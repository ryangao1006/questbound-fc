"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import * as THREE from "three";
import type {LineupSlot} from "@/lib/club-lineup";
import {applyComicMaterial} from "@/lib/comic-material";
import {
  COMIC_INK,
  COMIC_PALETTE,
  comicPaletteFor,
  goalBurst,
  halftoneSpec,
  inkOutline,
  sprintLines,
  type BurstSpec,
  type ComicPalette,
} from "@/lib/comic-art";
import type { ResolvedDecor } from "@/lib/club-decor";
import type { TimelineItem } from "@/lib/match-v2";

type BallTrack = { m: number; x: number; y: number }[];

/**
 * First 3D "watch" view for the club match timeline.
 *
 * This is a data-driven visualisation of the stored event timeline (goal / save /
 * chance) with simple low-poly tokens and a ball. It is NOT a physics simulation
 * and does not model 11v11 tactical AI. It deliberately avoids the GLB player
 * assets used by the career pitch so the whole scene stays a few dozen draw calls.
 */

type WatchEventKind = "goal" | "chance" | "save" | "sub";
type WatchEvent = {
  minute: number;
  side: "home" | "away";
  kind: WatchEventKind;
  line: "MID" | "ATT";
  label: string;
  scorer?: string;
  out?: string;
  x?: number;
  y?: number;
  homeName?: string;
  awayName?: string;
};

type PathFrame = { minute: number; x: number; y: number; side: "home" | "away" };

type WatchLanguage = "en" | "zh";

const WATCH_COPY = {
  ariaLabel: { en: "3D match watch", zh: "3D 观战" },
  badge: { en: "3D watch · event animation (not a physics simulation)", zh: "3D 观战 · 事件动画（非物理模拟）" },
  physicsNote: {
    en: "Driven by the saved event timeline: no 11-player physics and no tactical AI are simulated.",
    zh: "基于已保存的事件时间线：不模拟 11 人物理与战术 AI。",
  },
  spatialNote: {
    en: "Ball path comes from the model-generated spatial path, not collision physics.",
    zh: "球路来自模型生成的空间路径，不是碰撞物理。",
  },
  fallbackNote: {
    en: "This record has no spatial path; the event-animation fallback is used.",
    zh: "此记录没有空间路径，使用事件动画回退。",
  },
  reducedNote: { en: "Reduced motion: static scene, advance manually.", zh: "已启用减少动态效果：静态场景，请手动推进。" },
  play: { en: "Play", zh: "播放" },
  pause: { en: "Pause", zh: "暂停" },
  replay: { en: "Replay", zh: "重新播放" },
  fullTime: { en: "Full time", zh: "终场" },
  speed: { en: "Speed", zh: "速度" },
  close: { en: "Close 3D watch", zh: "关闭 3D 观战" },
  kickoff: { en: "Kick-off — press play", zh: "准备开球 · 点击播放" },
  livePlay: { en: "Live — match under way", zh: "直播中 · 比赛进行中" },
  playDribble: { en: "Carry", zh: "持球" },
  playPass: { en: "Pass", zh: "传球" },
  playShot: { en: "Shot", zh: "射门" },
  playRestart: { en: "Restart", zh: "重新开球" },
  goal: { en: "Goal", zh: "进球" },
  save: { en: "Save", zh: "扑救" },
  chance: { en: "Chance", zh: "机会" },
  sub: { en: "Substitution", zh: "换人" },
  minute: { en: "{0}'", zh: "{0}′" },
  commentary: { en: "Commentary", zh: "解说" },
  goalLive: { en: "{0}' Goal · {1} · {2} {3} – {4} {5}", zh: "{0}′ 进球 · {1} · {2} {3} – {4} {5}" },
  fullTimeLive: { en: "Full time · {0} {1} – {2} {3}", zh: "终场 · {0} {1} – {2} {3}" },
  eventLive: { en: "{0}' {1} · {2}", zh: "{0}′ {1} · {2}" },
  subLive: { en: "{0}' Substitution · {1} → {2}", zh: "{0}′ 换人 · {1} → {2}" },
} as const;

type WatchCopyKey = keyof typeof WATCH_COPY;

function watchCopy(language: WatchLanguage, key: WatchCopyKey, ...values: (string | number)[]) {
  return WATCH_COPY[key][language].replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? ""));
}

function eventKindLabel(language: WatchLanguage, kind: WatchEventKind) {
  return watchCopy(language, kind === "goal" ? "goal" : kind === "save" ? "save" : kind === "sub" ? "sub" : "chance");
}

declare global {
  interface Window {
    __clubWatchFps?: number;
    __clubWatchReady?: boolean;
    __clubWatchReducedMotion?: boolean;
    __clubWatchLastEvent?: { minute: number; kind: WatchEventKind; side: "home" | "away" } | null;
    __clubWatchEventCount?: number;
    __clubWatchBall?: { minute: number; x: number; y: number; z: number };
    __clubWatchSpatial?: {
      pathMinute: number;
      ballX: number;
      ballZ: number;
      frames: number;
      attackSide?: "home" | "away";
    };
    __clubWatchTokenShiftMax?: number;
    __clubWatchTokens?: {
      id: string;
      side: "home" | "away";
      x: number;
      z: number;
      speed: number;
      heading: number;
    }[];
    __clubWatchLayout?: {
      source: "lineups" | "formation";
      count: number;
      tokens: { side: "home" | "away"; id: string; x: number; z: number }[];
    };
    __clubWatchComic?: boolean;
    __clubWatchAtmosphere?: boolean;
    __clubWatchDecor?: { pitch: string; stands: string; lights: string } | null;
    __clubWatchBallSpeed?: number;
    __clubWatchTeleports?: number;
    __clubWatchPlay?: {
      minute: number;
      kind: TimelineItem["kind"];
      carrier: number;
      receiver: number;
      side: "home" | "away";
      ball: { x: number; y: number };
    } | null;
    __clubWatchEntrance?: {
      active: boolean;
      phase?: "entrance" | "broadcast" | "waiting";
      progress?: number;
      startedAt?: number;
      completedAt?: number;
      skipped?: boolean;
    } | null;
    __clubWatchBurst?: { visible: boolean; headline: string; subline: string; rotation: number; rays: number } | null;
    __clubWatchSpeedLines?: number;
    __clubWatchTrail?: number;
    __clubWatchLastShot?: {
      spatial: boolean;
      minute: number;
      kind: WatchEventKind;
      from: { x: number; z: number };
      to: { x: number; z: number };
    } | null;
  }
}

/* ------------------------------------------------------------------ */
/* scene primitives                                                    */
/* ------------------------------------------------------------------ */

const PITCH_HALF_LENGTH = 52.5;
const PITCH_HALF_WIDTH = 34;

/** Build a MeshStandardMaterial and run the shared qfc-comic-v2 cel treatment. */
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

function halftoneTexture(density: "light" | "medium" | "heavy" = "medium"): THREE.CanvasTexture {
  const spec = halftoneSpec(density);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, size, size);
    context.fillStyle = "rgba(16, 21, 31, 0.92)";
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
  texture.repeat.set(9, 6);
  texture.needsUpdate = true;
  return texture;
}

