import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./game.css";
import "./journal.css";
import "./retro-career.css";
import "./matchday-polish.css";
import "./task-workspace.css";
import "./football-career.css";
import "./task-follow-up.css";
import "./smart-board.css";
import "./task-readability.css";
import "./pro-career.css";
import "./stadium-ui.css";
import "./career-comic.css";
import "./readable-surfaces.css";
import "./dorm-interactions.css";
import "./fc-themes.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b1523",
};

export const metadata: Metadata = {
  title: "Questbound FC — your football career planner",
  description: "Your football career, built through everyday quests, focus, wellbeing and lasting progress.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {capable:true,statusBarStyle:"default",title:"Questbound FC"},
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><meta name="darkreader-lock"/><script dangerouslySetInnerHTML={{__html:`try{const p=JSON.parse(localStorage.getItem('qfc-display')||'null');if(p&&['night-stadium','classic-career','training-day'].includes(p.theme)){document.documentElement.dataset.theme=p.theme==='training-day'?'classic-career':p.theme;document.documentElement.lang=p.language==='zh'?'zh-CN':'en';document.documentElement.dataset.motion=p.reduceMotion?'reduce':'system'}}catch{}`}}/></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
