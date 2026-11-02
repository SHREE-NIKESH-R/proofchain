import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";

/**
 * Counts up to a real, already-known value on mount/update. This is a presentation
 * animation, not a progress indicator — the value itself is never fabricated or
 * estimated, only its reveal is animated (design system: "do not fake progress").
 */
export default function AnimatedNumber({ value }) {
  const nodeRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!nodeRef.current) return;

    if (shouldReduceMotion) {
      nodeRef.current.textContent = String(value);
      return;
    }

    const controls = animate(0, value, {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(latest) {
        if (nodeRef.current) nodeRef.current.textContent = String(Math.round(latest));
      },
    });
    return () => controls.stop();
  }, [value, shouldReduceMotion]);

  return <span ref={nodeRef}>0</span>;
}
