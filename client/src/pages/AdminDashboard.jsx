import { Link } from "react-router-dom";
import { ShieldCheck, Users, AlertTriangle, ArrowRight } from "lucide-react";

export default function AdminDashboard() {
  return (
    <div className="page">
      <h1>Admin dashboard</h1>
      <p className="note">
        Review dispute claims, monitor account activity, and keep the proof
        registry under control.
      </p>

      <div className="stat-grid">
        <div className="card stat-card">
          <span className="stat-icon">
            <ShieldCheck size={16} strokeWidth={2} />
          </span>
          <span className="stat-label">Admin status</span>
          <span className="stat-value">Active</span>
        </div>
        <div className="card stat-card">
          <span className="stat-icon">
            <AlertTriangle size={16} strokeWidth={2} />
          </span>
          <span className="stat-label">Open disputes</span>
          <span className="stat-value">Pending</span>
        </div>
        <div className="card stat-card">
          <span className="stat-icon">
            <Users size={16} strokeWidth={2} />
          </span>
          <span className="stat-label">Users</span>
          <span className="stat-value">Managed</span>
        </div>
      </div>

      <section className="card">
        <h2>Admin actions</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link to="/disputes">
            <button type="button">Review disputes</button>
          </Link>
          <Link to="/dashboard">
            <button type="button" className="btn-secondary">
              Open normal dashboard
            </button>
          </Link>
        </div>
      </section>

      <section className="card">
        <h2>Latest review notes</h2>
        <ul style={{ margin: "0.75rem 0 0 1.2rem" }}>
          <li>
            ProofChain admin access is enabled for the configured admin email.
          </li>
          <li>
            Dispute claims can be reviewed and moved to Escrow / Resolved /
            Rejected.
          </li>
          <li>Use the dispute page to inspect asset-level claim history.</li>
        </ul>

        <div style={{ marginTop: "1rem" }}>
          <Link to="/disputes" className="text-link">
            Go to dispute center <ArrowRight size={14} strokeWidth={2} />
          </Link>
        </div>
      </section>
    </div>
  );
}
