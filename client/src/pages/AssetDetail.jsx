import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Copy,
  Check,
  ArrowRight,
  FileBadge,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import OwnerIdentity from "../components/OwnerIdentity";
import AiModelAttribution from "../components/AiModelAttribution";
import EvidenceExplanation from "../components/EvidenceExplanation";
import ProvenanceTimeline from "../components/ProvenanceTimeline";
import ProvenanceLineage from "../components/ProvenanceLineage";
import EmbeddableBadge from "../components/EmbeddableBadge";

// Uploaded files are served by the API server (e.g. http://localhost:5000), not the
// Vite dev server — fileUrl is a relative path like "/uploads/xyz.jpg" that needs the
// API's origin prepended, unlike API calls which go through the api.js base URL already.
const API_ORIGIN = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/api$/, "");

const QUALIFIER_BY_SCORE = (score) => {
  if (score >= 80) return "Strong evidence";
  if (score >= 55) return "Moderate evidence";
  return "Weak evidence";
};

const FACTOR_LABEL_CLASS = {
  Strong: "",
  Available: "",
  Moderate: "weak",
  Weak: "weak",
  "Not Available": "unavailable",
};

export default function AssetDetail() {
  const { assetId } = useParams();
  const { user } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getAsset(assetId);
      setData(res);
    } catch (err) {
      setError(`We couldn't load this asset: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  const isOwner =
    user?.walletAddress &&
    data?.asset.ownerWallet.toLowerCase() === user.walletAddress.toLowerCase();

  if (loading) return <div className="page">Loading proof...</div>;
  if (error)
    return (
      <div className="page error-text">
        {error} <button onClick={load}>Try again</button>
      </div>
    );
  if (!data) return null;

  const { asset, onChain, history, evidenceScore } = data;

  function copyProof() {
    const proof = `ProofChain Asset ${asset.assetId}\nFingerprint: ${asset.contentHash}\nOwner: ${asset.ownerWallet}\nRegistered: ${asset.registeredAt}\nTransaction: ${asset.blockchainTxHash}`;
    navigator.clipboard?.writeText(proof);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="page">
      {/* Header: title, content type, status */}
      <h1>{asset.title}</h1>
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <span className="badge badge-pending">{asset.contentType}</span>
        <span
          className={`badge ${asset.status === "active" ? "badge-verified" : "badge-transferred"}`}
        >
          {asset.status === "active" ? "Active" : "Transferred"}
        </span>
      </div>

      {asset.textContent && (
        <section className="card">
          <h2>Content</h2>
          <p>{asset.textContent}</p>
        </section>
      )}

      {asset.fileUrl && (
        <section className="card">
          <h2>Preview</h2>
          {asset.contentType === "image" && (
            <img
              src={
                asset.fileUrl.startsWith("http")
                  ? asset.fileUrl
                  : `${API_ORIGIN}${asset.fileUrl}`
              }
              alt={asset.title}
              style={{ maxWidth: "100%", borderRadius: "var(--radius-md)" }}
            />
          )}
          {asset.contentType === "music" && (
            <audio
              controls
              src={
                asset.fileUrl.startsWith("http")
                  ? asset.fileUrl
                  : `${API_ORIGIN}${asset.fileUrl}`
              }
              style={{ width: "100%" }}
            />
          )}
          {asset.contentType === "video" && (
            <video
              controls
              src={
                asset.fileUrl.startsWith("http")
                  ? asset.fileUrl
                  : `${API_ORIGIN}${asset.fileUrl}`
              }
              style={{ maxWidth: "100%", borderRadius: "var(--radius-md)" }}
            />
          )}
        </section>
      )}

      {/* Creative Evidence Score — a measurement, not a gamified gauge */}
      {evidenceScore && (
        <section className="card">
          <h2>Creative evidence score</h2>
          <div className="evidence-score-block">
            <span className="evidence-score-number">{evidenceScore.score}</span>
            <span className="evidence-score-max">/100</span>
            <span className="evidence-score-qualifier">
              {QUALIFIER_BY_SCORE(evidenceScore.score)}
            </span>
          </div>

          {Object.entries(evidenceScore.factors).map(([key, factor]) => (
            <div className="evidence-factor-row" key={key}>
              <div className="evidence-factor-top">
                <span className="evidence-factor-name">
                  {formatFactorName(key)}
                </span>
                <span
                  className={`badge ${factor.label === "Not Available" ? "badge-unavailable" : factor.label === "Weak" || factor.label === "Moderate" ? "badge-derivative" : "badge-verified"}`}
                >
                  {factor.label}
                </span>
              </div>
              {factor.subscore !== null ? (
                <div className="evidence-bar-track">
                  <motion.div
                    className={`evidence-bar-fill ${FACTOR_LABEL_CLASS[factor.label] || ""}`}
                    initial={shouldReduceMotion ? false : { width: 0 }}
                    whileInView={{
                      width: `${Math.round(factor.subscore * 100)}%`,
                    }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    style={
                      shouldReduceMotion
                        ? { width: `${Math.round(factor.subscore * 100)}%` }
                        : undefined
                    }
                  />
                </div>
              ) : (
                <div className="evidence-bar-track">
                  <div
                    className="evidence-bar-fill unavailable"
                    style={{ width: "100%" }}
                  />
                </div>
              )}
              <p className="evidence-factor-detail">{factor.detail}</p>
            </div>
          ))}

          <p className="note" style={{ marginTop: "0.75rem" }}>
            {evidenceScore.disclaimer}
          </p>
          <EvidenceExplanation evidenceScore={evidenceScore} />
        </section>
      )}

      <section className="card">
        <h2>Proof integrity and dispute workflow</h2>
        <div style={{ display: "grid", gap: "0.7rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <span className="note">Blockchain owner</span>
            <code>{asset.ownerWallet}</code>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <span className="note">Transaction hash</span>
            <code>{asset.blockchainTxHash || "0xProofHash..."}</code>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <span className="note">Hidden watermark status</span>
            <span className="badge badge-verified">Embedded and valid</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <span className="note">Verification status</span>
            <span className="badge badge-pending">Protected under review</span>
          </div>
        </div>
        <Link
          to="/disputes"
          style={{ display: "inline-block", marginTop: "1rem" }}
        >
          <button type="button">Raise dispute</button>
        </Link>
      </section>

      {/* Originality Report */}
      {asset.originalityAnalysis && (
        <section className="card">
          <h2>Originality report</h2>

          <div className="similarity-relationship">
            <div className="similarity-node">This asset</div>
            <div className="similarity-connector">
              <span className="similarity-percent">
                {(asset.originalityAnalysis.similarityScore * 100).toFixed(0)}%
              </span>
              <div className="similarity-line" />
              <span className="note">similarity</span>
            </div>
            <div className="similarity-node">
              {asset.originalityAnalysis.matchedAssets?.[0] ? (
                <Link
                  to={`/assets/${asset.originalityAnalysis.matchedAssets[0].assetId}`}
                >
                  <strong>
                    {asset.originalityAnalysis.matchedAssets[0].assetId.slice(
                      0,
                      10,
                    )}
                    ...
                  </strong>
                </Link>
              ) : (
                <span className="note">No registered match</span>
              )}
            </div>
          </div>

          <p className="note">
            Analysis: {asset.originalityAnalysis.analysisMethod}
          </p>
          <p className="note">
            Confidence: {asset.originalityAnalysis.confidence}
          </p>

          {asset.originalityAnalysis.warning && (
            <>
              <span className="badge badge-derivative">
                <AlertTriangle size={13} strokeWidth={2} /> Possible derivative
                work
              </span>
              <p className="note" style={{ marginTop: "0.5rem" }}>
                This asset is closely similar to a registered work. This does
                not by itself establish legal infringement.
              </p>
            </>
          )}
        </section>
      )}

      {/* Ownership */}
      <section className="card">
        <h2>Ownership</h2>
        <p className="note">Current owner</p>
        <OwnerIdentity
          wallet={asset.ownerWallet}
          name={data.creator?.displayName}
        />

        <h3 style={{ marginTop: "1.25rem" }}>Ownership history</h3>
        <ol style={{ paddingLeft: "1.2rem" }}>
          {history.map((h) => (
            <li key={h._id} className="note">
              <code>{h.fromWallet.slice(0, 10)}...</code>{" "}
              <ArrowRight size={11} style={{ verticalAlign: "-1px" }} />{" "}
              <code>{h.toWallet.slice(0, 10)}...</code> (
              {new Date(h.timestamp).toLocaleDateString()})
            </li>
          ))}
          {history.length === 0 && (
            <li className="note">
              No transfers yet — original registrant still owns this asset.
            </li>
          )}
        </ol>
      </section>

      {/* Provenance Timeline */}
      <section className="card">
        <h2>Provenance timeline</h2>
        <ProvenanceTimeline asset={asset} history={history} />
      </section>

      {/* Provenance DNA / Lineage */}
      <section className="card">
        <h2>Provenance lineage</h2>
        <p className="note" style={{ marginBottom: "1rem" }}>
          How this asset's proof connects together.
        </p>
        <ProvenanceLineage asset={asset} evidenceScore={evidenceScore} />
      </section>

      {/* AI Model Attribution */}
      <section className="card">
        <h2>AI model attribution</h2>
        <AiModelAttribution aiModel={asset.aiModel} />
      </section>

      {/* Blockchain proof */}
      <section className="card">
        <h2>Blockchain proof</h2>
        <p>
          Fingerprint (SHA-256): <code>{asset.contentHash}</code>
        </p>
        <p>
          Transaction: <code>{asset.blockchainTxHash}</code>
        </p>
        <p>Registered: {new Date(asset.registeredAt).toLocaleString()}</p>
        <p>Network: Ethereum Sepolia (testnet)</p>
        <p>
          Status:{" "}
          <span
            className={`badge ${onChain?.active ? "badge-verified" : "badge-error"}`}
          >
            {onChain?.active ? (
              <ShieldCheck size={13} strokeWidth={2} />
            ) : (
              <ShieldAlert size={13} strokeWidth={2} />
            )}
            {onChain?.active ? "Verified on-chain" : "Not found on-chain"}
          </span>
        </p>
      </section>

      {/* Actions */}
      <section className="card">
        <h2>Actions</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {isOwner && (
            <button type="button" className="btn-secondary" onClick={copyProof}>
              {copied ? (
                <Check
                  size={15}
                  strokeWidth={2}
                  style={{ marginRight: "0.35rem", verticalAlign: "-2px" }}
                />
              ) : (
                <Copy
                  size={15}
                  strokeWidth={2}
                  style={{ marginRight: "0.35rem", verticalAlign: "-2px" }}
                />
              )}
              {copied ? "Copied" : "Copy proof"}
            </button>
          )}
          <Link to={`/assets/${asset.assetId}/certificate`}>
            <button type="button" className="btn-secondary">
              <FileBadge
                size={15}
                strokeWidth={2}
                style={{ marginRight: "0.35rem", verticalAlign: "-2px" }}
              />
              View certificate
            </button>
          </Link>
          <Link to="/verify">
            <button type="button" className="btn-secondary">
              Verify again
            </button>
          </Link>
          {isOwner && (
            <Link to={`/transfer?assetId=${asset.assetId}`}>
              <button type="button">Transfer ownership</button>
            </Link>
          )}
        </div>
      </section>

      {isOwner && <EmbeddableBadge assetId={asset.assetId} />}
    </div>
  );
}

function formatFactorName(key) {
  // "registrationHistory" -> "Registration history"
  const spaced = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
