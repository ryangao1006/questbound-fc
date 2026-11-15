# Development — reliability and performance baseline

This is the first measured baseline for PLAN stage ①. It records what the current private site actually does on a local build, with the exact method used, so later work can be compared against it. Nothing here is a certification: it is one Mac, one browser channel, one local database full of synthetic records.

## Environment and method

- macOS, Apple silicon; Google Chrome via Playwright (headless), 1440×960 unless stated.
- Local dev server from this workspace (`npm run dev`, vinext/Vite, local D1/R2, loopback only).
- Planner data: the local dev document plus 200 deterministic `task.add` commands seeded through the real API (309 tasks total, 217 rows visible in the default filters).
- View-switch and click timings are measured **inside the page** with `performance.now()` around a real `click()` and two `requestAnimationFrame` paint boundaries, ten samples per view. They exclude Playwright's actionability waiting; earlier driver-inclusive numbers (≈460 ms) were rejected as misleading.
- API latency is measured from `fetch()` to the parsed response against the local D1.

## Measurements

| Measurement | Result | Note |
|---|---|---|
| Cold open → first task rows (dev server) | ≈640 ms | Includes dev-mode transform/compile of the route |
| `task.add` command round trip (200 samples) | median 15.1 ms · p95 18.2 ms · max 40 ms | Local D1, single writer |
| Task view switch, board (10 samples) | median 184 ms · p95 229 ms | 217 rows |
| Task view switch, compact list | median 145 ms · p95 303 ms | 217 rows |
| Task view switch, list + details | median 107 ms · p95 226 ms | 217 rows |
| Complete action → UI settled | ≈210 ms | Driver-inclusive click; optimistic row update is immediate |
| JS heap after the session | ≈134 MB | `performance.memory`, 309 tasks |
| Practice render (separate run) | 60 FPS at 1440×960 | Short headless sample, 6 players, `fixed-football-4` |
| Offline edit | reported **尚未保存** (not saved) | Click happens, nothing persists |

## Reproducible issues

1. **There is no offline read or write.** With the network disabled, a completion shows "尚未保存" and a reload fails with `ERR_INTERNET_DISCONNECTED`; the task list does not come back at all. A service worker is registered and controls the page, but `caches.keys()` is empty in this build, so no app shell is served offline. PLAN's "断网新增／编辑，关闭重开，联网恢复" scenario currently fails at the first step.
2. **View switching is slower than the 100 ms P95 target with 200+ tasks.** Board (229 ms p95) and compact list (303 ms p95) both miss it on the same data. The board is the worst case; list + details is closest to target.
3. **The retired Microsoft/OneDrive entry is still on screen.** Settings shows a "Microsoft 与 OneDrive 入口" card (and the OneDrive app-registration block) even though PLAN asks to remove that display so there is only one authoritative write path. The `workers.dev` link text does not appear, so only the entry card and form remain.
4. **The completion sound is fired on intent, not on save.** `components/quest-app.tsx` plays the cue as it applies the optimistic preview, before `plannerApi('command')` resolves; a failed save reverts the row after the sound already played. PLAN asks for local-save success first, then the short completion sound.
5. **Every command clones and migrates the whole document.** `reduceCommand` starts with `migrateState(structuredClone(input))` and the revision-checked commit then writes the full document; at 309 tasks one completion copies the whole planner at least twice. This is a scaling hazard rather than a measured cause: this baseline does not isolate how much of the view-switch cost it produces, and it must be watched before the document grows much further.
6. **Failed writes keep no retry affordance on the row.** The state reverts and the header can show a sync problem, but there is no per-task "retry" or "kept locally" marker; the plan's five distinct states (local saved / waiting cloud / cloud synced / Todoist pending / conflict) are not all reachable on this runtime.

## What this baseline does and does not show

- It does show: local command latency is fine, a 200-task document is usable, and the missing piece is offline persistence plus view-render cost rather than the network round trip.
- It does not show: real-phone frame rate, real Todoist/iCloud round trips, long-session memory growth, or sustained 60 FPS with a full 11-a-side match. Those need the user's credentials, a physical device and longer runs.
- The synthetic task records exist only in this workspace's local D1. No published site, production record, XP, credit or career result was touched.

## Recommended order for the next reliability tranche

1. Ship the offline shell and IndexedDB-backed queue on this private runtime (the local-first module already exists for the separate cloud entry; reuse its record shape rather than inventing a second one).
2. Make the header states truthful for queued cloud and queued provider work, and add a per-row retry/kept-locally marker.
3. Move the completion cue to after the local write resolves.
4. Remove the Microsoft/OneDrive entry card and form.
5. Re-run this same script and publish the delta (view switch, offline reload, completion cue timing).

## Fourth pass — view render cost (issue 2 resolved)

View switching with 207 tasks now meets the 100 ms P95 target in the development build; details are in `DEVELOPMENT-VIEW-PERFORMANCE.md`. The same alternating and per-view scripts were run before and after:

