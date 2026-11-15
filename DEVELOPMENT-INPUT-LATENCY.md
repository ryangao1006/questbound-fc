# Input latency: keyboard action → visible feedback (free practice)

Status: **measured** (2 independent runs, 2026‑11‑14) · engine `fixed-football-4` · dev build
Scope: PLAN stage ② acceptance metric *"keyboard action → visible feedback P95 ≤ 100 ms"* for the
free‑practice controls in the training lab.

All numbers below come from the real app running in a real browser (Chrome, headless) and from
in‑page instrumentation only. **No product code was changed**; the harness lives in
`work/qa-latency/`.

## TL;DR

| Action | Feedback definition | Median | P95 | Max | n | ≤100 ms P95? |
|---|---|---|---|---|---|---|
| Movement, `ArrowRight` held 200 ms | first rendered frame that includes the input's effect | **51.3 ms** | **63.3 ms** | 77.3 ms | 36 | ✅ yes |
| Movement, `ArrowRight` held 200 ms | first *clearly perceptible* movement (≥1 px / animation clip change) | **101.0 ms** | **138.7 ms** | 155.1 ms | 36 | ❌ no |
| Pass, `J` pressed (charge begins) | HUD power meter painted (same-frame) | **11.0 ms** | **13.1 ms** | 13.5 ms | 36 | ✅ yes |
| Pass, `J` released after 150 ms hold | pass clip starts / ball response reflected | **25.4 ms** | **29.1 ms** | 30.5 ms | 36 | ✅ yes |
| Pass, `J` released | ball actually leaves the foot (rendered) | 193.2 ms | 244.2 ms | 256.4 ms | 36 | n/a — designed animation windup, not input latency |

So: the **input→render pipeline** meets the 100 ms P95 target for every action measured, but the
**first movement a human can clearly see** does not (P95 ≈ 139 ms). The bottleneck is the
simulation/state‑emission path, not rendering — see §3.3. The PLAN metric needs an explicit
definition before it can be called pass/fail.

---

## 1. What was measured, and how

### 1.1 Feedback definitions (deliberately explicit)

For every sample the measured action instant `t0` is the in‑page capture‑phase `keydown`/`keyup`
timestamp (`performance.now()`), i.e. the moment the browser dispatches the key event to the page,
before the app's own handler runs.

* **Movement — "reflect"**: latency to the first *rendered pitch frame* whose draw calls happen
  after the first worker state in which the controlled player's simulated position has changed
  (> 0.0001 m) from the pre‑press state. This is the first frame that contains the engine's
  response to the key. The displacement on that frame is tiny (0.008–0.025 m ≈ 0.1–0.3 px in the
  default camera) — the frame *does* include the input effect, a person cannot see it yet.
* **Movement — "perceptible"**: same rule, but the state must show a *clearly perceptible* change:
  animation clip change, ≥ 0.10 m world displacement (≈ 1 px at the default broadcast camera), or
  a ≥ 0.25 rad facing turn.
* **Pass — press**: `J` down starts the charge. The visible feedback is the HUD `Power` meter
  repainting; latency to the first display frame after the DOM `value` mutation.
* **Pass — release**: `J` up submits the pass. Latency to the first rendered frame after the worker
  state that sets the controlled player's animation to `pass` (plus ball owner/velocity change).
  The ball leaving the foot is reported separately because the engine plays a pass windup first.

### 1.2 Instrumentation (page-side only, injected before app scripts)

`work/qa-latency/measure.mjs` installs, via Playwright's `addInitScript`:

1. a `requestAnimationFrame` wrapper that records the timestamp (display‑frame start) of every
   frame;
2. a `Worker.prototype.onmessage` wrapper that records every worker `state` message — its
   main‑thread arrival time plus the fields needed (controlled player x/y/vx/vy/facing/animation,
   ball owner/position/velocity, `frame`, `stoppage`) — then delegates to the app's handler;
3. `WebGL2RenderingContext.drawElements/drawArrays` hooks that record **the first draw call of every
   rendered frame of the 3D pitch canvas** (`.football-3d-canvas`). This is the actual render of the
   visible pitch; R3F renders it at ~60 fps in this environment;
