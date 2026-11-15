"use client";
/* eslint-disable react-hooks/immutability -- label anchors are intentionally positioned from the render loop. */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";
import type {BaseRoom, BaseRoomId, BaseVisuals} from "@/lib/club-base";
import {applyComicMaterial} from "@/lib/comic-material";
import {COMIC_INK, COMIC_PALETTE, comicPaletteFor, halftoneSpec, inkOutline} from "@/lib/comic-art";

type Language = "en" | "zh";

type Props = {
  visuals: BaseVisuals;
  language: Language;
  onUnavailable: () => void;
};

type LabelAnchor = HTMLAnchorElement | null;

declare global {
  interface Window {
    __clubBaseFps?: number;
    __clubBaseReady?: boolean;
    __clubBaseReduced?: boolean;
    __clubBaseHovered?: string | null;
    __clubBaseComic?: boolean;
    __clubBaseTransition?: { active: string; href: string; startedAt: number } | null;
    __clubBaseRooms?: {
      id: string;
      label: string;
      labelZh: string;
      href: string;
      screenX: number;
      screenY: number;
      visible: boolean;
    }[];
  }
}

const LABEL_HEIGHTS: Record<BaseRoomId, number> = {
  training: 3.4,
  tactics: 7.2,
  dressing: 6.2,
  stadium: 9.4,
  trophies: 7.6,
  transfers: 7.2,
  league: 7.2,
  cup: 7.6,
};

const BASE_Y = 1.1;

/** Small per-room label offsets keep crowded clusters readable. */
const LABEL_OFFSETS: Record<BaseRoomId, { dx: number; dy: number }> = {
  training: { dx: 44, dy: -6 },
  tactics: { dx: -34, dy: 4 },
  dressing: { dx: 10, dy: 16 },
  stadium: { dx: -18, dy: -22 },
  trophies: { dx: -28, dy: -18 },
  transfers: { dx: 42, dy: 10 },
  league: { dx: 40, dy: -8 },
  cup: { dx: -46, dy: 8 },
};

/* ------------------------------------------------------------------ */
/* comic helpers                                                        */
/* ------------------------------------------------------------------ */

