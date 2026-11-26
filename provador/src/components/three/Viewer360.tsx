"use client";

import { CameraControls, ContactShadows, Environment, Lightformer, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, forwardRef, type ReactNode, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { heightScale, morphWeights } from "@/lib/body/morphs";
import { BASE_BODY, BASE_FOLGA, type BodyMeasurements, type Sexo } from "@/lib/body/types";
import { composeShirtTexture, knitNormalCanvas, type ShirtTextureSpec } from "@/lib/client/shirt-texture";
import { shade } from "@/lib/format";

/**
 * Visualização 360°: manequim paramétrico (proporções estimadas do cliente) +
 * camiseta base com a textura do produto. Gire com o dedo/mouse, pinça ou
 * roda do mouse para zoom.
 *
 * Lembrete honesto: é um AVATAR com proporções aproximadas, não o corpo real.
 */
export type ViewName = "frente" | "costas" | "esquerda" | "direita";

export interface ViewerHandle {
  snapshot: () => string | null;
  setView: (v: ViewName) => void;
  zoom: (closer: boolean) => void;
}

interface Props {
  sexo: Sexo;
  measurements: BodyMeasurements | null;
  /** circunferência do peito da camiseta (m) no tamanho escolhido; null = caimento padrão */
  shirtChest: number | null;
  texture: ShirtTextureSpec | null;
  autoRotate?: boolean;
  interactive?: boolean;
  className?: string;
  onReady?: () => void;
  onInteract?: () => void;
}

const AZIMUTH: Record<ViewName, number> = { frente: 0, costas: Math.PI, esquerda: Math.PI / 2, direita: -Math.PI / 2 };

useGLTF.preload("/models/camiseta-base.glb");

function useMorphTargets(root: THREE.Object3D, weights: Record<string, number>) {
  const meshes = useMemo(() => {
    const list: THREE.Mesh[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.morphTargetDictionary) list.push(m);
    });
    return list;
  }, [root]);
  const target = useRef(weights);
  target.current = weights;
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 8); // transição suave ao trocar tamanho/medidas
    for (const mesh of meshes) {
      const dict = mesh.morphTargetDictionary!;
      const inf = mesh.morphTargetInfluences!;
      for (const [name, idx] of Object.entries(dict)) {
        const t = target.current[name] ?? 0;
        inf[idx] += (t - inf[idx]) * k;
      }
    }
  });
}

function Mannequin({ sexo, weights }: { sexo: Sexo; weights: Record<string, number> }) {
  const { scene } = useGLTF(`/models/manequim-${sexo}.glb`);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.envMapIntensity = 0.9;
      }
    });
    return c;
  }, [scene]);
  useMorphTargets(obj, weights);
  return <primitive object={obj} />;
}

function Shirt({ sexo, weights, spec, onTextureReady }: { sexo: Sexo; weights: Record<string, number>; spec: ShirtTextureSpec; onTextureReady?: () => void }) {
  const { scene } = useGLTF("/models/camiseta-base.glb");
  const gl = useThree((s) => s.gl);
  const node = useMemo(() => {
    const src = scene.getObjectByName(`Camiseta_${sexo}`) ?? scene.children[0];
    return src.clone(true);
  }, [scene, sexo]);
  const canvas = useMemo(() => document.createElement("canvas"), []);
  const map = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return t;
  }, [canvas, gl]);
  const normalMap = useMemo(() => {
    const t = new THREE.CanvasTexture(knitNormalCanvas());
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(36, 36);
    return t;
  }, []);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map,
        normalMap,
        normalScale: new THREE.Vector2(0.28, 0.28),
        roughness: 0.86,
        sheen: 1,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color("#ffffff"),
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        envMapIntensity: 1.1,
      }),
    [map, normalMap],
  );
  useEffect(() => {
    node.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = material;
        m.castShadow = true;
      }
    });
  }, [node, material]);
  const specKey = JSON.stringify(spec);
  useEffect(() => {
    let alive = true;
    composeShirtTexture(spec, sexo, 2048, canvas).then(() => {
      if (!alive) return;
      map.needsUpdate = true;
      material.sheenColor.set(shade(spec.hex, 0.35));
      onTextureReady?.();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey, sexo, canvas, map, material]);
  useEffect(() => () => {
    map.dispose();
    normalMap.dispose();
    material.dispose();
  }, [map, normalMap, material]);
  useMorphTargets(node, weights);
  return <primitive object={node} />;
}

function Rig({
  handleRef,
  scale,
  autoRotate,
  interactive,
  onInteract,
}: {
  handleRef: React.RefObject<ViewerHandle | null>;
  scale: number;
  autoRotate: boolean;
  interactive: boolean;
  onInteract?: () => void;
}) {
  const controls = useRef<CameraControls>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const idleSince = useRef(0);
  const ty = 1.0 * scale;

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.setLookAt(0.35 * scale, 1.2 * scale, 4.0 * scale, 0, ty * 0.95, 0, false);
  }, [scale, ty]);

  useImperativeHandle(handleRef, () => ({
    snapshot: () => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    },
    setView: (v) => {
      idleSince.current = performance.now();
      controls.current?.rotateTo(AZIMUTH[v], Math.PI / 2.15, true);
    },
    zoom: (closer) => {
      idleSince.current = performance.now();
      const c = controls.current;
      if (!c) return;
      c.dollyTo(closer ? 1.5 * scale : 4.0 * scale, true);
      c.moveTo(0, closer ? 1.22 * scale : ty * 0.95, 0, true);
    },
  }));

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c || !autoRotate) return;
    if (performance.now() - idleSince.current < 4000) return;
    c.azimuthAngle += dt * 0.35;
  });

  return (
    <CameraControls
      ref={controls}
      enabled={interactive}
      minDistance={0.9 * scale}
      maxDistance={5 * scale}
      minPolarAngle={Math.PI * 0.22}
      maxPolarAngle={Math.PI * 0.62}
      smoothTime={0.35}
      truckSpeed={0}
      onStart={() => {
        idleSince.current = performance.now() + 1e9;
        onInteract?.();
      }}
      onEnd={() => {
        idleSince.current = performance.now();
      }}
    />
  );
}

class GLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

export const Viewer360 = forwardRef<ViewerHandle, Props>(function Viewer360(
  { sexo, measurements, shirtChest, texture, autoRotate = true, interactive = true, className = "", onReady, onInteract },
  ref,
) {
  const handle = useRef<ViewerHandle | null>(null);
  useImperativeHandle(ref, () => ({
    snapshot: () => handle.current?.snapshot() ?? null,
    setView: (v) => handle.current?.setView(v),
    zoom: (c) => handle.current?.zoom(c),
  }));
  const [loaded, setLoaded] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || visible) return;
    const check = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) setVisible(true);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible]);
  const m = measurements ?? BASE_BODY[sexo];
  const scale = heightScale(m);
  const bodyWeights = useMemo(() => morphWeights(m), [m]);
  const shirtWeights = useMemo(
    () => morphWeights(m, shirtChest !== null ? shirtChest - m.peito : BASE_FOLGA[sexo] * scale),
    [m, shirtChest, sexo, scale],
  );

  return (
    <div ref={box} className={`relative ${className}`}>
      {visible && (
      <GLErrorBoundary
        fallback={
          <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">
            Seu navegador não conseguiu abrir a visualização 3D (WebGL indisponível).
          </div>
        }
      >
        <Canvas
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
          camera={{ fov: 30, near: 0.05, far: 50, position: [0.35, 1.25, 3.6] }}
          style={{ touchAction: "none" }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[2.5, 4, 3]} intensity={2.4} />
          <directionalLight position={[0, 1.5, 4]} intensity={0.7} />
          <directionalLight position={[-3, 2.5, -2.5]} intensity={0.9} color="#efe6d2" />
          <Environment resolution={256} frames={1}>
            <Lightformer form="rect" intensity={2.2} position={[0, 4, 2]} scale={[6, 1.2, 1]} />
            <Lightformer form="rect" intensity={1.1} position={[-4, 1.8, 0.5]} rotation-y={Math.PI / 2} scale={[4, 2.5, 1]} />
            <Lightformer form="rect" intensity={1.1} position={[4, 1.8, 0.5]} rotation-y={-Math.PI / 2} scale={[4, 2.5, 1]} />
            <Lightformer form="ring" color="#c7a96b" intensity={0.7} position={[0, 1.6, -4]} scale={2.5} />
          </Environment>
          <Suspense fallback={null}>
            <group scale={scale}>
              <Mannequin sexo={sexo} weights={bodyWeights} />
              {texture && <Shirt sexo={sexo} weights={shirtWeights} spec={texture} />}
            </group>
            <ContactShadows position={[0, 0.002, 0]} opacity={0.42} scale={3.2} blur={2.6} far={1.4} resolution={512} />
            <Ready
              onReady={() => {
                setLoaded(true);
                onReady?.();
              }}
            />
          </Suspense>
          <Rig handleRef={handle} scale={scale} autoRotate={autoRotate} interactive={interactive} onInteract={onInteract} />
        </Canvas>
      </GLErrorBoundary>
      )}
      {!loaded && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3 text-xs font-semibold tracking-wide text-muted uppercase">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-gold" />
            Montando o avatar 3D…
          </div>
        </div>
      )}
    </div>
  );
});