| Measurement (in page) | 3.9 baseline | Now |
|---|---|---|
| Board switch, alternating list/board | 148 ms median · 182 ms p95 | 24 ms · 45 ms |
| Board switch, isolated | 184 ms · 229 ms | 14 ms · 31 ms |
| Compact list, isolated | 145 ms · 303 ms | 29 ms · 43 ms |
| List + details, isolated | 107 ms · 226 ms | 27 ms · 41 ms |
| Main-thread task per board switch | ~90 ms every switch | none recorded |

Cause and fix: every row and card mounted at once, a new `Intl.DateTimeFormat` per row per date, and a one-second full-app re-render for the focus clock. The fix renders a first window with counted "show more" controls, caches formatters, skips off-screen layout/paint, and isolates the clock. Production-build and physical-device figures remain unverified.

## Third pass — offline copy (issue 1 resolved)

Issue 1 is now addressed for this runtime; see `DEVELOPMENT-OFFLINE.md`. Re-measured in the same browser setup:

| Offline scenario | 3.9 baseline | Now |
|---|---|---|
| Complete a task with the network off | row reverted, pill "尚未保存" | row kept, pill "本机已保存", one queued operation |
| Reload while offline | browser error page, no tasks | device copy page: revision, last save, 1 pending change, next tasks |
| Keep working after the offline reload | impossible | "Done" on the copy page queues a real completion (queue 1 → 2) |
| Reconnect | change lost | queue replayed, queue 0, server completed count 9 → 11 |
| Cache Storage | 1 entry, nothing cached | shell only; private pages and API still never cached |

The remaining limits are stated there: offline you get the copy page rather than the full planner, replay is foreground only, and rewards stay server-confirmed.

## Second pass — fixes from this baseline

Three of the issues above are now fixed and re-checked in the browser. The measurements in the table are unchanged; the offline and render-cost items are still open.

### Fixed

1. **The retired Microsoft/OneDrive entry is gone from the private site.** `AccountSync` no longer renders a cloud entry card on this runtime (it returns nothing when the local-first runtime is not active), and the Microsoft app-registration form (`connections/onedrive/start`, "Set up Microsoft sign-in") was removed from Settings → External connections. Re-checked on the live page: the connections tab mentions iCloud and Todoist only, with no `OneDrive` or `Microsoft` text and no `workers.dev` link. The Data & backups tab still lists OneDrive as a recovery-copy location, which the plan keeps.
2. **The completion cue now belongs to the saved state.** `saveCueAtIntent` returns no sound for a completion and `saveCueAfterSave` returns `complete` (or `level` when the save also levels up), so the cue is played only after the command resolves; a failed save stays silent. The optimistic preview still updates the row immediately. Unit-tested in `tests/save-cue.test.ts`; ordering is a code-path change, not something this headless run can hear.
3. **A failed change stays retryable.** The last failed command is kept in state and the sync popover offers **Retry this change** only while the pill is in the error tone. Re-checked by forcing one `HTTP 500` on `api/command`: the pill showed "尚未保存" (error), the popover offered the retry button, and after restoring the API the retry applied the same command idempotently — the row completed and the retry offer disappeared.

### Still open (unchanged by this pass)

- **No offline read or write.** Disabling the network still leaves a completion "尚未保存" and a reload at `ERR_INTERNET_DISCONNECTED`; the service worker still caches nothing. This is the next tranche.
- **View switching still misses 100 ms P95 at 200+ tasks** (board 229 ms p95, compact list 303 ms p95); nothing in this pass touched rendering.
- **Whole-document writes** per command are unchanged.
- **Five-state sync labels** are still not all reachable on this runtime: it shows Saved / Saving… / Conflict / Not saved / Connections paused, not local-saved vs waiting-cloud vs Todoist-pending.

### Re-measured after this pass

The same scripts were run again on the fixed build (213 visible rows, 3 tasks were completed during QA):

| Measurement | Before | After |
|---|---|---|
| Task view switch, board (in page) | 184 ms median · 229 ms p95 | 149 ms median · 215 ms p95 |
| Task view switch, compact list | 145 ms median · 303 ms p95 | 91 ms median · 253 ms p95 |
| Task view switch, list + details | 107 ms median · 226 ms p95 | 58 ms median · 201 ms p95 |
| JS heap | ≈134 MB | ≈105 MB |
| Cold open → first rows | ≈640 ms | ≈530 ms |
| Offline edit | 尚未保存, reload fails | unchanged |

The improvement is **not** attributed to this pass: no rendering work was done here, the row count and session heap differed, and the headless timings vary run to run. The honest reading is that view switching still misses the 100 ms P95 target on the board and compact list, and the next tranche must address it directly.

### Verification for this pass

`npm run typecheck` clean; `npm test` 321 passing (four new: completion cue at intent, completion cue after save, retired entry removed, retry retained); `npm run prebuild` and the four SQLite migration checks pass; browser QA as described above with synthetic local records only.
