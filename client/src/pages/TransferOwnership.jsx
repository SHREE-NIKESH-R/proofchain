import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { transferAssetOnChain } from "../lib/wallet";

export default function TransferOwnership() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assetId = searchParams.get("assetId");
  const [asset, setAsset] = useState(null);
  const [recipient, setRecipient] = useState("");
  const [loading, setLoading] = useState(Boolean(assetId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!assetId) {
      setLoading(false);
      return;
    }

    api
      .getAsset(assetId)
      .then((data) => setAsset(data.asset))
      .catch((err) => setError(`We couldn't load this asset: ${err.message}`))
      .finally(() => setLoading(false));
  }, [assetId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!assetId) {
      setError("This transfer link is missing an asset ID.");
      return;
    }
    if (!recipient.trim()) {
      setError("Enter the recipient's wallet address.");
      return;
    }
    if (recipient.trim().toLowerCase() === user?.walletAddress?.toLowerCase()) {
      setError("The recipient must be a different wallet.");
      return;
    }

    setSubmitting(true);
    try {
      const txHash = await transferAssetOnChain({
        assetId,
        newOwner: recipient.trim(),
      });
      await api.transferAsset(assetId, recipient.trim(), txHash);
      navigate(`/assets/${assetId}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page">Loading asset...</div>;
  if (error && !asset) return <div className="page error-text">{error}</div>;
  if (!asset)
    return (
      <div className="page error-text">
        This transfer link is missing an asset ID.
      </div>
    );

  return (
    <div className="page">
      <h1>Transfer ownership</h1>
      <p className="note">
        Transfer <strong>{asset.title}</strong> to another wallet.
      </p>
      <p>
        Asset ID: <code>{assetId}</code>
      </p>

      <form onSubmit={handleSubmit}>
        <label>
          Recipient wallet address
          <input
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="0x..."
            required
            disabled={submitting}
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="submit" disabled={submitting}>
            {submitting ? "Transferring..." : "Confirm transfer"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(`/assets/${assetId}`)}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
