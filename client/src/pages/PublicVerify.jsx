import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { api } from "../lib/api";
import OwnerIdentity from "../components/OwnerIdentity";
import AiModelAttribution from "../components/AiModelAttribution";
import EvidenceExplanation from "../components/EvidenceExplanation";
import { SkeletonLine } from "../components/Skeleton";

const API_ORIGIN = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/api$/, "");

/**
 * The page a QR code on a Proof Certificate points to. Deliberately public (no login,
 * no nav dependency on being signed in) — this is what a stranger sees when they scan
 * a certificate to check whether a claim of registered ownership is real.
 */
export default function PublicVerify() {
  const { assetId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .publicVerify(assetId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [assetId]);

  if (loading) {
    return (
      <div className="page">
        <SkeletonLine height="2rem" width="60%" />
        <div style={{ height: "1rem" }} />
        <SkeletonLine height="8rem" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="card">
          <span className="badge badge-error">
            <ShieldAlert size={13} strokeWidth={2} /> Not found
          </span>
          <p className="note" style={{ marginTop: "0.6rem" }}>
            No registered asset matches this ID. This link may be broken, or the
            asset may not exist.
          </p>
        </div>
      </div>
    );
  }

  const { asset, onChain, evidenceScore, creator, transferCount } = data;
  const isVerified = onChain?.active;

  return (
    <div className="page">
      <motion.div
        className="verification-stamp-wrap"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <span
          className={`verification-stamp ${isVerified ? "verified" : "unverified"}`}
        >
          {isVerified ? (
            <ShieldCheck size={28} strokeWidth={2} />
          ) : (
            <ShieldAlert size={28} strokeWidth={2} />
          )}
        </span>
        <h1>
          {isVerified ? "Ownership verified on-chain" : "Not found on-chain"}
        </h1>
      </motion.div>

      <div className="card">
        <h2>{asset.title}</h2>
        <span className="badge badge-pending">{asset.contentType}</span>

        {asset.fileUrl && asset.contentType === "image" && (
          <img
            src={
              asset.fileUrl.startsWith("http")
                ? asset.fileUrl
                : `${API_ORIGIN}${asset.fileUrl}`
            }
            alt={asset.title}
            style={{
              maxWidth: "100%",
              borderRadius: "var(--radius-md)",
              marginTop: "0.75rem",
            }}
          />
        )}

        <div style={{ marginTop: "1rem" }}>
          <p className="note">Registered by</p>
          <OwnerIdentity
            wallet={asset.ownerWallet}
            name={creator?.displayName}
          />
        </div>

        <p style={{ marginTop: "0.75rem" }}>
          Fingerprint: <code>{asset.contentHash}</code>
        </p>
        <p>
          Transaction: <code>{asset.blockchainTxHash}</code>
        </p>
        <p>Registered: {new Date(asset.registeredAt).toLocaleString()}</p>
        <p>Network: Ethereum Sepolia (testnet)</p>
        {transferCount > 0 && (
          <p className="note">
            Ownership has changed hands {transferCount} time
            {transferCount > 1 ? "s" : ""} since registration.
          </p>
        )}
      </div>

      <div className="card">
        <h2>AI model attribution</h2>
        <AiModelAttribution aiModel={asset.aiModel} />
      </div>

      {evidenceScore && (
        <div className="card">
          <h2>Creative evidence score</h2>
          <div className="evidence-score-block">
            <span className="evidence-score-number">{evidenceScore.score}</span>
            <span className="evidence-score-max">/100</span>
          </div>
          <EvidenceExplanation evidenceScore={evidenceScore} />
        </div>
      )}

      {asset.originalityAnalysis?.warning && (
        <div className="card">
          <span className="badge badge-derivative">
            <AlertTriangle size={13} strokeWidth={2} /> Possible derivative work
          </span>
          <p className="note" style={{ marginTop: "0.5rem" }}>
            This asset was found to be closely similar to another registered
            work at the time of registration. This is a technical similarity
            indicator, not a legal determination.
          </p>
        </div>
      )}

      <p className="note" style={{ textAlign: "center", marginTop: "1.5rem" }}>
        Verified independently against the ProofChain smart contract on Ethereum
        Sepolia.
      </p>
    </div>
  );
}
