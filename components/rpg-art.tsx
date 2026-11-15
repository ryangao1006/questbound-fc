"use client";

import { useId, type ReactNode } from "react";

type RPGArtProps = {
  level?: number;
  equipped?: string[];
  className?: string;
  large?: boolean;
  onSelect?: (id: string) => void;
};

const tiers: Record<string, number> = { tunic: 1, staff: 2, cloak: 3, sword: 4, companion: 5 };

function Spark({ x, y, size = 1, green = false }: { x: number; y: number; size?: number; green?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`} aria-hidden="true">
      <path d="M0-7 2-2 7 0 2 2 0 7-2 2-7 0-2-2Z" fill={green ? "#8ca68b" : "#d3ae66"} />
    </g>
  );
}

function Fern({ x, y, flip = false, size = 1 }: { x: number; y: number; flip?: boolean; size?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -size : size} ${size})`} aria-hidden="true">
      <path d="M0 0c-1-26-13-43-31-59m31 57c6-28 17-43 36-55" stroke="#78927a" strokeWidth="2" strokeLinecap="round" />
      <path d="M-6-22c-13 0-25-8-24-18 13-1 22 5 24 18Zm-8-15c-11 0-21-6-21-15 13 0 19 6 21 15Zm14 32c-15 1-31-7-33-19C-13-25-2-16 0-5Zm7-20c16 0 25-10 24-19-13 0-23 9-24 19Zm8-15c15 1 21-8 21-16-10 0-21 8-21 16Zm-10 28c19 0 31-8 32-19-17-1-31 8-32 19Z" fill="#9aaf8d" />
      <path d="M-3-10c-6-19-3-40 5-53 10 17 9 40-5 53Z" fill="#b5bf97" />
      <path d="m-3-11 5-50" stroke="#879b7c" strokeWidth="1.5" />
    </g>
  );
}

function EquipmentSlot({ name, label, x, y, active, children, onSelect }: {
  name: string;
  label: string;
  x: number;
  y: number;
  active: boolean;
  children: ReactNode;
  onSelect?: (id: string) => void;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g
        className={`rpg-equipment ${active ? "rpg-equipment-active" : "rpg-equipment-future"}`}
        role={onSelect ? "button" : "img"}
        tabIndex={onSelect ? 0 : undefined}
        aria-label={`${label}${active ? ", equipped" : `, unlock at level ${tiers[name]}`}`}
        onClick={onSelect ? () => onSelect(name) : undefined}
        onKeyDown={onSelect ? event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(name);
          }
        } : undefined}
        data-interactive={Boolean(onSelect)}
      >
        <circle r="29" fill={active ? "#f5e9ce" : "#f6f1e5"} stroke={active ? "#c5a066" : "#d9d4c5"} strokeWidth="1.5" />
        <circle className="rpg-slot-outline" r="34" stroke={active ? "#c5a066" : "#ddd8cb"} strokeDasharray={active ? "2 5" : "1 5"} opacity=".65" />
        <g stroke={active ? "#896b42" : "#a5aa97"} fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" opacity={active ? 1 : .65}>
          {children}
        </g>
        {active && <path d="m16 20 3 3 6-7" stroke="#55765c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      </g>
    </g>
  );
}

function Companion({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <ellipse cx="8" cy="31" rx="32" ry="8" fill="#5f7658" opacity=".12" />
      <path d="M13 24c34 14 38-16 26-29 1 15-12 10-20 9-14 0-18 14-6 20Z" fill="#bf7953" />
      <path d="M37-2c3 8 2 20-7 25-3-8 0-14 7-25Z" fill="#f3dfbe" />
      <path d="M-10 4C-21 9-19 27-9 31h24c6-8 2-24-9-28Z" fill="#c78b5b" />
      <path d="M-7 9c-5 5-5 16-1 21h14c4-8 1-17-4-21Z" fill="#f2dfb8" />
      <path d="m-19-8-3-20 15 12 13-2 15-12-2 23c8 15-1 26-17 26-18 0-29-12-21-27Z" fill="#cf9365" />
      <path d="m-19-13-1-10 9 8m21-1 9-9-1 12" stroke="#905e48" strokeWidth="2.5" />
      <path d="M-19 0c8-2 14 4 19 9 5-7 11-10 18-10-1 9-9 16-18 16-10 0-17-6-19-15Z" fill="#f9e8c8" />
      <path d="m-3 6 3 3 3-3Z" fill="#5b5948" />
      <path d="m-13-2 4 2m18 0 4-2" stroke="#544d40" strokeWidth="2" strokeLinecap="round" />
      <path d="M0 9v3" stroke="#6c6850" strokeWidth="1.2" />
      <path d="m-6 27-1 5m14-5 1 5" stroke="#99734f" strokeWidth="3" strokeLinecap="round" />
      <path d="M1-20c-1-8 5-14 11-15 1 8-4 15-11 15Z" fill="#7f9a70" />
      <path d="m1-20 7-10" stroke="#57765c" strokeWidth="1.4" />
    </g>
  );
}

