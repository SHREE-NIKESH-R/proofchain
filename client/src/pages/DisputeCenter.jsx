import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  ShieldAlert,
  UploadCloud,
} from "lucide-react";
import { api } from "../lib/api";

const STORAGE_KEY = "proofchain_disputes_v1";

function toDisplayLabel(value) {
  return value || "0xUnknown";
}

export default function DisputeCenter() {
  const [disputes, setDisputes] = useState([]);
  const [form, setForm] = useState({
    assetId: "",
    claimant: "",
    reason: "",
    hashHistory: "",
    timestamp: "",
    fileName: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDisputes() {
      try {
        const res = await api.listDisputes();
        setDisputes(res.disputes || []);
      } catch {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            setDisputes(Array.isArray(parsed) ? parsed : []);
          }
        } catch {
          setDisputes([]);
        }
      } finally {
        setLoading(false);
      }
    }

    loadDisputes();
  }, []);

  useEffect(() => {
    if (disputes.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(disputes));
    }
  }, [disputes]);

  const stats = useMemo(() => {
    const pending = disputes.filter((d) => d.status !== "Resolved").length;
    const escrowed = disputes.filter((d) => d.status === "Escrowed").length;
    return { pending, escrowed };
  }, [disputes]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    setForm((prev) => ({ ...prev, fileName: file ? file.name : "" }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const payload = {
        assetId: form.assetId,
        claimantWallet: form.claimant,
        reason: form.reason,
        hashHistory: form.hashHistory,
        timestamp: form.timestamp,
        evidenceFile: form.fileName,
      };

      const { dispute } = await api.createDispute(payload);
      setDisputes((prev) => [dispute, ...prev]);
      setSubmitted(true);
      setForm({
        assetId: "",
        claimant: "",
        reason: "",
        hashHistory: "",
        timestamp: "",
        fileName: "",
      });
    } catch (err) {
      setError(err.message || "Unable to submit the dispute.");
    }
  }

  async function handleStatusUpdate(disputeId, nextStatus) {
    try {
      const { dispute } = await api.updateDisputeStatus(
        disputeId,
        nextStatus,
        "Reviewed from dispute center",
      );
      setDisputes((prev) =>
        prev.map((item) =>
          item._id === disputeId || item.id === disputeId
            ? { ...item, ...dispute }
            : item,
        ),
      );
    } catch (err) {
      setError(err.message || "Unable to update the dispute.");
    }
  }

  return (
    <div className="page">
      <h1>Dispute center</h1>
      <p className="note">
        When conflicting ownership claims appear, the app can move the asset
        into escrow and collect timestamp and hash evidence before arbitration.
      </p>

      <div className="stat-grid" style={{ marginBottom: "1rem" }}>
        <div className="card stat-card">
          <span className="stat-icon">
            <AlertTriangle size={16} strokeWidth={2} />
          </span>
          <span className="stat-label">Open claims</span>
          <span className="stat-value">{stats.pending}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-icon">
            <ShieldAlert size={16} strokeWidth={2} />
          </span>
          <span className="stat-label">Escrowed</span>
          <span className="stat-value">{stats.escrowed}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <h2>Submit a claim</h2>

        <label>
          Asset ID
          <input
            name="assetId"
            value={form.assetId}
            onChange={handleChange}
            placeholder="A-1041"
            required
          />
        </label>

        <label>
          Claimant wallet
          <input
            name="claimant"
            value={form.claimant}
            onChange={handleChange}
            placeholder="0x..."
            required
          />
        </label>

        <label>
          Dispute reason
          <textarea
            name="reason"
            value={form.reason}
            onChange={handleChange}
            rows={4}
            placeholder="Example: conflicting claim after transfer or watermark mismatch"
            required
          />
        </label>

        <label>
          Perceptual hash / previous history
          <textarea
            name="hashHistory"
            value={form.hashHistory}
            onChange={handleChange}
            rows={3}
            placeholder="Provide previous ownership hash values or revision history"
          />
        </label>

        <label>
          Timestamp proof
          <input
            name="timestamp"
            value={form.timestamp}
            onChange={handleChange}
            placeholder="e.g. 2026-11-03T13:25:00Z"
          />
        </label>

        <label>
          Evidence file
          <div className="upload-dropzone" style={{ marginTop: "0.35rem" }}>
            <input type="file" onChange={handleFileChange} />
            {form.fileName && (
              <span className="note mono-text">{form.fileName}</span>
            )}
          </div>
        </label>

        {submitted && (
          <p className="success-text">
            <CheckCircle2 size={15} strokeWidth={2} /> Claim submitted. The
            asset has been moved into review.
          </p>
        )}
        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={loading}>
          <UploadCloud size={16} strokeWidth={2} />
          Submit dispute evidence
        </button>
      </form>

      <section className="card">
        <h2>Current claims</h2>
        {loading ? (
          <p className="note">Loading claims…</p>
        ) : disputes.length === 0 ? (
          <p className="note">No disputes have been filed yet.</p>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}
          >
            {disputes.map((item) => (
              <div
                key={item._id || item.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.9rem",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <strong>
                    {item._id ? item._id.slice(-6).toUpperCase() : item.id}
                  </strong>
                  <span className="badge badge-pending">{item.status}</span>
                </div>
                <p className="note" style={{ margin: "0.55rem 0" }}>
                  Asset: {item.assetId} • Claimant:{" "}
                  {toDisplayLabel(item.claimantWallet || item.claimant)}
                </p>
                <p>{item.reason}</p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    marginTop: "0.5rem",
                  }}
                >
                  <span className="note mono-text">
                    <Clock3 size={14} strokeWidth={2} />{" "}
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString()
                      : item.updated || "Just now"}
                  </span>
                  <div
                    style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                  >
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        handleStatusUpdate(item._id || item.id, "Escrowed")
                      }
                    >
                      Escrow
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        handleStatusUpdate(item._id || item.id, "Resolved")
                      }
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        handleStatusUpdate(item._id || item.id, "Rejected")
                      }
                    >
                      Reject
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: "0.75rem" }}>
                  <Link to={`/assets/${item.assetId}`} className="text-link">
                    <FileText size={14} strokeWidth={2} /> Open proof
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
