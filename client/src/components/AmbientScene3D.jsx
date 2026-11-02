import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";

const NODE_COUNT_DESKTOP = 55;
const NODE_COUNT_MOBILE = 26;
const LINK_DISTANCE = 2.6;
const BOUNDS = { x: 9, y: 5, z: 3 };

/** A soft, round radial-gradient sprite so points render as glowing dots, not hard squares. */
function useGlowTexture() {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.4, "rgba(255,255,255,0.5)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);
}

function readThemeColor() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  return new THREE.Color(isDark ? "#22B860" : "#16803C");
}

function ParticleNetwork({ reducedMotion }) {
  const { viewport } = useThree();
  const groupRef = useRef();
  const pointsRef = useRef();
  const lineRef = useRef();
  const glowTexture = useGlowTexture();
  const pointer = useRef({ x: 0, y: 0 });

  const isMobile = viewport.width < 6;
  const count = isMobile ? NODE_COUNT_MOBILE : NODE_COUNT_DESKTOP;

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * BOUNDS.x * 2,
        (Math.random() - 0.5) * BOUNDS.y * 2,
        (Math.random() - 0.5) * BOUNDS.z * 2
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.004,
        (Math.random() - 0.5) * 0.004,
        (Math.random() - 0.5) * 0.002
      ),
    }));
  }, [count]);

  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const maxLinePairs = count * 6; // generous cap; unused segments collapse to zero-length
  const linePositions = useMemo(() => new Float32Array(maxLinePairs * 6), [maxLinePairs]);

  const color = useMemo(() => readThemeColor(), []);

  // Re-read the accent color whenever the theme toggles (data-theme attribute changes).
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const next = readThemeColor();
      color.copy(next);
      if (pointsRef.current) pointsRef.current.material.color.copy(next);
      if (lineRef.current) lineRef.current.material.color.copy(next);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [color]);

  // Slow, continuous idle rotation via GSAP — independent of the per-frame pointer
  // parallax below, giving the whole network a gentle, never-quite-still drift.
  useEffect(() => {
    if (reducedMotion || !groupRef.current) return;
    const tween = gsap.to(groupRef.current.rotation, {
      y: `+=${Math.PI * 2}`,
      duration: 180,
      repeat: -1,
      ease: "none",
    });
    return () => tween.kill();
  }, [reducedMotion]);

  useEffect(() => {
    function handlePointerMove(e) {
      pointer.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    }
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  useFrame(() => {
    if (reducedMotion) return;

    // Drift each particle and bounce within bounds.
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.position.add(p.velocity);
      if (Math.abs(p.position.x) > BOUNDS.x) p.velocity.x *= -1;
      if (Math.abs(p.position.y) > BOUNDS.y) p.velocity.y *= -1;
      if (Math.abs(p.position.z) > BOUNDS.z) p.velocity.z *= -1;
      positions[i * 3] = p.position.x;
      positions[i * 3 + 1] = p.position.y;
      positions[i * 3 + 2] = p.position.z;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;

    // Connect nearby particles — recomputed every frame but cheap at this node count.
    let segIndex = 0;
    for (let i = 0; i < particles.length && segIndex < maxLinePairs; i++) {
      for (let j = i + 1; j < particles.length && segIndex < maxLinePairs; j++) {
        const dist = particles[i].position.distanceTo(particles[j].position);
        if (dist < LINK_DISTANCE) {
          linePositions[segIndex * 6] = particles[i].position.x;
          linePositions[segIndex * 6 + 1] = particles[i].position.y;
          linePositions[segIndex * 6 + 2] = particles[i].position.z;
          linePositions[segIndex * 6 + 3] = particles[j].position.x;
          linePositions[segIndex * 6 + 4] = particles[j].position.y;
          linePositions[segIndex * 6 + 5] = particles[j].position.z;
          segIndex++;
        }
      }
    }
    // Collapse any unused segment slots to zero-length so they don't render as stray lines.
    for (let k = segIndex; k < maxLinePairs; k++) {
      linePositions[k * 6] = linePositions[k * 6 + 1] = linePositions[k * 6 + 2] = 0;
      linePositions[k * 6 + 3] = linePositions[k * 6 + 4] = linePositions[k * 6 + 5] = 0;
    }
    lineRef.current.geometry.attributes.position.needsUpdate = true;
    lineRef.current.geometry.setDrawRange(0, segIndex * 2);

    // Gentle parallax toward the pointer, layered on top of the GSAP idle rotation.
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -pointer.current.y * 0.08, 0.02);
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          size={0.22}
          map={glowTexture}
          color={color}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
      <lineSegments ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={maxLinePairs * 2} array={linePositions} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} />
      </lineSegments>
    </group>
  );
}

export default function AmbientScene3D({ reducedMotion }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 50 }}
      dpr={[1, 1.4]}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      style={{ width: "100%", height: "100%" }}
    >
      <ParticleNetwork reducedMotion={reducedMotion} />
    </Canvas>
  );
}
