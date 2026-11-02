import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Wallet, FolderCheck, ShieldCheck, ScanSearch, Gauge, PlusCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import AnimatedNumber from "../components/AnimatedNumber";
import ScrollReveal from "../components/ScrollReveal";
import { SkeletonLine } from "../components/Skeleton";

export default function Dashboard() {
  const { user, linkWallet } = useAuth();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState(null);
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  useEffect(() => {
    api
      .listMyAssets()
      .then((res) => setAssets(res.assets))
      .catch(() => {})
      .finally(() => setLoadingAssets(false));
  }, []);

  async function handleLinkWallet() {
    setError(null);
    setLinking(true);
    try {
      await linkWallet();
    } catch (err) {
      setError(err.message);
    } finally {
      setLinking(false);
    }
  }

  const stats = useMemo(() => {
    const total = assets.length;
    const verified = assets.filter((a) => a.status !== "deactivated").length;
    const withAnalysis = assets.filter((a) => a.originalityAnalysis);
    const avgScore = assets.filter((a) => a.evidenceScore !== null && a.evidenceScore !== undefined);
    const avg = avgScore.length > 0 ? Math.round(avgScore.reduce((s, a) => s + a.evidenceScore, 0) / avgScore.length) : 0;
    return { total, verified, checked: withAnalysis.length, avgScore: avg };
  }, [assets]);

  const recent = useMemo(() => assets.slice(0, 5), [assets]);

  return (
    <div className="page">
      <h1>Overview</h1>
      <p className="note">Signed in as {user?.email}</p>

      {!user?.walletAddress && (
        <section className="card">
          <h2><Wallet size={17} strokeWidth={2} style={{ marginRight: "0.4rem", verticalAlign: "-3px" }} />Wallet</h2>
          <p className="note">Link a MetaMask wallet to register or verify ownership on-chain.</p>
          <button onClick={handleLinkWallet} disabled={linking}>
            {linking ? "Connecting..." : "Connect MetaMask"}
          </button>
          {error && <p className="error-text">{error}</p>}
        </section>
      )}

      <div className="stat-grid">
        <ScrollReveal>
          <div className="card stat-card">
            <span className="stat-icon"><FolderCheck size={16} strokeWidth={2} /></span>
            <span className="stat-label">Registered assets</span>
            <span className="stat-value"><AnimatedNumber value={stats.total} /></span>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.05}>
          <div className="card stat-card">
            <span className="stat-icon"><ShieldCheck size={16} strokeWidth={2} /></span>
            <span className="stat-label">Active</span>
            <span className="stat-value"><AnimatedNumber value={stats.verified} /></span>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <div className="card stat-card">
            <span className="stat-icon"><ScanSearch size={16} strokeWidth={2} /></span>
            <span className="stat-label">Originality checks run</span>
            <span className="stat-value"><AnimatedNumber value={stats.checked} /></span>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.15}>
          <div className="card stat-card">
            <span className="stat-icon"><Gauge size={16} strokeWidth={2} /></span>
            <span className="stat-label">Avg. evidence score</span>
            <span className="stat-value">
              {stats.avgScore > 0 ? <><AnimatedNumber value={stats.avgScore} />/100</> : "—"}
            </span>
          </div>
        </ScrollReveal>
      </div>

      <section className="card">
        <h2>Quick actions</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link to="/register"><button type="button"><PlusCircle size={16} strokeWidth={2} style={{ marginRight: "0.4rem", verticalAlign: "-3px" }} />Register content</button></Link>
          <Link to="/verify"><button type="button" className="btn-secondary"><ScanSearch size={16} strokeWidth={2} style={{ marginRight: "0.4rem", verticalAlign: "-3px" }} />Verify content</button></Link>
        </div>
      </section>

      <section className="card">
        <h2>Recent assets</h2>
        {loadingAssets ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <SkeletonLine height="1.2rem" />
            <SkeletonLine height="1.2rem" width="80%" />
            <SkeletonLine height="1.2rem" width="60%" />
          </div>
        ) : recent.length === 0 ? (
          <p className="note">
            No registered assets yet. Register your first AI-generated work to create a
            timestamped ownership proof. <Link to="/register">Register content</Link>
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Asset</th><th>Type</th><th>Status</th></tr>
            </thead>
            <tbody>
              {recent.map((asset) => (
                <tr key={asset.assetId}>
                  <td><Link to={`/assets/${asset.assetId}`}>{asset.title}</Link></td>
                  <td className="note">{asset.contentType}</td>
                  <td>
                    <span className={`badge ${asset.status === "active" ? "badge-verified" : "badge-transferred"}`}>
                      {asset.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
