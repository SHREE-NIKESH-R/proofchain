// Split into its own file (no three.js/R3F imports) so this can be statically imported
// by ProvenanceHero.jsx without defeating the lazy-load of the actual 3D scene.
const STAGES = ["Prompt", "AI model", "Content", "Fingerprint", "Blockchain proof", "Verification"];

export default function ProvenanceNetworkFallback() {
  return (
    <div
      className="provenance-fallback"
      role="img"
      aria-label="Prompt to AI model to content to fingerprint to blockchain proof to verification"
    >
      {STAGES.map((label, i) => (
        <div className="provenance-fallback-node" key={label}>
          <span className={`provenance-fallback-dot ${i === STAGES.length - 1 ? "verified" : ""}`} />
          <span>{label}</span>
          {i < STAGES.length - 1 && <span className="provenance-fallback-arrow">→</span>}
        </div>
      ))}
    </div>
  );
}
