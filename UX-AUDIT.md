# UX audit — club game (local app + static demo)

Scope: the hosted planner shell, `/club` (four tabs), `/club/base` (3D base + room previews), the static demo on GitHub Pages, at 1440×900 and 390×844. Findings are based on browser runs in this workspace, not on user interviews.

## What already works well

- Four-tab club layout with a compact overview (spider chart, funds ring, formation pitch, action cards) — 1,031 px page height, four tabs, 774 ms local load.
- Every long list is windowed or lazily loaded: roster (2,062 players) loads only when the Club tab opens; 3D watch/base are separate lazy chunks (demo index 650 KB, 3D chunks ~36 KB/18 KB).
- Feedback loops exist: toasts/aria-live on training, tactics, facilities, transfers; optimistic disabled states with reasons; the watch auto-plays and reports teleports/speed; injury and fitness bars are visible on cards and detail.
- Navigation continuity: planner hub strip shows club level, funds, line ratings and trophies and links to `/club`; `?tab=` and `#anchor` deep links work in both app and demo.
- Accessibility basics: real focusable tabs with arrow keys, dialogs with focus trap/Esc/restore (`role=dialog aria-modal`), reduced-motion honoured in the watch/base, form controls labelled.

## Issues found and fixed in this pass (all six landed)

| # | Problem | Evidence | Fix |
|---|---|---|---|
| 1 | **Demo had no earning loop.** The Pages demo only exposes the club, but started at 150 FC with no way to earn; training (20 FC each) quickly dead-ends and signings/facilities/tactics were unreachable. | Demo first run: `150 FC`, banner made no mention of demo money; cheapest signing 300 FC. | Demo seed now starts with **5,150 FC** (5,000 demo-only funds) and the banner says “5,000 demo funds to try every system”. |
| 2 | **Dead planner links in the static demo.** “返回计划 / Back to planner” pointed at `/`, which does not exist on GitHub Pages; “基地总览” jumped to a route that the demo only serves via `#base`. | Demo DOM: `a[href="/"]` labelled “Back to planner”; clicking it leaves the demo. | Demo-aware top bar: demo links are now “Demo home → `#top`” and “Base overview → `#base`”; no `/` or `/club/base` links remain. |
| 3 | **Server errors leaked in English** while the UI language could be zh (e.g. “Not enough club funds. Your balance is unchanged.”, “Five substitutions are the limit per match.”). | Raw error strings rendered in flashes. | Bilingual error map for the common command errors (funds, formation, substitutions, injuries, decorations, training caps); verified in the zh UI with mocked 400s. |
| 4 | **Small mobile tap targets.** Audit counted **9 interactive elements under 40 px** at 390 px (mostly compact icon/text buttons). | 390 px run: `9` buttons/links with height < 36 px. | Raised to ≥40 px; a fresh audit across all four tabs finds **0** controls below 40 px at 390 px with no overflow. |
| 5 | **Low-funds dead end without guidance.** With 30 FC left the overview only shows disabled actions; no hint that the planner is the earning loop (and in the demo, that funds are seeded). | Real save at 30 FC; overview action cards disabled with reasons but no “how to earn”. | One-line hint under 200 FC: real app “资金不足？回计划完成 1 个任务 +20 FC” linking to `/`, demo “演示版已提供启动资金，可随意体验”. Independently re-checked at 30 FC. |
| 6 | **Quick-simulation result could be missed.** After simulating, the result hero updates below the fold; nothing scrolled or moved focus. | Match tab scroll position unchanged after “Quick simulate”. | The hero is scrolled into view, its heading receives focus and a hidden live region announces the score; verified after a real quick simulation. |

## Backlog worth doing later (not blocking)

| Area | Idea | Why |
|---|---|---|
| Demo | ✅ **Done**: “Top up +5,000” and “Reset demo” live in the demo bar; an offline service worker precaches the shell and hashed assets (offline reload verified after one online visit). | The service worker is demo-only; the main app has its own offline layer. |
| Error UX | Cover the remaining command errors (migration, save/conflict) and translate 409s into “reload and retry” actions | Full coverage makes failures self-explanatory. |
| Planner ↔ club | ✅ **Done**: task/habit/focus toasts show the computed club payout (+20 FC etc.) and a “查看俱乐部” link inside the existing live region. | — |
| Accessibility | ✅ **Done**: axe-core 4.14 audit over the four tabs, 3D base and demo, desktop + 390 px — three issues found and fixed, **0 violations** on re-run. Remaining: add a skip link and verify live-region ordering under rapid commands. | The audit is manual (not in CI) so regressions could creep back in. |
| Mobile | Real-device pass (touch, safe-area insets, 30 FPS target) and sticky primary action on mobile | The harness can only emulate 390 px. |
| Offline | ✅ **Done** for the demo (`demo/public/sw.js`). | Only the shell and hashed assets are cached; large 3D chunks cache on first use. |
| Performance | Code-splitting club tabs was **evaluated and deferred**: measured tab-switch first content is 60–180 ms and the demo entry is ~640 KB minified (~200 KB gzip) with roster/3D already lazy; a split would add request waterfalls. Revisit if the bundle grows. | — |

## How this was verified

Browser runs against the local dev server and the built static demo: tab/deep-link checks, aria-live assertions, 390 px overflow/tap-target measurements, bundle sizes from `npx vite build --config vite.demo.config.ts`, toolchain checks (`tsc`, 549 tests, migration tests, prebuild, production build) and the migration drill (9/9). Real-device and provider tests remain user-dependent and are listed in `docs/DEPLOYMENT.md`.
