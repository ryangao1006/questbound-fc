# Development — view performance at 200+ tasks

Stage ① of PLAN asked for task-view switching at P95 ≤ 100 ms with about 200 tasks. The 3.9 baseline missed it badly; this tranche fixes the cause and re-measures with the same scripts.

## What was slow

With 207 visible tasks the journal mounted every row or every board card on each switch:

- board: 184 ms median / 229 ms p95
- compact list: 145 ms / 303 ms
- list + details: 107 ms / 226 ms

Three separate costs were found by measurement, not guesswork:

1. **Every row and card mounted at once.** The board rendered every card in every subject column (207 cards), and the lists rendered every row. Cost scaled linearly with the task count — a filtered view with 11 rows switched in 32 ms.
2. **A fresh `Intl.DateTimeFormat` per row per date.** `dateTime()` and the row's short-date helper constructed formatters during render; `TaskBoard`'s date helper did the same.
3. **A full-app re-render every second.** The global one-second clock re-rendered the whole planner — including the 200-card board — just to update the focus bar's `mm:ss`. Long-task instrumentation showed ~90 ms tasks on the board unrelated to the click.

## What changed

1. **Progressive windows** (`lib/progressive-list.ts`, `hooks/use-progressive.ts`). Lists render the first 40 rows and reveal 120 more per click; the board renders 3 subject columns and reveals 6 more on request or when the board is scrolled; each column renders 6 cards and reveals 6 more per click. A filter, sort or view change resets the window, so switching stays predictable. Every hidden row is reachable with a visible, counted button — nothing is silently dropped, and the full task data, ordering, drag targets and commands are unchanged.
2. **Formatter cache** (`lib/i18n.ts`). One `Intl.DateTimeFormat` per language and option set, bounded to 64 entries; `task-disclosure.tsx` reuses `dateTime()` instead of building its own.
3. **Off-screen rows skip layout and paint** — `content-visibility: auto` with `contain-intrinsic-size` on task rows, so long lists do not pay paint cost for rows below the fold.
4. **Focus clock isolation** (`components/active-training-bar.tsx`). The bar owns its own one-second tick, and the page clock now only ticks on views that display seconds (hub, training, calendar). The task board no longer re-renders every second.

## Measurements (same machine, dev server, 207 visible tasks)

| Scenario | Before | After |
|---|---|---|
| Board switch, alternating list/board | 148 ms median · 182 ms p95 | **24 ms median · 45 ms p95** |
| Compact list switch, alternating | 76 ms median · 83 ms p95 | **72 ms median · 79 ms p95** |
| Board switch, isolated per view | 184 ms median · 229 ms p95 | **14 ms median · 31 ms p95** |
| Compact list, isolated | 145 ms · 303 ms | **29 ms · 43 ms** |
| List + details, isolated | 107 ms · 226 ms | **27 ms · 41 ms** |
| Main-thread long task per board switch | ~90 ms, every switch | none recorded on switch |

The first "before" column is the 3.9 in-page measurement; the alternating figures come from the same alternating script run before and after the change. All timings are `performance.now()` around a real click and two paint boundaries inside the page (no driver auto-wait).

## Behaviour that did not change

- Task data, ordering, filters, sorting, drag-and-drop, completion, editing, subtasks, reminders and sync commands are untouched.
- The board still shows every subject; the first paint shows three columns and the rest are one click (or a scroll) away, with the count of hidden subjects on the button. Columns reveal their own hidden cards in chunks of six.
- Nothing is written to the server by the windowing; no schema, migration, reward or record changed.

## Not verified

- These numbers are the **development** build. The production bundle could not be measured locally because the Sites sign-in route is dev-only (`/signin-with-chatgpt` is a 404 in the wrangler preview), so a production or physical-device figure is not claimed.
- Physical-phone scroll performance and very large documents (1,000+ tasks) were not measured; the windowing is linear in the visible window, not in the total, but that is an expectation rather than a measurement.
- Window sizes (40 rows / 3 columns / 6 cards) are tuned from these runs; they are constants in the two components and can be revisited with real-device data.
