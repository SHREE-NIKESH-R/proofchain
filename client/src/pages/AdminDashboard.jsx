import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, AlertTriangle, CheckCircle2, Clock3, ArrowRight } from "lucide-react";
import { api } from "../lib/api";

export default function AdminDashboard() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDisputes() {
      try {
        const res = await api.listDisputes();
        setDisputes(res.disputes || []);
      } catch {
        setDisputes([]);
      } finally {
        setLoading(false);
      }
    }

    loadDisputes();
  }, []);

  const stats = useMemo(() => {
    const total = disputes.length;
    const pending = disputes.filter((d) => d.status !== "Resolved" && d.status !== "Rejected").length;
    const escrowed = disputes.filter((d) => d.status === "Escrowed").length;
    const resolved = disputes.filter((d) => d.status === "Resolved").length;
    return { total, pending, escrowed, resolved };
  }, [disputes]);

  const recentDisputes = useMemo(
    () => disputes.slice(0, 4),
    [disputes],
  );

  return (
    <div className="page">
      <h1>Admin dashboard</h1>
      <p className="note">
        Review the active ownership conflict queue and resolve disputes quickly.
      </p>

      <div className="stat-grid">
        <div className="card stat-card">
          <span className="stat-icon">
            <ShieldCheck size={16} strokeWidth={2} />
          </span>
          <span className="stat-label">Admin</span>
          <span className="stat-value">Active</span>
        </div>
        <div className="card stat-card">
          <span className="stat-icon">
            <Clock3 size={16} strokeWidth={2} />
          </span>
          <span className="stat-label">Open claims</span>
          <span className="stat-value">{loading ? "..." : stats.pending}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-icon">
            <AlertTriangle size={16} strokeWidth={2} />
          </span>
          <span className="stat-label">Escrowed</span>
          <span className="stat-value">{loading ? "..." : stats.escrowed}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-icon">
            <CheckCircle2 size={16} strokeWidth={2} />
          </span>
          <span className="stat-label">Resolved</span>
          <span className="stat-value">{loading ? "..." : stats.resolved}</span>
        </div>
      </div>

      <section className="card">
        <h2>Admin actions</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link to="/disputes">
            <button type="button">Review disputes</button>
          </Link>
        </div>
      </section>

      <section className="card">
        <h2>Recent dispute queue</h2>
        {loading ? (
          <p className="note">Loading claims…</p>
        ) : recentDisputes.length === 0 ? (
          <p className="note">No disputes available right now.</p>
        ) : (
          <ul style={{ margin: "0.75rem 0 0 1.2rem", padding: 0 }}>
            {recentDisputes.map((item) => (
              <li key={item._id || item.id} style={{ marginBottom: "0.65rem" }}>
                <strong>{item.assetId || "Unknown asset"}</strong> — {item.reason || "No reason provided"}
                <span className="note" style={{ display: "block" }}>
                  Status: {item.status || "Pending review"} · Claimant: {item.claimantWallet || "Unknown"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div style={{ marginTop: "1rem" }}>
          <Link to="/disputes" className="text-link">
            Open dispute center <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>
      </section>

      <section className="card">
        <h2>Summary</h2>
        <p className="note" style={{ marginBottom: 0 }}>
          Total claims: {loading ? "..." : stats.total}. This dashboard is intentionally focused on ownership conflict review and escrow decisions.
        </p>
      </section>
    </div>
  );
}
