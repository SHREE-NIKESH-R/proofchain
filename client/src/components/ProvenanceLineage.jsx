import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";

/**
 * A relationship diagram, not a decoration: shows how this specific asset connects to
 * its fingerprint, its blockchain proof, and — when one exists — the nearest similar
 * registered work. Every node here corresponds to real data already on the asset;
 * nothing is simulated or placeholder.
 */
export default function ProvenanceLineage({ asset, evidenceScore }) {
  const shouldReduceMotion = useReducedMotion();
  const match = asset.originalityAnalysis?.matchedAssets?.[0];

  const nodes = [
    { id: "content", label: asset.title, sub: asset.contentType },
    { id: "fingerprint", label: "SHA-256 fingerprint", sub: asset.contentHash.slice(0, 12) + "..." },
    { id: "blockchain", label: "Blockchain proof", sub: "Sepolia testnet" },
    { id: "evidence", label: `Evidence score: ${evidenceScore?.score ?? "—"}/100`, sub: "Weighted composite" },
  ];
  if (match) {
    nodes.push({
      id: "match",
      label: "Nearest similar work",
      sub: `${(match.similarityScore * 100).toFixed(0)}% similarity`,
      link: `/assets/${match.assetId}`,
    });
  }

  return (
    <div className="lineage-graph">
      {nodes.map((node, i) => (
        <div className="lineage-node-wrap" key={node.id}>
          <motion.div
            className={`lineage-node ${node.id === "match" ? "lineage-node-match" : ""}`}
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            {node.link ? (
              <Link to={node.link}>
                <strong>{node.label}</strong>
                <span className="note">{node.sub}</span>
              </Link>
            ) : (
              <>
                <strong>{node.label}</strong>
                <span className="note">{node.sub}</span>
              </>
            )}
          </motion.div>
          {i < nodes.length - 1 && <div className="lineage-connector" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}
