import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { UserCircle, Wallet, LogOut, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, linkWallet, logout } = useAuth();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState(null);

  async function handleRelinkWallet() {
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

  return (
    <div className="page">
      <h1>Profile & settings</h1>

      <motion.section
        className="card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2>
          <UserCircle
            size={17}
            strokeWidth={2}
            style={{ marginRight: "0.4rem", verticalAlign: "-3px" }}
          />
          Account
        </h2>
        <p>Email: {user?.email}</p>
        <p>
          Member since:{" "}
          {user?.createdAt
            ? new Date(user.createdAt).toLocaleDateString()
            : "—"}
        </p>
      </motion.section>

      <motion.section
        className="card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <h2>
          <Wallet
            size={17}
            strokeWidth={2}
            style={{ marginRight: "0.4rem", verticalAlign: "-3px" }}
          />
          Wallet
        </h2>
        {user?.walletAddress ? (
          <>
            <p>
              Connected: <code>{user.walletAddress}</code>
            </p>
            <p className="note">
              To switch wallets, connect a different account in MetaMask first,
              then re-link below.
            </p>
          </>
        ) : (
          <p className="note">No wallet linked yet.</p>
        )}
        <button onClick={handleRelinkWallet} disabled={linking}>
          {linking
            ? "Connecting..."
            : user?.walletAddress
              ? "Re-link wallet"
              : "Connect MetaMask"}
        </button>
        {error && (
          <p className="error-text">
            <AlertTriangle size={15} strokeWidth={2} /> {error}
          </p>
        )}
      </motion.section>

      {user?.walletAddress && (
        <motion.section
          className="card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
        >
          <h2>Creator identity</h2>
          <p className="note">
            Display name and bio are managed on your canonical public creator
            profile.
          </p>
          <Link to={`/creator/${user.walletAddress}`}>
            <button type="button">Open creator profile</button>
          </Link>
        </motion.section>
      )}

      <section className="card">
        <h2>Account actions</h2>
        <button onClick={logout} className="btn-secondary">
          <LogOut
            size={16}
            strokeWidth={2}
            style={{ marginRight: "0.4rem", verticalAlign: "-3px" }}
          />
          Log out
        </button>
      </section>
    </div>
  );
}
