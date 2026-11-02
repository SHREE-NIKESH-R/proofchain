import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import QRCode from "react-qr-code";
import { ShieldCheck, Printer, Download, ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import OwnerIdentity from "../components/OwnerIdentity";
import AiModelAttribution from "../components/AiModelAttribution";
import { SkeletonLine } from "../components/Skeleton";

/**
 * A printable/shareable Proof Certificate: everything needed to independently verify
 * this asset's registration, condensed onto one page, plus a QR code that opens the
 * public verification page (no login required) for anyone who scans it.
 */
export default function Certificate() {
  const { assetId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const certRef = useRef(null);

  useEffect(() => {
    api
      .getAsset(assetId)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [assetId]);

  function handlePrint() {
    window.print();
  }

  if (error) return <div className="page error-text">{error}</div>;
  if (!data) {
    return (
      <div className="page">
        <SkeletonLine height="2.5rem" width="50%" />
        <div style={{ height: "1.5rem" }} />
        <SkeletonLine height="16rem" />
      </div>
    );
  }

  const { asset, onChain, evidenceScore, creator } = data;
  const verifyUrl = `${window.location.origin}/assets/${asset.assetId}`;

  return (
    <div className="page">
      <Link to={`/assets/${assetId}`} className="note certificate-back-link">
        <ArrowLeft size={14} strokeWidth={2} /> Back to asset
      </Link>

      <motion.div
        className="certificate"
        ref={certRef}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="certificate-header">
          <span className="certificate-brand">
            <ShieldCheck size={20} strokeWidth={2.3} /> ProofChain
          </span>
          <span className="badge badge-verified">Proof certificate</span>
        </div>

        <h1 style={{ marginBottom: "0.2rem" }}>{asset.title}</h1>
        <p className="note" style={{ marginBottom: "1.25rem" }}>
          {asset.contentType} · Asset ID <code>{asset.assetId}</code>
        </p>

        <div className="certificate-grid">
          <div>
            <p className="certificate-label">Registered by</p>
            <OwnerIdentity
              wallet={asset.ownerWallet}
              name={creator?.displayName}
            />

            <p className="certificate-label" style={{ marginTop: "1rem" }}>
              Fingerprint (SHA-256)
            </p>
            <code className="mono-text">{asset.contentHash}</code>

            <p className="certificate-label" style={{ marginTop: "1rem" }}>
              Blockchain transaction
            </p>
            <code className="mono-text">{asset.blockchainTxHash}</code>

            <p className="certificate-label" style={{ marginTop: "1rem" }}>
              Registered
            </p>
            <p>{new Date(asset.registeredAt).toLocaleString()}</p>

            <p className="certificate-label" style={{ marginTop: "1rem" }}>
              Network
            </p>
            <p>Ethereum Sepolia (testnet)</p>

            <p className="certificate-label" style={{ marginTop: "1rem" }}>
              Status
            </p>
            <span
              className={`badge ${onChain?.active ? "badge-verified" : "badge-error"}`}
            >
              {onChain?.active ? "Verified on-chain" : "Not found on-chain"}
            </span>

            <p className="certificate-label" style={{ marginTop: "1rem" }}>
              AI model
            </p>
            <AiModelAttribution aiModel={asset.aiModel} />

            {evidenceScore && (
              <>
                <p className="certificate-label" style={{ marginTop: "1rem" }}>
                  Creative evidence score
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: "1.5rem",
                  }}
                >
                  {evidenceScore.score}
                  <span className="note" style={{ fontSize: "1rem" }}>
                    /100
                  </span>
                </p>
              </>
            )}
          </div>

          <div className="certificate-qr-block">
            <div className="certificate-qr">
              <QRCode
                value={verifyUrl}
                size={148}
                fgColor="#111111"
                bgColor="#FFFFFF"
              />
            </div>
            <p
              className="note"
              style={{ textAlign: "center", marginTop: "0.5rem" }}
            >
              Scan to verify independently
            </p>
            <p
              className="mono-text"
              style={{ textAlign: "center", wordBreak: "break-all" }}
            >
              {verifyUrl}
            </p>
          </div>
        </div>

        <p className="note certificate-footer">
          This certificate documents a blockchain-backed ownership registration
          and, where available, a technical originality indicator. It is not a
          legal determination of copyright ownership or infringement.
        </p>
      </motion.div>

      <div className="certificate-actions">
        <button type="button" className="btn-secondary" onClick={handlePrint}>
          <Printer
            size={15}
            strokeWidth={2}
            style={{ marginRight: "0.4rem", verticalAlign: "-2px" }}
          />
          Print / Save as PDF
        </button>
        <a href={verifyUrl} target="_blank" rel="noreferrer">
          <button type="button" className="btn-secondary">
            <Download
              size={15}
              strokeWidth={2}
              style={{ marginRight: "0.4rem", verticalAlign: "-2px" }}
            />
            Open public verification page
          </button>
        </a>
      </div>
    </div>
  );
}
