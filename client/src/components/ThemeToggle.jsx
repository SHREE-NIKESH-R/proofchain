import { Sun, Moon } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <AnimatePresence mode="wait" initial={false}>
        {theme === "dark" ? (
          <motion.span
            key="sun"
            initial={shouldReduceMotion ? false : { rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={shouldReduceMotion ? {} : { rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: "flex" }}
          >
            <Sun size={17} strokeWidth={2} />
          </motion.span>
        ) : (
          <motion.span
            key="moon"
            initial={shouldReduceMotion ? false : { rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={shouldReduceMotion ? {} : { rotate: -90, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: "flex" }}
          >
            <Moon size={17} strokeWidth={2} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
