import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Pencil, Check, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import AssetCard from "../components/AssetCard";
import { SkeletonLine } from "../components/Skeleton";

export default function CreatorProfile() {
  const { wallet } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const isOwnProfile = user?.walletAddress?.toLowerCase() === wallet.toLowerCase();

  function load() {
    setLoading(true);
    api
      .getPublicProfile(wallet)
      .then((res) => {
        setData(res);
        setDisplayName(res.displayName || "");
        setBio(res.bio || "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [wallet]);

  async function handleSave(e) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      await api.updateMyProfile(displayName, bio);
      setEditing(false);
      load();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <SkeletonLine height="2rem" width="40%" />
        <div style={{ height: "1rem" }} />
        <SkeletonLine height="1rem" width="70%" />
      </div>
    );
  }
  if (error) return <div className="page error-text">{error}</div>;

  return (
    <div className="page">
      <motion.div className="card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="creator-avatar"><User size={26} strokeWidth={2} /></div>

        {editing ? (
          <form onSubmit={handleSave} style={{ marginTop: "0.75rem" }}>
            <label>
              Display name
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} required />
            </label>
            <label>
              Bio (optional)
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} rows={3} />
            </label>
            {saveError && <p className="error-text"><AlertTriangle size={15} strokeWidth={2} /> {saveError}</p>}
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button type="submit" disabled={saving}>
                <Check size={15} strokeWidth={2} style={{ marginRight: "0.35rem", verticalAlign: "-2px" }} />
                {saving ? "Saving..." : "Save"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <h1 style={{ marginTop: "0.75rem" }}>{data.displayName || "Unnamed creator"}</h1>
            <code className="mono-text">{data.walletAddress}</code>
            {data.bio && <p style={{ marginTop: "0.5rem" }}>{data.bio}</p>}
            <p className="note" style={{ marginTop: "0.5rem" }}>
              Display name is a platform label associated with this wallet — it is not part of
              the on-chain record. The wallet address above is the verifiable identity.
            </p>
            {isOwnProfile && (
              <button type="button" className="btn-secondary" onClick={() => setEditing(true)} style={{ marginTop: "0.75rem" }}>
                <Pencil size={14} strokeWidth={2} style={{ marginRight: "0.35rem", verticalAlign: "-2px" }} />
                {data.displayName ? "Edit profile" : "Set display name"}
              </button>
            )}
          </>
        )}
      </motion.div>

      <h2 style={{ marginTop: "1.5rem" }}>Registered assets ({data.assets.length})</h2>
      {data.assets.length === 0 ? (
        <p className="note">No public assets registered by this wallet yet.</p>
      ) : (
        <div className="asset-grid">
          {data.assets.map((asset) => (
            <AssetCard key={asset.assetId} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}
