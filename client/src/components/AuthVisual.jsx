import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, Fingerprint, Link2 } from "lucide-react";

const ICONS = [Fingerprint, Link2, ShieldCheck];

export default function AuthVisual({ eyebrow, title, description }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="auth-split-visual-content">
      <div className="auth-visual-nodes">
        {ICONS.map((Icon, i) => (
          <motion.div
            key={i}
            className="auth-visual-node"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <Icon size={18} strokeWidth={2} />
            {i < ICONS.length - 1 && <span className="auth-visual-connector" />}
          </motion.div>
        ))}
      </div>
      <span className="auth-visual-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
