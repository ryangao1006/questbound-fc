# Accessibility & keyboard audit — progressive task windows and match panels (3.12–3.15)

Date: 2026-11-14 · Owner: teammate `a11y` (task-4) · Workspace: `quest-island-copy-20261114-183054`

Scope from the brief:

- board **“显示其余 N 个科目”** (`.board-more`) and per-column **“显示其余 N 项任务”** (`.board-more-cards`) — `components/task-board.tsx`
- list **“显示其余 N 项任务”** (`.ws-more`) — `components/quest-journal.tsx`
- match camera panel (`.match-camera` details/summary + range inputs) — `components/football-match.tsx` (READ ONLY for this audit; findings go to the owner)
- match objectives panel (`.match-objectives`) — `components/match-objectives.tsx` (READ ONLY; findings go to the owner)

Browser: Playwright 1.66 + installed Chrome (headless), dev server `http://127.0.0.1:5174`,
scripts in `work/qa-a11y/` (evidence screenshots in `work/qa/shots/a11y-final-*.png`).
UI language during the audit: **zh-CN** (saved planner preference); the same `t()` templates are
used in English (`”Show {0} more tasks”` / `”Show {0} more subjects”`, `lib/messages.ts:683-684`).

## Environment note (not a product change)

The dev mock server content-negotiates CSS: a request to `/app/*.css` without
`Accept: text/css` is answered as `text/javascript`. The app’s service worker
(`public/sw.js`) installs a shell cache by fetching every `/offline` asset with a plain
`fetch()`, so it caches those CSS URLs under the JS content type and then serves them to
stylesheet requests — with the SW active the whole dev app renders unstyled
(`document.styleSheets` rules = 0, `body` background transparent). Blocking service
workers in the Playwright context restores the real CSS (`body`/nav styled,
`task-workspace.css` = 132 rules). All screenshots and computed-style evidence below were
captured with `serviceWorkers: "block"`. This only reproduces against the dev
content-negotiation; the production build serves hashed CSS with `text/css`, so it is a
dev/QA-only hazard (worth knowing for other browser tests in this repo).

## Checklist and result

Legend: ✅ pass · 🔧 fixed in this pass · ⚠️ observed / reported (owned elsewhere)

### 1. Tab reaches each “show more” control in a sensible order

| Control | Tab order observed | Result |
| --- | --- | --- |
| list `.ws-more button` | previous = last visible row’s `.ws-actions summary` (`aria-label` “任务操作：Baseline task 17”) → **button** → next = `.ws-inline-add` (“添加任务… N”) | ✅ |
| board `.board-more` | previous = last visible column’s `.board-add` (“添加任务”) → **button** → next = end of document (button is the last tabbable control in the board) | ✅ |
| board `.board-more-cards` | previous = last visible card’s `.board-task-menu summary` (`aria-label` “任务操作：Career test — isolated preview only”) → **button** → next = that column’s `.board-add` | ✅ |

All three are real `<button type="button">` elements with `tabIndex=0` (not divs), and are not
disabled while the window can grow.

### 2. Enter and Space activate; focus is not lost to `<body>`

Before the fix (observed):

- list: `.ws-more` 40→160 rows (button survives, focus stays), then Space 160→204 rows —
  the button unmounts and `document.activeElement === document.body`.
- board per-column: `.board-more-cards` in the 10-task “Projects” column, Enter 6→10 cards —
  button unmounts, `document.activeElement === document.body`.
- `.board-more` had the same unmount-on-final-click pattern (the button is only rendered
  while `boardWindow.limit < ordered.length`).

After the fix (verified, see evidence below): Enter and Space both activate; when the button
survives the growth focus stays on it, and when the final activation unmounts it focus moves to
the **first newly revealed item** instead of `<body>`:

- list final activation → focus = first new row’s `.ws-task-main`
  (`aria-label` “编辑全部详情：Baseline task 123”), `document.activeElement === BODY` is **false**.
- board `.board-more` final activation → focus = first newly revealed column’s
  `.board-add` (“添加任务”).
- board `.board-more-cards` final activation → focus = first newly revealed card’s
  `.board-task-body` (`aria-label` “编辑全部详情：Career test — isolated preview only”).

When the button survives (list 40→160, board 3→9→15, cards 6→12) focus stays on the same
button, its accessible name updates, and for the list/cards the button is scrolled back into
view (`inViewport: true`) so the focused control is not left off-screen.