function comicGradient(): THREE.DataTexture {
  const data = new Uint8Array([90, 160, 255]);
  const texture = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  texture.needsUpdate = true;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

function comicMaterial(colour: string, options: { emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number } = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 1,
    metalness: 0,
    emissive: options.emissive ?? "#000000",
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
  return applyComicMaterial(material);
}

function halftoneGroundTexture(): THREE.CanvasTexture {
  const spec = halftoneSpec("medium");
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, size, size);
    context.fillStyle = "rgba(16, 21, 31, 0.9)";
    const angle = (spec.angleDegrees * Math.PI) / 180;
    for (let row = -size; row < size * 2; row += spec.scale) {
      for (let column = -size; column < size * 2; column += spec.scale) {
        const x = column * Math.cos(angle) - row * Math.sin(angle);
        const y = column * Math.sin(angle) + row * Math.cos(angle);
        if (x < -spec.radius || x > size + spec.radius || y < -spec.radius || y > size + spec.radius) continue;
        context.beginPath();
        context.arc(x, y, spec.radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 9);
  texture.needsUpdate = true;
  return texture;
}

function ComicBox({
  args,
  position,
  rotation,
  color,
  gradientMap,
  emissive,
  scale = 1,
}: {
  args: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  gradientMap: THREE.Texture;
  emissive?: string;
  scale?: number;
}) {
  const material = useMemo(
    () => comicMaterial(color, { emissive, emissiveIntensity: emissive ? 0.55 : 0 }),
    [color, emissive],
  );
  const outline = useMemo(() => new THREE.MeshBasicMaterial({ color: inkOutline(1).colour, side: THREE.BackSide }), []);
  useEffect(() => () => { material.dispose(); outline.dispose(); }, [material, outline]);
  void gradientMap;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh material={material}>
        <boxGeometry args={args} />
      </mesh>
      <mesh scale={inkOutline(1).scale} material={outline}>
        <boxGeometry args={args} />
      </mesh>
    </group>
  );
}

function ComicCylinder({
  args,
  position,
  rotation,
  color,
  gradientMap,
  emissive,
}: {
  args: [number, number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  gradientMap: THREE.Texture;
  emissive?: string;
}) {
  const material = useMemo(
    () => comicMaterial(color, { emissive, emissiveIntensity: emissive ? 0.55 : 0 }),
    [color, emissive],
  );
  const outline = useMemo(() => new THREE.MeshBasicMaterial({ color: inkOutline(1).colour, side: THREE.BackSide }), []);
  useEffect(() => () => { material.dispose(); outline.dispose(); }, [material, outline]);
  void gradientMap;
  return (
    <group position={position} rotation={rotation}>
      <mesh material={material}>
        <cylinderGeometry args={args} />
      </mesh>
      <mesh scale={inkOutline(1).scale} material={outline}>
        <cylinderGeometry args={args} />
      </mesh>
    </group>
  );
}

function Floodlights({ count, color, gradientMap }: { count: number; color: string; gradientMap: THREE.Texture }) {
  const spots = useMemo(
    () => [
      [-3.2, -2.2],
      [3.2, -2.2],
      [-3.2, 2.2],
      [3.2, 2.2],
    ],
    [],
  );
  return (
    <>
      {spots.slice(0, Math.max(0, Math.min(4, count))).map(([x, z], index) => (
        <group key={index} position={[x, 0, z]}>
          <ComicCylinder args={[0.12, 0.16, 4.2, 5]} position={[0, 2.1, 0]} color="#57637a" gradientMap={gradientMap} />
          <ComicBox args={[1.1, 0.35, 0.5]} position={[0, 4.35, 0]} color={color} emissive="#ffe9a3" gradientMap={gradientMap} />
        </group>
      ))}
    </>
  );
}

function Pitch({ room, visuals, hovered, gradientMap, onHover }: BuildingProps) {
  const lines = useMemo(() => {
    const entries: { x: number; z: number; w: number; d: number }[] = [];
    entries.push({ x: 0, z: 0, w: 8.4, d: 5.6 });
    entries.push({ x: 0, z: 0, w: 0.12, d: 5.6 });
    return entries;
  }, []);
  return (
    <group onPointerOver={(event) => { event.stopPropagation(); onHover(room.id); }} onPointerOut={() => onHover(null)}>
      <ComicBox args={[9.2, 0.5, 6.4]} position={[0, 0.25, 0]} color={room.accent[1]} gradientMap={gradientMap} />
      {lines.map((line, index) => (
        <mesh key={index} position={[line.x, 0.52, line.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[line.w, line.d]} />
          <meshBasicMaterial color={index === 0 ? room.accent[1] : "#f2f7ee"} transparent opacity={index === 0 ? 1 : 0.55} />
        </mesh>
      ))}
      <ComicBox args={[8.4, 0.08, 5.6]} position={[0, 0.53, 0]} color="#3d9a5e" gradientMap={gradientMap} />
      {[-4.15, 4.15].map((x) => (
        <group key={x} position={[x, 0.6, 0]}>
          <ComicBox args={[0.3, 0.12, 3.2]} position={[0, 0, 0]} color="#f4f7ef" gradientMap={gradientMap} />
          {[-1.6, 1.6].map((z) => (
            <ComicBox key={z} args={[0.25, 1.4, 0.3]} position={[0, 0.7, z]} color="#f4f7ef" gradientMap={gradientMap} />
          ))}
        </group>
      ))}
      <Floodlights count={Math.max(2, visuals.training.pitchLights)} color={room.accent[0]} gradientMap={gradientMap} />
      <group visible={hovered}>
        <mesh position={[0, 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[5.4, 6.1, 32]} />
          <meshBasicMaterial color={room.accent[0]} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

function Stadium({ room, visuals, hovered, gradientMap, onHover }: BuildingProps) {
  const tiers = Math.max(1, Math.min(5, visuals.stadium.stands));
  return (
    <group onPointerOver={(event) => { event.stopPropagation(); onHover(room.id); }} onPointerOut={() => onHover(null)}>
      <ComicBox args={[8.8, 0.5, 6.2]} position={[0, 0.25, 0]} color="#3d9a5e" gradientMap={gradientMap} />
      {Array.from({ length: tiers }).map((_, tier) => (
        <ComicBox
          key={tier}
          args={[8.4, 0.8, 5.8]}
          position={[0, 0.9 + tier * 0.8, 0]}
          color={tier % 2 === 0 ? room.accent[1] : "#d7e8ff"}
          gradientMap={gradientMap}
        />
      ))}
      <ComicBox args={[4.6, 0.5, 3.2]} position={[0, 1.2 + tiers * 0.8, 0]} color="#3d9a5e" gradientMap={gradientMap} />
      {[-1.6, 1.6].map((x) => (
        <ComicBox key={x} args={[0.18, 0.8, 1.8]} position={[x, 1.85 + tiers * 0.8, 0]} color="#f4f7ef" gradientMap={gradientMap} />
      ))}
      {visuals.stadium.floodlights ? <Floodlights count={4} color={room.accent[1]} gradientMap={gradientMap} /> : null}
      <group visible={hovered}>
        <mesh position={[0, 0.7, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[5.4, 6.1, 32]} />
          <meshBasicMaterial color={room.accent[0]} transparent opacity={0.65} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

function OfficeBuilding({ room, hovered, gradientMap, onHover, tall = false }: BuildingProps & { tall?: boolean }) {
  const height = tall ? 4.6 : 3.8;
  return (
    <group onPointerOver={(event) => { event.stopPropagation(); onHover(room.id); }} onPointerOut={() => onHover(null)}>
      <ComicBox args={[4.6, 0.4, 4.2]} position={[0, 0.2, 0]} color="#b8c7d8" gradientMap={gradientMap} />
      <ComicBox args={[4.2, height, 3.8]} position={[0, 0.4 + height / 2, 0]} color={room.accent[0]} gradientMap={gradientMap} />
      <ComicBox args={[4.8, 0.5, 4.4]} position={[0, 0.55 + height, 0]} color={room.accent[1]} gradientMap={gradientMap} />
      <ComicBox args={[1.1, 1.6, 0.2]} position={[0, 1.2, 1.95]} color="#0f2233" gradientMap={gradientMap} />
      {[-1.4, 1.4].map((x) => (
        <ComicBox key={x} args={[0.8, 0.7, 0.12]} position={[x, 2.3, 1.96]} color="#e8f6ff" emissive="#d8f3ff" gradientMap={gradientMap} />
      ))}
      <group visible={hovered}>
        <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.6, 4.2, 28]} />
          <meshBasicMaterial color="#ffe14a" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

function DressingRoom({ room, hovered, gradientMap, onHover }: BuildingProps) {
  return (
    <group onPointerOver={(event) => { event.stopPropagation(); onHover(room.id); }} onPointerOut={() => onHover(null)}>
      <ComicBox args={[4.8, 0.4, 4.2]} position={[0, 0.2, 0]} color="#b8c7d8" gradientMap={gradientMap} />
      <ComicBox args={[4.4, 3.2, 3.8]} position={[0, 2, 0]} color={room.accent[0]} gradientMap={gradientMap} />
      <ComicBox args={[5, 0.5, 4.3]} position={[0, 3.85, 0]} color={room.accent[1]} gradientMap={gradientMap} />
      {[-1.6, 0, 1.6].map((x) => (
        <ComicBox key={x} args={[0.9, 0.5, 0.5]} position={[x, 0.8, 2.1]} color="#e8f6ff" gradientMap={gradientMap} />
      ))}
      <ComicBox args={[0.9, 1.5, 0.15]} position={[0, 1.4, 1.95]} color="#0f2233" gradientMap={gradientMap} />
      <group visible={hovered}>
        <mesh position={[0, 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.5, 4.1, 28]} />
          <meshBasicMaterial color="#ffe14a" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

function TrophyRoom({ room, hovered, gradientMap, onHover }: BuildingProps) {
  const glassMaterial = useMemo(
    () => comicMaterial(room.accent[0], { emissive: "#f4d08a", emissiveIntensity: 0.3, transparent: true, opacity: 0.32 }),
    [room.accent],
  );
  const goldMaterial = useMemo(() => comicMaterial("#f4d08a", { emissive: "#f4d08a", emissiveIntensity: 0.9 }), []);
  useEffect(
    () => () => {
      glassMaterial.dispose();
      goldMaterial.dispose();
    },
    [glassMaterial, goldMaterial],
  );
  return (
    <group onPointerOver={(event) => { event.stopPropagation(); onHover(room.id); }} onPointerOut={() => onHover(null)}>
      <ComicBox args={[4.8, 0.5, 4.4]} position={[0, 0.25, 0]} color="#b8c7d8" gradientMap={gradientMap} />
      <ComicBox args={[3.2, 1.1, 3]} position={[0, 0.9, 0]} color={room.accent[1]} gradientMap={gradientMap} />
      <mesh position={[0, 2.7, 0]}>
        <boxGeometry args={[3.8, 3.4, 3.4]} />
        <primitive object={glassMaterial} attach="material" />
      </mesh>
      <ComicBox args={[4.6, 0.4, 4.2]} position={[0, 4.55, 0]} color={room.accent[1]} gradientMap={gradientMap} />
      <pointLight color="#ffd36e" intensity={3} distance={15} position={[0, 3.2, 0]} />
      <ComicCylinder args={[0.1, 0.36, 1.1, 8]} position={[0, 1.95, 0]} color="#e7b84a" emissive="#f4d08a" gradientMap={gradientMap} />
      <mesh position={[0, 2.85, 0]}>
        <sphereGeometry args={[0.85, 14, 10]} />
        <primitive object={goldMaterial} attach="material" />
      </mesh>
      <mesh position={[0, 2.9, 0]}>
        <sphereGeometry args={[2.8, 18, 12]} />
        <meshBasicMaterial color={room.accent[0]} transparent opacity={hovered ? 0.24 : 0.14} depthWrite={false} />
      </mesh>
      <group visible={hovered}>
        <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.5, 4.1, 28]} />
          <meshBasicMaterial color="#ffe14a" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

function Gate({ room, hovered, gradientMap, onHover }: BuildingProps) {
  return (
    <group onPointerOver={(event) => { event.stopPropagation(); onHover(room.id); }} onPointerOut={() => onHover(null)}>
      <ComicBox args={[3.6, 0.4, 1.2]} position={[0, 0.2, 0]} color="#b8c7d8" gradientMap={gradientMap} />
      {[-1.7, 1.7].map((x) => (
        <ComicCylinder key={x} args={[0.35, 0.4, 3.6, 6]} position={[x, 2, 0]} color={room.accent[0]} gradientMap={gradientMap} />
      ))}
      <ComicBox args={[4.2, 0.5, 0.7]} position={[0, 4, 0]} color={room.accent[1]} gradientMap={gradientMap} />
      <group visible={hovered}>
        <mesh position={[0, 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.6, 3.1, 24]} />
          <meshBasicMaterial color="#ffe14a" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

type BuildingProps = {
  room: BaseRoom;
  visuals: BaseVisuals;
  hovered: boolean;
  gradientMap: THREE.Texture;
  onHover: (id: BaseRoomId | null) => void;
};

function Building({ room, visuals, hovered, gradientMap, onHover }: BuildingProps) {
  const scale = hovered ? 1.06 : 1;
  return (
    <group position={[room.x, BASE_Y, room.z]} scale={scale}>
      {room.building === "pitch" ? <Pitch room={room} visuals={visuals} hovered={hovered} gradientMap={gradientMap} onHover={onHover} /> : null}
      {room.building === "stadium" ? <Stadium room={room} visuals={visuals} hovered={hovered} gradientMap={gradientMap} onHover={onHover} /> : null}
      {room.building === "office" ? <OfficeBuilding room={room} visuals={visuals} hovered={hovered} gradientMap={gradientMap} onHover={onHover} tall={room.id === "tactics"} /> : null}
      {room.building === "dressing" ? <DressingRoom room={room} visuals={visuals} hovered={hovered} gradientMap={gradientMap} onHover={onHover} /> : null}
      {room.building === "trophy" ? <TrophyRoom room={room} visuals={visuals} hovered={hovered} gradientMap={gradientMap} onHover={onHover} /> : null}
      {room.building === "gate" ? <Gate room={room} visuals={visuals} hovered={hovered} gradientMap={gradientMap} onHover={onHover} /> : null}
    </group>
  );
}

function ComicSky({ palette }: { palette: ReturnType<typeof comicPaletteFor> }) {
  const sunMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: palette.burst[0] }), [palette.burst]);
  const rayMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: palette.burst[0], transparent: true, opacity: 0.62 }),
    [palette.burst],
  );
  const cloudMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: COMIC_PALETTE.paper, roughness: 1 }), []);
  const cloudOutline = useMemo(() => new THREE.MeshBasicMaterial({ color: COMIC_INK, side: THREE.BackSide }), []);
  useEffect(
    () => () => {
      sunMaterial.dispose();
      rayMaterial.dispose();
      cloudMaterial.dispose();
      cloudOutline.dispose();
    },
    [sunMaterial, rayMaterial, cloudMaterial, cloudOutline],
  );
  const rays = useMemo(() => Array.from({ length: 12 }, (_, index) => (index / 12) * Math.PI * 2), []);
  return (
    <group>
      <group position={[14, 32, -32]}>
        <mesh material={sunMaterial}>
          <circleGeometry args={[5.2, 28]} />
        </mesh>
        {rays.map((angle, index) => (
          <mesh
            key={index}
            position={[Math.cos(angle) * 6.3, Math.sin(angle) * 6.3, 0]}
            rotation={[0, 0, angle]}
            material={rayMaterial}
          >
            <boxGeometry args={[3.1, 0.42, 0.04]} />
          </mesh>
        ))}
      </group>
      {[
        { x: -18, y: 17, z: -16, scale: 1.4 },
        { x: 16, y: 21, z: -20, scale: 1.9 },
        { x: 34, y: 15, z: -8, scale: 1.1 },
      ].map((cloud, cloudIndex) => (
        <group key={cloudIndex} position={[cloud.x, cloud.y, cloud.z]} scale={cloud.scale}>
          {[
            [-1.5, 0, 0, 1.1],
            [0.1, 0.5, 0.1, 1.5],
            [1.7, 0.1, -0.1, 1],
          ].map(([x, y, z, radius], puffIndex) => (
            <group key={puffIndex} position={[x, y, z]}>
              <mesh material={cloudMaterial}>
                <sphereGeometry args={[radius, 14, 10]} />
              </mesh>
              <mesh material={cloudOutline} scale={1.08}>
                <sphereGeometry args={[radius, 14, 10]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

function BaseDiorama({ visuals, hovered, onHover }: { visuals: BaseVisuals; hovered: string | null; onHover: (id: BaseRoomId | null) => void }) {
  const gradientMap = useMemo(() => comicGradient(), []);
  const palette = useMemo(() => comicPaletteFor(visuals.theme.primary, visuals.theme.secondary), [visuals.theme]);
  const halftone = useMemo(() => halftoneGroundTexture(), []);
  const halftoneMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: halftone, transparent: true, opacity: 0.55, depthWrite: false }),
    [halftone],
  );
  useEffect(
    () => () => {
      gradientMap.dispose();
      halftone.dispose();
      halftoneMaterial.dispose();
    },
    [gradientMap, halftone, halftoneMaterial],
  );
  return (
    <>
      <color attach="background" args={["#9ad8ff"]} />
      <fog attach="fog" args={["#bfe6ff", 95, 210]} />
      <ambientLight intensity={1.6} />
      <hemisphereLight args={["#ffffff", "#264631", 1.2]} />
      <directionalLight position={[-18, 30, 20]} intensity={2.3} />
      <directionalLight position={[22, 22, -18]} intensity={0.85} color="#c7e2ff" />
      <ComicSky palette={palette} />
      <ComicBox args={[54, 1.4, 42]} position={[1, -0.7, 0]} color={COMIC_INK} gradientMap={gradientMap} />
      <ComicBox args={[51.5, 0.5, 39.5]} position={[1, 0.15, 0]} color="#3a8154" gradientMap={gradientMap} />
      <ComicBox args={[46, 0.22, 34]} position={[1, 0.42, 0]} color="#468f5d" gradientMap={gradientMap} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1, 0.5, 0]} material={halftoneMaterial}>
        <planeGeometry args={[45.4, 33.4]} />
      </mesh>
      <ComicBox args={[4.6, 0.12, 0.9]} position={[1, 0.55, 9]} rotation={[0, 0.12, 0]} color="#d9c59a" gradientMap={gradientMap} />
      <ComicBox args={[0.9, 0.12, 28]} position={[1, 0.55, 1]} color="#d9c59a" gradientMap={gradientMap} />
      <ComicBox args={[30, 0.12, 0.8]} position={[1, 0.55, -7]} rotation={[0, -0.18, 0]} color="#d9c59a" gradientMap={gradientMap} />
      {visuals.rooms.map((room) => (
        <Building
          key={room.id}
          room={room}
          visuals={visuals}
          hovered={hovered === room.id}
          gradientMap={gradientMap}
          onHover={onHover}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* camera + labels + fps                                                */
/* ------------------------------------------------------------------ */

function CameraRig({
  reduced,
  mobile,
  pushTarget,
  transitionStartedAt,
}: {
  reduced: boolean;
  mobile: boolean;
  pushTarget: { x: number; z: number } | null;
  transitionStartedAt: number | null;
}) {
  const { camera } = useThree();
  const radius = mobile ? 88 : 70;
  const height = mobile ? 66 : 51;
  const desired = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    if (pushTarget) {
      const progress = transitionStartedAt ? Math.min(1, (performance.now() - transitionStartedAt) / 430) : 1;
      const eased = 1 - (1 - progress) ** 2;
      desired.set(pushTarget.x * 0.5 + 9 * eased, 26 - 8 * eased, pushTarget.z * 0.5 + 16 * eased);
      camera.position.lerp(desired, 0.18 + eased * 0.18);
      camera.lookAt(pushTarget.x, 2.2, pushTarget.z);
      return;
    }
    if (reduced) {
      camera.position.set(radius * 0.72, height, radius * 0.78);
      camera.lookAt(1, 1, 0);
      return;
    }
    const time = clock.getElapsedTime();
    const angle = 0.93 + Math.sin(time * 0.08) * 0.045;
    camera.position.set(Math.cos(angle) * radius, height + Math.sin(time * 0.18) * 0.6, Math.sin(angle) * radius);
    camera.lookAt(1, 1, 0);
  });
  return null;
}

function LabelProjector({
  rooms,
  anchors,
  mobile,
}: {
  rooms: BaseRoom[];
  anchors: React.MutableRefObject<Record<string, LabelAnchor>>;
  mobile: boolean;
}) {
  const { camera, size } = useThree();
  const vector = useMemo(() => new THREE.Vector3(), []);
  const frame = useRef(0);
  useFrame(() => {
    frame.current += 1;
    const projected: NonNullable<Window["__clubBaseRooms"]> = [];
    for (const room of rooms) {
      vector.set(room.x, LABEL_HEIGHTS[room.id] + BASE_Y, room.z).project(camera);
      const offset = LABEL_OFFSETS[room.id];
      const offsetScale = mobile ? 1.35 : 1;
      const rawX = (vector.x * 0.5 + 0.5) * size.width + offset.dx * offsetScale;
      const rawY = (-vector.y * 0.5 + 0.5) * size.height + offset.dy * offsetScale;
      const marginX = mobile ? 84 : 96;
      const marginY = 34;
      const screenX = Math.max(marginX, Math.min(size.width - marginX, rawX));
      const screenY = Math.max(marginY, Math.min(size.height - 18, rawY));
      const visible = vector.z < 1 && screenX > -60 && screenX < size.width + 60 && screenY > -40 && screenY < size.height + 40;
      const anchor = anchors.current[room.id];
      if (anchor) {
        anchor.style.transform = `translate(-50%, -100%) translate(${screenX.toFixed(1)}px, ${screenY.toFixed(1)}px)`;
        anchor.style.visibility = visible ? "visible" : "hidden";
      }
      projected.push({
        id: room.id,
        label: room.label,
        labelZh: room.labelZh,
        href: room.href,
        screenX: Math.round(screenX),
        screenY: Math.round(screenY),
        visible,
      });
    }
    if (frame.current % 4 === 0) window.__clubBaseRooms = projected;
  });
  return null;
}

function FpsProbe() {
  const frames = useRef(0);
  const start = useRef(0);
  useFrame(() => {
    const now = performance.now();
    if (!start.current) {
      start.current = now;
      frames.current = 0;
      return;
    }
    frames.current += 1;
    if (now - start.current >= 1000) {
      window.__clubBaseFps = Math.round((frames.current * 1000) / (now - start.current));
      frames.current = 0;
      start.current = now;
    }
  });
  return null;
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/* public component                                                     */
/* ------------------------------------------------------------------ */

export default function ClubBase3D({ visuals, language, onUnavailable }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [transitionRoom, setTransitionRoom] = useState<BaseRoom | null>(null);
  const [transitionStartedAt, setTransitionStartedAt] = useState<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const anchors = useRef<Record<string, LabelAnchor>>({});

  useEffect(() => {
    const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 760px)");
    const apply = () => {
      setReduced(reduceQuery.matches);
      setMobile(mobileQuery.matches);
      window.__clubBaseReduced = reduceQuery.matches;
    };
    apply();
    reduceQuery.addEventListener("change", apply);
    mobileQuery.addEventListener("change", apply);
    return () => {
      reduceQuery.removeEventListener("change", apply);
      mobileQuery.removeEventListener("change", apply);
    };
  }, []);

  useEffect(() => {
    window.__clubBaseHovered = hovered;
  }, [hovered]);

  useEffect(() => {
    window.__clubBaseComic = true;
    return () => {
      if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
      window.__clubBaseFps = undefined;
      window.__clubBaseReady = false;
      window.__clubBaseHovered = null;
      window.__clubBaseRooms = undefined;
      window.__clubBaseComic = false;
      window.__clubBaseTransition = null;
    };
  }, []);

  const handleRoomClick = (event: React.MouseEvent<HTMLAnchorElement>, room: BaseRoom) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (reduced) return;
    event.preventDefault();
    // eslint-disable-next-line react-hooks/purity -- click transition timestamp, not render state.
    const startedAt = performance.now();
    setTransitionRoom(room);
    setTransitionStartedAt(startedAt);
    window.__clubBaseTransition = { active: room.id, href: room.href, startedAt };
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      window.location.assign(room.href);
    }, 460);
  };

  return (
    <div
      className={`base-3d-stage${transitionRoom ? " is-transitioning" : ""}`}
      data-reduced-motion={reduced ? "true" : "false"}
      data-transitioning={transitionRoom ? transitionRoom.id : undefined}
    >
      <div className="base-3d-canvas-wrap" aria-hidden="true" data-webgl-canvas="true">
        <SceneBoundary
          fallback={<div className="base-3d-failed">3D base unavailable — showing the room list instead.</div>}
          onError={onUnavailable}
        >
          <Canvas
            dpr={[1, mobile ? 1 : 1.5]}
            shadows={false}
            frameloop="always"
            camera={{ position: [52, 48, 58], fov: 30, near: 0.5, far: 320 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace;
              window.__clubBaseReady = true;
            }}
          >
            <BaseDiorama visuals={visuals} hovered={hovered} onHover={(id) => setHovered(id)} />
            <CameraRig
              reduced={reduced}
              mobile={mobile}
              pushTarget={transitionRoom ? { x: transitionRoom.x, z: transitionRoom.z } : null}
              transitionStartedAt={transitionStartedAt}
            />
            <LabelProjector rooms={visuals.rooms} anchors={anchors} mobile={mobile} />
            <FpsProbe />
          </Canvas>
        </SceneBoundary>
      </div>
      <div className="base-3d-labels">
        {visuals.rooms.map((room) => {
          const name = language === "zh" ? room.labelZh : room.label;
          return (
            <a
              key={room.id}
              ref={(node) => {
                anchors.current[room.id] = node;
              }}
              className={`base-room-label${hovered === room.id ? " is-hovered" : ""}`}
              href={room.href}
              aria-label={`${name} — ${room.status}`}
              data-room-id={room.id}
              data-room-href={room.href}
              onClick={(event) => handleRoomClick(event, room)}
              onMouseEnter={() => setHovered(room.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(room.id)}
              onBlur={() => setHovered(null)}
            >
              <span className="base-room-label-name">{name}</span>
              <small className="base-room-label-status">{room.status}</small>
            </a>
          );
        })}
      </div>
      {transitionRoom ? (
        <div className="base-3d-transition" aria-hidden="true" data-transition-room={transitionRoom.id}>
          <span className="base-3d-transition-lines" />
          <span className="base-3d-transition-label">
            {language === "zh" ? `前往 ${transitionRoom.labelZh}` : `Entering ${transitionRoom.label}`}
          </span>
        </div>
      ) : null}
      <p className="base-3d-legend">
        {language === "zh"
          ? "漫画风基地总览 · 点击标签进入房间 · 悬停高亮"
          : "Comic base overview · click a label to enter a room · hover to highlight"}
      </p>
    </div>
  );
}