export default function RPGArt({ level = 1, equipped, className = "", large = false, onSelect }: RPGArtProps) {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const active = (name: string) => name === "tunic" || (equipped ? equipped.includes(name) : level >= tiers[name]);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 650 470"
      fill="none"
      className={`rpg-art ${large ? "rpg-art-large" : ""} ${className}`}
      style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
      role={onSelect ? "group" : "img"}
      aria-labelledby={id("title")}
    >
      <title id={id("title")}>Your adventurer: a welcoming woodland traveller with equipment that grows with your progress</title>
      <defs>
        <radialGradient id={id("parchment")} cx="50%" cy="48%" r="48%">
          <stop stopColor="#f0e5c8" /><stop offset=".72" stopColor="#f5eedd" stopOpacity=".8" /><stop offset="1" stopColor="#f7f3e9" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("cloak")} x1="254" y1="194" x2="399" y2="382" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3f6555" /><stop offset=".55" stopColor="#52745b" /><stop offset="1" stopColor="#77906c" />
        </linearGradient>
        <linearGradient id={id("tunic")} x1="283" y1="210" x2="356" y2="336" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a5b295" /><stop offset=".65" stopColor="#8fa183" /><stop offset="1" stopColor="#71886c" />
        </linearGradient>
        <linearGradient id={id("skin")} x1="301" y1="146" x2="340" y2="202" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e2b394" /><stop offset="1" stopColor="#c78f70" />
        </linearGradient>
        <linearGradient id={id("leather")} x1="355" y1="263" x2="394" y2="334" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b5835d" /><stop offset="1" stopColor="#8c6349" />
        </linearGradient>
        <linearGradient id={id("blade")} x1="413" y1="236" x2="431" y2="304" gradientUnits="userSpaceOnUse">
          <stop stopColor="#dce0ce" /><stop offset="1" stopColor="#aab7a4" />
        </linearGradient>
        <radialGradient id={id("magic")}>
          <stop stopColor="#d9e7bc" stopOpacity=".8" /><stop offset="1" stopColor="#b6cf9d" stopOpacity="0" />
        </radialGradient>
        <filter id={id("ground-shadow")} x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <style>{`
        .rpg-art .rpg-equipment { outline: none; transform-box: fill-box; transform-origin: center; transition: transform 200ms ease, filter 200ms ease; }
        .rpg-art .rpg-equipment[data-interactive="true"] { cursor: pointer; }
        .rpg-art .rpg-equipment[data-interactive="true"]:hover, .rpg-art .rpg-equipment:focus-visible { transform: translateY(-3px); filter: drop-shadow(0 4px 5px #596a4b22); }
        .rpg-art .rpg-equipment:focus-visible .rpg-slot-outline { stroke: #b9874e; stroke-width: 3; opacity: 1; }
        .rpg-art .rpg-mote { animation: rpg-mote-drift 5s ease-in-out infinite alternate; }
        .rpg-art .rpg-mote-late { animation-delay: -2.7s; }
        .rpg-art .rpg-rune-glow { animation: rpg-rune-pulse 4s ease-in-out infinite alternate; }
        @keyframes rpg-mote-drift { from { transform: translateY(3px); opacity: .5; } to { transform: translateY(-4px); opacity: 1; } }
        @keyframes rpg-rune-pulse { from { opacity: .35; } to { opacity: .75; } }
        @media (prefers-reduced-motion: reduce) { .rpg-art * { animation: none !important; transition: none !important; } }
      `}</style>

      <ellipse cx="328" cy="246" rx="260" ry="218" fill={`url(#${id("parchment")})`} />
      {/* A weathered woodland threshold frames the traveller, with no buildings or game-board tiles. */}
      <path d="M178 350V219a147 147 0 0 1 294 0v131" stroke="#e6dfcb" strokeWidth="25" strokeLinecap="round" />
      <path d="M178 350V219a147 147 0 0 1 294 0v131" stroke="#f3ead4" strokeWidth="17" strokeLinecap="round" />
      <path d="M197 345V219a128 128 0 0 1 256 0v126" stroke="#d9d5be" strokeWidth="1.5" strokeDasharray="3 7" />
      <path d="m169 301 18 1m-18-47 18 2m-16-47 19 3m-9-47 18 9m4-48 16 15m15-45 10 20m30-36 5 21m40-26v23m41-17-5 22m40-4-12 20m44 8-17 15m34 27-20 8m27 35-21 3m21 43h-20m20 44h-20" stroke="#d2cbb4" strokeWidth="2" />
      <g stroke="#adad89" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity=".65" aria-hidden="true">
        <path d="m232 140 4 13 8-9m55-39 4-9 7 9-7 10Zm-91 85 10 8-9 5m220 0-11 4 8 8m-54-91 5-10 5 14m-23-13 3 6m-175 117 9 6-8 8m266-2-10 6 10 6" />
      </g>
      <g opacity=".38" aria-hidden="true">
        <path d="M433 312c40-43 26-97 41-132m-18 71c8-17 24-25 35-30m-29 4c-12-16-15-29-12-41" stroke="#8eaa85" strokeWidth="2" strokeLinecap="round" />
        <path d="M471 193c-10-9-10-20-6-29 12 7 15 21 6 29Zm-9 35c-15-3-24-15-22-26 13 1 25 12 22 26Zm0 26c4-17 18-24 30-23-1 15-14 24-30 23Zm-15 42c2-18 16-29 30-29-1 17-12 27-30 29Z" fill="#96ad87" />
      </g>
      <path d="M162 388c72-27 237-29 327-2" stroke="#d4d5b9" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="326" cy="407" rx="111" ry="17" fill="#586b50" opacity=".13" filter={`url(#${id("ground-shadow")})`} />
      <ellipse cx="326" cy="408" rx="72" ry="8" fill="#7d8c68" opacity=".11" />
      <Fern x={212} y={393} size={.77} />
      <Fern x={439} y={394} flip size={.81} />
      <path d="m166 398 13-8 17 5 3 8-20 2Zm277 12 14-7 14 5-2 7-23 1Z" fill="#c2c8ad" />
      <path d="m166 398 13-8 17 5-16 3Zm277 12 14-7 14 5-14 3Z" fill="#dbe0c8" />
      <g stroke="#9aa884" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="m250 402-4-10m4 8 4-7m137 17-3-9m3 8 5-6m-169 5-2-7m2 5 4-6m181-4 1-9m-1 7 5-5" />
      </g>

      {/* Optional long cloak and sword live behind the starter outfit. */}
      {active("cloak") && <g aria-hidden="true">
        <path d="M293 199c-22 18-28 59-36 103-4 30-13 56-21 71 29-2 42 15 67 13l26-16 25 18c20-3 38-20 65-16-26-34-20-89-31-127-5-22-14-37-29-46Z" fill={`url(#${id("cloak")})`} />
        <path d="M292 216c-15 58-17 111-42 155m112-157c18 57 12 118 44 155" stroke="#c3c89e" strokeWidth="2" opacity=".36" />
        <path d="m251 374 48 8 30-17 26 18 49-12" stroke="#c0b581" strokeWidth="3" strokeLinecap="round" />
        <path d="M281 303c-3 28-2 51-13 70m105-71c6 24 4 43 13 63" stroke="#2e5147" strokeWidth="3" opacity=".3" />
      </g>}
      {active("sword") && <g aria-hidden="true">
        <path d="m371 290 53-67 2 20-39 59Z" fill={`url(#${id("blade")})`} stroke="#8c9c88" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="m380 293 44-65" stroke="#edf0d9" strokeWidth="2" />
        <path d="m371 289 18 12" stroke="#b68e52" strokeWidth="6" strokeLinecap="round" />
        <path d="m380 298-13 17" stroke="#7b6246" strokeWidth="7" strokeLinecap="round" />
        <path d="m377 301-4-2m1 6-4-2m1 6-4-2" stroke="#c7a670" strokeWidth="1.5" />
        <circle cx="367" cy="316" r="5" fill="#b3925b" />
      </g>}

      {/* Boots and leggings keep the base character completely present at level one. */}
      <path d="M287 316c-2 23-2 42-6 67l31 2 12-65Zm44 4 3 62 29-2c-1-24 0-44-6-66Z" fill="#6c7460" />
      <path d="m290 337 17 2-4 38m34-38 17-2 1 38" stroke="#8a9275" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <path d="m281 370 32 2-2 26c-5 7-36 10-43 3-3-9 7-13 11-15Z" fill="#7e5c45" />
      <path d="m279 375 32 2m-1 19c-11 5-27 7-41 2" stroke="#a77e56" strokeWidth="3" />
      <path d="m333 371 31-2 5 17c6 5 13 9 10 16-11 6-34 2-44-4Z" fill="#7e5c45" />
      <path d="m335 376 30-2m-28 22c12 5 26 6 40 4" stroke="#a77e56" strokeWidth="3" />
      <path d="m287 380 17 2m-18 5 17 1m37-7 18-1m-17 7h19" stroke="#4e4d3c" strokeWidth="2" strokeLinecap="round" />

      {/* Jacket, layered linen, hand stitching, and shoulder wrap. */}
      <path d="M292 204c-19 8-26 21-31 43l-11 25 18 11 20-26 7 31-17 41c14 13 32 14 47 7 15 8 31 5 42-4l-16-45 8-32 22 24 16-15-12-31c-8-17-20-27-32-29Z" fill={`url(#${id("tunic")})`} />
      <path d="m321 218-7 67 8 45 11-45-7-67Z" fill="#e3d7b5" />
      <path d="m310 217 11 15 13-15m-20 21 17 6m-18 5 18 6m-19 5 20 6" stroke="#6b7e63" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M286 212c-7 22-10 37-18 49m96-46c1 17 7 30 17 43" stroke="#c7ccaa" strokeWidth="3" strokeLinecap="round" />
      <path d="m259 259 16 9-8 16-18-9Zm114 1 16-12 10 18-17 14Z" fill="#71866a" />
      <path d="M290 211c9 14 24 20 36 20 12 0 24-7 34-20l-11-13-47-1Z" fill="#52715a" />
      <path d="M293 212c8 10 21 15 31 15 12 0 23-5 33-15" stroke="#aebc92" strokeWidth="2" />
      <circle cx="325" cy="229" r="5" fill="#c29e5e" /><circle cx="325" cy="229" r="2" fill="#8da184" />
      <path d="m284 289 70-1 3 14-75 2Z" fill="#8c684b" />
      <rect x="318" y="289" width="16" height="15" rx="3" fill="#c2a16b" />
      <path d="M322 293h8v7h-8Zm4 2v3" stroke="#725d41" strokeWidth="1.5" />
      <path d="m288 298 19-1m35 0 10-1" stroke="#d1b289" strokeWidth="1.5" strokeDasharray="2 3" />
      <path d="m292 311-6 18m15-18-2 24m47-25 8 19" stroke="#5f795f" strokeWidth="2" strokeLinecap="round" opacity=".6" />

      {/* A traveller's satchel, always equipped, makes the starter feel lived in. */}
      <path d="m297 209 70 89" stroke="#654f3c" strokeWidth="12" strokeLinecap="round" />
      <path d="m298 209 69 87" stroke="#bb966a" strokeWidth="8" strokeLinecap="round" />
      <path d="m300 215 62 78" stroke="#e1c299" strokeWidth="1.5" strokeDasharray="3 4" />
      <path d="M355 285c8-7 30-6 39 3l-2 41c-12 9-31 8-40 0Z" fill={`url(#${id("leather")})`} stroke="#7f5b44" strokeWidth="1.5" />
      <path d="M354 286c10-7 28-8 40 1l-1 16c-11 7-27 7-39-1Z" fill="#c2976b" />
      <path d="M355 290c10-5 24-5 36 0m-36 32c10 5 23 6 34 0" stroke="#e3c398" strokeWidth="1.5" strokeDasharray="2 3" />
      <rect x="369" y="299" width="11" height="10" rx="2" fill="#c6a264" stroke="#91734d" strokeWidth="1.2" />
      <path d="M374 301v5" stroke="#7b6042" strokeWidth="1.4" />
      <path d="m390 291 6 3 2 21-8 1Z" fill="#8e7651" />
      <path d="m396 297 6 7-3 8-7 1" stroke="#d4bf92" strokeWidth="3" strokeLinecap="round" />

      {/* Hands and walking staff. The plain walking stick exists before its magical upgrade. */}
      <path d="m251 272-9 14c-4 3-13 3-15-3-1-3 2-6 6-7l6-13Z" fill="#d6a17f" />
      <path d="m245 276-5 8m-6-6-2 6" stroke="#b78164" strokeWidth="1.4" strokeLinecap="round" />
      <path d="m386 273 4 13c0 9-13 10-18 3l-1-9 8-9Z" fill="#d6a17f" />
      <path d="m378 282 3 7m2-8 3 6" stroke="#b78164" strokeWidth="1.4" strokeLinecap="round" />
      <path d="m233 398 5-206 9-30" stroke="#785b41" strokeWidth="7" strokeLinecap="round" />
      <path d="m234 395 5-202 8-29" stroke="#bd9366" strokeWidth="3" strokeLinecap="round" />
      <path d="m235 314 6-4m-5-2 5-4m-5-2 5-4" stroke="#e1c499" strokeWidth="2.5" strokeLinecap="round" />
      {active("staff") && <g aria-hidden="true">
        <circle cx="245" cy="153" r="47" fill={`url(#${id("magic")})`} className="rpg-rune-glow" />
        <path d="M239 187c-9-6-12-17-7-25l12-19c12 7 18 19 12 29-4 6-10 9-17 9" stroke="#947348" strokeWidth="4" strokeLinecap="round" />
        <path d="m245 139 9 16-10 14-9-14Z" fill="#b4c795" stroke="#7f9a76" strokeWidth="1.7" />
        <path d="m245 139-1 30-9-14Z" fill="#d6e0ae" /><path d="m244 145 5 9-5 8" stroke="#f6f7d9" strokeWidth="1.4" />
        <path d="m237 182 12 2m-12 5 10 2m-9-19c-12 0-19-8-17-16 13 0 19 7 17 16Z" fill="#88a17c" stroke="#718a66" strokeWidth="1.5" strokeLinecap="round" />
        <Spark x={224} y={139} size={.6} green /><Spark x={267} y={162} size={.55} />
      </g>}

      {/* Portrait: a kind, gender-neutral face framed by a soft hood and swept hair. */}
      <path d="M289 183c-10-22-6-52 15-66 20-12 44-7 57 12 11 18 13 41 2 59l-16 20-43-1Z" fill="#5a745b" />
      <path d="M294 180c-8-20-4-43 13-55 16-10 36-6 47 8 11 17 9 37 3 52l-12 13-40-3Z" fill="#a9b48d" />
      <path d="M312 189v17c4 9 20 10 27 0v-19Z" fill="#c58d6e" />
      <path d="M311 192c8 7 19 8 28-1v8c-9 8-19 6-28-1Z" fill="#a8755a" opacity=".35" />
      <path d="M297 158c-7-5-12 1-9 10 1 7 6 11 12 8m47-16c7-6 12 0 9 9-1 7-6 11-11 7" fill="#cc9879" />
      <path d="M298 151c0-21 48-29 49 2l-1 25c-2 17-13 24-24 24-12 0-22-9-25-25Z" fill={`url(#${id("skin")})`} />
      <path d="M296 166c-7-11-7-28 2-36 15-15 34-15 47-2 9 6 11 19 4 36l-5-13c-11-1-20-8-24-15-5 9-15 14-23 13Z" fill="#685744" />
      <path d="M301 139c12-11 25-15 39-7m-36 1c6-5 11-8 17-10" stroke="#8d7759" strokeWidth="3" strokeLinecap="round" />
      <path d="m306 162 9-2m17 0 8 3" stroke="#776047" strokeWidth="2" strokeLinecap="round" />
      <path d="M308 169h4m22 0h4" stroke="#534c3b" strokeWidth="3" strokeLinecap="round" />
      <path d="m323 170-3 8 5 1" stroke="#b78363" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M315 186c4 3 9 3 14 0" stroke="#916b53" strokeWidth="1.7" strokeLinecap="round" />
      <ellipse cx="305" cy="178" rx="5" ry="3" fill="#ca886d" opacity=".4" /><ellipse cx="339" cy="179" rx="5" ry="3" fill="#ca886d" opacity=".4" />
      <path d="m300 192 12 16-15 4-10-13m57-7-5 15 15 4 11-16" fill="#718769" />
      <path d="m300 198 8 10m38-9-4 8" stroke="#bdc39a" strokeWidth="1.8" strokeLinecap="round" />
      {active("cloak") && <path d="m302 202 19 13 23-13" stroke="#d4bc7c" strokeWidth="2.5" strokeLinecap="round" />}

      {active("companion") && <Companion x={218} y={379} />}

      {/* A few quiet fireflies and a butterfly make the scene feel alive at every level. */}
      <g className="rpg-mote" aria-hidden="true">
        <Spark x={278} y={93} size={.65} /><Spark x={401} y={171} size={.8} />
        <circle cx="437" cy="213" r="2.5" fill="#cbb275" /><circle cx="194" cy="297" r="2" fill="#b4bf8f" />
        <path d="M418 116c-14-17-20-3-9 5-13-3-14 9-2 9 8-1 9-8 11-14Zm1 0c10-14 18-3 9 4 12-3 14 8 3 9-6 0-10-6-12-13Z" fill="#cdbb8c" opacity=".75" />
        <path d="m418 117-3 14" stroke="#97845d" strokeWidth="1.4" strokeLinecap="round" />
      </g>
      <g className="rpg-mote rpg-mote-late" aria-hidden="true">
        <Spark x={391} y={361} size={.6} green /><Spark x={261} y={226} size={.4} />
        <circle cx="274" cy="189" r="2" fill="#ceb276" /><circle cx="396" cy="110" r="2" fill="#b5bf8b" />
        <circle cx="455" cy="332" r="2" fill="#c7b170" /><circle cx="258" cy="350" r="2" fill="#c7b170" />
      </g>

      <EquipmentSlot name="tunic" label="Traveller’s tunic" x={109} y={252} active={active("tunic")} onSelect={onSelect}>
        <path d="m-6-12-11 8 6 7 4-3-2 16H9L7 0l4 3 6-7-11-8c-2 5-10 5-12 0Z" /><path d="m-8 7 16 0M-4-9c1 3 7 3 8 0" />
      </EquipmentSlot>
      <EquipmentSlot name="staff" label="Woodland staff" x={159} y={120} active={active("staff")} onSelect={onSelect}>
        <path d="m-5 17 8-27m-1-6 6 7-5 7-6-7Zm-2 16-7-7m2 5-5 1m17-7 6-7" /><path d="m-6 8 5 2m-6 2 5 2" />
      </EquipmentSlot>
      <EquipmentSlot name="cloak" label="Wayfarer’s cloak" x={490} y={137} active={active("cloak")} onSelect={onSelect}>
        <path d="M-7-6c-1-16 16-16 14 0l9 21c-10-3-12 4-16-1-4 5-6-2-16 1Z" /><path d="M-7-6c3 5 11 5 14 0M0-7v21m-8-9-5 9m21-9 5 9" />
      </EquipmentSlot>
      <EquipmentSlot name="sword" label="Keeper’s sword" x={536} y={267} active={active("sword")} onSelect={onSelect}>
        <path d="m-8 7 16-23 2 10L-3 12Zm3 2 6 4m-10-8 13 9m-8-1-7 9m2-10 5 4" />
      </EquipmentSlot>
      <EquipmentSlot name="companion" label="Woodland companion" x={492} y={389} active={active("companion")} onSelect={onSelect}>
        <path d="m-13-4-2-12 10 7 9-1 10-7-1 13c4 9-2 16-13 16S-18 5-13-4Z" /><path d="m-10 1 4 2m12-1 4-2M-3 5l3 3 3-3m-3 3v3m1-20c-1-5 3-8 7-10 0 6-2 9-7 10Z" />
      </EquipmentSlot>
    </svg>
  );
}