### 3. Accessible names contain the action and the count; they update as content grows

Observed accessible names (Playwright `ariaSnapshot` / `getByRole` name):

- `.ws-more button` → **“显示其余 164 项任务”** (204 visible, 40 rendered) → after Enter
  **“显示其余 44 项任务”** → gone when all 204 rows are rendered.
- `.board-more button` → **“显示其余 18 个科目”** (21 columns, 3 rendered) → Enter
  **“显示其余 12 个科目”** → Space **“显示其余 6 个科目”** → gone at 21/21.
- `.board-more-cards` big column (201 tasks) → **“显示其余 188 项任务”** → Enter
  **“显示其余 182 项任务”** (12 cards shown).
- `.board-more-cards` 10-task column → **“显示其余 4 项任务”** → gone after one Enter (10/10 cards).

These controls grow content rather than toggling an open/closed state, so they intentionally
do **not** get `aria-expanded`; the refreshed name/count is the announcement. To make the
grown region discoverable from the control, `aria-controls` was added (see fixes) with valid
targets: `ws-task-list`, `board-column-track`, `board-cards-<columnKey>`.

Visible focus (`:focus-visible`) was already provided by
`app/task-workspace.css:13` / `app/task-readability.css:17`; computed ring observed in the
classic-career theme = `outline: solid 3px rgb(30, 76, 118)`, `outline-offset: 3px`
(the theme’s `--ws-accent`), on all three controls and on the focused item they hand off to.

### 4. Match camera panel (`.match-camera`) and objectives panel (`.match-objectives`)

READ-ONLY audit — see the findings section below (the owner of `football-match.tsx` can apply
them). The control is a native `<details>`/`<summary>` with `aria-label` “镜头设置”; the panel
contains a `<select>` (“镜头角度”) and two range inputs whose labels are “跟随强度” and
“缩放” (range values shown in `<output>`), and the pause panel renders
`<section class="match-objectives" aria-label="本场目标">`.

#### 4a. What was observed in the match overlay (browser evidence)

Method: `work/qa-a11y/audit-match.mjs`, `audit-match-ax.mjs` and `audit-match-followup.mjs`
(Playwright + CDP `Accessibility.getPartialAXTree`, dev user, zh-CN UI). The practice match was
taken over with 继续比赛 / 在此设备续接比赛, the audit stayed paused, then 保存并退出 closed the
overlay. One benign `409 Conflict` console line comes from the resume handshake; the overlay
opened and saved normally afterwards.

Tab order into the camera panel (first stops after the overlay dialog receives focus):

```
保存并退出 (button, aria-label)
继续比赛 / 暂停比赛 (button, aria-label)
镜头设置 (SUMMARY, aria-label, .match-camera > summary)   <-- camera control
操作说明 (button)
战术视图 (button)
… 开始 / 保存并退出 / 比赛模式 select … (pause panel and decisions)
```

- The summary is a native `<summary>` (inside `<details class="match-camera">`); CDP AX node:
  `role: DisclosureTriangle`, `name: "镜头设置"`, `focusable: true`, and `expanded: false`
  before opening → `expanded: true` after opening. It is reached by Tab in a sensible order and
  **Space and Enter both open the panel**; focus stays on the summary. Opening it with Enter
  while the match was paused did **not** also resume the match (frame counter unchanged
  `14510 → 14510`, pause panel and “继续比赛” label retained; same result after an explicit
  Escape pause at frame `15824`), so the global Enter shortcut does not double-act here.
- With the panel open, Tab continues into the panel in DOM order:
  `select` (“镜头角度”) → slider (“跟随强度”) → slider (“缩放”) → 操作说明. 16 sampled Tab
  presses never left `[role="dialog"]` (`.football-match-overlay`, `aria-modal="true"`,
  `aria-label="比赛日"`).
- Sliders are keyboard-operable: ArrowRight changed 跟随强度 `0.4 → 0.45` and persisted
  `localStorage["qfc-match-camera"] = {"preset":"broadcast","follow":0.45,"zoom":1}`.
- **Visible focus:** select = `solid 2px rgb(101,153,138)` offset 2px, both ranges =
  `solid 2px …` offset 4px (from `app/game.css:3` global `input:focus-visible` and
  `app/football-career.css` overlay rules). The `summary` only shows the browser default
  `auto 1px rgb(0,95,204)` ring — visible, but not the themed ring the other controls get
  (finding F2).
