"use client";

import { useId, type ReactNode } from "react";

type IslandArtProps = {
  level?: number;
  unlocked?: string[];
  className?: string;
  large?: boolean;
  onSelect?: (id: string) => void;
};

function Tree({ x, y, scale = 1, purple = false }: { x: number; y: number; scale?: number; purple?: boolean }) {
  const light = purple ? "#d4c4e6" : "#b1c99a";
  const mid = purple ? "#b9a1cf" : "#7f9f75";
  const dark = purple ? "#9d85b6" : "#557c61";
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true">
      <ellipse cx="6" cy="3" rx="19" ry="7" fill="#375b43" opacity=".12" />
      <path d="M0 0v-27m0 8L-10-28M0-13l11-11" fill="none" stroke="#8b7154" strokeWidth="4" strokeLinecap="round" />
      <path d="M-25-31c-1-10 7-16 13-17 2-11 15-15 23-10 11-2 18 6 17 16 11 8 8 21-3 25-6 9-20 9-27 3-12 3-23-5-23-17Z" fill={mid} />
      <path d="M-25-31c0-9 6-15 13-17 2-11 15-15 23-10 5 0 10 2 13 6-15-4-20 7-18 14-8-1-15 7-12 15-9 4-16 1-19-8Z" fill={light} />
      <path d="M0-16c13 4 22-3 24-13 6 2 9-1 11-5 1 9-4 15-10 17-6 9-20 9-27 3Z" fill={dark} opacity=".48" />
      <path d="m-11-41 2-3m18-5 3 1m-20 21 3 1m19-11 2-2" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".28" />
    </g>
  );
}

function Pine({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true">
      <ellipse cx="4" cy="2" rx="14" ry="5" fill="#375b43" opacity=".11" />
      <path d="M0 0v-23" stroke="#927450" strokeWidth="4" />
      <path d="m0-65 15 24h-7l13 22H10l14 17C9 4-10 4-24-2l14-17h-11l13-22h-7Z" fill="#4e7c64" />
      <path d="m0-65 2 25 2 24 3 19C-4 3-16 1-24-2l14-17h-11l13-22h-7Z" fill="#72957a" />
      <path d="m0-45 8 7m-9 12 13 7m-14 7 17 8" stroke="#9cb192" strokeWidth="2" strokeLinecap="round" opacity=".5" />
    </g>
  );
}

