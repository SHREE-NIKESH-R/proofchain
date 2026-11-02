const Asset = require("../models/Asset");
const OwnershipHistory = require("../models/OwnershipHistory");
const User = require("../models/User");
const { sha256Text, sha256Buffer } = require("../utils/hash");
const { deriveAssetId } = require("../utils/assetId");
const blockchainService = require("../services/blockchainService");
const aiService = require("../services/aiService");
const storageService =
  process.env.STORAGE_PROVIDER === "cloudinary"
    ? require("../services/cloudinaryStorageService")
    : require("../services/storageService");
const { computeEvidenceScore } = require("../services/evidenceScoreService");
const {
  resolveDisplayName,
  resolveDisplayNames,
} = require("../services/profileService");
const { LIMITS } = require("../middleware/upload");

const TEXT_CONTENT_TYPES = ["prompt", "article"];
const FILE_CONTENT_TYPES = ["image", "music", "video"];

/** Best-effort on-chain ownership history length; null if unreadable (chain unreachable, etc.). */
async function getOnChainHistoryCount(assetId) {
  try {
    const history =
      await blockchainService.readOwnershipHistoryOnChain(assetId);
    return history.length;
  } catch {
    return null;
  }
}

/**
 * Step 1 of registration: given text content, compute the SHA-256 hash and a
 * deterministic-enough assetId, and hand both back to the client. The client
 * then submits the on-chain registerAsset() transaction via MetaMask using
 * these exact values, so what's on-chain and what we later store match.
 *
 * Phase 1 supports Prompt/Article (text) only — image/music/video are Phase 2.
 */
async function prepareRegistration(req, res, next) {
  try {
    const { contentType, textContent } = req.body;

    if (!TEXT_CONTENT_TYPES.includes(contentType)) {
      return res.status(400).json({
        error: `Phase 1 only supports contentType "prompt" or "article". Got "${contentType}".`,
      });
    }
    if (
      !textContent ||
      typeof textContent !== "string" ||
      textContent.trim().length === 0
    ) {
      return res.status(400).json({ error: "textContent is required" });
    }

    const contentHash = sha256Text(textContent);
    const assetId = deriveAssetId(contentHash);

    res.json({ contentHash, assetId });
  } catch (err) {
    next(err);
  }
}

/**
 * File-based equivalent of prepareRegistration, for Image/Music/Video. Computes the
 * SHA-256 hash from the uploaded file's bytes (not re-encoded/re-processed — the exact
 * bytes as uploaded, matching what the blockchain will ultimately attest to).
 */
async function prepareFileRegistration(req, res, next) {
  try {
    const { contentType } = req.body;
    if (!FILE_CONTENT_TYPES.includes(contentType)) {
      return res.status(400).json({
        error: `contentType must be one of: ${FILE_CONTENT_TYPES.join(", ")}. Got "${contentType}".`,
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: "A file is required" });
    }

    const limits = LIMITS[contentType];
    const validation = storageService.validate(req.file, limits);
    if (!validation.valid) {
      return res.status(415).json({ error: validation.reason });
    }

    const contentHash = sha256Buffer(req.file.buffer);
    const assetId = deriveAssetId(contentHash);

    res.json({ contentHash, assetId });
  } catch (err) {
    next(err);
  }
}

/**
 * Step 2: after the client has confirmed the on-chain transaction, it posts the
 * result here. We independently re-read the chain (never trust the client blindly)
 * before persisting metadata to MongoDB.
 */
