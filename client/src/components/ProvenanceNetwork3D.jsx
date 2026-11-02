import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, Html } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";

/**
 * The six-stage provenance path this scene represents (spec Sections 14 / 45).
 * Order matters: this is the one signature visual reused across the product.
 */
const STAGES = [
  { label: "Prompt", pos: [-4.2, 1.4, 0] },
  { label: "AI model", pos: [-2.4, 0.2, 0.6] },
  { label: "Content", pos: [-0.6, 1.1, -0.4] },
  { label: "Fingerprint", pos: [1.2, -0.3, 0.4] },
  { label: "Blockchain proof", pos: [3.0, 0.7, -0.2] },
  { label: "Verification", pos: [4.6, -0.5, 0.3] },
];

function ProvenanceNode({ position, label, index, isLast, reducedMotion }) {
  const meshRef = useRef();
  const materialRef = useRef();
  const phase = useMemo(() => index * 0.9, [index]);

  // The "Verification" node gets a slow GSAP pulse — the one node in this scene that
  // represents a completed, confirmed state, so it's the one that visibly "breathes".
  useEffect(() => {
    if (!isLast || reducedMotion || !materialRef.current) return;
    const tween = gsap.to(materialRef.current, {
      emissiveIntensity: 0.6,
      duration: 1.4,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    return () => tween.kill();
  }, [isLast, reducedMotion]);

  useFrame(({ clock }) => {
    if (reducedMotion || !meshRef.current) return;
    // Slow, small floating motion — not a spectacle, just enough to read as "alive".
    meshRef.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.5 + phase) * 0.12;
  });

  return (
    <group>
      <mesh ref={meshRef} position={position}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial
          ref={materialRef}
          color={isLast ? "#16803C" : "#F1F2F0"}
          roughness={0.65}
          metalness={0.05}
          emissive={isLast ? "#16803C" : "#000000"}
          emissiveIntensity={isLast ? 0.25 : 0}
        />
      </mesh>
      <Html position={[position[0], position[1] - 0.42, position[2]]} center distanceFactor={8} style={{ pointerEvents: "none" }}>
        <span className="provenance-node-label">{label}</span>
      </Html>
    </group>
  );
}

function NetworkScene({ reducedMotion }) {
  const groupRef = useRef();
  const { viewport } = useThree();
  const pointer = useRef({ x: 0, y: 0 });

  useFrame(() => {
    if (!groupRef.current || reducedMotion) return;
    // Gentle parallax toward the pointer — explains depth without inviting interaction
    // that could be mistaken for a game or a draggable object (no OrbitControls here).
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, pointer.current.x * 0.15, 0.03);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -pointer.current.y * 0.08, 0.03);
  });

  function handlePointerMove(e) {
    pointer.current = {
      x: (e.clientX / window.innerWidth) * 2 - 1,
      y: (e.clientY / window.innerHeight) * 2 - 1,
    };
  }

  const linePoints = STAGES.map((s) => new THREE.Vector3(...s.pos));

  return (
    <group ref={groupRef} onPointerMove={handlePointerMove} scale={Math.min(viewport.width / 9, 1)}>
      <Line points={linePoints} color="#D8DBD8" lineWidth={1.2} transparent opacity={0.7} />
      {STAGES.map((s, i) => (
        <ProvenanceNode
          key={s.label}
          position={s.pos}
          label={s.label}
          index={i}
          isLast={i === STAGES.length - 1}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}

export default function ProvenanceNetwork3D({ reducedMotion }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 7.5], fov: 42 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 5, 5]} intensity={0.6} />
      <NetworkScene reducedMotion={reducedMotion} />
    </Canvas>
  );
}
