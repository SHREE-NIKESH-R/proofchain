import { motion, useReducedMotion } from "framer-motion";
import { FileCheck, ShieldCheck, ScanSearch, ArrowLeftRight } from "lucide-react";

/**
 * Builds a chronological timeline purely from data the app already has — registration
 * timestamp, ownership transfers, and whether originality analysis has run. No event is
 * invented; if a stage hasn't happened (e.g. no analysis yet), it isn't included.
 */
export default function ProvenanceTimeline({ asset, history }) {
  const shouldReduceMotion = useReducedMotion();

  const events = [
    {
      icon: FileCheck,
      label: "Content fingerprinted",
      detail: `SHA-256 hash generated at registration`,
      date: asset.registeredAt,
    },
    {
      icon: ShieldCheck,
      label: "Registered on-chain",
      detail: `Transaction ${asset.blockchainTxHash.slice(0, 14)}...`,
      date: asset.registeredAt,
    },
  ];

  if (asset.originalityAnalysis) {
    events.push({
      icon: ScanSearch,
      label: "Originality analysis run",
      detail: `${(asset.originalityAnalysis.similarityScore * 100).toFixed(0)}% similarity to nearest registered work`,
      date: asset.registeredAt, // analysis runs at registration time in the current pipeline
    });
  }

  for (const transfer of history) {
    events.push({
      icon: ArrowLeftRight,
      label: "Ownership transferred",
      detail: `${transfer.fromWallet.slice(0, 8)}... → ${transfer.toWallet.slice(0, 8)}...`,
      date: transfer.timestamp,
    });
  }

  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="timeline">
      {events.map((event, i) => {
        const Icon = event.icon;
        return (
          <motion.div
            className="timeline-event"
            key={i}
            initial={shouldReduceMotion ? false : { opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
          >
            <span className="timeline-dot"><Icon size={13} strokeWidth={2} /></span>
            <div className="timeline-body">
              <p className="timeline-label">{event.label}</p>
              <p className="note">{event.detail}</p>
              <p className="note mono-text">{new Date(event.date).toLocaleString()}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