async function registerAsset(req, res, next) {
  try {
    const {
      assetId,
      contentHash,
      txHash,
      title,
      description,
      contentType,
      textContent,
      aiModel,
    } = req.body;

    if (!assetId || !contentHash || !txHash || !title || !contentType) {
      return res.status(400).json({
        error:
          "assetId, contentHash, txHash, title, and contentType are required",
      });
    }

    const user = await User.findById(req.userId);
    if (!user || !user.walletAddress) {
      return res
        .status(400)
        .json({ error: "Link a wallet before registering an asset" });
    }

    const alreadyStored = await Asset.findOne({ assetId });
    if (alreadyStored) {
      return res
        .status(409)
        .json({ error: "This asset has already been registered" });
    }

    const { confirmed, reason } =
      await blockchainService.confirmTransaction(txHash);
    if (!confirmed) {
      return res
        .status(422)
        .json({ error: `Transaction not confirmed: ${reason}` });
    }

    const onChainAsset = await blockchainService.readAssetOnChain(assetId);
    if (!onChainAsset) {
      return res
        .status(422)
        .json({
          error:
            "Asset not found on-chain. Registration transaction may have failed.",
        });
    }
    if (onChainAsset.contentHash.toLowerCase() !== contentHash.toLowerCase()) {
      return res
        .status(422)
        .json({ error: "contentHash does not match the on-chain record" });
    }
    if (onChainAsset.owner.toLowerCase() !== user.walletAddress.toLowerCase()) {
      return res
        .status(422)
        .json({ error: "On-chain owner does not match your linked wallet" });
    }

    const asset = await Asset.create({
      assetId,
      userId: user._id,
      title,
      description: description || "",
      contentType,
      textContent: TEXT_CONTENT_TYPES.includes(contentType)
        ? textContent
        : null,
      contentHash,
      ownerWallet: user.walletAddress,
      blockchainTxHash: txHash,
      registeredAt: new Date(onChainAsset.timestamp * 1000),
      aiModel: aiModel || "Human-created / Unknown",
    });

    // Originality analysis is best-effort: a slow/unavailable AI service should never
    // block a blockchain-confirmed registration from succeeding. If it fails, the asset
    // is still safely registered and can be (re-)analyzed later.
    if (TEXT_CONTENT_TYPES.includes(contentType)) {
      try {
        const analysis = await aiService.analyzeText(
          assetId,
          textContent,
          contentType,
        );
        asset.originalityAnalysis = analysis;
      } catch (err) {
        console.error(
          `[originality] Analysis failed for asset ${assetId}:`,
          err.message,
        );
      }
    }

    // Evidence score is computed from whatever data is actually available right now
    // (analysis may or may not have succeeded above) — see evidenceScoreService.js for
    // why a missing factor is excluded/reweighted rather than treated as a penalty.
    const onChainHistoryCount = await getOnChainHistoryCount(assetId);
    const evidenceResult = computeEvidenceScore({
      asset,
      onChainAsset,
      ownershipHistoryCount: 0, // just registered, no transfers yet
      onChainOwnershipHistoryCount: onChainHistoryCount,
      originalityAnalysis: asset.originalityAnalysis,
    });
    asset.evidenceScore = evidenceResult.score;
    asset.evidenceScoreBreakdown = evidenceResult;
    await asset.save();

    res.status(201).json({ asset });
  } catch (err) {
    next(err);
  }
}

/**
 * File-based equivalent of registerAsset, for Image/Music/Video. Same trust model as
 * the text flow: independently re-reads the chain before persisting, never trusts the
 * client's claimed hash/owner blindly. The uploaded file is stored via storageService
 * (never the raw bytes in MongoDB — spec Section 12) and its bytes are also handed to
 * the AI service for originality analysis.
 */
