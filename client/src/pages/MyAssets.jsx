import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import AssetCard from "../components/AssetCard";
import { SkeletonCard } from "../components/Skeleton";

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

export default function MyAssets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    api
      .listMyAssets()
      .then((res) => setAssets(res.assets))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return assets.filter((asset) => {
      if (typeFilter !== "all" && asset.contentType !== typeFilter) return false;
      if (statusFilter !== "all" && asset.status !== statusFilter) return false;
      return true;
    });
  }, [assets, typeFilter, statusFilter]);

  const contentTypes = useMemo(() => [...new Set(assets.map((a) => a.contentType))], [assets]);

  if (error) return <div className="page error-text">{error}</div>;

  return (
    <div className="page">
      <h1>My Assets</h1>

      <div className="filters-row">
        <label>
          Content type
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All</option>
            {contentTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="transferred">Transferred</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="asset-grid">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="note">
          No assets match these filters. <Link to="/register">Register your first creation</Link>.
        </p>
      ) : (
        <motion.div className="asset-grid" variants={gridVariants} initial="hidden" animate="show">
          {filtered.map((asset) => (
            <AssetCard key={asset.assetId} asset={asset} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
