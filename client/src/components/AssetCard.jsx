import { useRef } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import {
  FileText,
  Newspaper,
  Image as ImageIcon,
  Music,
  Video,
} from "lucide-react";
import { formatAssetId } from "../lib/formatAssetId";

const TYPE_ICON = {
  prompt: FileText,
  article: Newspaper,
  image: ImageIcon,
  music: Music,
  video: Video,
};

export default function AssetCard({ asset }) {
  const ref = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  const Icon = TYPE_ICON[asset.contentType] || FileText;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [7, -7]), {
    stiffness: 300,
    damping: 25,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-7, 7]), {
    stiffness: 300,
    damping: 25,
  });

  function handleMouseMove(e) {
    if (shouldReduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={
        shouldReduceMotion
          ? undefined
          : { rotateX, rotateY, transformStyle: "preserve-3d" }
      }
      whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to={`/assets/${asset.assetId}`} className="card asset-card">
        <div className="asset-card-icon">
          <Icon size={18} strokeWidth={2} />
        </div>
        <h3>{asset.title}</h3>
        <p className="note">
          {asset.contentType} · {asset.status}
        </p>
        <p className="note">Asset ID: {formatAssetId(asset.assetId)}</p>
        {asset.evidenceScore !== null && asset.evidenceScore !== undefined && (
          <p className="score-mini">
            Evidence score: {asset.evidenceScore}/100
          </p>
        )}
        <p className="note">
          Registered {new Date(asset.registeredAt).toLocaleDateString()}
        </p>
      </Link>
    </motion.div>
  );
}
