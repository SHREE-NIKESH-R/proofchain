import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthVisual from "../components/AuthVisual";

export default function Login() {
  const { login } = useAuth();
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
      await login(email, password);
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
          eyebrow="Welcome back"
          title="Your registered work is exactly where you left it."
          description="Every fingerprint, blockchain proof, and originality report tied to your wallet stays put — log in to pick up where you left off."
        />
      </div>
      <div className="auth-split-form">
        <motion.div
          className="auth-split-form-inner"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1>Log in</h1>
          <form onSubmit={handleSubmit}>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {error && (
              <p className="error-text">
                <AlertCircle size={15} strokeWidth={2} /> {error}
              </p>
            )}
            <button type="submit" disabled={submitting}>
              <LogIn size={16} strokeWidth={2} style={{ marginRight: "0.4rem", verticalAlign: "-3px" }} />
              {submitting ? "Logging in..." : "Log in"}
            </button>
          </form>
          <p className="note" style={{ marginTop: "1rem" }}>
            No account? <Link to="/register-account">Create one</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
