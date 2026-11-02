import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";

const FACTOR_LABEL_CLASS = {
  Strong: "",
  Available: "",
  Moderate: "weak",
  Weak: "weak",
  "Not Available": "unavailable",
};

/**
 * Turns the evidence score's factor breakdown (already fully computed server-side, see
 * evidenceScoreService.js) into a plain-language "why" explanation: what each factor
 * measured, how much it counted, and — when a factor is missing — why that's excluded
 * rather than penalized. No new data is invented here; this only explains what's real.
 */
export default function EvidenceExplanation({ evidenceScore }) {
  const [open, setOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  if (!evidenceScore) return null;

  const availableFactors = Object.entries(evidenceScore.factors).filter(([, f]) => f.subscore !== null);
  const totalAvailableWeight = availableFactors.reduce((sum, [key]) => sum + evidenceScore.weights[key], 0);

  return (
    <div className="evidence-explain">
      <button type="button" className="evidence-explain-toggle" onClick={() => setOpen((o) => !o)}>
        <HelpCircle size={15} strokeWidth={2} />
        <span>Why is this score {evidenceScore.score}?</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: "flex", marginLeft: "auto" }}>
          <ChevronDown size={15} strokeWidth={2} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div className="evidence-explain-body">
              <p className="note">
                Each factor below contributes a share of the final score, weighted by how much
                it matters as ownership/originality evidence. Factors marked "Not Available"
                are excluded from the calculation entirely — their weight is redistributed
                across the remaining factors rather than counted as a strike against the score.
              </p>
              {Object.entries(evidenceScore.factors).map(([key, factor]) => {
                const isAvailable = factor.subscore !== null;
                const effectiveWeight = isAvailable
                  ? Math.round((evidenceScore.weights[key] / totalAvailableWeight) * 100)
                  : 0;
                return (
                  <div className="evidence-explain-row" key={key}>
                    <div className="evidence-explain-row-top">
                      <strong>{formatFactorName(key)}</strong>
                      <span className={`badge ${FACTOR_LABEL_CLASS[factor.label] ? "badge-derivative" : "badge-verified"}`}>
                        {factor.label}
                      </span>
                    </div>
                    <p className="note" style={{ margin: "0.2rem 0" }}>
                      {isAvailable
                        ? `Counted for ~${effectiveWeight}% of this score. `
                        : "Not counted — excluded, weight redistributed to other factors. "}
                      {factor.detail}
                    </p>
                  </div>
                );
              })}
              <p className="note" style={{ marginTop: "0.5rem" }}>{evidenceScore.disclaimer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatFactorName(key) {
  const spaced = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
