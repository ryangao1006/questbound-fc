# Development — broadcast camera for competitive matches

PLAN stage ④ asks for a default televised angled view with zoom and follow-strength settings. This tranche adds those controls to the existing match overlay without changing the match engine, the saved match document or any competitive rule.

## What ships

`lib/match-camera.ts` holds a device-local profile:

- **Camera angle** — broadcast (default), close, wide.
- **Follow strength** — 0 % keeps the look-at point on the ball, 100 % keeps it on your player; the weight moves between 25 % and 85 % player so the ball never leaves the frame entirely.
- **Zoom** — 0.70× to 1.40×, scaling framing only.

Values are clamped and validated on read, persisted to `localStorage` under `qfc-match-camera`, and never written to the account or the match document. Reduced-motion users keep one stable wide framing regardless of the saved profile.

`components/football-pitch.tsx` now accepts an optional rig and uses it for height, distance and follow weighting; the practice lab keeps its own `cameraPreset` path unchanged. `components/football-match.tsx` adds a **Camera** panel in the match toolbar (angle select, follow slider with percentage, zoom slider with multiplier), applies changes immediately and writes them back to the device profile.

## Evidence

- `npm test` — 346 tests, six new in `tests/match-camera.test.ts`: defaults for missing/invalid values, clamping of follow and zoom, follow weighting moving from the ball to the player (weights always sum to 1), close/wide/zoom framing changes, reduced-motion producing one stable rig regardless of the saved profile, and a storage round trip that writes exactly one key.
- Browser check in the real match overlay (the paused free-practice fixture, which awards nothing): the **Camera** control is offered, choosing wide and 70 % follow stored `{"preset":"wide","follow":0.7,"zoom":1}`, and the value survived a reload. The panel renders fully inside the viewport with Chinese labels (镜头角度 / 转播镜头 / 跟随强度 / 缩放).

## Limits

- One visual layout issue was found and fixed during this check: the panel opened right-aligned from a left-hand toolbar and was clipped; it now opens from the left with a viewport cap.
- No measured frame-rate change is claimed: the rig changes camera placement only, and no sustained-load or physical-device run was made.
- The panel is not covered by an automated DOM test; the verification above is the browser observation.
- This does not yet deliver match objectives, substitution briefings or the post-match debrief from the same stage; those remain open.
