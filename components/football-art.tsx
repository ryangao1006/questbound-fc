"use client";

import { useId, type ReactNode } from "react";

type FootballArtProps = {
  position?: string;
  playerNumber?: number;
  level?: number;
  equipped?: string[];
  className?: string;
  large?: boolean;
  onSelect?: (id: string) => void;
};

function Selectable({ id, label, onSelect, children }: { id: string; label: string; onSelect?: (id: string) => void; children: ReactNode }) {
  return (
    <g
      className="football-selectable"
      role={onSelect ? "button" : undefined}
      aria-label={onSelect ? label : undefined}
      tabIndex={onSelect ? 0 : undefined}
      data-interactive={Boolean(onSelect)}
      onClick={onSelect ? () => onSelect(id) : undefined}
      onKeyDown={onSelect ? event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(id);
        }
      } : undefined}
    >{children}</g>
  );
}

export default function FootballArt({ position = "CM", playerNumber = 8, level = 1, equipped = [], className = "", large = false, onSelect }: FootballArtProps) {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${uid}-${name}`;
  const positions: Record<string, string> = { STRIKER: "ST", FORWARD: "ST", MIDFIELDER: "CM", MIDFIELD: "CM", DEFENDER: "CB", DEFENCE: "CB", DEFENSE: "CB", GOALKEEPER: "GK", KEEPER: "GK", WINGER: "LW" };
  const abbreviation = positions[position.toUpperCase()] || position.toUpperCase().slice(0, 3);
  const goalkeeper = abbreviation === "GK";
  const elite = equipped.includes("armband");
  const away = equipped.includes("kit");
  const golden = equipped.includes("goldboots");
  const boots = equipped.includes("boots");
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 650 470"
      fill="none"
      className={`football-art ${large ? "football-art-large" : ""} ${className}`}
      style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
      role={onSelect ? "group" : "img"}
      aria-labelledby={id("title")}
    >
      <title id={id("title")}>{`Your football career: a fictional ${abbreviation} player ready for the next training session`}</title>
      <defs>
        <radialGradient id={id("glow")} cx="50%" cy="48%" r="50%"><stop stopColor="#ece4cf" /><stop offset=".73" stopColor="#f3ecdd" stopOpacity=".75" /><stop offset="1" stopColor="#f8f3e9" stopOpacity="0" /></radialGradient>
        <linearGradient id={id("shirt")} x1="282" y1="169" x2="362" y2="261" gradientUnits="userSpaceOnUse"><stop stopColor={away ? "#a5684d" : "#52705b"} /><stop offset="1" stopColor={away ? "#7c4633" : "#2c4e40"} /></linearGradient>
        <linearGradient id={id("shorts")} x1="291" y1="249" x2="354" y2="305" gradientUnits="userSpaceOnUse"><stop stopColor="#f1e8d1" /><stop offset="1" stopColor="#d1c9ad" /></linearGradient>
        <linearGradient id={id("skin")} x1="304" y1="123" x2="344" y2="166" gradientUnits="userSpaceOnUse"><stop stopColor="#d6a486" /><stop offset="1" stopColor="#b77d60" /></linearGradient>
        <linearGradient id={id("boot")} x1="276" y1="376" x2="322" y2="401" gradientUnits="userSpaceOnUse"><stop stopColor={golden ? "#efd077" : boots ? "#81a1b4" : "#d1aa6b"} /><stop offset="1" stopColor={golden ? "#ba8d25" : boots ? "#3d6078" : "#a97147"} /></linearGradient>
        <linearGradient id={id("turf")} x1="325" y1="319" x2="325" y2="435" gradientUnits="userSpaceOnUse"><stop stopColor="#bec6a4" stopOpacity=".45" /><stop offset="1" stopColor="#dbe0c4" stopOpacity=".06" /></linearGradient>
        <filter id={id("blur")} x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="6" /></filter>
        <clipPath id={id("ball-clip")}><circle cx="274" cy="399" r="24" /></clipPath>
      </defs>
      <style>{`
        .football-art .football-selectable { outline: none; transform-box: fill-box; transform-origin: center; transition: filter 180ms ease, transform 180ms ease; }
        .football-art .football-selectable[data-interactive="true"] { cursor: pointer; }
        .football-art .football-selectable[data-interactive="true"]:hover, .football-art .football-selectable:focus-visible { filter: drop-shadow(0 3px 4px #294b3b33); }
        .football-art .football-selectable:focus-visible .football-focus { stroke: #b98b4e; stroke-width: 3; stroke-dasharray: 4 4; }
        .football-art .football-glint { animation: football-glint 5s ease-in-out infinite alternate; }
        @keyframes football-glint { from { opacity: .35; } to { opacity: .8; } }
        @media (prefers-reduced-motion: reduce) { .football-art * { animation: none !important; transition: none !important; } }
      `}</style>

      <ellipse cx="327" cy="242" rx="253" ry="217" fill={`url(#${id("glow")})`} />
      {/* Abstract stadium seating and a rounded portal suggest a career collectible card. */}
      <path d="M151 343V210a175 175 0 0 1 350 0v133" stroke="#e6dfcd" strokeWidth="2" />
      <path d="M164 344V211a162 162 0 0 1 324 0v133" stroke="#e7e0ce" strokeWidth="11" strokeDasharray="2 7" opacity=".65" />
      <path d="m155 262 54 12 49-9 64 8 61-9 52 8 59-14v61H155Z" fill="#dce0ca" opacity=".4" />
      <path d="m155 279 54 9 49-6 64 5 61-6 52 6 59-12m-339 23 54 6 49-4 64 3 61-4 52 3 59-9m-339 23 54 3 49-2 64 2 61-2 52 2 59-5" stroke="#b8c2a8" strokeWidth="2" opacity=".5" />
      <g fill="#b8c3a6" opacity=".6" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map(n => <g key={n} transform={`translate(${179 + n * 20} ${269 + n * 2})`}><circle r="2" /><circle cx="3" cy="16" r="2" /></g>)}
        {[0, 1, 2, 3, 4, 5].map(n => <g key={n} transform={`translate(${384 + n * 18} ${269 - n})`}><circle r="2" /><circle cx="2" cy="15" r="2" /></g>)}
      </g>

      {/* Fine floodlight posts keep the stadium graphic airy and restrained. */}
      <g stroke="#b9c0a9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M187 252V153l-7-18m12 20 14-10M463 253V151l7-19m-12 21-14-10" />
        <path d="m166 133 27-6 4 12-27 6Zm278-7 28 5-3 12-28-5Z" fill="#ece6d4" />
        <path d="m174 133 2 9m7-11 2 9m7-10 2 8m257-9-2 10m11-8-2 10m11-8-2 9" />
      </g>
      <path d="m179 147-25 65m36-66 8 61m258-61-5 62m17-61 25 65" stroke="#e0d4af" strokeWidth="8" opacity=".11" />
      <path d="M136 353c82-28 295-28 377 0l55 79H82Z" fill={`url(#${id("turf")})`} />
      <path d="M137 353c82-28 294-28 375 0m-343 35c82-28 232-28 311 0M325 335v100" stroke="#b4bea1" strokeWidth="1.5" opacity=".56" />
      <ellipse cx="325" cy="383" rx="96" ry="25" stroke="#f6f3df" strokeWidth="2" opacity=".8" />
      <ellipse cx="325" cy="383" rx="4" ry="1.5" fill="#9fac8d" />
      <path d="m116 414 23-27 79-6m316 33-23-27-79-6" stroke="#e8e8d0" strokeWidth="1.6" opacity=".8" />
      <ellipse cx="322" cy="412" rx="84" ry="12" fill="#4f6850" opacity=".15" filter={`url(#${id("blur")})`} />

      {/* Arms show the short-sleeve training kit; the player stays fully rendered at level one. */}
      <path d="M289 182c-11 6-20 18-25 35l-10 33c-3 9 0 19 8 20 6 0 9-5 11-11l11-28 14-24Z" fill="#cc9778" />
      <path d="m268 224-8 30c-1 5 0 8 3 10" stroke="#b67e60" strokeWidth="2" strokeLinecap="round" />
      <path d="M356 180c12 7 20 19 23 33l9 37c3 10-1 18-8 18-6 0-10-7-11-13l-9-26-15-24Z" fill="#cc9778" />
      <path d="m375 226 7 26c2 6 0 10-3 11" stroke="#b67e60" strokeWidth="2" strokeLinecap="round" />

      <Selectable id="kit" label="Your football kit" onSelect={onSelect}>
        <path className="football-focus" d="M297 170c-15 4-26 11-33 27l-6 16 25 11 8-16-4 42c22 10 49 10 71 0l-5-43 10 15 24-12-8-18c-7-12-18-19-30-22Z" fill={`url(#${id("shirt")})`} stroke="transparent" />
        <path d="m297 170-19 30 9 6 20-30m40-6 19 28-9 9-20-31" fill="#e8e3cb" />
        <path d="m261 207 24 11-3 7-25-11Zm100 8 24-12 3 8-24 12Z" fill="#e5debf" />
        <path d="M306 170c2 15 29 15 33 0l-9-4h-15Z" fill="#c59170" />
        <path d="M305 170c3 8 9 12 17 12 9 0 15-4 18-12" stroke="#e8e2c8" strokeWidth="4" />
        <path d="m295 191 26 12 27-12m-54 9 27 12 28-12" stroke="#90a18a" strokeWidth="1.4" opacity=".55" />
        <path d="M297 216v26m8-29v30m35-30v30m8-26v25" stroke="#567860" strokeWidth="1.5" opacity=".5" />
        <path d="M290 246c20 8 44 8 64 0" stroke="#d9ceaa" strokeWidth="3" />
        <text x="321" y="234" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="23" fontWeight="800" fill="#efe6c9" letterSpacing="-1">{String(playerNumber).padStart(2,"0")}</text>
        <path d="m293 211 2 5m54-5-2 5" stroke="#d8c28f" strokeWidth="2" strokeLinecap="round" />
        {elite && <path d="m365 198 15-7 4 9-15 7Z" fill="#d2b378" />}
        {elite && <path d="m373 196 3 5m-5-4 1 4m6-7 1 4" stroke="#8f754a" strokeWidth="1" />}
      </Selectable>

      {/* Cream shorts and athletic, grounded proportions. */}
      <path d="M288 249c22 8 45 8 69 0l7 48-33 7-9-30-10 30-34-8Z" fill={`url(#${id("shorts")})`} />
      <path d="M289 252c22 7 44 7 66 0" stroke="#3b5948" strokeWidth="4" />
      <path d="m287 258-6 33m73-32 6 33" stroke="#849778" strokeWidth="3" />
      <path d="m283 292 27 6m24 0 25-6" stroke="#b9b89b" strokeWidth="2" />
      <text x="295" y="286" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" fill="#4e6851">{String(playerNumber).padStart(2,"0")}</text>
      <path d="m284 298 25 5-7 45-12 25-21-7 11-26Zm49 4 27-6 2 45-4 34-23 1-1-34Z" fill="#c89574" />
      <path d="m287 309-3 29-7 22m69-52 3 29-3 25" stroke="#b27b5d" strokeWidth="2" strokeLinecap="round" opacity=".55" />
      <path d="m276 350 27 8-14 30-25-7Zm59 4 26-1-1 36-25 1Z" fill="#385a47" />
      <path d="m276 351 27 8-3 7-27-8Zm59 3 26-1v8l-26 1Z" fill="#e5dfc1" />
      <path d="m274 358 25 8-2 4-25-8Zm61 6 26-1v4l-26 1Z" fill="#bda36c" />
      <path d="m276 368-4 9m9-7-4 10m65-7v10m7-10v9" stroke="#648064" strokeWidth="1.3" />

      <Selectable id="boots" label="Your football boots" onSelect={onSelect}>
        <path className="football-focus" d="m265 378 24 7-2 11c-10 4-31 4-43-1-6-3-4-9 2-10l15-2Z" fill={`url(#${id("boot")})`} stroke="transparent" />
        <path d="m245 394 39 2m-15-14 11 9m-13-7 13 3" stroke="#8f633f" strokeWidth="2" strokeLinecap="round" />
        <path d="m251 397-1 4m13-3v4m13-4 1 4" stroke="#6a6445" strokeWidth="3" strokeLinecap="round" />
        <path className="football-focus" d="m335 385 25-1 7 9 14 7c5 3 3 8-3 10-16 2-33-2-45-8Z" fill={`url(#${id("boot")})`} stroke="transparent" />
        <path d="M335 401c14 6 29 8 45 7m-42-20 16 5m-15-1 17 5" stroke="#8f633f" strokeWidth="2" strokeLinecap="round" />
        <path d="m340 405-1 5m13-2v5m16-3 1 4" stroke="#6a6445" strokeWidth="3" strokeLinecap="round" />
        <path d="m251 390 11 2m91 9 15 3" stroke="#e5cb92" strokeWidth="2" strokeLinecap="round" />
      </Selectable>

      {/* Adult, gender-neutral fictional portrait; no likeness to a real player. */}
      <path d="M312 151v20c3 9 20 10 27 0v-20Z" fill="#bb8062" />
      <path d="M312 155c8 7 18 7 27 0v8c-9 6-18 6-27 0Z" fill="#98664f" opacity=".28" />
      <path d="M298 123c-6-3-9 3-6 11 1 6 5 9 10 8m46-18c6-4 10 1 7 10-1 6-5 9-10 8" fill="#bd8769" />
      <path d="M301 115c1-26 46-25 46 0l-1 28c-3 15-11 23-22 23-12 0-21-10-24-25Z" fill={`url(#${id("skin")})`} />
      <path d="M299 136c-7-12-7-31 3-41 13-14 36-12 46 1 8 9 8 27 0 40l-3-20c-13 1-24-2-32-10-2 6-8 11-13 11Z" fill="#4d4d3c" />
      <path d="M306 102c10-10 25-12 36-4m-31-1c6-5 12-6 18-6" stroke="#6d6951" strokeWidth="3" strokeLinecap="round" />
      <path d="m306 125 9-2m16 0 9 2" stroke="#6d5844" strokeWidth="2" strokeLinecap="round" />
      <path d="M309 131h3m22 0h3" stroke="#48483a" strokeWidth="2.8" strokeLinecap="round" />
      <path d="m323 132-3 9 5 1" stroke="#a97155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M316 150c4 2 8 2 12 0" stroke="#885f49" strokeWidth="1.6" strokeLinecap="round" />
      <path d="m305 140 4 1m27 0 4-1" stroke="#d69978" strokeWidth="3" strokeLinecap="round" opacity=".6" />

      {goalkeeper && <g aria-hidden="true">
        <path d="m247 249 15 2 8 15-5 12-13-2-7-12Z" fill="#e4dcc3" stroke="#a29f83" strokeWidth="1.4" />
        <path d="m249 254 14 3m-13 2 15 4m-13 1 12 4m-11-15-2 15m7-13-2 16" stroke="#80927d" strokeWidth="1.5" />
        <path d="m373 249 14-2 7 14-3 13-12 4-9-11Z" fill="#e4dcc3" stroke="#a29f83" strokeWidth="1.4" />
        <path d="m376 254 13-2m-13 7 15-2m-13 7 13-2m-12-10 3 17m3-18 3 17" stroke="#80927d" strokeWidth="1.5" />
        <path d="m248 247 14 2m109-1 15-3" stroke="#3d5d47" strokeWidth="5" strokeLinecap="round" />
      </g>}

      <Selectable id="training" label="Your training progress" onSelect={onSelect}>
        <ellipse cx="275" cy="423" rx="28" ry="5" fill="#546b50" opacity=".14" />
        <circle className="football-focus" cx="274" cy="399" r="24" fill="#f4edda" stroke="#d0ccb5" strokeWidth="1.5" />
        <g clipPath={`url(#${id("ball-clip")})`} stroke="#b5b8a1" strokeWidth="1.1">
          <path d="m273 386 11 8-4 13-13 0-5-13Z" fill="#4f6652" stroke="#4f6652" />
          <path d="m273 386-1-12m12 20 13-4m-17 17 7 14m-20-14-10 13m5-26-12-4" />
          <path d="m263 375 8 6 9-5m18 13-8 5 3 10m-4 17-9-5-7 8m-19-5 9-5-4-10m-10-15 10 3 3-9" fill="#526b55" stroke="#526b55" />
          <path d="M258 386c-8 15 2 32 18 34 13 0 23-9 25-19" stroke="#d6d0b7" strokeWidth="4" opacity=".55" />
        </g>
        <path d="M263 381c-4 2-7 5-9 10" stroke="#fff9e8" strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
      </Selectable>

      {/* Position marker is a discreet, selectable career detail rather than a club crest. */}
      <Selectable id="position" label={`Your ${abbreviation} position`} onSelect={onSelect}>
        <rect className="football-focus" x="428" y="193" width="51" height="57" rx="15" fill="#f2e8d0" stroke="#c9b584" strokeWidth="1.3" />
        <path d="M437 208h33m-33 27h33" stroke="#d4c6a0" strokeWidth="1" />
        <text x="453.5" y="228" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="18" fontWeight="800" letterSpacing="1" fill="#47634d">{abbreviation}</text>
        <circle cx="453.5" cy="244" r="2" fill="#c6a56a" />
      </Selectable>
      <g className="football-glint" fill="#c7ac73" aria-hidden="true">
        <path d="m250 132 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm153 12 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z" />
        <circle cx="226" cy="213" r="2" /><circle cx="405" cy="318" r="2.5" />
      </g>
      {equipped.includes("banner") && <g aria-hidden="true"><path d="M210 34h230v29H210Z" fill="#3c5a48"/><text x="325" y="54" textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="13" fill="#f1e8d1" letterSpacing="3">CLUB LEGEND</text></g>}
      {equipped.includes("celebration") && <g aria-hidden="true" fill="#c97954">{Array.from({length:10},(_,n)=><rect key={n} x={180+n*31} y={90+(n%3)*23} width="5" height="12" rx="2" transform={`rotate(${n*17} ${180+n*31} ${90+(n%3)*23})`}/>)}</g>}
      {level >= 2 && <g fill="#c6a568" aria-hidden="true">
        {Array.from({ length: Math.min(level - 1, 5) }, (_, n) => <path key={n} transform={`translate(${296 + n * 15} 74) scale(.7)`} d="m0-6 2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z" />)}
      </g>}
    </svg>
  );
}
