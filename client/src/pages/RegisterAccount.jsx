import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { UserPlus, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthVisual from "../components/AuthVisual";

export default function RegisterAccount() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-split">
      <div className="auth-split-visual">
        <AuthVisual
          eyebrow="Get started"
          title="Fingerprint it. Anchor it. Prove it."
          description="Create an account, link a wallet, and register your first Prompt, Article, Image, Music, or Video with a timestamped, on-chain ownership proof."
        />
      </div>
      <div className="auth-split-form">
        <motion.div
          className="auth-split-form-inner"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1>Create your account</h1>
          <form onSubmit={handleSubmit}>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <span className="note">At least 8 characters.</span>
            </label>
            {error && (
              <p className="error-text">
                <AlertCircle size={15} strokeWidth={2} /> {error}
              </p>
            )}
            <button type="submit" disabled={submitting}>
              <UserPlus size={16} strokeWidth={2} style={{ marginRight: "0.4rem", verticalAlign: "-3px" }} />
              {submitting ? "Creating account..." : "Create account"}
            </button>
          </form>
          <p className="note" style={{ marginTop: "1rem" }}>
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