function Stone({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`} aria-hidden="true">
      <path d="m-13 3-4-10 10-9 16 2 10 12-7 9-17 2Z" fill="#a5b5a5" />
      <path d="m-17-7 10-9 16 2-7 10-15 7Z" fill="#c5cdb8" />
      <path d="m2-4 7-10L19-2l-7 9-2-10Z" fill="#8e9f96" />
    </g>
  );
}

function Lock({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <circle r="14" fill="#fffaf0" stroke="#d8d4c4" strokeWidth="1.5" />
      <path d="M-4-2v-3a4 4 0 0 1 8 0v3" fill="none" stroke="#6f7b69" strokeWidth="1.8" />
      <rect x="-6" y="-2" width="12" height="9" rx="2.5" fill="#7b896f" />
      <path d="M0 1v3" stroke="#fffaf0" strokeWidth="1.7" strokeLinecap="round" />
    </g>
  );
}

function Place({ name, label, atLevel, level, unlocked, onSelect, children }: {
  name: string;
  label: string;
  atLevel: number;
  level: number;
  unlocked?: string[];
  onSelect?: (id: string) => void;
  children: ReactNode;
}) {
  const open = unlocked ? unlocked.includes(name) : level >= atLevel;
  return (
    <g
      className={`qi-place ${open ? "qi-place-open" : "qi-place-locked"}`}
      role={onSelect ? "button" : "img"}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={open ? label : `${label}, unlock at level ${atLevel}`}
      onClick={onSelect ? () => onSelect(name) : undefined}
      onKeyDown={onSelect ? event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(name);
        }
      } : undefined}
      data-interactive={Boolean(onSelect)}
    >
      {children}
    </g>
  );
}

export default function IslandArt({ level = 1, unlocked, className = "", large = false, onSelect }: IslandArtProps) {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const isOpen = (name: string, atLevel: number) => unlocked ? unlocked.includes(name) : level >= atLevel;
  const placeProps = { level, unlocked, onSelect };
  return (
    <svg
      viewBox="0 0 780 470"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`qi-island-art ${large ? "qi-island-large" : ""} ${className}`}
      style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
      role={onSelect ? "group" : "img"}
      aria-labelledby={id("title")}
    >
      <title id={id("title")}>Your Quest Island: a coastal library, training ground, and workshop that grow with your progress</title>
      <defs>
        <linearGradient id={id("water")} x1="395" y1="220" x2="395" y2="440" gradientUnits="userSpaceOnUse">
          <stop stopColor="#bce5da" /><stop offset="1" stopColor="#d5eee4" stopOpacity=".15" />
        </linearGradient>
        <linearGradient id={id("land")} x1="290" y1="170" x2="460" y2="378" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c9d9a6" /><stop offset="1" stopColor="#a7c393" />
        </linearGradient>
        <linearGradient id={id("cliff")} x1="390" y1="260" x2="390" y2="402" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d3c6a3" /><stop offset=".6" stopColor="#b4b39b" /><stop offset="1" stopColor="#9aa995" />
        </linearGradient>
        <linearGradient id={id("roof")} x1="355" y1="136" x2="437" y2="198" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e89e79" /><stop offset="1" stopColor="#c8775c" />
        </linearGradient>
        <linearGradient id={id("pond")} x1="244" y1="282" x2="282" y2="325" gradientUnits="userSpaceOnUse">
          <stop stopColor="#91c9bc" /><stop offset="1" stopColor="#b5e0d0" />
        </linearGradient>
        <filter id={id("shadow")} x="-30%" y="-100%" width="160%" height="300%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <style>{`
        .qi-island-art .qi-place { transform-box: fill-box; transform-origin: center; transition: transform 220ms ease, filter 220ms ease; outline: none; }
        .qi-island-art .qi-place[data-interactive="true"] { cursor: pointer; }
        .qi-island-art .qi-place[data-interactive="true"]:hover, .qi-island-art .qi-place:focus-visible { transform: translateY(-5px); filter: drop-shadow(0 6px 4px #375e4733); }
        .qi-island-art .qi-place:focus-visible .qi-focus-ring { stroke: #cf7e52; stroke-width: 3; stroke-dasharray: 5 4; }
        .qi-island-art .qi-place-locked .qi-building { opacity: .57; filter: saturate(.5); }
        .qi-island-art .qi-cloud { animation: qi-cloud-drift 9s ease-in-out infinite alternate; }
        .qi-island-art .qi-water-spark { animation: qi-water-light 3.8s ease-in-out infinite alternate; }
        .qi-island-art .qi-cloud-late { animation-delay: -5s; }
        @keyframes qi-cloud-drift { from { transform: translateX(-3px); } to { transform: translateX(6px); } }
        @keyframes qi-water-light { from { opacity: .35; } to { opacity: .85; } }
        @media (prefers-reduced-motion: reduce) { .qi-island-art * { animation: none !important; transition: none !important; } }
      `}</style>

      {/* The shoreline remains open around the island so the scene sits naturally in a card. */}
      <ellipse cx="393" cy="355" rx="310" ry="87" fill={`url(#${id("water")})`} />
      <ellipse cx="395" cy="359" rx="247" ry="41" fill="#6d9781" opacity=".14" filter={`url(#${id("shadow")})`} />
      <path d="M121 347c-9-35 42-54 102-58m406 10c51 12 71 36 52 60M173 384c67 33 173 45 265 33m104-10c43-7 83-17 108-33" stroke="#a9d6c9" strokeWidth="2" strokeLinecap="round" opacity=".65" />
      <path d="m114 374 23 3m460 35 31-7M179 407l24 5m444-119 22 7" stroke="#fffdf3" strokeWidth="3" strokeLinecap="round" className="qi-water-spark" />

      <g className="qi-cloud" aria-hidden="true" opacity=".8">
        <path d="M116 128c-11-1-13-14-4-18 0-10 13-14 20-7 7-8 22-3 23 7 12 0 18 13 7 17Z" fill="#fffdf7" />
        <path d="M632 114c-9-2-11-11-4-15 0-9 12-13 18-6 7-7 18-3 19 6 11 0 15 10 8 14Z" fill="#fffdf7" />
      </g>
      <g className="qi-cloud qi-cloud-late" aria-hidden="true" opacity=".7">
        <path d="M522 63c-7 0-10-9-4-12 1-8 10-12 17-6 6-5 15-2 16 5 9 0 12 9 6 12Z" fill="#fffdf7" />
      </g>
      <g stroke="#91aa99" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M209 113q7-6 14 0 7-7 14-1m338 50q5-5 10 0 5-6 10-1m-280-63q5-4 10 0 5-5 10-1" />
      </g>

      {/* Sandstone sides and the thin grassy lip give the land an isometric profile. */}
      <path d="M166 249c-28 6-35 28-18 49l17 31c8 16 36 23 54 29l42 23c22 12 44 7 61 13 30 11 55 14 84 9l41-1c27 2 45-8 63-15l51-14c20-3 46-18 55-30l20-14c24-15 29-43 14-57l-20-25Z" fill={`url(#${id("cliff")})`} />
      <path d="m164 303 18 27 27 9 28 19 27 5 19 17 35 2 17 14m91-15 26 1 27-14 33-5 16-14 24-8 19-21m-354-13 8 31m62 11 6 28m189-19-5 23m67-52-8 25" stroke="#879989" strokeWidth="3" strokeLinecap="round" opacity=".24" />
      <path d="M164 241c6-23 39-37 64-43l38-20c18-11 49-11 73-17 31-11 63-9 88-1l32 4c30-3 60 8 76 20l47 17c20 6 30 23 35 36 24 8 44 23 34 42-7 18-31 24-48 33l-19 22c-17 14-44 12-62 22-26 16-46 18-75 18l-37 5c-32 1-44-9-71-8-32 2-51-6-70-16l-39-13c-21-3-36-11-47-27l-21-14c-23-10-24-31-10-43Z" fill="#e6d6af" />
      <path d="M171 239c8-18 32-29 60-35l41-23c19-9 49-9 69-15 31-9 59-8 85 0l35 3c26-3 56 6 70 19l48 17c19 6 28 20 33 34 21 7 38 21 29 37-7 14-28 20-46 29l-21 22c-16 12-41 13-60 22-23 14-45 17-70 16l-38 6c-26 2-45-8-70-7-27 2-51-5-68-15l-38-12c-21-3-32-11-43-25l-24-15c-17-9-20-25-7-36Z" fill={`url(#${id("land")})`} />
      <path d="M181 277c9-12 18-10 25-24m384 18c5-12 16-15 25-14m-303 89 29 9m119 0 27-7" stroke="#e7e6bd" strokeWidth="3" strokeLinecap="round" opacity=".85" />

      {/* Paths connect the three places rather than dividing the island into tiles. */}
      <path d="M302 345c21-12 41-28 58-39 21-14 26-34 23-59m-22 58c36 3 55 5 82-8 24-12 33-16 66-15m-126-33c32-8 54-21 65-40" stroke="#94ad83" strokeWidth="18" strokeLinecap="round" opacity=".25" />
      <path d="M302 340c21-12 41-28 58-39 21-14 26-34 23-59m-22 58c36 3 55 5 82-8 24-12 33-16 66-15m-126-33c32-8 54-21 65-40" stroke="#eadbb8" strokeWidth="13" strokeLinecap="round" />
      <path d="m307 336 6-4m17-12 5-4m32-26 4-6m14-24v-6m12 44 7-1m17-4 7-3m19-6 6-3" stroke="#d0bc99" strokeWidth="2" strokeLinecap="round" opacity=".6" />

      <Pine x={267} y={225} scale={.85} />
      <Pine x={290} y={204} scale={.7} />
      <Tree x={515} y={219} scale={.82} purple />
      <Tree x={549} y={229} scale={.66} purple />
      <Pine x={580} y={256} scale={.82} />
      <Pine x={604} y={266} scale={.59} />
      <Tree x={209} y={260} scale={.84} />

      <Place {...placeProps} name="library" label="The island library" atLevel={1}>
        <ellipse className="qi-focus-ring" cx="386" cy="257" rx="76" ry="26" fill="#607b56" fillOpacity=".13" stroke="transparent" />
        <g className="qi-building">
          <path d="m322 225 64-28 63 30-62 32Z" fill="#d2c5a4" />
          <path d="m329 191 57 27v47l-57-28Z" fill="#f7e9ca" />
          <path d="m386 218 55-27v47l-55 27Z" fill="#e2cfab" />
          <path d="m321 192 65-57 64 56-64 32Z" fill={`url(#${id("roof")})`} />
          <path d="m386 135 64 56-64 32Z" fill="#bd6f55" />
          <path d="m319 193 67 33 66-33" stroke="#9c624d" strokeWidth="4" strokeLinejoin="round" />
          <path d="m334 180 49 25m-36-37 48 26m-35-39 47 28m-35-40 47 29m-33-37v88" stroke="#f7c4a0" strokeWidth="2" opacity=".45" />
          <path d="m415 139 10 5v26l-10-5Z" fill="#c7b494" />
          <path d="m425 144 8-4v26l-8 4Z" fill="#a9947d" />
          <path d="m413 139 10-5 12 5-10 6Z" fill="#e2d6b9" />
          <path d="m340 212 12 6v16l-12-6Z" fill="#789786" stroke="#d1b999" strokeWidth="2" />
          <path d="m345 214v17m-5-10 12 6" stroke="#f7e6c4" strokeWidth="1.5" />
          <path d="m364 223 12 6v17l-12-6Z" fill="#789786" stroke="#d1b999" strokeWidth="2" />
          <path d="m369 225v17m-5-10 12 6" stroke="#f7e6c4" strokeWidth="1.5" />
          <path d="m401 231 15-7v27l-15 8Z" fill="#647e68" />
          <path d="m403 233 11-5v8l-11 6Z" fill="#b9c9a4" />
          <path d="m428 216 9-5v15l-9 5Z" fill="#739282" stroke="#bdab8e" strokeWidth="1.5" />
          <path d="m399 257 18-8 7 4-18 9Zm0 5 25-9v5l-25 10-5-3Z" fill="#c7b69a" />
          <path d="m335 236 40 20m53-22 9-5" stroke="#d8c29f" strokeWidth="2" />
          <path d="m367 164 19 10 18-10-18-10Z" fill="#f3d4ae" stroke="#a7644f" strokeWidth="2" />
          <path d="m377 162 9 5 9-5m-9-5v10" stroke="#a7644f" strokeWidth="1.5" />
          <path d="M409 128q8-8 4-17m9 13q7-8 4-15" stroke="#fffaf1" strokeWidth="4" strokeLinecap="round" opacity=".65" />
        </g>
        {!isOpen("library", 1) && <Lock x={383} y={214} />}
      </Place>

      {/* A little pond and bridge soften the front edge. */}
      <path d="M230 288c15-12 36-14 57-4 10 5 13 19 3 28-11 11-39 13-58 5-15-6-16-19-2-29Z" fill="#91b58f" />
      <path d="M232 290c14-10 35-11 53-3 10 5 10 16 1 23-14 9-36 10-53 4-12-5-14-15-1-24Z" fill={`url(#${id("pond")})`} />
      <path d="m235 300 18-2m16 9 13-3m-38 5 6 1" stroke="#e3eee0" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="239" cy="293" rx="6" ry="2.5" fill="#739a7c" />
      <path d="m288 288 29 10-13 10-30-11Z" fill="#b89570" />
      <path d="m280 295 28 10m-20-14 28 10m-35-12-2 12m36-1-2 12" stroke="#916f54" strokeWidth="2.5" />

      <Place {...placeProps} name="training" label="The training ground" atLevel={2}>
        <ellipse className="qi-focus-ring" cx="466" cy="229" rx="57" ry="19" fill="#607b56" fillOpacity=".12" stroke="transparent" />
        <g className="qi-building">
          <path d="m417 210 51-24 53 25-51 27Z" fill="#d6bc8d" />
          <path d="m423 209 45-21 47 23-45 23Z" fill="#c17c61" />
          <path d="m433 209 35-16 36 18-34 17Z" fill="#a6b98a" />
          <path d="m428 210 40-19 41 20-39 20Z" stroke="#f1d6b3" strokeWidth="1.5" />
          <path d="m444 205 24-11 25 12-24 12Z" stroke="#dfdfb5" strokeWidth="1" />
          <path d="m468 196 1 21m-10-17 18 9m-17-8 1 11m16-12 1 11" stroke="#e9e4bf" strokeWidth="1" />
          <path d="m430 188 10-4 10 5-10 5Z" fill="#f6e6c6" />
          <path d="m430 188 1 16m9-10v15m10-20v16" stroke="#ad9675" strokeWidth="2" />
          <path d="m439 183v-20l17 5-17 7" fill="#e9a678" stroke="#8b9071" strokeWidth="2" strokeLinejoin="round" />
          <path d="m493 224 11-5 8 4-11 6Zm0 4 19-5v4l-19 6Z" fill="#b99d79" />
          <circle cx="485" cy="215" r="3" fill="#f8eccc" />
          <path d="m483 215 2 1 2-2" stroke="#7b8167" strokeWidth="1" />
        </g>
        {!isOpen("training", 2) && <Lock x={470} y={211} />}
      </Place>

      <Place {...placeProps} name="workshop" label="The creative workshop" atLevel={3}>
        <ellipse className="qi-focus-ring" cx="509" cy="307" rx="63" ry="21" fill="#607b56" fillOpacity=".14" stroke="transparent" />
        <g className="qi-building">
          <path d="m461 265 47 22v40l-47-23Z" fill="#dfa181" />
          <path d="m508 287 43-22v40l-43 22Z" fill="#bc8268" />
          <path d="m452 266 47-39 60 37-51 27Z" fill="#738e78" />
          <path d="m499 227 60 37-51 27Z" fill="#4e7262" />
          <path d="m451 266 57 27 52-27" stroke="#3e5b50" strokeWidth="3" strokeLinejoin="round" />
          <path d="m469 254 35 18m-24-28 36 19m-24-29 36 20" stroke="#a2b294" strokeWidth="2" opacity=".55" />
          <path d="m474 283 15 7v14l-15-7Z" fill="#eed6a3" stroke="#af785f" strokeWidth="2" />
          <path d="m481 287 1 13m-8-10 15 7" stroke="#9f745b" strokeWidth="1.3" />
          <path d="m521 289 19-9v31l-19 10Z" fill="#6e5f50" />
          <path d="m524 291 5-3v25l-5 3m8-30 5-3v25l-5 3" fill="#938068" />
          <path d="m463 293 10 5m21 5 11 5m-37-24 9 4m14 7 11 5m-37 0 10 5m14 6 10 4" stroke="#b6765f" strokeWidth="1.5" opacity=".65" />
          <path d="m539 240 8 4v-25l-8-4Z" fill="#a87962" />
          <path d="m547 244 7-4v-25l-7 4Z" fill="#795c4d" />
          <path d="m537 215 9-5 10 5-9 5Z" fill="#cba98b" />
          <path d="m477 309-6 8 16 8 7-9Z" fill="#c7b496" />
          <path d="m477 309 17 7v7l-17-8Z" fill="#e2c6a0" />
        </g>
        {!isOpen("workshop", 3) && <Lock x={504} y={279} />}
      </Place>

      <Tree x={569} y={314} scale={.86} purple />
      <Tree x={594} y={304} scale={.56} purple />
      <Pine x={227} y={288} scale={.7} />
      <Tree x={324} y={320} scale={.62} purple />
      <Tree x={358} y={353} scale={.67} />

      <Place {...placeProps} name="garden" label="The island garden" atLevel={4}>
        <ellipse className="qi-focus-ring" cx="407" cy="334" rx="29" ry="13" fill="transparent" stroke="transparent" />
        <g className="qi-building">
          <path d="m382 328 22-10 30 13-22 12Z" fill="#947c5d" />
          <path d="m387 328 17-7 24 10-17 8Z" fill="#b69a73" />
          <path d="m389 325 23 11m-15-14 23 10" stroke="#e1ca9e" strokeWidth="2" />
          {[0, 1, 2].map(n => <g key={n} transform={`translate(${396 + n * 8} ${327 + n * 4})`}><path d="M0 0v-7" stroke="#66845b" strokeWidth="1.5" /><path d="M0-3c-8-7-5-12 0-6 5-8 9-4 0 6Z" fill={n === 1 ? "#a6b77e" : "#7f9b69"} /></g>)}
        </g>
        {!isOpen("garden", 4) && <Lock x={408} y={329} />}
      </Place>

      <Stone x={182} y={295} size={.7} />
      <Stone x={259} y={348} size={.85} />
      <Stone x={281} y={355} size={.45} />
      <Stone x={602} y={330} size={.7} />
      <Stone x={444} y={370} size={.5} />
      <g fill="#d3dcae" aria-hidden="true">
        <ellipse cx="195" cy="278" rx="9" ry="4" /><ellipse cx="306" cy="219" rx="7" ry="3" />
        <ellipse cx="534" cy="335" rx="10" ry="4" /><ellipse cx="380" cy="359" rx="7" ry="3" />
      </g>
      <g stroke="#89a178" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="m245 237-2-5m3 4 3-5m92 111-3-5m5 4 2-5m147 32-2-5m4 4 3-5m81-85-1-5m3 5 2-3" />
      </g>
      <g fill="#f8e4aa" aria-hidden="true">
        <circle cx="298" cy="263" r="2" /><circle cx="304" cy="260" r="2" /><circle cx="308" cy="266" r="2" />
        <circle cx="551" cy="322" r="2" /><circle cx="555" cy="325" r="2" /><circle cx="550" cy="328" r="2" />
        <circle cx="365" cy="337" r="2" /><circle cx="370" cy="335" r="2" />
      </g>

      {/* A dock and tiny boat reward exploration without crowding the main buildings. */}
      <path d="m300 357-23 20 30 12 24-20Z" fill="#bc9672" />
      <path d="m283 375 27 11m-18-19 27 11m-18-19 27 11" stroke="#8b725a" strokeWidth="2" />
      <path d="M281 371v15m44-22v14m-17 6v13" stroke="#9e8062" strokeWidth="4" strokeLinecap="round" />
      <Place {...placeProps} name="boat" label="The little explorer boat" atLevel={5}>
        <ellipse className="qi-focus-ring" cx="263" cy="400" rx="32" ry="13" fill="transparent" stroke="transparent" />
        <g className="qi-building">
          <path d="M233 396c17-8 39-8 58 1-11 12-42 16-58-1Z" fill="#b8795f" />
          <path d="M233 396c17-8 39-8 58 1-21 8-42 7-58-1Z" fill="#e1bb8e" />
          <path d="m244 394 31 6m-20-8 28 5" stroke="#a57c5e" strokeWidth="2" />
          <path d="M263 397v-43l-22 33 22 7" fill="#fff4d9" />
          <path d="m266 358 17 31-17 5Z" fill="#e3c5a0" />
          <path d="M263 396v-44" stroke="#8a7861" strokeWidth="2" strokeLinecap="round" />
        </g>
        {!isOpen("boat", 5) && <Lock x={262} y={386} />}
      </Place>
      <path d="m239 418 30 1m-43-5 10 1m45-8 17-3" stroke="#acd4c5" strokeWidth="2" strokeLinecap="round" className="qi-water-spark" />
    </svg>
  );
}
