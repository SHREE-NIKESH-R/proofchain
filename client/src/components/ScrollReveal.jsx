import { motion, useReducedMotion } from "framer-motion";

/**
 * Fade + small translate on scroll into view — the one enter animation used throughout
 * the landing page (design system Section 18: opacity + small translate + scale 0.98→1).
 * Automatically becomes an instant, motionless render under prefers-reduced-motion.
 */
export default function ScrollReveal({ children, delay = 0, className = "" }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
