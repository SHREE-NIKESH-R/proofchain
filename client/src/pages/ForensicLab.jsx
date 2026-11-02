import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Microscope, ShieldCheck, ShieldX, AlertTriangle, FlaskConical } from "lucide-react";
import { api } from "../lib/api";

const TEXT_TYPES = ["prompt", "article"];
const FILE_TYPES = ["image", "music", "video"];
const FILE_ACCEPT = { image: "image/jpeg,image/png,image/webp", music: "audio/mpeg,audio/wav", video: "video/mp4,video/webm,video/quicktime" };

/**
 * A deeper diagnostic view than the Verify page: runs every available signal (exact
 * fingerprint match + similarity analysis) and presents it as a lab report, explicit
 * about what each signal proves and — just as importantly — what it does not prove.
 */
export default function ForensicLab() {
  const [contentType, setContentType] = useState("article");
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(null);

  const isFileType = FILE_TYPES.includes(contentType);

  async function runDiagnostics(e) {
    e.preventDefault();
    setError(null);
    setReport(null);
    if (isFileType && !file) {
      setError("Choose a file to analyze.");
      return;
    }
    setRunning(true);
    try {
      setStage("Computing cryptographic fingerprint");
      const exact = isFileType ? await api.verifyFileContent(file) : await api.verifyContent(textContent);

      let similarity = null;
      if (!exact.exactMatch) {
        setStage("Running originality analysis");
        try {
          similarity = isFileType
            ? (await api.checkFileSimilarity(contentType, file)).analysis
            : (await api.checkSimilarity(textContent, contentType)).analysis;
        } catch {
          // best-effort, as elsewhere
        }
      }
      setReport({ exact, similarity });
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
      setStage(null);
    }
  }

  return (
    <div className="page">
      <h1><Microscope size={22} strokeWidth={2} style={{ marginRight: "0.5rem", verticalAlign: "-4px" }} />Forensic lab</h1>
      <p className="note">
        Runs every available technical signal against a piece of content and reports exactly
        what each one does and doesn't establish. For a quick check, use Verify Content instead.
      </p>

      <form onSubmit={runDiagnostics}>
        <label>
          Content type
          <select value={contentType} onChange={(e) => { setContentType(e.target.value); setFile(null); }}>
            <option value="prompt">Prompt</option>
            <option value="article">Article</option>
            <option value="image">Image</option>
            <option value="music">Music</option>
            <option value="video">Video</option>
          </select>
        </label>
        {TEXT_TYPES.includes(contentType) ? (
          <label>
            Content
            <textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} rows={7} required />
          </label>
        ) : (
          <label>
            File
            <div className="upload-dropzone">
              <input type="file" accept={FILE_ACCEPT[contentType]} onChange={(e) => setFile(e.target.files?.[0] || null)} required />
              {file && <span className="note mono-text">{file.name}</span>}
            </div>
          </label>
        )}
        {error && <p className="error-text"><AlertTriangle size={15} strokeWidth={2} /> {error}</p>}
        <button type="submit" disabled={running}>
          <FlaskConical size={16} strokeWidth={2} style={{ marginRight: "0.4rem", verticalAlign: "-3px" }} />
          {running ? stage || "Running..." : "Run diagnostics"}
        </button>
      </form>

      {report && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="card lab-signal">
            <div className="lab-signal-header">
              {report.exact.exactMatch ? <ShieldCheck size={18} strokeWidth={2} className="lab-icon-pass" /> : <ShieldX size={18} strokeWidth={2} className="lab-icon-neutral" />}
              <h2>Signal 1 — Exact fingerprint match</h2>
            </div>
            <p><strong>Result:</strong> {report.exact.exactMatch ? "Match found" : "No match"}</p>
            <p className="note"><strong>What this proves:</strong> Whether byte-for-byte identical content has been registered before.</p>
            <p className="note"><strong>What this does not prove:</strong> Anything about content that has been modified, resized, or paraphrased — even slightly — from a registered original.</p>
            {report.exact.exactMatch && (
              <Link to={`/assets/${report.exact.asset.assetId}`}>View the matched registration</Link>
            )}
          </div>

          {report.similarity && (
            <div className="card lab-signal">
              <div className="lab-signal-header">
                {report.similarity.warning ? <AlertTriangle size={18} strokeWidth={2} className="lab-icon-warn" /> : <ShieldCheck size={18} strokeWidth={2} className="lab-icon-pass" />}
                <h2>Signal 2 — Originality analysis</h2>
              </div>
              <p><strong>Similarity score:</strong> {(report.similarity.similarityScore * 100).toFixed(1)}%</p>
              <p><strong>Method:</strong> {report.similarity.analysisMethod}</p>
              <p><strong>Confidence:</strong> {report.similarity.confidence} (reflects how much registered content existed to compare against)</p>
              <p className="note"><strong>What this proves:</strong> How close this content is, by this specific method, to the nearest registered work.</p>
              <p className="note"><strong>What this does not prove:</strong> Legal copyright infringement, intent to copy, or definitive originality — this is one technical indicator among several.</p>
              {report.similarity.warning && (
                <span className="badge badge-derivative"><AlertTriangle size={13} strokeWidth={2} /> Possible derivative work</span>
              )}
            </div>
          )}

          <p className="note" style={{ textAlign: "center" }}>
            End of report. No signal here is a legal determination of ownership or infringement.
          </p>
        </motion.div>
      )}
    </div>
  );
}