4. a `keydown`/`keyup` capture‑phase listener (runs before the app's window handler) for `t0`;
5. a hook on the practice `Power` meter's `value` property: mutation time + the next display frame;
6. a `MutationObserver` on `[data-ui-frame]`, used **only as a diagnostic** (see §1.3).

The 3D view is the default practice view; the whole measurement therefore runs in the shipping
default path.

### 1.3 Why not measure the `[data-ui-frame]` attribute (as the task suggested)?

`components/football-practice-lab.tsx` throttles the React state that feeds the HUD:

```ts
if (now - lastUI.current > 120 || e.data.state.finished || ...) { lastUI.current = now; setState(...) }
```

So the HUD DOM tick is at best ~120 ms behind the simulation, and it is *not* the frame that carries
the canvas response. Measured anyway as a diagnostic: `[data-ui-frame]` change latency was
**median 87.1 ms / P95 132.5 ms / max 143.1 ms** (n = 36) — using it would have overstated the
movement feedback latency by 40–80 ms and measured the wrong object. The real feedback frame is the
canvas, which is why the renderer is instrumented instead.

### 1.4 Sample protocol and hygiene

Every sample starts from a deterministic state: click *Restart drill* → *Play practice*, then wait
until the controlled player owns the ball and three consecutive worker states are settled
(`vx = vy = 0`, idle clip, no stoppage, not paused). Then:

* movement: press `ArrowRight`, hold 200 ms, release; idle a random 250–650 ms before the press so
  samples do not all align with the engine's animation‑refresh boundary or the state‑emission phase;
* pass: press `J`, hold 150 ms, release (`hold` median 153 ms; the gesture length does not change
  the measured feedback latency).

Samples are rejected and retried when a stoppage/goal kickoff reset contaminates the window, when the
player's simulated reset jump is implausible, or when the pass HUD mutation did not happen inside
the keydown task. Final run: **36/36 clean movement samples, 36/36 clean pass samples, zero
rejections**. (An earlier run needed 42 attempts for 36 clean pass samples — the checks did discard
6 anomalous attempts, which is why they exist.) A second full run is archived in
`work/qa-latency/results-run1.json`; its numbers were within ~5 ms of the reported run
(movement reflect median 47.7 / P95 59.9 ms; perceptible 96.8 / 131.1 ms; pass press 10.7 / 12.8 ms;
pass release 25.2 / 29.6 ms), so the result is reproducible run-to-run on this machine.

Timing arithmetic: `latency = frame_timestamp − t0`, where `frame_timestamp` is the rAF timestamp of
the frame whose draw calls occur after the triggering worker message (or HUD mutation). Latencies are
clamped at 0 ms: a display frame can start a few ms before the key event is dispatched when the
input is processed inside that same frame (this affected a handful of HUD samples in both runs; the
most negative raw value was −5.3 ms in run 1).

---

## 2. Environment and exact rerun command

Measured on the development copy at
`/Users/mac/Documents/ai_development/quest-island-copy-20261114-183054`:

* dev server: Vite dev build on `http://127.0.0.1:5174` (`npm run dev -- --port 5174`), this copy;
* browser: Playwright 1.x driving **Chrome 157, headless**, `{channel: "chrome", headless: true}`;
* platform: macOS (Darwin), Apple M5; WebGL2 via **ANGLE Metal Renderer: Apple M5** (real GPU rendering
  is active even headless);
* viewport 1440×900, DPR 1, balanced graphics, 3D broadcast camera — the default free‑practice view;
* drill: *3 v 3 · small pitch · 3 minutes*, engine `fixed-football-4`, synthetic owner
  `qa-latency-measure` (no real planner data is read or written);
* runtime health during the reported run: rAF ≈ 60 fps, ~60 rendered pitch frames/s,
  worker state emission ≈ 22.5 Hz (median gap 46.4 ms); zero page errors.

```bash
cd /Users/mac/Documents/ai_development/quest-island-copy-20261114-183054

# 1. dev server: expect HTTP 307 (redirect to sign-in) when it is listening
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5174/
# if it is not listening, start it (this copy only; 5173 belongs to another project):
npm run dev -- --port 5174

# 2. measurement: ~3–4 minutes, 36 samples per action
node work/qa-latency/measure.mjs

# optional overrides
#   QA_BASE=http://127.0.0.1:5174  QA_SAMPLES=36  QA_OWNER=qa-latency-measure
```

Outputs (all under `work/qa-latency/`): `results.json` (all raw samples, per‑sample diagnostics and
percentiles), `results-run1.json` (archived first run), `lab-playing.png` (screenshot of the measured
view), `meter-before.png` / `meter-charging.png` (pixel proof of the HUD charge repaint), and
`summarize.mjs` (prints the tables from `results.json`).

Note: the dev tree is shared with other agents; a hot update can reload the page mid‑run. The script
detects that (dialog gone / practice not live) and re‑enters the lab, retrying the sample, but a run
that throws should simply be rerun.

---

## 3. Results

All samples: 3D broadcast camera, free practice `fixed-football-4`, headless Chrome 157, macOS M5.
Percentiles: linear interpolation between closest ranks. Raw samples and histograms are in
`work/qa-latency/results.json`.

### 3.1 Movement — `ArrowRight` held 200 ms (n = 36)

| Metric | Median | P90 | P95 | Max |
|---|---|---|---|---|
| **First rendered frame including the input effect* | **51.3 ms** | 60.3 ms | **63.3 ms** | 77.3 ms (min 39.4) |
| First clearly perceptible movement (≥1 px / clip change) | 101.0 ms | 132.0 ms | 138.7 ms | 155.1 ms |
| Engine ack: state echo arrives on main thread | 9.2 ms | 14.9 ms | 16.2 ms | 17.5 ms |
| First worker state with *any* player displacement | 43.9 ms | 49.5 ms | 50.2 ms | 83.8 ms |
| First worker state with a perceptible change | 91.3 ms | 125.8 ms | 133.6 ms | 142.8 ms |
| `[data-ui-frame]` HUD attribute change (diagnostic only) | 87.1 ms | 124.9 ms | 132.5 ms | 143.1 ms |

\* the frame contains the input's effect but the player has only moved 0.008–0.025 m on it (≈ 0.1–0.3
pixels in this camera) — it is not yet visually obvious movement.

