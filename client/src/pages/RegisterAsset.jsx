import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, LoaderCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { registerAssetOnChain } from "../lib/wallet";
import FileDropzone from "../components/FileDropzone";

const AI_MODELS = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "Midjourney",
  "Flux",
  "Stable Diffusion",
  "Runway",
  "Other",
  "Human-created / Unknown",
];

const TEXT_TYPES = ["prompt", "article"];
const FILE_TYPES = ["image", "music", "video"];
const FILE_ACCEPT = {
  image: "image/jpeg,image/png,image/webp",
  music: "audio/mpeg,audio/wav",
  video: "video/mp4,video/webm,video/quicktime",
};

const STEPS = [
  "Preparing content",
  "Generating fingerprint",
  "Waiting for wallet confirmation",
  "Confirming on blockchain",
  "Comparing registered works",
  "Registration confirmed",
];

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/**
 * XHR-based multipart upload with real byte-level progress — fetch() cannot report
 * upload progress, which matters here since video files can be tens of MB.
 */
function uploadWithProgress(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);

    const token = localStorage.getItem("proofchain_token");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON response; data stays {}
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else
        reject(
          new Error(data.error || `Request failed with status ${xhr.status}`),
        );
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));

    xhr.send(formData);
  });
}

export default function RegisterAsset() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [contentType, setContentType] = useState("article");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState(null);
  const [aiModel, setAiModel] = useState("Human-created / Unknown");

  const [stepIndex, setStepIndex] = useState(-1);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState(null);
  const [registeredAsset, setRegisteredAsset] = useState(null);

  const isFileType = FILE_TYPES.includes(contentType);
  const isRunning = stepIndex >= 0 && stepIndex < STEPS.length - 1;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setRegisteredAsset(null);
    setUploadProgress(null);

    if (!user?.walletAddress) {
      setError(
        "Link a MetaMask wallet from the Dashboard before registering an asset.",
      );
      return;
    }
    if (isFileType && !file) {
      setError("Choose a file to upload.");
      return;
    }

    try {
      setStepIndex(0); // Preparing content
      let contentHash, assetId;
      if (isFileType) {
        const form = new FormData();
        form.append("contentType", contentType);
        form.append("file", file);
        setUploadProgress(0);
        const prep = await uploadWithProgress(
          "/assets/prepare-file",
          form,
          setUploadProgress,
        );
        setUploadProgress(null);
        contentHash = prep.contentHash;
        assetId = prep.assetId;
      } else {
        const prep = await api.prepareAsset(contentType, textContent);
        contentHash = prep.contentHash;
        assetId = prep.assetId;
      }

      setStepIndex(1); // Generating fingerprint (already done server-side; shown for UX clarity)

      setStepIndex(2); // Waiting for wallet confirmation
      const txHash = await registerAssetOnChain({
        assetId,
        contentHash,
        contentType,
        aiModel,
      });

      setStepIndex(3); // Registering on blockchain (mined by the time registerAssetOnChain resolves)

      setStepIndex(4); // Running originality analysis (happens server-side as part of this call)
      let asset;
      if (isFileType) {
        const form = new FormData();
        form.append("assetId", assetId);
        form.append("contentHash", contentHash);
        form.append("txHash", txHash);
        form.append("title", title);
        form.append("description", description);
        form.append("contentType", contentType);
        form.append("aiModel", aiModel);
        form.append("file", file);
        setUploadProgress(0);
        const res = await uploadWithProgress(
          "/assets/register-file",
          form,
          setUploadProgress,
        );
        setUploadProgress(null);
        asset = res.asset;
      } else {
        const res = await api.registerAsset({
          assetId,
          contentHash,
          txHash,
          title,
          description,
          contentType,
          textContent,
          aiModel,
        });
        asset = res.asset;
      }

      setStepIndex(5); // Complete
      setRegisteredAsset(asset);
    } catch (err) {
      setError(err.message);
      setStepIndex(-1);
      setUploadProgress(null);
    }
  }

  if (registeredAsset) {
    return (
      <motion.div
        className="page"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <span className="badge badge-verified">
          <CheckCircle2 size={13} strokeWidth={2} /> Registration confirmed
        </span>
        <h1>{registeredAsset.title}</h1>
        <p className="note">
          A timestamped ownership proof now exists on-chain for this asset.
        </p>
        <button onClick={() => navigate(`/assets/${registeredAsset.assetId}`)}>
          View proof
        </button>
      </motion.div>
    );
  }

  return (
    <div className="page">
      <h1>Register content</h1>
      <p className="note">
        Create a timestamped ownership proof for a Prompt, Article, Image,
        Music, or Video asset.
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
            disabled={isRunning}
          >
            <option value="prompt">Prompt</option>
            <option value="article">Article</option>
            <option value="image">Image</option>
            <option value="music">Music</option>
            <option value="video">Video</option>
          </select>
        </label>

        <label>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isRunning}
          />
        </label>

        <label>
          Description (optional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isRunning}
          />
        </label>

        {TEXT_TYPES.includes(contentType) && (
          <label>
            Content
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={8}
              required
              disabled={isRunning}
            />
          </label>
        )}

        {isFileType && (
          <label>
            File
            <FileDropzone
              contentType={contentType}
              accept={FILE_ACCEPT[contentType]}
              file={file}
              onChange={setFile}
              disabled={isRunning}
            />
          </label>
        )}

        <label>
          AI model used
          <select
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            disabled={isRunning}
          >
            {AI_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="error-text">
            <AlertTriangle
              size={15}
              strokeWidth={2}
              style={{ flexShrink: 0, marginTop: "2px" }}
            />
            <span>
              {error} Your blockchain registration was not affected if this
              happened after the wallet confirmation step — you can safely try
              again.
            </span>
          </p>
        )}

        <button type="submit" disabled={isRunning}>
          {isRunning && (
            <LoaderCircle
              className="loading-spinner"
              size={16}
              strokeWidth={2}
            />
          )}
          {isRunning ? "Registering..." : "Register content"}
        </button>
      </form>

      {stepIndex >= 0 && (
        <ol className="progress-steps" aria-live="polite">
          {STEPS.map((label, i) => (
            <li key={label} className={i <= stepIndex ? "done" : ""}>
              {label}
              {uploadProgress !== null &&
                (i === 0 || i === 4) &&
                i === stepIndex && (
                  <span className="upload-progress"> — {uploadProgress}%</span>
                )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
