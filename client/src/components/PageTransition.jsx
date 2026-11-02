import { motion, useReducedMotion } from "framer-motion";

/**
 * Short, consistent fade+rise on every route change (design system: "page transition —
 * keep it short," 220–400ms range). Becomes an instant static render under reduced motion.
 */
export default function PageTransition({ children }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) return children;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