All 36 "perceptible" samples were triggered by the animation clip switch `idle → dribble`, not by the
1‑pixel displacement threshold; the engine's acceleration ramp reaches the 0.6 m/s clip threshold two
to three 30 Hz simulation ticks after the press.

### 3.2 Pass — `J` press / hold 150 ms / release (n = 36)

| Metric | Median | P90 | P95 | Max |
|---|---|---|---|---|
| **`J` down → HUD power meter painted** | **11.0 ms** | 12.7 ms | **13.1 ms** | 13.5 ms (min 0) |
| HUD `value` mutation after keydown (same task) | 0.2 ms | 0.2 ms | 0.3 ms | 0.6 ms |
| **`J` up → first rendered frame with pass response** | **25.4 ms** | 28.8 ms | **29.1 ms** | 30.5 ms (min 22.8) |
| `J` up → worker state echo with `animation = pass` | 14.0 ms | 15.5 ms | 16.0 ms | 16.8 ms |
| `J` up → ball actually leaves the foot (rendered) | 193.2 ms | 233.7 ms | 244.2 ms | 256.4 ms |
| hold duration (control) | 153.4 ms | 156.1 ms | 157.9 ms | 196.4 ms |

The charge feedback was also verified at the pixel level: `meter-before.png` (empty track) vs
`meter-charging.png` (green fill spanning 47 of the 160 px crop width, ≈ 29 %) are crops of the same
160×9 px HUD meter region taken before and 130 ms into a hold.

The ball leaving the foot ~193 ms after release is the *designed pass animation windup*
(contact frame), not input latency; the player-visible response to the action starts at ~25 ms.

### 3.3 Where the time actually goes (movement)

1. **Input echo**: keydown handler → worker processes the input and posts a state back → main thread
   receives it: **median 9.2 ms** (P95 16.2). This state contains the new control vector but no
   visible change yet.
2. **State emission batching**: the first state showing actual displacement lands **median 43.9 ms**
   after keydown. The worker intends to emit states at 30 Hz
   (`if (now - lastEmit >= 1000 / 30) send()`), but its timer ticks at ~16.1 ms, so two ticks are
   just under 33.33 ms and the emitter takes the third tick, which is consistent with the measured
   emission rate of **21.7–22.5 Hz (median gap 46–48 ms)**. This batching alone accounts for most of
   the 51 ms.
3. **Render**: the first pitched frame after that state lands **≈7 ms** later (median; 60 fps rAF
   cadence).
4. **Perceptibility**: the player starts from standstill; the animation clip only becomes `dribble`
   once speed > 0.6 m/s, and the engine only re‑evaluates animation clips when
   `s.elapsed − p.animationAt > 0.65 s` (v4 `stepMatch`). Together with the batching this pushes the
   first *clearly perceptible* movement to **median 101 ms / P95 139 ms**.

So the renderer is not the bottleneck; the worker state emission cadence and the engine's movement
ramp/animation refresh are.

---

## 4. What the numbers prove — and what they do not

**Proves (in this environment):**

* The 3D pitch renders a frame that contains the engine response to a movement key at **P95 63.3 ms**
  and to a pass gesture at **P95 13.1 ms (charge) / 29.1 ms (release)** after the in‑page key event.
* The render path adds only single‑digit/low‑teens ms after the simulation state reaches the main
  thread; the latency budget is dominated by worker→main state batching and the engine's motion ramp.
* The HUD charge meter repaints in the frame following the keydown (same‑frame in some samples), and
  that repaint is pixel‑verified.

**Does not prove:**

