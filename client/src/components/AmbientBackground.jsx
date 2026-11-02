import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import {
  isWebGL2Available,
  isWebGLAvailable,
  prefersReducedMotion,
} from "../lib/deviceCapabilities";

// Heavy (three.js + R3F + GSAP) — lazy-loaded so it never blocks first paint on any page,
// same pattern as the Landing hero's 3D scene. This is what makes the background feel
// "full" in both light and dark mode: a real glowing 3D particle network behind every
// page, not just a flat CSS pattern.
const AmbientScene3D = lazy(() => import("./AmbientScene3D"));
const GradientWaves = lazy(() => import("./GradientWaves"));

const wavePalettes = {
  light: {
    horizonColor: "#DFF5D0",
    waveColor: "#497602",
    crestColor: "#9BFF00",
    brightness: 1,
    opacity: 1,
  },
  dark: {
    horizonColor: "#21340D",
    waveColor: "#6FAD08",
    crestColor: "#9BFF00",
    brightness: 1,
    opacity: 1,
  },
};

/**
 * Sitewide ambient background: a faint technical grid (always present, pure CSS) plus,
 * where supported, a real 3D glowing particle network drifting slowly behind the page.
 * Uses the GradientWaves shader as the single global wave layer so there is no second
 * set of CSS bands competing with the actual wave surface.
 */
export default function AmbientBackground() {
  const { theme } = useTheme();
  const [webglOk, setWebglOk] = useState(false);
  const [webgl2Ok, setWebgl2Ok] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const wavePalette = useMemo(
    () => wavePalettes[theme] ?? wavePalettes.light,
    [theme],
  );

  useEffect(() => {
    const supportsWebgl2 = isWebGL2Available();
    setWebgl2Ok(supportsWebgl2);
    setWebglOk(supportsWebgl2 || isWebGLAvailable());
    setReducedMotion(prefersReducedMotion());

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const showWaves = webgl2Ok && !reducedMotion;
  const showNetworkFallback = webglOk && !webgl2Ok && !reducedMotion;

  return (
    <>
      <div className="ambient-waves" aria-hidden="true">
        {showWaves && (
          <Suspense fallback={null}>
            <GradientWaves
              {...wavePalette}
              speed={0.4}
              amplitude={2.5}
              waveScale={0.6}
              waveRatio={0.9}
              swell={35}
              turbulence={20}
              tilt={1.11}
              zoom={1}
              height={5.5}
              fogDepth={15}
              detail="medium"
              mouseInteraction
              parallaxStrength={0.5}
              grain
              grainIntensity={0.05}
            />
          </Suspense>
        )}
      </div>
      <div className="ambient-grid" aria-hidden="true" />
      {showNetworkFallback && (
        <div className="ambient-network-3d" aria-hidden="true">
          <Suspense fallback={null}>
            <AmbientScene3D reducedMotion={reducedMotion} />
          </Suspense>
        </div>
      )}
    </>
  );
}