function starBurstGeometry(rays: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const points = Math.max(8, rays) * 2;
  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const radius = index % 2 === 0 ? 3.4 : 1.35;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function pitchLineGeometry() {
  const points: THREE.Vector3[] = [];
  const segment = (x: number, z: number, a: number, b: number) =>
    points.push(new THREE.Vector3(x, 0.035, z), new THREE.Vector3(a, 0.035, b));
  const box = (x: number, z: number, w: number, h: number) => {
    segment(x, z, x + w, z);
    segment(x + w, z, x + w, z + h);
    segment(x + w, z + h, x, z + h);
    segment(x, z + h, x, z);
  };
  box(-PITCH_HALF_LENGTH, -PITCH_HALF_WIDTH, 105, 68);
  segment(0, -PITCH_HALF_WIDTH, 0, PITCH_HALF_WIDTH);
  box(-52.5, -20.16, 16.5, 40.32);
  box(36, -20.16, 16.5, 40.32);
  box(-52.5, -9.16, 5.5, 18.32);
  box(47, -9.16, 5.5, 18.32);
  for (let index = 0; index < 64; index += 1) {
    const a = (index / 64) * Math.PI * 2;
    const b = ((index + 1) / 64) * Math.PI * 2;
    segment(Math.cos(a) * 9.15, Math.sin(a) * 9.15, Math.cos(b) * 9.15, Math.sin(b) * 9.15);
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.name = "club-watch-pitch-lines";
  return geometry;
}

function GoalFrame({ side }: { side: 1 | -1 }) {
  const white = useMemo(() => comicMaterial("#f6f6f2"), []);
  const ink = useMemo(() => new THREE.MeshBasicMaterial({ color: COMIC_INK, side: THREE.BackSide }), []);
  const outline = inkOutline(1);
  useEffect(
    () => () => {
      white.dispose();
      ink.dispose();
    },
    [white, ink],
  );
  const posts: { position: [number, number, number]; rotation?: [number, number, number] }[] = [
    { position: [0, 1.22, -3.66] },
    { position: [0, 1.22, 3.66] },
    { position: [0, 2.44, 0], rotation: [Math.PI / 2, 0, 0] },
  ];
  return (
    <group position={[side * PITCH_HALF_LENGTH, 0, 0]}>
      {posts.map((post, index) => (
        <group key={index} position={post.position} rotation={post.rotation}>
          <mesh material={white}>
            <cylinderGeometry args={[0.07, 0.07, index === 2 ? 7.32 : 2.44, 8]} />
          </mesh>
          <mesh material={ink} scale={outline.scale}>
            <cylinderGeometry args={[0.07, 0.07, index === 2 ? 7.32 : 2.44, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

type CrowdAtmosphere = {
  homeMesh: THREE.InstancedMesh;
  awayMesh: THREE.InstancedMesh;
  geometry: THREE.BoxGeometry;
  homeMaterial: THREE.MeshStandardMaterial;
  awayMaterial: THREE.MeshStandardMaterial;
};

function crowdAtmosphere(homeColor: string, awayColor: string): CrowdAtmosphere {
  const geometry = new THREE.BoxGeometry(0.7, 0.85, 0.55);
  const homeMaterial = comicMaterial(homeColor);
  const awayMaterial = comicMaterial(awayColor);
  const homeMatrices: THREE.Matrix4[] = [];
  const awayMatrices: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();
  for (const side of [-1, 1] as const) {
    for (let row = 0; row < 6; row += 1) {
      for (let column = 0; column < 46; column += 1) {
        const x = -54 + column * 2.4;
        dummy.position.set(x, 3.2 + row * 1.55, side * (41 + row * 1.85));
        dummy.rotation.set(0, (column % 2 ? 0.25 : -0.25) + (row % 3) * 0.08, 0);
        dummy.scale.set(0.85 + (column % 3) * 0.08, 0.9 + (row % 2) * 0.12, 0.85);
        dummy.updateMatrix();
        (x < 0 ? homeMatrices : awayMatrices).push(dummy.matrix.clone());
      }
    }
  }
  const build = (matrices: THREE.Matrix4[], material: THREE.MeshStandardMaterial) => {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  };
  return {
    homeMesh: build(homeMatrices, homeMaterial),
    awayMesh: build(awayMatrices, awayMaterial),
    geometry,
    homeMaterial,
    awayMaterial,
  };
}

function bannerTexture(title: string, subtitle: string, background: string, ink: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(16, 21, 31, 0.16)";
    for (let x = 12; x < canvas.width; x += 12) {
      for (let y = 12; y < canvas.height; y += 12) {
        context.beginPath();
        context.arc(x, y, 1.7, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.strokeStyle = "#10151f";
    context.lineWidth = 12;
    context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    context.strokeStyle = accent;
    context.lineWidth = 4;
    context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
    context.fillStyle = ink;
    context.font = "900 62px Arial Black, Trebuchet MS, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(title, canvas.width / 2, 58);
    context.fillStyle = ink;
    context.font = "800 24px Trebuchet MS, sans-serif";
    context.fillText(subtitle, canvas.width / 2, 100);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function pitchPatternTexture(pattern: string, accent: string): THREE.CanvasTexture | null {
  if (pattern === "pitch.stripes" || pattern === "") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const colour = new THREE.Color(accent);
  const rgb = `${Math.round(colour.r * 255)}, ${Math.round(colour.g * 255)}, ${Math.round(colour.b * 255)}`;
  context.clearRect(0, 0, 512, 512);
  if (pattern === "pitch.checker") {
    const cell = 64;
    context.fillStyle = `rgba(${rgb}, 0.32)`;
    for (let x = 0; x < 512; x += cell) {
      for (let y = 0; y < 512; y += cell) {
        if ((x / cell + y / cell) % 2 === 0) context.fillRect(x, y, cell, cell);
      }
    }
  } else if (pattern === "pitch.diagonal") {
    context.save();
    context.translate(256, 256);
    context.rotate(-Math.PI / 4);
    context.fillStyle = `rgba(${rgb}, 0.3)`;
    for (let offset = -720; offset < 720; offset += 96) {
      context.fillRect(offset, -720, 48, 1440);
    }
    context.restore();
  } else if (pattern === "pitch.halftone") {
    context.fillStyle = `rgba(${rgb}, 0.4)`;
    for (let x = 16; x < 512; x += 28) {
      for (let y = 16; y < 512; y += 28) {
        const radius = 5 + ((x * 7 + y * 3) % 5);
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  } else {
    return null;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function Stadium({
  mobile,
  palette,
  homeColor,
  awayColor,
  homeShortName,
  awayShortName,
  homeTrophies,
  decor,
}: {
  mobile: boolean;
  palette: ComicPalette;
  homeColor: string;
  awayColor: string;
  homeShortName: string;
  awayShortName: string;
  homeTrophies: number;
  decor?: ResolvedDecor;
}) {
  const lineGeometry = useMemo(() => pitchLineGeometry(), []);
  const pitchMaterial = useMemo(() => comicMaterial("#2f744b"), []);
  const stripeMaterial = useMemo(() => [comicMaterial("#347f52"), comicMaterial("#2b6a44")], []);
  const standMaterial = useMemo(() => comicMaterial("#22364f"), []);
  const darkStandMaterial = useMemo(() => comicMaterial("#1a2b41"), []);
  const halftone = useMemo(() => halftoneTexture("medium"), []);
  const halftoneMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: halftone, transparent: true, opacity: 0.55, depthWrite: false }),
    [halftone],
  );
  const pitchMode = decor?.choice.pitch ?? "pitch.stripes";
  const pitchAccent = decor?.colours.pitchAccent ?? palette.paper;
  const standsHome = decor?.colours.stands[0] ?? homeColor;
  const standsAway = decor?.colours.stands[1] ?? awayColor;
  const lightsColour = decor?.colours.lights ?? "#ffffff";
  const pitchPattern = useMemo(() => pitchPatternTexture(pitchMode, pitchAccent), [pitchMode, pitchAccent]);
  const pitchPatternMaterial = useMemo(
    () => (pitchPattern ? new THREE.MeshBasicMaterial({ map: pitchPattern, transparent: true, depthWrite: false }) : null),
    [pitchPattern],
  );
  const crowd = useMemo(() => crowdAtmosphere(standsHome, standsAway), [standsHome, standsAway]);
  const homeBanner = useMemo(
    () => bannerTexture(homeShortName, "HOME", homeColor, palette.paper, palette.burst[0]),
    [homeShortName, homeColor, palette.paper, palette.burst],
  );
  const awayBanner = useMemo(
    () => bannerTexture(awayShortName, "AWAY", awayColor, "#10151f", palette.paper),
    [awayShortName, awayColor, palette.paper],
  );
  const trophyBanner = useMemo(
    () => (homeTrophies > 0 ? bannerTexture(`★ ${homeTrophies}`, "TROPHIES", "#f7f1e3", "#10151f", palette.burst[0]) : null),
    [homeTrophies, palette.burst],
  );
  const bannerMaterial = useMemo(() => [
    new THREE.MeshBasicMaterial({ map: homeBanner, transparent: true, side: THREE.DoubleSide, toneMapped: false }),
    new THREE.MeshBasicMaterial({ map: awayBanner, transparent: true, side: THREE.DoubleSide, toneMapped: false }),
    trophyBanner
      ? new THREE.MeshBasicMaterial({ map: trophyBanner, transparent: true, side: THREE.DoubleSide, toneMapped: false })
      : null,
  ], [homeBanner, awayBanner, trophyBanner]);
  const floodBeamMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: lightsColour, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
    [lightsColour],
  );
  const floodGlowMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: lightsColour }),
    [lightsColour],
  );
  useEffect(
    () => () => {
      lineGeometry.dispose();
      pitchMaterial.dispose();
      stripeMaterial.forEach((material) => material.dispose());
      standMaterial.dispose();
      darkStandMaterial.dispose();
      halftone.dispose();
      halftoneMaterial.dispose();
      crowd.geometry.dispose();
      crowd.homeMaterial.dispose();
      crowd.awayMaterial.dispose();
      homeBanner.dispose();
      awayBanner.dispose();
      trophyBanner?.dispose();
      bannerMaterial.forEach((material) => material?.dispose());
      floodBeamMaterial.dispose();
      floodGlowMaterial.dispose();
      pitchPattern?.dispose();
      pitchPatternMaterial?.dispose();
    },
    [
      lineGeometry,
      pitchMaterial,
      stripeMaterial,
      standMaterial,
      darkStandMaterial,
      halftone,
      halftoneMaterial,
      crowd,
      homeBanner,
      awayBanner,
      trophyBanner,
      bannerMaterial,
      floodBeamMaterial,
      floodGlowMaterial,
      pitchPattern,
      pitchPatternMaterial,
    ],
  );
  const stripes = useMemo(() => Array.from({ length: 10 }, (_, index) => index), []);
  return (
    <>
      <color attach="background" args={["#050b16"]} />
      <fog attach="fog" args={["#0a1424", 100, 240]} />
      <ambientLight intensity={1.35} />
      <hemisphereLight args={["#dbe9ff", "#24462f", 1.25]} />
      <directionalLight position={[-36, 52, 22]} intensity={2.1} />
      <directionalLight position={[44, 34, -46]} intensity={1.2} color="#c9e0ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} material={pitchMaterial}>
        <planeGeometry args={[160, 115]} />
      </mesh>
      {pitchMode === "pitch.stripes"
        ? stripes.map((index) => (
            <mesh
              key={index}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[-47.25 + index * 10.5, 0, 0]}
              material={stripeMaterial[index % 2]}
            >
              <planeGeometry args={[10.5, 68]} />
            </mesh>
          ))
        : pitchPatternMaterial ? (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} material={pitchPatternMaterial}>
              <planeGeometry args={[104, 67]} />
            </mesh>
          ) : null}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]} material={halftoneMaterial}>
        <planeGeometry args={[104, 67]} />
      </mesh>
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color={palette.paper} />
      </lineSegments>
      <GoalFrame side={-1} />
      <GoalFrame side={1} />
      {[-1, 1].map((side) => (
        <group key={side}>
          {[0, 1, 2].map((tier) => (
            <mesh
              key={tier}
              position={[0, 3 + tier * 3, side * (43 + tier * 4)]}
              rotation={[side * -0.2, 0, 0]}
              material={tier % 2 ? standMaterial : darkStandMaterial}
            >
              <boxGeometry args={[125, 2.3, 6]} />
            </mesh>
          ))}
          <mesh position={[0, 0.6, side * 38]} material={darkStandMaterial}>
            <boxGeometry args={[108, 1.1, 0.3]} />
          </mesh>
        </group>
      ))}
      <primitive object={crowd.homeMesh} />
      <primitive object={crowd.awayMesh} />
      <mesh position={[-28, 10.4, -39.4]} material={bannerMaterial[0]!}>
        <planeGeometry args={[15, 3.8]} />
      </mesh>
      <mesh position={[28, 10.4, -39.4]} material={bannerMaterial[1]!}>
        <planeGeometry args={[15, 3.8]} />
      </mesh>
      {trophyBanner && bannerMaterial[2] ? (
        <mesh position={[0, 14.2, -39.4]} material={bannerMaterial[2]}>
          <planeGeometry args={[11, 3]} />
        </mesh>
      ) : null}
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <group key={`${x}:${z}`} position={[x * 49, 0, z * 31]}>
            <mesh position={[0, 12, 0]} material={standMaterial}>
              <cylinderGeometry args={[0.2, 0.34, 24, mobile ? 5 : 6]} />
            </mesh>
            <mesh position={[0, 24, 0]} rotation={[0.2 * x, 0, 0.1 * z]}>
              <boxGeometry args={[6.5, 1.9, 0.55]} />
              <meshBasicMaterial color="#edf4ff" />
            </mesh>
            <mesh position={[0, 24.5, 0]} material={floodGlowMaterial}>
              <sphereGeometry args={[1.7, mobile ? 8 : 12, mobile ? 6 : 8]} />
            </mesh>
            <mesh position={[0, 12, 0]} material={floodBeamMaterial}>
              <coneGeometry args={[5.8, 23, mobile ? 8 : 14, 1, true]} />
            </mesh>
          </group>
        )),
      )}
    </>
  );
}

type TokenSpec = { id: string; side: "home" | "away"; x: number; z: number; keeper?: boolean };

function formationTokens(): TokenSpec[] {
  const rows: TokenSpec[] = [];
  const add = (side: "home" | "away", x: number, zs: number[], offset: number, keeper: boolean) => {
    zs.forEach((z, index) => {
      rows.push({ id: `${side}-${offset + index}`, side, x, z, keeper });
    });
  };
  // Home 4-3-3 attacking +x.
  add("home", -48, [0], 0, true);
  add("home", -31, [-21, -7, 7, 21], 1, false);
  add("home", -10, [-16, 0, 16], 5, false);
  add("home", 14, [-18, 0, 18], 8, false);
  // Away 4-4-2 attacking -x.
  add("away", 48, [0], 11, true);
  add("away", 31, [-21, -7, 7, 21], 12, false);
  add("away", 9, [-21, -7, 7, 21], 16, false);
  add("away", -14, [-10, 10], 20, false);
  return rows;
}

type TokenRuntime = { x: number; z: number; vx: number; vz: number; heading: number; speed: number };
type PlayFrame = {
  active: boolean;
  kind: TimelineItem["kind"];
  side: "home" | "away";
  carrier: number;
  receiver: number;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  progress: number;
};
type PlayPlanEntry = { item: TimelineItem; start: number; end: number };

function sampleBallTrack(track: BallTrack | undefined, minute: number): { x: number; y: number } | null {
  if (!track?.length) return null;
  if (minute <= track[0].m) return { x: track[0].x, y: track[0].y };
  const last = track[track.length - 1];
  if (minute >= last.m) return { x: last.x, y: last.y };
  let low = 0;
  let high = track.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (track[mid].m <= minute) low = mid;
    else high = mid;
  }
  const a = track[low];
  const b = track[high];
  const span = b.m - a.m || 1;
  const t = Math.max(0, Math.min(1, (minute - a.m) / span));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function buildTimelinePlan(items: TimelineItem[] | undefined): PlayPlanEntry[] {
  if (!items?.length) return [];
  const sorted = [...items].sort((a, b) => a.minute - b.minute || a.t - b.t);
  const groups = new Map<number, TimelineItem[]>();
  for (const item of sorted) {
    const group = groups.get(item.minute) ?? [];
    group.push(item);
    groups.set(item.minute, group);
  }
  const plan: PlayPlanEntry[] = [];
  for (const [minute, group] of groups) {
    group.forEach((item, index) => {
      const start = Math.max(0, minute - 1 + index / group.length);
      const end = Math.max(start + 0.01, minute - 1 + (index + 1) / group.length);
      plan.push({ item, start, end });
    });
  }
  return plan.sort((a, b) => a.start - b.start);
}

function Tokens({
  homeColor,
  awayColor,
  mobile,
  reducedMotion,
  ballPositionRef,
  attackSideRef,
  sprintRef,
  tokenSpecs,
  layoutSource,
  playing,
  playRef,
  tokenRuntimeRef,
}: {
  homeColor: string;
  awayColor: string;
  mobile: boolean;
  reducedMotion: boolean;
  ballPositionRef: MutableRefObject<THREE.Vector3>;
  attackSideRef: MutableRefObject<"home" | "away">;
  sprintRef: MutableRefObject<SprintPlan | null>;
  tokenSpecs: TokenSpec[];
  layoutSource: "lineups" | "formation";
  playing: boolean;
  playRef?: MutableRefObject<PlayFrame | null>;
  tokenRuntimeRef?: MutableRefObject<TokenRuntime[]>;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const runtimeRef = useRef<
    { x: number; z: number; vx: number; vz: number; heading: number; speed: number }[]
  >([]);
  const publishRef = useRef(0);
  const tokenSpecsVersionRef = useRef<TokenSpec[] | null>(null);
  const bodyGeometry = useMemo(() => new THREE.CylinderGeometry(0.55, 0.68, 2.1, mobile ? 6 : 8, 1), [mobile]);
  const headGeometry = useMemo(() => new THREE.SphereGeometry(0.34, mobile ? 8 : 10, mobile ? 6 : 8), [mobile]);
  const homeBody = useMemo(() => comicMaterial(homeColor), [homeColor]);
  const awayBody = useMemo(() => comicMaterial(awayColor), [awayColor]);
  const homeHead = useMemo(
    () => comicMaterial(new THREE.Color(homeColor).offsetHSL(0, 0, 0.18).getStyle()),
    [homeColor],
  );
  const awayHead = useMemo(
    () => comicMaterial(new THREE.Color(awayColor).offsetHSL(0, 0, 0.18).getStyle()),
    [awayColor],
  );
  const inkMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: COMIC_INK, side: THREE.BackSide }), []);
  const outlineScale = inkOutline(1).scale;
  const speedLineGeometry = useMemo(() => new THREE.BoxGeometry(0.24, 0.08, 1), []);
  const speedLineMaterials = useMemo(
    () => Array.from({ length: Math.max(1, tokenSpecs.length * 4) }, () => new THREE.MeshBasicMaterial({ color: COMIC_PALETTE.burst[0], transparent: true, opacity: 0 })),
    [tokenSpecs.length],
  );
  const speedLineSpecs = useMemo(() => tokenSpecs.map((_, index) => sprintLines(1000 + index * 37, 4)), [tokenSpecs]);
  const sideTokenIndex = useMemo(() => {
    const counters = { home: 0, away: 0 };
    return tokenSpecs.map((spec) => {
      const index = counters[spec.side];
      counters[spec.side] += 1;
      return index;
    });
  }, [tokenSpecs]);
  const speedLineGroups = useRef<THREE.Group[]>([]);
  useEffect(
    () => () => {
      bodyGeometry.dispose();
      headGeometry.dispose();
      homeBody.dispose();
      awayBody.dispose();
      homeHead.dispose();
      awayHead.dispose();
      inkMaterial.dispose();
      speedLineGeometry.dispose();
      speedLineMaterials.forEach((material) => material.dispose());
    },
    [bodyGeometry, headGeometry, homeBody, awayBody, homeHead, awayHead, inkMaterial, speedLineGeometry, speedLineMaterials],
  );

  useEffect(() => {
    window.__clubWatchLayout = {
      source: layoutSource,
      count: tokenSpecs.length,
      tokens: tokenSpecs.map((token) => ({ side: token.side, id: token.id, x: round2(token.x), z: round2(token.z) })),
    };
  }, [layoutSource, tokenSpecs]);

  // Reduced motion: tokens stand still on their slots (still exposed for QA).
  useEffect(() => {
    if (!reducedMotion) return;
    window.__clubWatchTokens = tokenSpecs.map((spec) => ({
      id: spec.id,
      side: spec.side,
      x: round2(spec.x),
      z: round2(spec.z),
      speed: 0,
      heading: 0,
    }));
  }, [reducedMotion, tokenSpecs]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(0.05, delta);
    const time = state.clock.getElapsedTime();
    const ball = ballPositionRef.current;
    const attackSide = attackSideRef.current;
    const sprint = sprintRef.current;
    // Reset run interpolation whenever the lineup/layout changes.
    if (tokenSpecsVersionRef.current !== tokenSpecs) {
      tokenSpecsVersionRef.current = tokenSpecs;
      runtimeRef.current = tokenSpecs.map((spec) => ({ x: spec.x, z: spec.z, vx: 0, vz: 0, heading: 0, speed: 0 }));
      groupRef.current.children.forEach((child, index) => {
        const spec = tokenSpecs[index];
        if (spec) child.position.set(spec.x, 0, spec.z);
      });
    }
    const runtime = runtimeRef.current;
    let maxShift = 0;
    let activeSpeedLines = 0;
    for (let index = 0; index < tokenSpecs.length; index += 1) {
      const spec = tokenSpecs[index];
      if (!spec) continue;
      let token = runtime[index];
      if (!token) {
        token = runtime[index] = { x: spec.x, z: spec.z, vx: 0, vz: 0, heading: 0, speed: 0 };
      }
      const child = groupRef.current.children[index];
      if (reducedMotion) {
        token.x = spec.x;
        token.z = spec.z;
        token.vx = 0;
        token.vz = 0;
        token.speed = 0;
        token.heading = 0;
        if (child) child.position.set(spec.x, 0, spec.z);
        continue;
      }
      if (!playing) {
        // Playback is paused: hold every token still and zero its velocity.
        token.vx = 0;
        token.vz = 0;
        token.speed = 0;
        if (child) child.position.set(token.x, 0, token.z);
        continue;
      }
      const attacking = spec.side === attackSide;
      const forward = spec.side === "home" ? 1 : -1;
      const phase = Math.sin(time * 0.55 + index * 0.72);
      // Ball-side pull, then phase-based team runs: possession pushes up, defence drops.
      let desiredX = spec.x + (ball.x - spec.x) * (attacking ? 0.19 : 0.15);
      let desiredZ = spec.z + (ball.z - spec.z) * (attacking ? 0.17 : 0.13);
      if (attacking) {
        desiredX += forward * (3 + phase * 1.8);
        desiredZ += Math.sin(time * 0.4 + index * 1.1) * 1.4;
      } else {
        desiredX -= forward * (2.4 + phase * 1.1);
        desiredZ *= 0.92;
      }
      let stiffness = 6.5;
      let damping = 5.2;
      let maxSpeed = 5.5;
      if (spec.keeper) {
        // Keepers stay close to their line instead of joining the phase runs.
        desiredX = spec.x + (ball.x - spec.x) * 0.06;
        desiredZ = spec.z + (ball.z - spec.z) * 0.08;
        stiffness = 4.5;
        damping = 5.5;
        maxSpeed = 2.4;
      }
      if (sprint && time < sprint.until && !spec.keeper && sprint.ids.includes(spec.id)) {
        const rank = sprint.ids.indexOf(spec.id);
        desiredX = sprint.target.x + (rank - 1) * 1.8;
        desiredZ = sprint.target.z + (rank % 2 === 0 ? 1.1 : -1.1);
        stiffness = 15;
        damping = 4.6;
        maxSpeed = 13;
      }
      const play = playRef?.current;
      if (play?.active && index < sideTokenIndex.length) {
        const sideIndex = sideTokenIndex[index];
        if (spec.side === play.side && sideIndex === play.carrier) {
          desiredX = play.toX;
          desiredZ = play.toZ;
          stiffness = 13;
          damping = 4.8;
          maxSpeed = 11;
        } else if (play.receiver >= 0 && spec.side === play.side && sideIndex === play.receiver) {
          desiredX = play.toX;
          desiredZ = play.toZ;
          stiffness = 17;
          damping = 4.5;
          maxSpeed = 13;
        }
      }
      desiredX = clampValue(desiredX, -50.5, 50.5);
      desiredZ = clampValue(desiredZ, -32.5, 32.5);
      token.vx += (desiredX - token.x) * stiffness * dt;
      token.vz += (desiredZ - token.z) * stiffness * dt;
      const friction = Math.exp(-damping * dt);
      token.vx *= friction;
      token.vz *= friction;
      const rawSpeed = Math.hypot(token.vx, token.vz);
      if (rawSpeed > maxSpeed) {
        token.vx = (token.vx / rawSpeed) * maxSpeed;
        token.vz = (token.vz / rawSpeed) * maxSpeed;
      }
      token.x += token.vx * dt;
      token.z += token.vz * dt;
      if (token.x < -51) {
        token.x = -51;
        token.vx = 0;
      } else if (token.x > 51) {
        token.x = 51;
        token.vx = 0;
      }
      if (token.z < -32.5) {
        token.z = -32.5;
        token.vz = 0;
      } else if (token.z > 32.5) {
        token.z = 32.5;
        token.vz = 0;
      }
      token.speed = Math.hypot(token.vx, token.vz);
      if (token.speed > 0.18) token.heading = Math.atan2(token.vz, token.vx);
      if (child) child.position.set(token.x, Math.sin(time * 1.7 + index * 0.9) * 0.055, token.z);
      const lineGroup = speedLineGroups.current[index];
      if (lineGroup) {
        const sprintingNow = token.speed > 7.5 && playing && !reducedMotion;
        lineGroup.visible = sprintingNow;
        if (sprintingNow) {
          activeSpeedLines += lineGroup.children.length;
          const fade = clampValue((token.speed - 7.5) / 5, 0, 1);
          const dirX = Math.cos(token.heading);
          const dirZ = Math.sin(token.heading);
          lineGroup.children.forEach((lineChild, lineIndex) => {
            const spec = speedLineSpecs[index]?.[lineIndex];
            const offset = 1.05 + (spec?.offset ?? 0) * 0.7;
            lineChild.position.set(-dirX * offset, 0.42 + lineIndex * 0.16, -dirZ * offset);
            lineChild.rotation.set(0, Math.PI / 2 - token.heading, 0);
            lineChild.scale.set(1, 1, Math.max(0.6, (spec?.length ?? 1) * (1.15 + 0.9 * fade)));
            const material = (lineChild as THREE.Mesh).material as THREE.MeshBasicMaterial;
            material.opacity = 0.95 * fade;
          });
        }
      }
      maxShift = Math.max(maxShift, Math.hypot(token.x - spec.x, token.z - spec.z));
    }
    window.__clubWatchTokenShiftMax = Math.round(maxShift * 100) / 100;
    window.__clubWatchSpeedLines = activeSpeedLines;
    if (tokenRuntimeRef) tokenRuntimeRef.current = runtime;
    publishRef.current += 1;
    if (publishRef.current % 2 === 0) {
      window.__clubWatchTokens = runtime.map((token, index) => {
        const spec = tokenSpecs[index];
        return {
          id: spec?.id ?? `token-${index}`,
          side: spec?.side ?? "home",
          x: round2(token.x),
          z: round2(token.z),
          speed: round2(token.speed),
          heading: Math.round(token.heading * 1000) / 1000,
        };
      });
    }
  });
  return (
    <group ref={groupRef}>
      {tokenSpecs.map((token, index) => (
        <group key={token.id} position={[token.x, 0, token.z]}>
          <mesh geometry={bodyGeometry} material={token.side === "home" ? homeBody : awayBody} position={[0, 1.09, 0]} />
          <mesh geometry={headGeometry} material={token.side === "home" ? homeHead : awayHead} position={[0, 2.36, 0]} />
          <mesh geometry={bodyGeometry} material={inkMaterial} position={[0, 1.09, 0]} scale={outlineScale} />
          <mesh geometry={headGeometry} material={inkMaterial} position={[0, 2.36, 0]} scale={outlineScale} />
          <group
            ref={(node) => {
              if (node) speedLineGroups.current[index] = node;
            }}
            visible={false}
          >
            {Array.from({ length: 4 }).map((_, lineIndex) => (
              <mesh
                key={lineIndex}
                geometry={speedLineGeometry}
                material={speedLineMaterials[index * 4 + lineIndex]}
              />
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}

type ActiveAction = {
  event: WatchEvent;
  started: number;
  duration: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  goalDirection: 1 | -1 | null;
};

function eventTarget(event: WatchEvent): { to: THREE.Vector3; goalDirection: 1 | -1 | null } {
  const attackingDirection: 1 | -1 = event.side === "home" ? 1 : -1;
  const seed = event.minute * 37 + (event.scorer?.length ?? 0) * 11 + (event.kind === "goal" ? 5 : event.kind === "save" ? 9 : 13);
  const z = event.kind === "chance" ? (seed % 2 ? 1 : -1) * (38 + (seed % 5)) : (seed % 13) - 6;
  if (event.kind === "save") {
    // The shot travels towards the opponent goal, where the keeper stops it.
    return { to: new THREE.Vector3(attackingDirection * (PITCH_HALF_LENGTH - 2.2), 1.1, z), goalDirection: null };
  }
  return {
    to: new THREE.Vector3(attackingDirection * (PITCH_HALF_LENGTH - 1.2), event.kind === "goal" ? 1.15 : 1.6, z),
    goalDirection: attackingDirection,
  };
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const clampValue = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type SprintPlan = { ids: string[]; target: { x: number; z: number }; started: number; until: number };

/** Linear interpolation of the stored spatial path (105x68, home attacks +x). */
function sampleSpatialPath(frames: PathFrame[], minuteValue: number): { x: number; y: number } | null {
  if (!frames.length) return null;
  const first = frames[0];
  const last = frames[frames.length - 1];
  if (minuteValue <= first.minute) return { x: first.x, y: first.y };
  if (minuteValue >= last.minute) return { x: last.x, y: last.y };
  let low = 0;
  let high = frames.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (frames[mid].minute <= minuteValue) low = mid;
    else high = mid;
  }
  const a = frames[low];
  const b = frames[high];
  const span = b.minute - a.minute || 1;
  const t = Math.max(0, Math.min(1, (minuteValue - a.minute) / span));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function scenePoint(x: number, y: number, height = 0.34) {
  return new THREE.Vector3(x - PITCH_HALF_LENGTH, height, y - PITCH_HALF_WIDTH);
}

function nearestPathSide(frames: PathFrame[], minuteValue: number): "home" | "away" {
  let nearest = frames[0];
  let best = Math.abs(frames[0].minute - minuteValue);
  for (const frame of frames) {
    const distance = Math.abs(frame.minute - minuteValue);
    if (distance < best) {
      best = distance;
      nearest = frame;
    }
  }
  return nearest.side;
}

function WatchScene({
  events,
  minute,
  reducedMotion,
  mobile,
  homeColor,
  awayColor,
  path,
  lineups,
  playing,
  speed,
  palette,
  homeShortName,
  awayShortName,
  homeTrophies,
  decor,
  timeline,
  ballTrack,
  language,
  playHudRef,
  onGoalBurst,
}: {
  events: WatchEvent[];
  minute: number;
  reducedMotion: boolean;
  mobile: boolean;
  homeColor: string;
  awayColor: string;
  homeShortName: string;
  awayShortName: string;
  homeTrophies: number;
  decor?: ResolvedDecor;
  timeline?: TimelineItem[];
  ballTrack?: BallTrack;
  language: WatchLanguage;
  playHudRef?: MutableRefObject<HTMLSpanElement | null>;
  path?: PathFrame[];
  lineups?: { home: LineupSlot[]; away: LineupSlot[] };
  playing: boolean;
  speed: 1 | 2 | 4;
  palette: ComicPalette;
  onGoalBurst: (spec: BurstSpec, screen: { x: number; y: number }) => void;
}) {
  const { camera, size } = useThree();
  const ballRef = useRef<THREE.Mesh | null>(null);
  const ballShadowRef = useRef<THREE.Mesh | null>(null);
  const ballOutlineRef = useRef<THREE.Mesh | null>(null);
  const highlightRef = useRef<THREE.Mesh | null>(null);
  const flashLeftRef = useRef<THREE.Mesh | null>(null);
  const flashRightRef = useRef<THREE.Mesh | null>(null);
  const actionRef = useRef<ActiveAction | null>(null);
  const burstRef = useRef<THREE.Mesh | null>(null);
  const burstMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const burstSpecRef = useRef<{ spec: BurstSpec; started: number; duration: number } | null>(null);
  const [burstGeometry, setBurstGeometry] = useState<THREE.BufferGeometry | null>(null);
  const trailRefs = useRef<THREE.Mesh[]>([]);
  const trailPositions = useRef<THREE.Vector3[]>([]);
  const playRef = useRef<PlayFrame | null>(null);
  const tokenRuntimeRef = useRef<TokenRuntime[]>([]);
  const ballSpeedWindowRef = useRef<{ t: number; x: number; z: number }[]>([]);
  const lastBallPositionRef = useRef<THREE.Vector3 | null>(null);
  const teleportCountRef = useRef(0);
  const lastMinuteRef = useRef(0);
  const pathMinuteRef = useRef(0);
  const ballPositionRef = useRef(new THREE.Vector3(0, 0.34, 0));
  const attackSideRef = useRef<"home" | "away">("home");
  const sprintRef = useRef<SprintPlan | null>(null);
  const frameCounterRef = useRef(0);
  const clockRef = useRef(0);
  const lineupTokenSpecs = useMemo(() => {
    const home = lineups?.home;
    const away = lineups?.away;
    if (home?.length !== 11 || away?.length !== 11) return null;
    const toToken = (side: "home" | "away", slot: LineupSlot): TokenSpec => ({
      id: `${side}-${slot.id}`,
      side,
      x: slot.x - PITCH_HALF_LENGTH,
      z: slot.y - PITCH_HALF_WIDTH,
      keeper: slot.role === "GK",
    });
    return [...home.map((slot) => toToken("home", slot)), ...away.map((slot) => toToken("away", slot))];
  }, [lineups]);
  const tokenSpecs = useMemo(() => lineupTokenSpecs ?? formationTokens(), [lineupTokenSpecs]);
  const specSideIndex = useMemo(() => {
    const counters = { home: 0, away: 0 };
    return tokenSpecs.map((spec) => {
      const index = counters[spec.side];
      counters[spec.side] += 1;
      return index;
    });
  }, [tokenSpecs]);
  const timelinePlan = useMemo(() => buildTimelinePlan(timeline), [timeline]);
  const layoutSource: "lineups" | "formation" = lineupTokenSpecs ? "lineups" : "formation";
  const pathFrames = useMemo(
    () =>
      (path ?? [])
        .filter(
          (frame) =>
            Number.isFinite(frame.minute) && Number.isFinite(frame.x) && Number.isFinite(frame.y),
        )
        .slice()
        .sort((a, b) => a.minute - b.minute),
    [path],
  );
  const ballMaterial = useMemo(() => comicMaterial("#f7f7f2"), []);
  const ballInkMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: COMIC_INK, side: THREE.BackSide }), []);
  const ballOutlineScale = inkOutline(1).scale;
  const trailGeometry = useMemo(() => new THREE.SphereGeometry(0.27, 8, 6), []);
  const trailMaterials = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) =>
        new THREE.MeshBasicMaterial({
          color: COMIC_PALETTE.burst[0],
          transparent: true,
          opacity: 0.55 - index * 0.075,
          depthWrite: false,
        }),
      ),
    [],
  );
  const ballGeometry = useMemo(() => new THREE.SphereGeometry(0.34, mobile ? 10 : 14, mobile ? 8 : 10), [mobile]);
  const highlightGeometry = useMemo(() => new THREE.RingGeometry(0.95, 1.3, 28), []);
  const highlightMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#ffe14a", transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    [],
  );
  const flashGeometry = useMemo(() => new THREE.PlaneGeometry(7.4, 2.7), []);
  const flashMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#ffe14a", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    [],
  );
  const shadowMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#07121f", transparent: true, opacity: 0.28 }), []);
  const shadowGeometry = useMemo(() => new THREE.CircleGeometry(0.55, 16), []);
  useEffect(
    () => () => {
      ballMaterial.dispose();
      ballInkMaterial.dispose();
      ballGeometry.dispose();
      trailGeometry.dispose();
      trailMaterials.forEach((material) => material.dispose());
      highlightGeometry.dispose();
      highlightMaterial.dispose();
      flashGeometry.dispose();
      flashMaterial.dispose();
      shadowMaterial.dispose();
      shadowGeometry.dispose();
    },
    [
      ballMaterial,
      ballGeometry,
      highlightGeometry,
      highlightMaterial,
      flashGeometry,
      flashMaterial,
      shadowMaterial,
      shadowGeometry,
      ballInkMaterial,
      trailGeometry,
      trailMaterials,
    ],
  );

  useEffect(() => {
    window.__clubWatchReady = true;
    window.__clubWatchBallSpeed = 0;
    window.__clubWatchTeleports = 0;
    teleportCountRef.current = 0;
    ballSpeedWindowRef.current = [];
    lastBallPositionRef.current = null;
    return () => {
      window.__clubWatchLastEvent = null;
      window.__clubWatchLastShot = null;
      window.__clubWatchBallSpeed = undefined;
      window.__clubWatchTeleports = undefined;
    };
  }, []);

  const publishBall = (position: THREE.Vector3) => {
    frameCounterRef.current += 1;
    if (frameCounterRef.current % 3 !== 0) return;
    window.__clubWatchBall = {
      minute: round2(pathMinuteRef.current),
      x: round2(position.x),
      y: round2(position.y),
      z: round2(position.z),
    };
    window.__clubWatchSpatial = {
      pathMinute: round2(pathMinuteRef.current),
      ballX: round2(position.x),
      ballZ: round2(position.z),
      frames: pathFrames.length,
      attackSide: attackSideRef.current,
    };
  };

  const resetFlashes = () => {
    if (highlightRef.current) highlightRef.current.visible = false;
    if (flashLeftRef.current) (flashLeftRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
    if (flashRightRef.current) (flashRightRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
  };

  useFrame((state, delta) => {
    const clock = (clockRef.current += delta);
    const hudMinute = Math.min(90, Math.max(0, minute));
    void state;

    if (reducedMotion) {
      const sample = pathFrames.length ? sampleSpatialPath(pathFrames, hudMinute) : null;
      const staticPosition = sample ? scenePoint(sample.x, sample.y) : new THREE.Vector3(0, 0.34, 0);
      if (ballRef.current) ballRef.current.position.copy(staticPosition);
      if (ballShadowRef.current) ballShadowRef.current.position.set(staticPosition.x, 0.02, staticPosition.z);
      ballPositionRef.current.set(staticPosition.x, staticPosition.z);
      pathMinuteRef.current = hudMinute;
      lastMinuteRef.current = hudMinute;
      actionRef.current = null;
      resetFlashes();
      if (ballOutlineRef.current) ballOutlineRef.current.position.copy(staticPosition);
      trailRefs.current.forEach((mesh) => { mesh.visible = false; });
      window.__clubWatchTrail = 0;
      window.__clubWatchBallSpeed = 0;
      window.__clubWatchTeleports = teleportCountRef.current;
      publishBall(staticPosition);
      return;
    }

    if (pathFrames.length) attackSideRef.current = nearestPathSide(pathFrames, pathMinuteRef.current);

    // Continuous spatial playhead: advances between the integer HUD minute ticks so
    // the ball glides along the stored path instead of jumping once per minute.
    if (!playing) {
      pathMinuteRef.current = hudMinute;
    } else {
      let next = pathMinuteRef.current + delta * speed;
      if (Math.abs(hudMinute - next) > 2) next = hudMinute; // seeking / big jumps
      pathMinuteRef.current = Math.min(hudMinute, next);
    }

    if (hudMinute !== lastMinuteRef.current) {
      if (hudMinute > lastMinuteRef.current) {
        const crossed = events.filter(
          (event) => event.kind !== "sub" && event.minute > lastMinuteRef.current && event.minute <= hudMinute,
        );
        if (crossed.length) {
          const event = crossed[crossed.length - 1];
          const hasSpatial = typeof event.x === "number" && typeof event.y === "number";
          let target: THREE.Vector3;
          let goalDirection: 1 | -1 | null = null;
          if (hasSpatial) {
            target = scenePoint(
              event.x as number,
              event.y as number,
              event.kind === "goal" ? 1.15 : event.kind === "save" ? 1.25 : 1.65,
            );
            goalDirection = event.kind === "goal" ? (event.side === "home" ? 1 : -1) : null;
          } else {
            const fallback = eventTarget(event);
            target = fallback.to;
            goalDirection = fallback.goalDirection;
          }
          const currentSample = pathFrames.length ? sampleSpatialPath(pathFrames, pathMinuteRef.current) : null;
          const from = currentSample
            ? scenePoint(currentSample.x, currentSample.y)
            : ballRef.current
              ? ballRef.current.position.clone()
              : new THREE.Vector3();
          actionRef.current = {
            event,
            started: clock,
            duration: event.kind === "goal" ? 1.5 : 1.1,
            from,
            to: target,
            goalDirection,
          };
          window.__clubWatchLastEvent = { minute: event.minute, kind: event.kind, side: event.side };
          window.__clubWatchLastShot = {
            spatial: hasSpatial,
            minute: event.minute,
            kind: event.kind,
            from: { x: round2(from.x), z: round2(from.z) },
            to: { x: round2(target.x), z: round2(target.z) },
          };
          window.__clubWatchEventCount = (window.__clubWatchEventCount ?? 0) + 1;
          if (event.kind === "goal") {
            const burst = goalBurst(
              event.minute * 131 + (event.side === "home" ? 7 : 13) + (event.scorer?.length ?? 0),
              event.side === "home",
              event.homeName ?? "Home",
              event.awayName ?? "Away",
              event.minute,
            );
            const projected = target.clone().project(camera);
            onGoalBurst(burst, {
              x: (projected.x * 0.5 + 0.5) * size.width,
              y: (-projected.y * 0.5 + 0.5) * size.height,
            });
            setBurstGeometry((previous) => {
              previous?.dispose();
              return starBurstGeometry(burst.rays);
            });
            burstSpecRef.current = { spec: burst, started: clock, duration: 1.7 };
            if (burstRef.current) {
              burstRef.current.position.set(target.x, 1.85, target.z);
              burstRef.current.visible = true;
              burstRef.current.scale.setScalar(0.4);
            }
            window.__clubWatchBurst = {
              visible: true,
              headline: burst.headline,
              subline: burst.subline,
              rotation: burst.rotation,
              rays: burst.rays,
            };
          }
          // Short sprints to the event spot for the nearest two/three outfield tokens.
          const sprintIds = tokenSpecs
            .filter((spec) => !spec.keeper && spec.side === event.side)
            .map((spec) => ({
              id: spec.id,
              distance: Math.hypot(spec.x - target.x, spec.z - target.z),
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 3)
            .map((entry) => entry.id);
          sprintRef.current = {
            ids: sprintIds,
            target: { x: target.x, z: target.z },
            started: clock,
            until: clock + 1.7,
          };
          if (highlightRef.current) {
            highlightRef.current.position.set(target.x, 0.05, target.z);
            highlightRef.current.visible = true;
          }
        }
      } else {
        actionRef.current = null;
        sprintRef.current = null;
        resetFlashes();
      }
      lastMinuteRef.current = hudMinute;
    }

    if (!timelinePlan.length) {
      if (actionRef.current) {
        const action = actionRef.current;
        const progress = Math.min(1, (clock - action.started) / action.duration);
        const eased = 1 - (1 - progress) ** 3;
        const position = action.from.clone().lerp(action.to, eased);
        position.y += Math.sin(progress * Math.PI) * (action.event.kind === "goal" ? 2.6 : 1.4);
        if (ballRef.current) {
          ballRef.current.position.copy(position);
          ballRef.current.rotation.x += delta * 7;
        }
        if (action.event.kind === "goal" && action.goalDirection !== null) {
          const flash = action.goalDirection > 0 ? flashRightRef.current : flashLeftRef.current;
          if (flash) (flash.material as THREE.MeshBasicMaterial).opacity = Math.sin(progress * Math.PI) * 0.85;
        }
        if (progress >= 1) {
          actionRef.current = null;
          resetFlashes();
        }
      } else {
        const sample = pathFrames.length ? sampleSpatialPath(pathFrames, pathMinuteRef.current) : null;
        if (sample) {
          const target = scenePoint(sample.x, sample.y);
          if (ballRef.current) {
            ballRef.current.position.lerp(target, 1 - Math.exp(-delta * 24));
            ballRef.current.rotation.x += delta * 2.4 * (playing ? speed : 1);
            ballRef.current.rotation.z -= delta * 1.6;
          }
        } else {
          // Old records without a spatial path keep the original breathing ball.
          const idleX = Math.sin(clock * 0.35) * 1.6;
          const idleZ = Math.cos(clock * 0.27) * 1.1;
          if (ballRef.current) {
            ballRef.current.position.lerp(new THREE.Vector3(idleX, 0.34, idleZ), 1 - Math.exp(-delta * 3.2));
            ballRef.current.rotation.x += delta * 0.8;
            ballRef.current.rotation.z -= delta * 0.5;
          }
        }
        if (flashLeftRef.current) (flashLeftRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
        if (flashRightRef.current) (flashRightRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }

    let ballTarget: { x: number; y: number; z: number } | null = null;
    if (timelinePlan.length) {
      const playMinute = pathMinuteRef.current;
      let entry = timelinePlan[0];
      let progress = 0;
      for (const candidate of timelinePlan) {
        if (candidate.start <= playMinute) {
          entry = candidate;
          progress = Math.max(0, Math.min(1, (playMinute - candidate.start) / (candidate.end - candidate.start)));
        } else {
          break;
        }
      }
      const item = entry.item;
      const fromX = item.from.x - PITCH_HALF_LENGTH;
      const fromZ = item.from.y - PITCH_HALF_WIDTH;
      const toX = item.to.x - PITCH_HALF_LENGTH;
      const toZ = item.to.y - PITCH_HALF_WIDTH;
      const trackTarget = sampleBallTrack(ballTrack, playMinute);
      let targetX = fromX;
      let targetZ = fromZ;
      if (item.kind === "dribble") {
        const carrierSpecIndex = tokenSpecs.findIndex(
          (spec, index) => spec.side === item.side && specSideIndex[index] === item.carrier,
        );
        const runtime = carrierSpecIndex >= 0 ? tokenRuntimeRef.current[carrierSpecIndex] : undefined;
        if (runtime) {
          targetX = runtime.x + Math.cos(runtime.heading) * 0.5;
          targetZ = runtime.z + Math.sin(runtime.heading) * 0.5;
        } else if (trackTarget) {
          targetX = trackTarget.x - PITCH_HALF_LENGTH;
          targetZ = trackTarget.y - PITCH_HALF_WIDTH;
        }
      } else if (trackTarget) {
        targetX = trackTarget.x - PITCH_HALF_LENGTH;
        targetZ = trackTarget.y - PITCH_HALF_WIDTH;
      } else {
        const eased = 1 - (1 - progress) ** 3;
        targetX = fromX + (toX - fromX) * eased;
        targetZ = fromZ + (toZ - fromZ) * eased;
      }
      const targetY = item.kind === "shot" ? 0.34 + Math.sin(progress * Math.PI) * 1.35 : 0.34;
      ballTarget = { x: targetX, y: targetY, z: targetZ };
      playRef.current = {
        active: true,
        kind: item.kind,
        side: item.side,
        carrier: item.carrier,
        receiver: item.receiver,
        fromX,
        fromZ,
        toX,
        toZ,
        progress,
      };
      window.__clubWatchPlay = {
        minute: round2(playMinute),
        kind: item.kind,
        carrier: item.carrier,
        receiver: item.receiver,
        side: item.side,
        ball: { x: round2(targetX + PITCH_HALF_LENGTH), y: round2(targetZ + PITCH_HALF_WIDTH) },
      };
      if (playHudRef?.current) {
        const label = watchCopy(
          language,
          item.kind === "dribble" ? "playDribble" : item.kind === "pass" ? "playPass" : item.kind === "shot" ? "playShot" : "playRestart",
        );
        playHudRef.current.textContent = `${label} · ${item.carrier}${item.receiver >= 0 ? ` → ${item.receiver}` : ""}`;
      }
    } else {
      playRef.current = null;
      window.__clubWatchPlay = null;
      if (playHudRef?.current) {
        playHudRef.current.textContent = "";
      }
    }

    if (ballTarget && ballRef.current) {
      const currentBall = ballRef.current.position;
      const dx = ballTarget.x - currentBall.x;
      const dz = ballTarget.z - currentBall.z;
      const horizontal = Math.hypot(dx, dz);
      const maxStep = 18 * speed * delta;
      if (horizontal > 0.0001) {
        const step = Math.min(horizontal, maxStep);
        currentBall.x += (dx / horizontal) * step;
        currentBall.z += (dz / horizontal) * step;
      }
      currentBall.y += Math.max(-maxStep, Math.min(maxStep, ballTarget.y - currentBall.y));
      ballRef.current.rotation.x += delta * 5;
      if (window.__clubWatchPlay) {
        window.__clubWatchPlay = {
          ...window.__clubWatchPlay,
          ball: { x: round2(currentBall.x + PITCH_HALF_LENGTH), y: round2(currentBall.z + PITCH_HALF_WIDTH) },
        };
      }
    }

    if (ballRef.current) {
      ballPositionRef.current.set(ballRef.current.position.x, ballRef.current.position.z);
      if (ballShadowRef.current) ballShadowRef.current.position.set(ballRef.current.position.x, 0.02, ballRef.current.position.z);
      if (ballOutlineRef.current) ballOutlineRef.current.position.copy(ballRef.current.position);
      const previousTrail = trailPositions.current[0];
      if (!reducedMotion && (!previousTrail || previousTrail.distanceToSquared(ballRef.current.position) > 0.0025)) {
        trailPositions.current.unshift(ballRef.current.position.clone());
        if (trailPositions.current.length > 6) trailPositions.current.length = 6;
      }
      let visibleTrail = 0;
      trailRefs.current.forEach((mesh, index) => {
        const position = trailPositions.current[index];
        if (position && !reducedMotion) {
          mesh.visible = true;
          mesh.position.copy(position);
          mesh.scale.setScalar(1 - index * 0.11);
          visibleTrail += 1;
        } else {
          mesh.visible = false;
        }
      });
      window.__clubWatchTrail = visibleTrail;
      publishBall(ballRef.current.position);
    }

    if (burstRef.current && burstSpecRef.current) {
      const burst = burstSpecRef.current;
      const progress = Math.min(1, (clock - burst.started) / burst.duration);
      burstRef.current.scale.setScalar(reducedMotion ? 1.25 : 0.4 + progress * 2.5);
      burstRef.current.rotation.z = ((burst.spec.rotation * Math.PI) / 180) + (reducedMotion ? 0 : progress * 0.25);
      if (burstMaterialRef.current) burstMaterialRef.current.opacity = reducedMotion ? 0.85 : 0.96 * (1 - progress);
      if (progress >= 1) {
        burstRef.current.visible = false;
        burstSpecRef.current = null;
        window.__clubWatchBurst = {
          visible: false,
          headline: burst.spec.headline,
          subline: burst.spec.subline,
          rotation: burst.spec.rotation,
          rays: burst.spec.rays,
        };
      }
    }

    if (ballRef.current) {
      const position = ballRef.current.position;
      const speedWindow = ballSpeedWindowRef.current;
      speedWindow.push({ t: clock, x: position.x, z: position.z });
      while (speedWindow.length && clock - speedWindow[0].t > 1) speedWindow.shift();
      const first = speedWindow[0];
      const elapsed = clock - first.t;
      const ballSpeed = elapsed > 0.02 ? Math.hypot(position.x - first.x, position.z - first.z) / elapsed : 0;
      window.__clubWatchBallSpeed = round2(ballSpeed);
      const previous = lastBallPositionRef.current;
      if (previous) {
        const moved = Math.hypot(position.x - previous.x, position.z - previous.z);
        if (moved > 25) teleportCountRef.current += 1;
      }
      lastBallPositionRef.current = position.clone();
      window.__clubWatchTeleports = teleportCountRef.current;
    }
  });

  return (
    <>
      <Stadium
        mobile={mobile}
        palette={palette}
        homeColor={homeColor}
        awayColor={awayColor}
        homeShortName={homeShortName}
        awayShortName={awayShortName}
        homeTrophies={homeTrophies}
        decor={decor}
      />
      <Tokens
        homeColor={homeColor}
        awayColor={awayColor}
        mobile={mobile}
        reducedMotion={reducedMotion}
        ballPositionRef={ballPositionRef}
        attackSideRef={attackSideRef}
        sprintRef={sprintRef}
        tokenSpecs={tokenSpecs}
        layoutSource={layoutSource}
        playing={playing}
        playRef={playRef}
        tokenRuntimeRef={tokenRuntimeRef}
      />
      <mesh ref={ballRef} geometry={ballGeometry} material={ballMaterial} position={[0, 0.34, 0]} />
      <mesh ref={ballOutlineRef} geometry={ballGeometry} material={ballInkMaterial} position={[0, 0.34, 0]} scale={ballOutlineScale} />
      <mesh ref={ballShadowRef} geometry={shadowGeometry} material={shadowMaterial} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} />
      {trailMaterials.map((material, index) => (
        <mesh
          key={index}
          ref={(node) => {
            if (node) trailRefs.current[index] = node;
          }}
          geometry={trailGeometry}
          material={material}
          visible={false}
        />
      ))}
      <mesh ref={burstRef} geometry={burstGeometry ?? undefined} visible={false} renderOrder={4}>
        <meshBasicMaterial ref={burstMaterialRef} color={palette.burst[0]} transparent opacity={0.95} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh
        ref={highlightRef}
        geometry={highlightGeometry}
        material={highlightMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
        visible={false}
      />
      <mesh
        ref={flashLeftRef}
        geometry={flashGeometry}
        material={flashMaterial}
        position={[-PITCH_HALF_LENGTH + 2.4, 1.5, 0]}
        rotation={[0, Math.PI / 2 - 0.55, 0]}
      />
      <mesh
        ref={flashRightRef}
        geometry={flashGeometry}
        material={flashMaterial.clone()}
        position={[PITCH_HALF_LENGTH - 2.4, 1.5, 0]}
        rotation={[0, -Math.PI / 2 + 0.55, 0]}
      />
    </>
  );
}

function CameraRig({
  reducedMotion,
  mobile,
  minute,
}: {
  reducedMotion: boolean;
  mobile: boolean;
  minute: number;
}) {
  const { camera } = useThree();
  const entranceStarted = useRef<number | null>(null);
  const entranceDone = useRef(false);
  const smooth = (value: number) => 1 - (1 - value) ** 2;
  const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (reducedMotion) {
      camera.position.set(0, 46, 62);
      camera.lookAt(0, 0, 0);
      if (!entranceDone.current) {
        entranceDone.current = true;
        window.__clubWatchEntrance = { active: false, phase: "broadcast", progress: 1, skipped: true };
      }
      return;
    }
    if (minute > 0) {
      entranceDone.current = true;
      window.__clubWatchEntrance = { active: false, phase: "broadcast", progress: 1, skipped: true };
    }
    if (!entranceDone.current) {
      if (entranceStarted.current === null) {
        entranceStarted.current = time;
        window.__clubWatchEntrance = {
          active: true,
          phase: "entrance",
          progress: 0,
          startedAt: Date.now(),
        };
      }
      const elapsed = time - (entranceStarted.current ?? time);
      const duration = 2.8;
      const progress = Math.min(1, elapsed / duration);
      if (progress < 1) {
        const phase = elapsed / duration;
        let x = 0;
        let y = 46;
        let z = 62;
        let lookX = 0;
        let lookY = 0.4;
        let lookZ = 0;
        if (phase < 0.18) {
          const amount = smooth(phase / 0.18);
          x = lerp(0, -42, amount);
          y = lerp(46, 24, amount);
          z = lerp(62, 30, amount);
          lookX = lerp(0, -25, amount);
          lookY = lerp(0.4, 12, amount);
          lookZ = lerp(0, -38, amount);
        } else if (phase < 0.82) {
          const amount = (phase - 0.18) / 0.64;
          x = -42 + 84 * amount;
          y = 24;
          z = 30;
          lookX = -25 + 50 * amount;
          lookY = 12;
          lookZ = -38;
        } else {
          const amount = smooth((phase - 0.82) / 0.18);
          x = lerp(42, 0, amount);
          y = lerp(24, 46, amount);
          z = lerp(30, 62, amount);
          lookX = lerp(25, 0, amount);
          lookY = lerp(12, 0.4, amount);
          lookZ = lerp(-38, 0, amount);
        }
        camera.position.set(x, y, z);
        camera.lookAt(lookX, lookY, lookZ);
        window.__clubWatchEntrance = {
          active: true,
          phase: "entrance",
          progress: Math.round(progress * 100) / 100,
          startedAt: Date.now() - Math.round(elapsed * 1000),
        };
        return;
      }
      entranceDone.current = true;
      window.__clubWatchEntrance = {
        active: false,
        phase: "broadcast",
        progress: 1,
        completedAt: Date.now(),
      };
    }
    const timeNow = clock.getElapsedTime();
    const sway = mobile ? 0.5 : 1.1;
    camera.position.set(Math.sin(timeNow * 0.11) * sway, 46 + Math.sin(timeNow * 0.22) * 0.35, 62);
    camera.lookAt(0, 0.4, 0);
  });
  return null;
}

function FpsProbe() {
  const frames = useRef(0);
  const startedAt = useRef(0);
  useFrame(() => {
    const now = performance.now();
    if (!startedAt.current) {
      startedAt.current = now;
      frames.current = 0;
      return;
    }
    frames.current += 1;
    const elapsed = now - startedAt.current;
    if (elapsed >= 1000) {
      window.__clubWatchFps = Math.round((frames.current * 1000) / elapsed);
      frames.current = 0;
      startedAt.current = now;
    }
  });
  return null;
}

function InvalidateOnChange({ minute, reducedMotion }: { minute: number; reducedMotion: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (reducedMotion) invalidate();
  }, [minute, reducedMotion, invalidate]);
  return null;
}

class WatchErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/* overlay component                                                   */
/* ------------------------------------------------------------------ */

export default function ClubWatch3D({
  events,
  homeName,
  awayName,
  homeColor = "#1f4e79",
  awayColor = "#c8f56e",
  homeShortName,
  awayShortName,
  homeTrophies = 0,
  decor,
  timeline,
  ballTrack,
  path,
  lineups,
  language,
  onClose,
}: {
  events: WatchEvent[];
  homeName: string;
  awayName: string;
  homeColor?: string;
  awayColor?: string;
  homeShortName?: string;
  awayShortName?: string;
  homeTrophies?: number;
  decor?: ResolvedDecor;
  timeline?: TimelineItem[];
  ballTrack?: BallTrack;
  path?: PathFrame[];
  lineups?: { home: LineupSlot[]; away: LineupSlot[] };
  language: WatchLanguage;
  onClose: () => void;
}) {
  const [minute, setMinute] = useState(0);
  const [playing, setPlaying] = useState(false);
  const autoStartedRef = useRef(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [goalBurstInfo, setGoalBurstInfo] = useState<{ spec: BurstSpec; x: number; y: number } | null>(null);
  const burstTimerRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const playHudRef = useRef<HTMLSpanElement | null>(null);
  const palette = useMemo(() => comicPaletteFor(homeColor, awayColor), [homeColor, awayColor]);
  const homeShort = homeShortName || homeName.slice(0, 3).toUpperCase();
  const awayShort = awayShortName || awayName.slice(0, 3).toUpperCase();

  useEffect(() => {
    const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 700px)");
    const apply = () => {
      setReducedMotion(reduceQuery.matches);
      setMobile(mobileQuery.matches);
      window.__clubWatchReducedMotion = reduceQuery.matches;
      if (!reduceQuery.matches && !autoStartedRef.current) {
        autoStartedRef.current = true;
        setPlaying(true);
      }
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
    window.__clubWatchEventCount = 0;
    window.__clubWatchLastEvent = null;
    window.__clubWatchComic = true;
    window.__clubWatchAtmosphere = true;
    window.__clubWatchDecor = decor
      ? { pitch: decor.choice.pitch, stands: decor.choice.stands, lights: decor.choice.lights }
      : { pitch: "pitch.stripes", stands: "stands.classic", lights: "lights.white" };
    window.__clubWatchEntrance = { active: false, phase: "waiting", progress: 0 };
    return () => {
      if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current);
      window.__clubWatchFps = undefined;
      window.__clubWatchReady = false;
      window.__clubWatchComic = false;
      window.__clubWatchAtmosphere = false;
      window.__clubWatchDecor = null;
      window.__clubWatchEntrance = null;
      window.__clubWatchDecor = null;
      window.__clubWatchPlay = null;
      window.__clubWatchBurst = null;
    };
  }, [decor]);

  const handleGoalBurst = (spec: BurstSpec, screen: { x: number; y: number }) => {
    if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current);
    setGoalBurstInfo({ spec, x: screen.x, y: screen.y });
    burstTimerRef.current = window.setTimeout(() => {
      setGoalBurstInfo(null);
      burstTimerRef.current = null;
    }, reducedMotion ? 2400 : 1900);
  };

  const finished = minute >= 90;
  const tickMs = 1000 / speed;
  useEffect(() => {
    if (!playing || reducedMotion || minute >= 90) return;
    const timeout = window.setTimeout(() => setMinute((value) => Math.min(90, value + 1)), tickMs);
    return () => window.clearTimeout(timeout);
  }, [playing, reducedMotion, minute, tickMs]);

  const goto = (value: number) => setMinute(Math.max(0, Math.min(90, value)));
  const toggle = () => {
    if (finished) {
      setMinute(0);
      setPlaying(true);
      return;
    }
    setPlaying((value) => !value);
  };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const interactive =
      target !== null && target !== event.currentTarget && ["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A"].includes(target.tagName);
    if (interactive) return;
    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      toggle();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goto(minute - 5);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goto(minute + 5);
    }
  };

  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.minute - b.minute), [events]);
  const goals = sortedEvents.filter((event) => event.kind === "goal" && event.minute <= minute);
  const homeGoals = goals.filter((event) => event.side === "home").length;
  const awayGoals = goals.filter((event) => event.side === "away").length;
  const latestEvent = [...sortedEvents].reverse().find((event) => event.minute <= minute) ?? null;
  const announcement = finished
    ? watchCopy(language, "fullTimeLive", homeName, homeGoals, awayName, awayGoals)
    : latestEvent
      ? latestEvent.kind === "goal"
        ? watchCopy(
            language,
            "goalLive",
            latestEvent.minute,
            latestEvent.scorer ?? "—",
            homeName,
            homeGoals,
            awayName,
            awayGoals,
          )
        : latestEvent.kind === "sub"
          ? watchCopy(language, "subLive", latestEvent.minute, latestEvent.out ?? "—", latestEvent.scorer ?? "—")
          : watchCopy(
              language,
              "eventLive",
              latestEvent.minute,
              eventKindLabel(language, latestEvent.kind),
              latestEvent.scorer ?? (latestEvent.side === "home" ? homeName : awayName),
            )
      : playing
        ? watchCopy(language, "livePlay")
        : watchCopy(language, "kickoff");
  const commentary = latestEvent
    ? latestEvent.kind === "sub"
      ? `${latestEvent.minute}' ${watchCopy(language, "sub")} · ${latestEvent.out ?? "—"} → ${latestEvent.scorer ?? "—"}`
      : `${latestEvent.minute}' ${eventKindLabel(language, latestEvent.kind)}${
          latestEvent.scorer ? ` · ${latestEvent.scorer}` : ""
        }`
    : playing
      ? watchCopy(language, "livePlay")
      : watchCopy(language, "kickoff");

  const reducedBurst =
    reducedMotion && latestEvent?.kind === "goal" && latestEvent.minute === minute
      ? {
          spec: goalBurst(
            latestEvent.minute * 131 + (latestEvent.side === "home" ? 7 : 13) + (latestEvent.scorer?.length ?? 0),
            latestEvent.side === "home",
            homeName,
            awayName,
            latestEvent.minute,
          ),
          x: 0,
          y: 0,
        }
      : null;
  const visibleBurst = goalBurstInfo ?? reducedBurst;

  const fallback = (
    <p className="club-watch3d-fallback">
      {language === "zh" ? "3D 场景暂不可用（WebGL 不可用）。" : "The 3D scene is unavailable (WebGL is not available)."}
    </p>
  );

  return (
    <div
      className="club-watch3d club-watch3d-comic"
      data-reduced-motion={reducedMotion ? "true" : "false"}
      ref={wrapperRef}
      role="region"
      aria-label={watchCopy(language, "ariaLabel")}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="club-watch3d-stage">
        <WatchErrorBoundary fallback={fallback}>
          <Canvas
            className="club-watch3d-canvas"
            dpr={[1, mobile ? 1 : 1.25]}
            shadows={false}
            frameloop={reducedMotion ? "demand" : "always"}
            camera={{ position: [0, 46, 62], fov: 42, near: 0.5, far: 260 }}
            gl={{ antialias: false, powerPreference: "low-power" }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace;
              window.__clubWatchReady = true;
            }}
          >
            <WatchScene
              events={sortedEvents}
              minute={minute}
              reducedMotion={reducedMotion}
              mobile={mobile}
              homeColor={homeColor}
              awayColor={awayColor}
              path={path}
              lineups={lineups}
              playing={playing}
              speed={speed}
              palette={palette}
              homeShortName={homeShort}
              awayShortName={awayShort}
              homeTrophies={homeTrophies}
              decor={decor}
              timeline={timeline}
              ballTrack={ballTrack}
              language={language}
              playHudRef={playHudRef}
              onGoalBurst={handleGoalBurst}
            />
            <CameraRig reducedMotion={reducedMotion} mobile={mobile} minute={minute} />
            <FpsProbe />
            <InvalidateOnChange minute={minute} reducedMotion={reducedMotion} />
          </Canvas>
        </WatchErrorBoundary>
        <div className="club-watch3d-top">
          <span className="club-watch3d-comic-badge">{language === "zh" ? "漫画风" : "COMIC"}</span>
          <div className="club-watch3d-score">
            <span className="club-watch3d-team">{homeName}</span>
            <b>{`${homeGoals} – ${awayGoals}`}</b>
            <span className="club-watch3d-team club-watch3d-team-away">{awayName}</span>
          </div>
          <div className="club-watch3d-clock">
            <span>{watchCopy(language, "minute", minute)}</span>
            {finished ? <span className="club-watch3d-fulltime">{watchCopy(language, "fullTime")}</span> : null}
          </div>
        </div>
        <div className="club-watch3d-commentary">
          <span className="club-watch3d-kicker">{watchCopy(language, "commentary")}</span>
          <p>{commentary}</p>
          <span className="club-watch3d-play-hud" ref={playHudRef} />
        </div>
        {visibleBurst ? (
          <div
            className={`club-watch3d-goal-burst${reducedMotion ? " is-static" : ""}${reducedBurst ? " is-reduced-static" : ""}`}
            aria-hidden="true"
            style={
              {
                left: reducedBurst ? "50%" : `${Math.max(90, Math.min(1000, visibleBurst.x))}px`,
                top: reducedBurst ? "40%" : `${Math.max(90, Math.min(520, visibleBurst.y))}px`,
                "--burst-rotation": `${visibleBurst.spec.rotation}deg`,
                "--burst-scale": `${visibleBurst.spec.scale}`,
              } as CSSProperties
            }
          >
            <span className="club-watch3d-goal-burst-rays" aria-hidden="true" />
            <b>{visibleBurst.spec.headline}</b>
            <span>{visibleBurst.spec.subline}</span>
          </div>
        ) : null}
        <p className="club-watch3d-live" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>

      <div className="club-watch3d-note">
        <span className="club-badge club-watch3d-badge">{watchCopy(language, "badge")}</span>
        <span>{watchCopy(language, "physicsNote")}</span>
        <span className="club-watch3d-spatial-note">{watchCopy(language, "spatialNote")}</span>
        {!path?.length ? <span className="club-watch3d-fallback-note">{watchCopy(language, "fallbackNote")}</span> : null}
        {reducedMotion ? <span className="club-watch3d-reduced">{watchCopy(language, "reducedNote")}</span> : null}
      </div>

      <div className="club-watch3d-controls">
        <button type="button" className="club-button club-button-primary" onClick={toggle}>
          {finished ? watchCopy(language, "replay") : playing ? watchCopy(language, "pause") : watchCopy(language, "play")}
        </button>
        <div className="club-watch3d-speed" role="group" aria-label={watchCopy(language, "speed")}>
          {([1, 2, 4] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`club-watch3d-speed-button${speed === value ? " is-selected" : ""}`}
              aria-pressed={speed === value}
              onClick={() => setSpeed(value)}
            >
              {`${value}×`}
            </button>
          ))}
        </div>
        <div className="club-watch3d-progress">
          <input
            type="range"
            min={0}
            max={90}
            step={1}
            value={minute}
            onChange={(event) => setMinute(Number(event.target.value))}
            aria-label={language === "zh" ? "比赛进度（分钟）" : "Match progress (minutes)"}
          />
          <span className="club-watch3d-progress-labels">
            <span>0′</span>
            <span>45′</span>
            <span>90′</span>
          </span>
        </div>
        <button type="button" className="club-button club-button-secondary" onClick={onClose}>
          {watchCopy(language, "close")}
        </button>
      </div>
    </div>
  );
}
