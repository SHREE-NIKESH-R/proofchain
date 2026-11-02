import { lazy, Suspense, useEffect, useState } from "react";
import { isWebGLAvailable, prefersReducedMotion } from "../lib/deviceCapabilities";
import ProvenanceNetworkFallback from "./ProvenanceNetworkFallback";

// Heavy (three.js + R3F) — lazy-loaded so it never blocks the rest of the page,
// per the design system's performance rules (lazy-load heavy 3D assets).
const ProvenanceNetwork3D = lazy(() => import("./ProvenanceNetwork3D"));

export default function ProvenanceHero() {
  const [webglOk, setWebglOk] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setWebglOk(isWebGLAvailable());
    setReducedMotion(prefersReducedMotion());

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  if (!webglOk) {
    return <ProvenanceNetworkFallback />;
  }

  return (
    <div className="provenance-hero-canvas">
      <Suspense fallback={<ProvenanceNetworkFallback />}>
        <ProvenanceNetwork3D reducedMotion={reducedMotion} />
      </Suspense>
    </div>
  );
}
