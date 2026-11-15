# Development — responsive practice (`fixed-football-4`)

This tranche continues PLAN stage ② (control and simulation). The published `fixed-football-1/2/3` engines are untouched: saved competitive matches, replays and older practice checkpoints keep dispatching to the engine they were created with. Free three-a-side practice now creates the new `fixed-football-4` / `pitch-physics-4` state.

## What changed

### 1. Buffered first touch (engine)

`lib/football-engine/v4.ts` adds one buffered action to the controlled player:

- Pressing pass, through, cross or shoot while the ball is genuinely in flight and within 9 m stores `{action, power, target, move, at}` on the state instead of being dropped.
- When that player receives the ball, a buffer younger than 0.55 s is consumed: the direction held at press time becomes the first touch (the ball is nudged into that lane and the player gets a small burst), then the stored action is released with the power and aim of that press.
- Buffers older than 0.6 s are discarded during `stepMatch`, so a stale key press can never fire late. Pressing while a teammate is carrying the ball still means "ask for the ball"; only loose, travelling balls are buffered.
- The buffer also expires on a stoppage, so restarting play cannot replay an old press.

This is state, not UI: it survives checkpoints, replays and `advanceMatch` deterministically.

### 2. Published pass target (engine + UI)

`stepMatch` now writes `state.passPreview` — the teammate the engine would actually pick for a ground pass, using the same scoring function that `releaseKick` uses. It is deterministic (no RNG), clears when the controlled player loses the ball or a stoppage starts, and never changes what the engine will do.

The pitch renders it as an amber ring plus a short pole on the current carrier and a lime ring, pole and marker over the pass target; tactical view draws the same carrier ring, a dashed line to the target and the attack-direction arrow.

### 3. Slot shape instead of one shared chase point

`aiTarget` rebuilt two branches:

- **Defending:** the closest outfielder still presses the ball; the second closest becomes cover between the ball and the own goal; every other defender holds their formation slot with the block shifting toward the ball (18% x / 22% y), instead of every defender targeting the same "threat" position.
- **Support:** runners keep their own channel (slot parity/lane offset) instead of all moving to one identical point next to the carrier.

`basePosition()` is exported for tests and telemetry.

### 4. Lab and input safety

- v4 practice checkpoints are saved and offered again after reload (the allowlist accepts `fixed-football-4`).
- Resuming clears the held-key set and sends a zeroed movement/sprint/close-control/shield input, so a resumed drill cannot inherit a direction the player was holding before the reload.
- "Play again" now deletes the stored checkpoint instead of silently resurrecting the previous drill.
- The PAUSE panel explains the new first-touch window when the drill is v4.

## Evidence

- `npm run typecheck` — clean.
- `npm test` — 312 tests pass, including six new ones in `tests/football-v4.test.ts`:
  - v4 is created, on a 60×40 field, and v1/v2/v3 still dispatch by version;
  - the pass preview names a teammate, is stable across identical steps, and clears when the ball leaves;
  - an action pressed during an incoming pass becomes an actual one-touch (pass counted, ball released above 6 m/s);
  - a stale buffer expires and produces no pass or shot;
  - slot shape drift is measurably smaller than the retained v3 threat-chasing behaviour over the same snapshot and 90 frames;
  - a v4 snapshot round-trips through JSON and replays identically for 120 frames.
- `python3 tests/migration_test.py` — 4 checks pass (no schema change in this tranche).
- `npm run prebuild` — release identity and append-only engine contract pass; `fixed-football-4` is frozen in `.openai/football-engine-contract.json` with its SHA-256.
- Browser QA against this workspace's own dev server (synthetic local owner, no real records): v4 engine reported in the live HUD, local checkpoint stored as `fixed-football-4`/`pitch-physics-4`, pass preview and carrier published while playing, buffer flag set by a press during the pass flight and cleared afterwards, v4 checkpoint offered and resumed after a reload, 60 FPS render counter at 1440×960, 390×844 phone viewport without horizontal overflow, no page errors.

## Not claimed

- Physical-phone frame rate, thermal behaviour and measured input latency are still unverified; the 60 FPS sample is a short local headless-Chrome observation.
- No 11-a-side, substitute, replay or competitive-fixture change: those stay on their published engines.
- No XP, credits, fixture passes, inventory or career result is awarded by practice; no schema, migration or production record changed.
- The comic character profile and the offline reliability baseline are separate tranches of the plan and are not part of this change.
