import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, FileSearch, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import OwnerIdentity from "../components/OwnerIdentity";

export default function PublicExplorer() {
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState(null);
  const [searching, setSearching] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setAssets(null);
    setSearching(true);
    try {
      const res = await api.publicSearch(query);
      setAssets(res.assets);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="page">
      <h1><FileSearch size={22} strokeWidth={2} style={{ marginRight: "0.5rem", verticalAlign: "-4px" }} />Public explorer</h1>
      <p className="note">
        Look up any registered asset by Asset ID, content hash, wallet address, or blockchain
        transaction hash. No account needed. Only public ownership-proof information is shown.
      </p>

      <form onSubmit={handleSubmit}>
        <label>
          Search
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Asset ID, hash, or wallet address..."
            required
          />
        </label>
        {error && <p className="error-text"><AlertTriangle size={15} strokeWidth={2} /> {error}</p>}
        <button type="submit" disabled={searching}>
          <Search size={16} strokeWidth={2} style={{ marginRight: "0.4rem", verticalAlign: "-3px" }} />
          {searching ? "Searching..." : "Search"}
        </button>
      </form>

      {assets && assets.length === 0 && <p className="note">No matching asset found.</p>}

      {assets && assets.length > 0 && (
        <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <h2>{assets.length} result{assets.length > 1 ? "s" : ""}</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {assets.map((asset, i) => (
              <motion.li
                key={asset.assetId}
                style={{ marginBottom: "0.75rem", padding: "0.6rem 0", borderBottom: "1px solid var(--hairline)" }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
              >
                <Link to={`/assets/${asset.assetId}`}>
                  {asset.contentType} — <code>{asset.assetId.slice(0, 16)}...</code>
                </Link>
                <br />
                <span className="note">
                  Owner: <OwnerIdentity wallet={asset.ownerWallet} name={asset.creatorName} size="small" /> · Registered {new Date(asset.registeredAt).toLocaleDateString()}
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}
