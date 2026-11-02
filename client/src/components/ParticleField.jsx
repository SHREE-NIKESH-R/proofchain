import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../lib/deviceCapabilities";

const PARTICLE_COUNT_DESKTOP = 18;
const PARTICLE_COUNT_MOBILE = 8;

/**
 * A sparse field of slow-moving dots representing registered assets drifting through
 * the provenance network — not a starfield. Canvas 2D (not a second WebGL context)
 * to stay cheap alongside the 3D hero scene. Disabled entirely under reduced-motion.
 */
export default function ParticleField() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) return; // static/no canvas at all — nothing to freeze mid-frame

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const isMobile = window.innerWidth < 640;
    const count = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;

    function resize() {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    }
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.08,
      vy: (Math.random() - 0.5) * 0.08,
      r: (1 + Math.random() * 1.5) * window.devicePixelRatio,
    }));

    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(22, 128, 60, 0.18)"; // proof-green, very low opacity
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (prefersReducedMotion()) return null;

  return <canvas ref={canvasRef} className="particle-field" aria-hidden="true" />;
}