async function registerFileAsset(req, res, next) {
  try {
    const {
      assetId,
      contentHash,
      txHash,
      title,
      description,
      contentType,
      aiModel,
    } = req.body;

    if (!FILE_CONTENT_TYPES.includes(contentType)) {
      return res
        .status(400)
        .json({
          error: `contentType must be one of: ${FILE_CONTENT_TYPES.join(", ")}`,
        });
    }
    if (!assetId || !contentHash || !txHash || !title || !req.file) {
      return res
        .status(400)
        .json({
          error: "assetId, contentHash, txHash, title, and a file are required",
        });
    }

    const limits = LIMITS[contentType];
    const validation = storageService.validate(req.file, limits);
    if (!validation.valid) {
      return res.status(415).json({ error: validation.reason });
    }

    // Recompute the hash from the actual uploaded bytes rather than trusting the
    // client's claimed contentHash — mirrors the on-chain cross-check below.
    const actualHash = sha256Buffer(req.file.buffer);
    if (actualHash.toLowerCase() !== contentHash.toLowerCase()) {
      return res
        .status(422)
        .json({
          error: "Uploaded file does not match the claimed content hash",
        });
    }

    const user = await User.findById(req.userId);
    if (!user || !user.walletAddress) {
      return res
        .status(400)
        .json({ error: "Link a wallet before registering an asset" });
    }

    const alreadyStored = await Asset.findOne({ assetId });
    if (alreadyStored) {
      return res
        .status(409)
        .json({ error: "This asset has already been registered" });
    }

    const { confirmed, reason } =
      await blockchainService.confirmTransaction(txHash);
    if (!confirmed) {
      return res
        .status(422)
        .json({ error: `Transaction not confirmed: ${reason}` });
    }

    const onChainAsset = await blockchainService.readAssetOnChain(assetId);
    if (!onChainAsset) {
      return res
        .status(422)
        .json({
          error:
            "Asset not found on-chain. Registration transaction may have failed.",
        });
    }
    if (onChainAsset.contentHash.toLowerCase() !== contentHash.toLowerCase()) {
      return res
        .status(422)
        .json({ error: "contentHash does not match the on-chain record" });
    }
    if (onChainAsset.owner.toLowerCase() !== user.walletAddress.toLowerCase()) {
      return res
        .status(422)
        .json({ error: "On-chain owner does not match your linked wallet" });
    }

    const stored = await storageService.upload(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
    );

    const asset = await Asset.create({
      assetId,
      userId: user._id,
      title,
      description: description || "",
      contentType,
      textContent: null,
      fileUrl: stored.url,
      contentHash,
      ownerWallet: user.walletAddress,
      blockchainTxHash: txHash,
      registeredAt: new Date(onChainAsset.timestamp * 1000),
      aiModel: aiModel || "Human-created / Unknown",
    });

    // Best-effort, same reasoning as the text flow: a slow/unavailable AI service
    // should never block a blockchain-confirmed registration from succeeding.
    try {
      let analysis;
      if (contentType === "image") {
        analysis = await aiService.analyzeImage(
          assetId,
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
        );
      } else if (contentType === "music") {
        analysis = await aiService.analyzeAudio(
          assetId,
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
        );
      } else if (contentType === "video") {
        analysis = await aiService.analyzeVideo(
          assetId,
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
        );
      }
      asset.originalityAnalysis = analysis;
    } catch (err) {
      console.error(
        `[originality] Analysis failed for asset ${assetId}:`,
        err.message,
      );
    }

    const onChainHistoryCount = await getOnChainHistoryCount(assetId);
    const evidenceResult = computeEvidenceScore({
      asset,
      onChainAsset,
      ownershipHistoryCount: 0,
      onChainOwnershipHistoryCount: onChainHistoryCount,
      originalityAnalysis: asset.originalityAnalysis,
    });
    asset.evidenceScore = evidenceResult.score;
    asset.evidenceScoreBreakdown = evidenceResult;
    await asset.save();

    res.status(201).json({ asset });
  } catch (err) {
    next(err);
  }
}

/** Public verification: given content (or a hash), check for an exact on-chain match. */
async function verifyContent(req, res, next) {
  try {
    const { textContent, contentHash: providedHash } = req.body;

    const contentHash =
      providedHash || (textContent ? sha256Text(textContent) : null);
    if (!contentHash) {
      return res
        .status(400)
        .json({ error: "Provide either textContent or contentHash" });
    }

    const asset = await Asset.findOne({ contentHash });
    if (!asset) {
      return res.json({ exactMatch: false, contentHash });
    }

    const onChainAsset = await blockchainService.readAssetOnChain(
      asset.assetId,
    );
    const creator = await resolveDisplayName(asset.ownerWallet);
    res.json({
      exactMatch: true,
      contentHash,
      asset,
      onChain: onChainAsset,
      creator,
    });
  } catch (err) {
    next(err);
  }
}