- **Slider accessible names are empty in the AX tree** (finding F1): CDP `name: ""` for both
  sliders, `input.labels.length === 0`, and `getByRole("slider",{name:/跟随强度|缩放/})` = 0.
  Cause: each control is `<label>跟随强度 <output>40%</output><input type="range"></label>`,
  and `<output>` is itself a labelable element — it is the first labelable descendant of the
  `<label>`, so the label is associated with the `<output>`, not the range input. The
  `<output>` elements are exposed as `role="status"` nodes named “跟随强度 0.4” / “缩放 1”
  (so value changes are announced), but the sliders themselves are unnamed.

Objectives panel:

- `<section class="match-objectives" aria-label="本场目标">` is exposed as
  `role: region`, `name: "本场目标"`, visible inside `.match-pause-panel`, before the
  开始 / 保存并退出 buttons. Its list is readable:
  `listitem: 射正 3 次 主要目标 · 0/3`, `listitem: 进球 次要 · 0/1`,
  `listitem: 用 10 次传球串联进攻 次要 · 0/10`.
- **Pause is not announced** (finding F3): pausing with Escape while the overlay dialog held
  focus left focus on the dialog (`.football-match-overlay`, label “比赛日”); the pause panel,
  the objectives region and the resume button appeared with no `aria-live` region and no focus
  move, so a screen-reader user gets no cue that the match paused or that objectives exist.

#### 4b. Findings for the `football-match.tsx` / `match-objectives.tsx` owner (not edited here)

- **F1 — medium — camera range inputs have no accessible name.**
  `components/football-match.tsx:50`. Because `<output>` is labelable, the wrapping `<label>`
  labels the output instead of the `<input type=range>` (`labels.length === 0`, AX name empty).
  Fix: move `<output>` out of the `<label>` (e.g. `<label>{t("Follow strength")}<input …/></label>
  <output …>`), or give each input an explicit `id`/`aria-label` + `aria-labelledby`.
  Also set `aria-valuetext` (`"40%"`, `"1.00×"`): today the slider exposes raw values
  `valuetext "0.4"` / `"1"`.
- **F2 — low — the camera `summary` has only the UA focus ring.** Add `summary` to the global
  focus-visible rule in `app/game.css:3` (which already covers `button,a,input,select,textarea`)
  or add `.football-match-overlay summary:focus-visible` next to
  `app/football-career.css` overlay rules. Passes “visible focus” today, but inconsistent with
  the themed ring on the other controls.
- **F3 — medium — pause panel + objectives are not announced.** The pause panel is rendered
  without `role`/`aria-live` or a focus move (`components/football-match.tsx:52`); pausing via
  Escape/visibility leaves focus on the dialog. Suggest focusing the pause-panel heading /
  first action (`tabIndex={-1}`) when pausing, or adding a polite live region announcing
  “比赛已暂停” plus the objectives summary.
- **F4 — low — debrief icons are decorative without `aria-hidden`.** In the full-time debrief
  (`components/match-objectives.tsx:18-31`) the Check/X icons are followed by “达成/未达成”
  text, so the state is readable; mark the icons `aria-hidden="true"` so AT does not announce
  them twice.
- **F5 — info — focus trap selector.** `components/football-match.tsx:43` builds the trap from
  `button:not([disabled]),select:not([disabled]),[tabindex="0"]`; it excludes `summary` and
  range inputs. No leak was observed (16 Tab presses stayed inside the dialog because these
  controls are not at the boundaries), but including `summary,input` in the trap selector would
  keep the wrap correct if the panel order changes.
- **F6 — info — checked, no action needed.** Enter on the summary does not fire the global
  “resume when paused” shortcut in either paused state we tested; opening/closing with
  Space/Enter and the native `expanded` announcement all work. `.match-objectives` region name
  and list content are exposed correctly.


## What was fixed

Minimal changes only, in the three allowed files; no data logic, window sizes or rendering
strategy changed.

1. `components/quest-journal.tsx:43-47, 73, 75`
   - track the grow click in `pendingRows`; the final click (when `windowed.hidden <= 120`) hands
     focus to the first newly revealed `.ws-row`’s `.ws-task-main`; otherwise the surviving
     `.ws-more button` is `scrollIntoView({block:"nearest"})`-ed so the focused button stays visible;
   - `id="ws-task-list"` + `ref` on the list section and `aria-controls="ws-task-list"` on the button.
