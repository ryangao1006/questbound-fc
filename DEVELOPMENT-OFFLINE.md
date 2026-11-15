# Development — offline copy and queued changes

Third tranche of the reliability work: the private site now keeps a device-only copy of the planner and queues changes made without a connection, then replays them when the site is reachable again.

## What ships

### 1. Device copy — `lib/site-cache.ts`

A separate IndexedDB database (`questbound-site`) holds two stores:

- `snapshot/latest` — the last envelope the server accepted (revision, updatedAt, state, cachedAt). An older revision can never overwrite a newer one.
- `queue/<operationId>` — commands made while the site was unreachable, with the operation id used for the request.

Every successful `GET /api/state` and every accepted command writes the snapshot. Nothing here is uploaded, shared between devices or placed in an HTTP cache.

### 2. Queue replay — `lib/site-queue.ts`

Pure, testable rules: `enqueue` keeps order and never duplicates an operation id; `applyQueued` replays the queue over the last server copy so the device shows the change immediately while the server revision stays untouched; `flushQueue` sends commands in order with their original ids, refreshes and retries once on a stale revision, keeps everything on a real conflict, and stops at the first network failure without dropping the rest.

### 3. Offline page — `public/sw.js` + `/offline`

The service worker now installs a shell and, when a navigation fails, answers with a **self-contained** HTML page (no framework hydration, no build assets) that reads the same IndexedDB copy and lists:

- when the site last saved, the revision and when this device copied it;
- how many changes are waiting;
- the next open tasks, each with a **Done** button that queues a real `task.toggle` and updates the count.

It is bilingual, follows the planner's saved language, offers a retry/reconnect action and reloads automatically when the connection returns. Privacy rule kept: private pages and `/api/*` are never cached in Cache Storage; only the shell and static assets are.

### 4. App integration — `components/quest-app.tsx`

- Loading: the last snapshot is used automatically when `/api/state` fails, with the pill showing "Local saved".
- Writing: a command with no HTTP answer is applied locally, stored in the queue and reported as "Local saved" instead of pretending to be saved on the server.
- Reconnecting: `online`, the next successful load and the 30-second poll flush the queue; accepted commands are removed and the authoritative server state replaces the local view; a conflict keeps the change on the device and asks for review.
- The 3.9 baseline's completion-cue and retry fixes are unchanged.

## Verification

- `npm run typecheck` clean; `npm test` **332** passing, including 11 new tests: queue ordering and dedupe, local replay without changing the server revision, newest-snapshot rule, ordered send, one 409 refresh-and-retry, conflict retention, stop-on-network-failure, plus IndexedDB snapshot/queue durability, older-revision rejection, dedupe and clear.
- `npm run prebuild`, the four SQLite migration checks and `npm run build` pass; `/offline` builds as a static route and `public/sw.js` is copied into the build.
- Browser end-to-end flow (synthetic local owner, dev server):
  1. worker controls the page, one shell cache exists and `/offline` is cached;
  2. the device snapshot is written (revision 921 in the sample run);
  3. offline, completing a task shows **本机已保存** and the queue holds one operation;
  4. reloading while offline serves the offline page — it reports "1 项修改已保存在本机，等待发送到站点" and lists the open tasks;
  5. completing another task from that page raises the queue to 2;
  6. reconnecting flushes both operations — queue 0 and the server's completed-task count rose from 9 to 11.

## Cache correctness fix (post-3.11)

A QA teammate found that the dev server answers `GET /app/*.css` with `text/javascript` when the request does not ask for CSS, and the worker's install-time precache stored those responses as CSS. With the worker controlling the page, a stylesheet request could then be answered from a cache entry with the wrong MIME type and the app rendered unstyled. The worker now only stores a response when its `content-type` matches the request (`text/css` for stylesheets, `javascript` for scripts, `font` for fonts), and the cache name moved to `qfc-shell-v2` so older wrong-MIME entries are dropped on activation. Verified in a fresh browser context with the worker controlling the page: all stylesheets parse (45–76 rules each), the navigation renders as flex, and the only cache entries are the offline page and its scripts, all with matching types.

## Limits

- Offline you get the **offline copy page**, not the full planner UI: you can read the next tasks and queue completions, not edit titles, dates or create tasks. The full app still requires a connection to load.
- Replay is foreground only: it runs when the tab is open and the `online` event, a successful load or the 30-second poll fires. There is no background sync, so a change made offline reaches the site the next time the planner is opened online.
- Rewards stay server-confirmed. Local replay shows the completion immediately but XP and credits only change when the server accepts the command; a rejected/conflicting command stays queued and is never silently dropped.
- Cache Storage holds the shell and static assets only. It is not evicted by revision and has no size cap yet.
- The snapshot is one device's copy, not an archive: it is not encrypted at rest beyond the browser's own storage and should not replace the encrypted cloud/Mac backups.
- Physical-phone offline behaviour was not tested; the run above is headless Chrome against the local dev server.
