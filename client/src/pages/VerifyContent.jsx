import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  ScanSearch,
  GitCompare,
  FlaskConical,
  LoaderCircle,
} from "lucide-react";
import { api } from "../lib/api";
import OwnerIdentity from "../components/OwnerIdentity";

const TEXT_TYPES = ["prompt", "article"];
const FILE_TYPES = ["image", "music", "video"];
const FILE_ACCEPT = {
  image: "image/jpeg,image/png,image/webp",
  music: "audio/mpeg,audio/wav",
  video: "video/mp4,video/webm,video/quicktime",
};

export default function VerifyContent() {
  const [contentType, setContentType] = useState("article");
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [similarity, setSimilarity] = useState(null);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [statusLabel, setStatusLabel] = useState(null);
  const [compareAsset, setCompareAsset] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [proofText, setProofText] = useState(
    "This is my original creative work for ProofChain verification.",
  );
  const [proofTxHash, setProofTxHash] = useState(
    "0x1234567890abcdef1234567890abcdef12345678",
  );
  const [embeddedProof, setEmbeddedProof] = useState("");
  const [proofStatus, setProofStatus] = useState(null);
  const [proofLoading, setProofLoading] = useState(false);

  async function handleCompare(matchedAssetId) {
    setComparing(true);
    try {
      const res = await api.getAsset(matchedAssetId);
      setCompareAsset(res.asset);
    } catch {
      // best-effort — comparison is a bonus view, not core to verification
    } finally {
      setComparing(false);
    }
  }

  async function handleEmbedProof() {
    setProofStatus(null);
    setProofLoading(true);
    try {
      const res = await api.embedHiddenProof(proofText, proofTxHash);
      setEmbeddedProof(res.embeddedText);
      setProofStatus({
        variant: "success",
        message:
          "Hidden tx hash embedded. The visible text still reads normally.",
      });
    } catch (err) {
      setProofStatus({
        variant: "error",
        message: err.message || "Could not embed the hidden proof.",
      });
    } finally {
      setProofLoading(false);
    }
  }

  async function handleExtractProof() {
    setProofStatus(null);
    setProofLoading(true);
    try {
      const res = await api.extractHiddenProof(embeddedProof || proofText);
      setProofTxHash(res.txHash);
      setProofStatus({
        variant: "success",
        message: `Recovered tx hash: ${res.txHash}`,
      });
    } catch (err) {
      setProofStatus({
        variant: "error",
        message: err.message || "No hidden proof was found in the text.",
      });
    } finally {
      setProofLoading(false);
    }
  }

  const isFileType = FILE_TYPES.includes(contentType);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSimilarity(null);
    setShowDiagnostics(false);

    if (isFileType && !file) {
      setError("Choose a file to check.");
      return;
    }

    setChecking(true);
    try {
      setStatusLabel("Checking for an exact fingerprint match");
      const exactRes = isFileType
        ? await api.verifyFileContent(file)
        : await api.verifyContent(textContent);
      setResult(exactRes);

      // Only run the (slower) similarity check when there's no exact match — an exact
      // fingerprint match and a semantic/visual similarity check answer different questions.
      if (!exactRes.exactMatch) {
        setStatusLabel("Comparing registered works");
        try {
          const simRes = isFileType
            ? await api.checkFileSimilarity(contentType, file)
            : await api.checkSimilarity(textContent, contentType);
          setSimilarity(simRes.analysis);
        } catch {
          // Similarity analysis is best-effort here too — an exact-match result
          // (or lack thereof) should never be hidden by a similarity-check failure.
        }
      }
    } catch (err) {
      setError(`We couldn't complete verification: ${err.message}`);
    } finally {
      setChecking(false);
      setStatusLabel(null);
    }
  }

  return (
    <div className="page">
      <h1>Verify content</h1>
      <p className="note">
        First checks for an exact fingerprint (SHA-256) match. If none is found,
        runs a similarity check against registered works of the same content
        type.
      </p>

      <form onSubmit={handleSubmit}>
        <label>
          Content type
          <select
            value={contentType}
            onChange={(e) => {
              setContentType(e.target.value);
              setFile(null);
            }}
          >
            <option value="prompt">Prompt</option>
            <option value="article">Article</option>
            <option value="image">Image</option>
            <option value="music">Music</option>
            <option value="video">Video</option>
          </select>
        </label>

        {TEXT_TYPES.includes(contentType) && (
          <label>
            Paste the content to check
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={8}
              required
            />
          </label>
        )}

        {isFileType && (
          <label>
            File
            <div className="upload-dropzone">
              <input
                type="file"
                accept={FILE_ACCEPT[contentType]}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
              {file && (
                <span className="note mono-text">
                  {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              )}
            </div>
          </label>
        )}

        {error && (
          <p className="error-text">
            <AlertTriangle size={15} strokeWidth={2} /> {error}
          </p>
        )}
        <button type="submit" disabled={checking}>
          {checking ? (
            <LoaderCircle
              className="loading-spinner"
              size={16}
              strokeWidth={2}
            />
          ) : (
            <ScanSearch size={16} strokeWidth={2} />
          )}
          {checking ? statusLabel || "Checking..." : "Verify content"}
        </button>
      </form>

      <div className="card" style={{ marginTop: "2rem" }}>
        <h2 style={{ marginTop: 0 }}>Hidden proof test</h2>
        <p className="note">
          This checks the screenshot requirement: normal text stays readable
          while a blockchain tx hash is embedded as zero-width Unicode and later
          recovered.
        </p>

        <label>
          Visible text
          <textarea
            value={proofText}
            onChange={(e) => setProofText(e.target.value)}
            rows={4}
          />
        </label>

        <label>
          Transaction hash to hide
          <input
            value={proofTxHash}
            onChange={(e) => setProofTxHash(e.target.value)}
          />
        </label>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleEmbedProof}
            disabled={proofLoading}
          >
            Embed hash
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExtractProof}
            disabled={proofLoading || !embeddedProof}
          >
            Extract hash
          </button>
        </div>

        {embeddedProof && (
          <div style={{ marginTop: "1rem" }}>
            <p className="note">Embedded text</p>
            <textarea value={embeddedProof} rows={4} readOnly />
          </div>
        )}

        {proofStatus && (
          <p
            className={
              proofStatus.variant === "error" ? "error-text" : "success-text"
            }
            style={{ marginTop: "1rem" }}
          >
            {proofStatus.message}
          </p>
        )}
      </div>

      {result && (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <span
            className={`badge ${result.exactMatch ? "badge-verified" : "badge-pending"}`}
          >
            {result.exactMatch ? (
              <ShieldCheck size={13} strokeWidth={2} />
            ) : (
              <ShieldX size={13} strokeWidth={2} />
            )}
            {result.exactMatch
              ? "Exact fingerprint match"
              : "No exact fingerprint match"}
          </span>
          <p style={{ marginTop: "0.75rem" }}>
            Fingerprint: <code>{result.contentHash}</code>
          </p>
          {result.exactMatch && (
            <>
              <p>
                Owner: <code>{result.asset.ownerWallet}</code>
              </p>
              <p>
                Registered:{" "}
                {new Date(result.asset.registeredAt).toLocaleDateString()}
              </p>
              <p>
                Blockchain status:{" "}
                <span
                  className={`badge ${result.onChain?.active ? "badge-verified" : "badge-error"}`}
                >
                  {result.onChain?.active ? (
                    <ShieldCheck size={13} strokeWidth={2} />
                  ) : (
                    <ShieldX size={13} strokeWidth={2} />
                  )}
                  {result.onChain?.active ? "Verified" : "Not found on-chain"}
                </span>
              </p>
              <Link to={`/assets/${result.asset.assetId}`}>
                View full proof
              </Link>
            </>
          )}
        </motion.div>
      )}

      {similarity && (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2>Originality report</h2>

          <div className="similarity-relationship">
            <div className="similarity-node">Submitted work</div>
            <div className="similarity-connector">
              <span className="similarity-percent">
                {(similarity.similarityScore * 100).toFixed(0)}%
              </span>
              <div className="similarity-line" />
              <span className="note">similarity</span>
            </div>
            <div className="similarity-node">
              {similarity.matchedAssets[0] ? (
                <Link to={`/assets/${similarity.matchedAssets[0].assetId}`}>
                  <strong>
                    {similarity.matchedAssets[0].assetId.slice(0, 10)}...
                  </strong>
                </Link>
              ) : (
                <span className="note">No registered match</span>
              )}
            </div>
          </div>

          <p className="note">Analysis method: {similarity.analysisMethod}</p>
          <p className="note">Confidence: {similarity.confidence}</p>

          {similarity.warning && (
            <>
              <span className="badge badge-derivative">
                <AlertTriangle size={13} strokeWidth={2} /> Possible derivative
                work
              </span>
              <p className="note" style={{ marginTop: "0.5rem" }}>
                The submitted content is closely similar to a registered work.
                This does not by itself establish legal infringement.
              </p>
            </>
          )}

          {similarity.matchedAssets[0] && (
            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: "0.75rem" }}
              onClick={() => handleCompare(similarity.matchedAssets[0].assetId)}
              disabled={comparing}
            >
              <GitCompare
                size={15}
                strokeWidth={2}
                style={{ marginRight: "0.4rem", verticalAlign: "-2px" }}
              />
              {comparing ? "Loading..." : "Compare with matched asset"}
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: "0.75rem" }}
            onClick={() => setShowDiagnostics((visible) => !visible)}
          >
            <FlaskConical
              size={15}
              strokeWidth={2}
              style={{ marginRight: "0.4rem", verticalAlign: "-2px" }}
            />
            {showDiagnostics ? "Hide full diagnostic" : "Show full diagnostic"}
          </button>

          {showDiagnostics && (
            <div className="note" style={{ marginTop: "1rem" }}>
              <p>
                <strong>What this proves:</strong> Exact matching checks whether
                identical content was registered before. Similarity analysis
                measures closeness to registered works using the stated method.
              </p>
              <p>
                <strong>What this does not prove:</strong> A similarity result
                is not a legal determination of copyright infringement, intent
                to copy, or definitive originality.
              </p>
            </div>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {compareAsset && (
          <motion.div
            className="card"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <h2>Comparison</h2>
            <div className="compare-grid">
              <div>
                <p className="certificate-label">Submitted content</p>
                <p>
                  {isFileType
                    ? file?.name
                    : `${textContent.slice(0, 60)}${textContent.length > 60 ? "..." : ""}`}
                </p>
                <p className="note">Not yet registered</p>
              </div>
              <div>
                <p className="certificate-label">{compareAsset.title}</p>
                <OwnerIdentity wallet={compareAsset.ownerWallet} size="small" />
                <p className="note">
                  Registered{" "}
                  {new Date(compareAsset.registeredAt).toLocaleDateString()}
                </p>
                <p className="note">AI model: {compareAsset.aiModel}</p>
                {compareAsset.evidenceScore !== null &&
                  compareAsset.evidenceScore !== undefined && (
                    <p className="note">
                      Evidence score: {compareAsset.evidenceScore}/100
                    </p>
                  )}
                <Link to={`/assets/${compareAsset.assetId}`}>
                  View full proof
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