* **Physical/end‑to‑end input latency.** `t0` is the in‑page keydown dispatch; keyboard firmware,
  USB/OS input, browser event dispatch before the page listener, compositor presentation and display
  scan‑out are excluded. Frame timestamps are display‑frame starts; actual presentation can trail by
  up to one refresh interval (~17 ms at 60 Hz). These are **keydown → frame** numbers, not photon
  latency.
* **Human‑perceived responsiveness.** On the "reflect" frame the player has moved only 0.1–0.3 px;
  clearly perceptible movement is median 101 ms / P95 139 ms.
* **Production behaviour.** This is the Vite **dev build** (React dev mode, HMR, unminified code) in
  **headless Chrome**. A production build, headed browser, other browsers/hardware/refresh rates, CPU
  throttling or a real keyboard have not been measured.
* **Other practice configurations.** Only the default 3D broadcast camera, 1440×900, DPR 1,
  balanced graphics, 3v3 free practice, default bindings were measured. Not measured: tactical view,
  detailed graphics, mobile layout/touch controls, solo ball work, passing-accuracy challenge,
  rebound keys, reduced‑motion mode.
* **Per-sample pixel isolation on the 3D canvas.** Feedback frames are attributed by renderer draw
  calls + simulation state, not by diffing 3D‑canvas pixels per sample (the scene always animates, so
  pixel diffing cannot attribute a change to the input). The HUD charge feedback was pixel‑verified
  separately.

---

## 5. PLAN stage ② verdict and recommendations

The acceptance metric needs an explicit definition; the measured data gives two different verdicts:

* **"First rendered frame that includes the input's effect"** (standard input‑to‑frame definition):
  movement P95 **63.3 ms**, pass charge P95 **13.1 ms**, pass release P95 **29.1 ms** → **all pass**
  the ≤ 100 ms P95 target.
* **"First frame in which a human can clearly see the movement"**: movement P95 **138.7 ms** →
  **fails** the ≤ 100 ms P95 target.

Recommendation: state which definition the metric uses. If the intent is user‑perceived
responsiveness, the free‑practice movement control does not meet 100 ms in this environment, and the
dominant costs are engine/sim, not rendering:

1. the worker→main state emission is effectively ~21 Hz, not the intended 30 Hz (the emitter's
   `>= 1000/30` threshold interacts with ~16.1 ms worker timer jitter to take 3 ticks instead of 2);
2. movement starts from a standstill with a 0.6 m/s clip threshold, and animation clips are only
   re‑evaluated every 0.65 s of simulated time;
3. a local visual acknowledgement (e.g. an immediate input‑driven animation/facing response, or a
   state emit on every simulation tick) would cut the perceptible movement latency without touching
   the renderer.

The pass gesture is fine under both definitions: charge feedback is same‑frame and the pass begins
within ~30 ms.

---

## 6. Files

| File | Purpose |
|---|---|
| `work/qa-latency/measure.mjs` | the measurement harness (rerun with `node work/qa-latency/measure.mjs`) |
| `work/qa-latency/results.json` | reported run: 36+36 raw samples, per‑sample diagnostics, percentiles, environment, visual check |
| `work/qa-latency/results-run1.json` | archived first independent run (replication check) |
| `work/qa-latency/summarize.mjs` | prints the tables from `results.json` |
| `work/qa-latency/lab-playing.png` | screenshot of the measured practice view |
| `work/qa-latency/meter-before.png`, `meter-charging.png` | pixel proof of HUD charge repaint |
| `DEVELOPMENT-INPUT-LATENCY.md` | this document |

No files under `lib/`, `components/`, `app/`, `tests/` were modified for this measurement, and no
planner records, site IDs, databases or backups were touched.

## 7. Known limitations / not covered

* One machine, one browser, one view (default 3D), one run of record; the second run is the
  replication check, not a different environment.
* The dev tree is shared with other agents and was being edited concurrently. Unrelated component
  edits landed via Vite HMR during/around the reported run; the practice-lab and worker modules used
  here were not among them, no page reload was detected mid-run (zero page errors, zero retries), and
  environment snapshots at the start and end of the run were consistent — but a fresh run after all
  concurrent edits settle is the cleanest reproduction.
* Headless Chrome uses a virtual display/vsync; the ~60 fps cadence and frame timestamps may differ
  from a headed window with a real display, and were not compared.
* The practice simulation is not deterministic across wall‑clock scheduling; state emission phase
  varies, which is why the protocol randomises idle time and retries contaminated samples.
* Tactical (2D canvas) practice view was not measured; it renders from the same worker states but
  draws on a 2D canvas at its own ~30 fps loop, so its numbers should be measured separately if that
  mode matters.
* The measurement windows in `results.json` include only data needed to verify each sample; full
  state traces are not retained.