2. `components/task-board.tsx:31-37, 38` (and the two button render sites)
   - `pendingColumns` / `pendingCards` hand-offs: final `.board-more` click focuses the first newly
     revealed column’s first `.board-task-body` (or `.board-add` for an empty column); final
     `.board-more-cards` click focuses the first newly revealed card; a surviving
     `.board-more-cards` is scrolled back into view;
   - `id="board-column-track"` + `ref` on `.board-track`, `id={`board-cards-${column.key}`}` on each
     `.subject-column-cards`, and matching `aria-controls` on both buttons.
3. `app/task-workspace.css:38` — `scroll-margin-block:64px` for the three controls so a
   re-focused/scrolled “show more” button is not hidden under the sticky header.

Pre-existing focus styling (`:focus-visible` outline) already in
`app/task-workspace.css:13` / `app/task-readability.css:17` was reused; no colour change needed.

## Tests and checks

- `npx tsc --noEmit` → exit 0, no errors.
- `npm test` → 351 tests, 351 pass, 0 fail, 0 skipped.
- Browser evidence scripts (all run against `http://127.0.0.1:5174`, service workers blocked so the
  dev stylesheet/MIME hazard above cannot blank the UI):
  `work/qa-a11y/verify-list.mjs` (list), `work/qa-a11y/verify-board.mjs` (board windows),
  `work/qa-a11y/audit-match.mjs` + `audit-match-ax.mjs` + `audit-match-followup.mjs` (match panel,
  including CDP AX-tree queries). Note the dev server’s mock auth strips
  `oai-authenticated-user-*` headers, so these scripts sign in through
  `/signin-with-chatgpt?return_to=%2F` first.
- Screenshots: `work/qa/shots/a11y-final-01-list-focused.png` (focus ring on `.ws-more` while the
  list is styled), `a11y-final-02-list-enter.png`, `a11y-final-03-list-exhausted.png`,
  `a11y-final-06-board-more-managed.png`, `a11y-final-07-board-cards-grow.png`,
  `a11y-final-08-board-cards-exhausted.png`, and the match screenshots.

## Remaining issues / observations

1. **Board scroll reveals the window while tabbing** (existing 3.12 behaviour, not changed):
   `.board-track` has `onScroll` → `boardWindow.showMore()` when `scrollLeft > 8`. Keyboard focus
   moving horizontally scrolls the track, which silently inserts columns *before* the focused
   control and changes the tab sequence mid-navigation. It does not lose focus, but the “show
   more subjects” button keeps moving right as the user tabs. Suggested follow-up (owner of
   `task-board.tsx`): gate the scroll-reveal to user-initiated wheel/touch scroll (e.g. flag set
   by `onWheel`/`onPointerDown`) so keyboard tabbing does not mutate the window mid-order.
2. **Focused `.board-more` can sit horizontally off-screen after growth** (it is inside the
   horizontal scrolling track, and scrolling the track itself triggers reveal by design). Focus
   is retained and Enter keeps working, so this was left alone; a follow-up could reveal columns
   on explicit button activation only.
3. **Match camera/objectives findings (F1–F6) are in section 4b above** and are reported to the
   owner of `components/football-match.tsx` / `components/match-objectives.tsx`; they were not
   edited here. The most important are F1 (camera sliders have no accessible name because the
   `<output>` inside each `<label>` takes the label association) and F3 (the pause panel with the
   objectives is not announced / focused when the match pauses).
4. **Dev-only stylesheet/MIME hazard (environment, not product):** see the environment note at the
   top; reported to the lead, who owns `public/sw.js`, so it is not changed here.


## Match overlay follow-up (owner: lead)

The four findings reported for `components/football-match.tsx` and `components/match-objectives.tsx` were fixed by their owner, since those files were outside this task's write scope:

- **F1 (medium)** camera sliders: `<output>` moved out of the `<label>`; both ranges now have `aria-label` and `aria-valuetext` (`40%`, `1.00×`). Browser check: `input.labels.length === 1`, names 跟随强度 / 缩放, value text correct.
- **F2 (low)** camera `summary` now has a `:focus-visible` outline in `app/stadium-ui.css`.
- **F3 (medium)** the pause panel is `role="group"` with `aria-label="比赛已暂停"` and `aria-live="polite"`, so the brief is announced.
- **F4 (low)** debrief ✓/✗ icons are `aria-hidden`.
- F5/F6 were informational and needed no change.

The match is left paused and saved, as reported.