/** File-based equivalent of verifyContent, for Image/Music/Video uploaded on the Verify page. */
async function verifyFileContent(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "A file is required" });
    }

    const contentHash = sha256Buffer(req.file.buffer);
    const asset = await Asset.findOne({ contentHash });
    if (!asset) {
      return res.json({ exactMatch: false, contentHash });
    }

    const onChainAsset = await blockchainService.readAssetOnChain(
      asset.assetId,
    );
    const creator = await resolveDisplayName(asset.ownerWallet);
    res.json({
      exactMatch: true,
      contentHash,
      asset,
      onChain: onChainAsset,
      creator,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Similarity-based verification: for content with no exact hash match, runs it through
 * the originality engine to check for near-duplicates. Kept as a separate endpoint from
 * verifyContent() so the fast exact-match path never waits on the AI service.
 */
async function checkSimilarity(req, res, next) {
  try {
    const { textContent, contentType } = req.body;
    if (!textContent || !TEXT_CONTENT_TYPES.includes(contentType)) {
      return res.status(400).json({
        error:
          'textContent and contentType ("prompt" or "article") are required',
      });
    }

    // Use a throwaway assetId so this ad-hoc check never gets stored as a real asset —
    // belt-and-suspenders alongside persist=false, in case persist is ever dropped.
    const probeId = `probe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const analysis = await aiService.analyzeText(
      probeId,
      textContent,
      contentType,
      /* persist */ false,
    );

    res.json({ analysis });
  } catch (err) {
    next(err);
  }
}

/**
 * File-based equivalent of checkSimilarity, for Image/Music/Video uploaded on the Verify
 * page. Uses in-memory multer bytes directly — never touches storageService, since a
 * verification probe should never be persisted as a registered asset's file.
 */
async function checkFileSimilarity(req, res, next) {
  try {
    const { contentType } = req.body;
    if (!FILE_CONTENT_TYPES.includes(contentType)) {
      return res
        .status(400)
        .json({
          error: `contentType must be one of: ${FILE_CONTENT_TYPES.join(", ")}`,
        });
    }
    if (!req.file) {
      return res.status(400).json({ error: "A file is required" });
    }

    const limits = LIMITS[contentType];
    const validation = storageService.validate(req.file, limits);
    if (!validation.valid) {
      return res.status(415).json({ error: validation.reason });
    }

    const probeId = `probe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let analysis;
    if (contentType === "image") {
      analysis = await aiService.analyzeImage(
        probeId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        /* persist */ false,
      );
    } else if (contentType === "music") {
      analysis = await aiService.analyzeAudio(
        probeId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        /* persist */ false,
      );
    } else {
      analysis = await aiService.analyzeVideo(
        probeId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        /* persist */ false,
      );
    }

    res.json({ analysis });
  } catch (err) {
    next(err);
  }
}

/** Records an ownership transfer that has already happened on-chain (client-signed). */
async function recordTransfer(req, res, next) {
  try {
    const { assetId } = req.params;
    const { toWallet, txHash } = req.body;

    if (!toWallet || !txHash) {
      return res
        .status(400)
        .json({ error: "toWallet and txHash are required" });
    }

    const asset = await Asset.findOne({ assetId });
    if (!asset) return res.status(404).json({ error: "Asset not found" });

    const { confirmed, reason } =
      await blockchainService.confirmTransaction(txHash);
    if (!confirmed) {
      return res
        .status(422)
        .json({ error: `Transaction not confirmed: ${reason}` });
    }

    const onChainAsset = await blockchainService.readAssetOnChain(assetId);
    if (onChainAsset.owner.toLowerCase() !== toWallet.toLowerCase()) {
      return res
        .status(422)
        .json({ error: "On-chain owner does not match the claimed recipient" });
    }

    const fromWallet = asset.ownerWallet;
    asset.ownerWallet = toWallet.toLowerCase();
    asset.status = "transferred";

    await OwnershipHistory.create({
      assetId,
      fromWallet,
      toWallet: toWallet.toLowerCase(),
      txHash,
      timestamp: new Date(),
    });

    const historyCount = await OwnershipHistory.countDocuments({ assetId });
    const onChainHistoryCount = await getOnChainHistoryCount(assetId);
    const evidenceResult = computeEvidenceScore({
      asset,
      onChainAsset,
      ownershipHistoryCount: historyCount,
      onChainOwnershipHistoryCount: onChainHistoryCount,
      originalityAnalysis: asset.originalityAnalysis,
    });
    asset.evidenceScore = evidenceResult.score;
    asset.evidenceScoreBreakdown = evidenceResult;
    await asset.save();

    res.json({ asset });
  } catch (err) {
    next(err);
  }
}

async function listMyAssets(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    const ownerFilter = user?.walletAddress
      ? [{ ownerWallet: user.walletAddress.toLowerCase() }]
      : [];
    const assets = await Asset.find({
      $or: [{ userId: req.userId }, ...ownerFilter],
    }).sort({ createdAt: -1 });
    res.json({ assets });
  } catch (err) {
    next(err);
  }
}

async function getAssetById(req, res, next) {
  try {
    const asset = await Asset.findOne({ assetId: req.params.assetId });
    if (!asset) return res.status(404).json({ error: "Asset not found" });

    const onChainAsset = await blockchainService.readAssetOnChain(
      asset.assetId,
    );
    const history = await OwnershipHistory.find({
      assetId: asset.assetId,
    }).sort({ timestamp: 1 });

    // Recomputed fresh on every read, not just served from the last-stored snapshot —
    // the score must reflect the current on-chain state (spec: "calculated dynamically").
    const onChainHistoryCount = await getOnChainHistoryCount(asset.assetId);
    const evidenceScore = computeEvidenceScore({
      asset,
      onChainAsset,
      ownershipHistoryCount: history.length,
      onChainOwnershipHistoryCount: onChainHistoryCount,
      originalityAnalysis: asset.originalityAnalysis,
    });

    const creator = await resolveDisplayName(asset.ownerWallet);
    const historyWallets = history.flatMap((h) => [h.fromWallet, h.toWallet]);
    const historyNames = await resolveDisplayNames(historyWallets);

    res.json({
      asset,
      onChain: onChainAsset,
      history,
      evidenceScore,
      creator,
      historyNames,
    });
  } catch (err) {
    next(err);
  }
}

/** Public explorer lookup — no auth required, no private user info exposed. */
async function publicVerify(req, res, next) {
  try {
    const asset = await Asset.findOne({ assetId: req.params.assetId }).select(
      "assetId title contentType fileUrl contentHash ownerWallet blockchainTxHash registeredAt aiModel status originalityAnalysis version",
    );
    if (!asset) return res.status(404).json({ error: "Asset not found" });

    const onChainAsset = await blockchainService.readAssetOnChain(
      asset.assetId,
    );
    const history = await OwnershipHistory.find({
      assetId: asset.assetId,
    }).sort({ timestamp: 1 });
    const onChainHistoryCount = await getOnChainHistoryCount(asset.assetId);

    // Recomputed fresh, same as the owner-facing detail page — a QR code or shared link
    // may be viewed long after registration, and ownership can change in the meantime.
    const evidenceScore = computeEvidenceScore({
      asset,
      onChainAsset,
      ownershipHistoryCount: history.length,
      onChainOwnershipHistoryCount: onChainHistoryCount,
      originalityAnalysis: asset.originalityAnalysis,
    });

    const creator = await resolveDisplayName(asset.ownerWallet);
    res.json({
      asset,
      onChain: onChainAsset,
      evidenceScore,
      creator,
      transferCount: history.length,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Public Explorer search — no auth required. Accepts assetId, contentHash, wallet
 * address, or blockchainTxHash and finds matching asset(s) by whichever field it looks
 * like. Only public-safe fields are ever returned (same projection as publicVerify).
 * Returns an array since a wallet-address search can legitimately match multiple assets.
 */
async function publicSearch(req, res, next) {
  try {
    const { query } = req.query;
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return res
        .status(400)
        .json({
          error:
            "Provide a query: asset ID, content hash, wallet address, or transaction hash",
        });
    }

    const trimmed = query.trim();
    const lower = trimmed.toLowerCase();
    const projection =
      "assetId title contentType contentHash ownerWallet blockchainTxHash registeredAt aiModel status evidenceScore";

    const assets = await Asset.find({
      $or: [
        { assetId: trimmed },
        { contentHash: lower },
        { ownerWallet: lower },
        { blockchainTxHash: lower },
      ],
    })
      .select(projection)
      .limit(25);

    if (assets.length === 0) {
      return res.json({ found: false, assets: [] });
    }

    const names = await resolveDisplayNames(assets.map((a) => a.ownerWallet));
    const assetsWithNames = assets.map((a) => ({
      ...a.toObject(),
      creatorName: names[a.ownerWallet] || null,
    }));

    res.json({ found: true, assets: assetsWithNames });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  prepareRegistration,
  prepareFileRegistration,
  registerAsset,
  registerFileAsset,
  verifyContent,
  verifyFileContent,
  checkSimilarity,
  checkFileSimilarity,
  recordTransfer,
  listMyAssets,
  getAssetById,
  publicVerify,
  publicSearch,
};
