import { Link } from "react-router-dom";
import { User } from "lucide-react";

/**
 * The single, consistent way a creator is ever displayed across the app: a display name
 * (if the wallet has set one) alongside — never instead of — the wallet address, since
 * the wallet is the actual verifiable identity and the name is a platform-level label
 * only (see server/models/Profile.js). Always links to the public creator profile.
 */
export default function OwnerIdentity({ wallet, name, size = "normal" }) {
  if (!wallet) return null;

  const short = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

  return (
    <Link to={`/creator/${wallet}`} className={`owner-identity ${size === "small" ? "owner-identity-small" : ""}`}>
      <span className="owner-identity-avatar"><User size={size === "small" ? 12 : 14} strokeWidth={2} /></span>
      {name ? (
        <span>
          {name} <code className="owner-identity-wallet">{short}</code>
        </span>
      ) : (
        <code className="owner-identity-wallet">{wallet}</code>
      )}
    </Link>
  );
}
