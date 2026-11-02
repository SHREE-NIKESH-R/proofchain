import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { transferAssetOnChain } from "../lib/wallet";

export default function OwnershipTransfer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState(searchParams.get("assetId") || "");
  const [toWallet, setToWallet] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api
      .listMyAssets()
      .then((res) => {
        // Only assets currently owned by this wallet can be transferred.
        const owned = res.assets.filter(
          (a) => a.ownerWallet?.toLowerCase() === user?.walletAddress?.toLowerCase()
        );
        setAssets(owned);
        if (!selectedAssetId && owned.length > 0) setSelectedAssetId(owned[0].assetId);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.walletAddress]);

  async function handleTransfer(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setTransferring(true);
    try {
      const txHash = await transferAssetOnChain({ assetId: selectedAssetId, newOwner: toWallet });
      await api.transferAsset(selectedAssetId, toWallet, txHash);
      setSuccess(true);
      setToWallet("");
    } catch (err) {
      setError(err.message);
    } finally {
      setTransferring(false);
    }
  }

  if (!user?.walletAddress) {
    return (
      <div className="page">
        <h1>Transfer Ownership</h1>
        <p className="note">
          Link a MetaMask wallet from your <Link to="/profile">Profile</Link> before transferring assets.
        </p>
      </div>
    );
  }

  if (loading) return <div className="page">Loading...</div>;
  if (error) {
    return (
      <div className="page">
        <h1>Transfer ownership</h1>
        <p className="error-text">Unable to load your assets: {error}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1><ArrowLeftRight size={22} strokeWidth={2} style={{ marginRight: "0.5rem", verticalAlign: "-4px" }} />Transfer ownership</h1>

      {assets.length === 0 ? (
        <p className="note">
          You don't currently own any registered assets to transfer.{" "}
          <Link to="/register">Register one first</Link>.
        </p>
      ) : (
        <form onSubmit={handleTransfer}>
          <label>
            Asset
            <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)} disabled={transferring}>
              {assets.map((a) => (
                <option key={a.assetId} value={a.assetId}>
                  {a.title} ({a.contentType})
                </option>
              ))}
            </select>
          </label>
          <label>
            Recipient wallet address
            <input value={toWallet} onChange={(e) => setToWallet(e.target.value)} placeholder="0x..." required disabled={transferring} />
          </label>
          {error && <p className="error-text"><AlertTriangle size={15} strokeWidth={2} /> {error}</p>}
          <AnimatePresence>
            {success && (
              <motion.p
                className="note"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--proof-green-dark)" }}
              >
                <CheckCircle2 size={15} strokeWidth={2} /> Transfer confirmed.{" "}
                <button
                  type="button"
                  onClick={() => navigate(`/assets/${selectedAssetId}`)}
                  style={{ padding: 0, background: "none", color: "var(--proof-green-dark)", textDecoration: "underline", width: "auto" }}
                >
                  View asset
                </button>
              </motion.p>
            )}
          </AnimatePresence>
          <button type="submit" disabled={transferring}>
            {transferring ? "Confirm in MetaMask..." : "Transfer ownership"}
          </button>
        </form>
      )}
    </div>
  );
}
