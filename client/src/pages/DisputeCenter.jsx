import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  ShieldAlert,
  UploadCloud,
} from "lucide-react";

const initialDisputes = [
  {
    id: "DSP-1041",
    assetId: "A-1041",
    claimant: "0x91A7...99FD",
    reason: "Conflicting ownership claim on reused prompt",
    status: "Escrowed",
    updated: "2 hours ago",
  },
  {
    id: "DSP-1038",
    assetId: "A-9832",
    claimant: "0x54B2...1E8A",
    reason: "Watermark mismatch during verification",
    status: "Pending review",
    updated: "1 day ago",
  },
];

export default function DisputeCenter() {
  const [disputes, setDisputes] = useState(initialDisputes);
  const [form, setForm] = useState({
    assetId: "",
    claimant: "",
    reason: "",
    hashHistory: "",
    timestamp: "",
    fileName: "",
  });
  const [submitted, setSubmitted] = useState(false);

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

  function handleSubmit(e) {
    e.preventDefault();

    const newDispute = {
      id: `DSP-${Math.floor(Math.random() * 9000 + 1000)}`,
      assetId: form.assetId || "A-NEW-CLAIM",
      claimant: form.claimant || "0xNew...Claimant",
      reason: form.reason || "Ownership dispute submitted",
      status: "Pending review",
      updated: "Just now",
    };

    setDisputes((prev) => [newDispute, ...prev]);
    setSubmitted(true);
    setForm({
      assetId: "",
      claimant: "",
      reason: "",
      hashHistory: "",
      timestamp: "",
      fileName: "",
    });
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

        <button type="submit">
          <UploadCloud size={16} strokeWidth={2} />
          Submit dispute evidence
        </button>
      </form>

      <section className="card">
        <h2>Current claims</h2>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}
        >
          {disputes.map((item) => (
            <div
              key={item.id}
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
                <strong>{item.id}</strong>
                <span className="badge badge-pending">{item.status}</span>
              </div>
              <p className="note" style={{ margin: "0.55rem 0" }}>
                Asset: {item.assetId} • Claimant: {item.claimant}
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
                  <Clock3 size={14} strokeWidth={2} /> {item.updated}
                </span>
                <Link to={`/assets/${item.assetId}`} className="text-link">
                  <FileText size={14} strokeWidth={2} /> Open proof
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
