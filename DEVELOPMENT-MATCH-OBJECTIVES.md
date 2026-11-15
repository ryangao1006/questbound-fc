# Development — match objectives and post-match debrief

PLAN stage ④ asks for one main objective per match plus at most two secondary ones, with defending, organising and goalkeeping all scored. This tranche adds that layer without touching the match engine, the saved match document or any reward rule.

## What ships

`lib/match-objectives.ts` derives the brief from the match itself, so nothing new is stored and the same match always produces the same brief:

- **One main objective by position** — goalkeeper saves, defender tackles, midfielder completed passes, attacker shots on target.
- **Up to two secondary objectives** — a clean sheet or interceptions for defenders and keepers; goals, assists or link-up passes for attackers and creators.
- **Targets scale with the format**: a full 300-second-half fixture asks for the full numbers; a 90-second-half small-sided drill asks for about a third (`scale = clamp(halfSeconds/300, .3, 1)`).
- **Objective values come from the real match statistics** (`PlayerMatchStats`, plus the scoreline for a clean sheet), never from a formula.
- **Phase ratings** — defending (tackles, interceptions, saves, fouls, turnovers), organising (pass accuracy, position score, turnovers) and goalkeeping (saves, clean sheet) on a 0–10 scale; goalkeeping only appears for a goalkeeper.

`components/match-objectives.tsx` renders two things: the brief inside the match pause panel (main objective highlighted, live progress against each target) and, at full time, a debrief with met/not-met marks, the three phase ratings and the existing "ratings are fictional game feedback" note.

## Evidence

- `npm test` — 351 tests, five new in `tests/match-objectives.test.ts`: every position gets exactly one main and at most two secondary objectives with unique ids; the brief differs by position and is deterministic; shorter formats ask for smaller numbers; objectives are judged from real statistics and the scoreline (including the clean-sheet flip when the opponent scores); phase ratings stay inside 0–10, respond to tackles/passes, are `null` for goalkeeping unless the player is a keeper, and rise with saves.
- Browser check of the match pause panel (paused free-practice fixture, no rewards): the brief rendered in Chinese with 射正 3 次 as the main objective and 进球 / 用 10 次传球串联进攻 as secondary, each showing live `0/3`, `0/1`, `0/10` progress.
- **Full-time debrief observed in a real match.** The fixture was resumed with a persistent browser profile (a fresh profile carried a different device id and the checkpoint came back as a 409), the next stoppage was used to switch to 16× watch speed, and the match played to 90'. The debrief then rendered: `data-met="0" data-total="3"`, rows `射正 3 次 0/3 · 未达成`, `进球 0/1 · 未达成`, `用 10 次传球串联进攻 0/10 · 未达成`, phase ratings 防守 4.8 / 组织 5.2 at a 6–5 scoreline, with the "ratings are fictional game feedback" note. Screenshot: `work/qa/shots/h5-fulltime-debrief.png`; script: `work/qa/fulltime-persist.mjs`.

## Accessibility follow-up from the team audit

The Agent Teams audit (task-4) reported four issues in these two files; all are fixed and checked:

- camera sliders had no accessible name because the `<output>` inside the `<label>` stole the association — both ranges now carry `aria-label` plus `aria-valuetext` (`40%`, `1.00×`), and the readouts sit outside the label;
- the pause panel is now an `aria-live="polite"` group labelled 比赛已暂停, so the brief is announced when the match pauses;
- the debrief ✓/✗ icons are `aria-hidden` (the met/not-met text already carries the meaning);
- the camera `summary` has a visible `:focus-visible` outline.

Verified in the match overlay: `input.labels.length === 1`, names 跟随强度 / 缩放, value text 40% / 1.00×, panel `role=group aria-label=比赛已暂停 aria-live=polite`, objectives region 本场目标 with three items.

## Limits

- The debrief was observed in **watch mode**, where the AI plays every player: the controlled footballer recorded no shots or passes, so all three objectives came back unmet. A debrief after human-controlled play (objectives partially met) is not yet captured.
- Reaching full time needed a persistent device profile and a stoppage window for the speed change; that is a measurement procedure, not a product change. A single new browser profile can still receive a checkpoint conflict from a stale device lease until the existing "continue on this device" takeover is used.
- Objectives and ratings are not persisted: they are recomputed from the saved match state, so a resumed match shows the same brief, but no history of "objectives met" is written into the career record.
- Ratings remain fictional game feedback and are not compared against real performance.
- No match-engine behaviour changed; the practice and competitive engines are untouched.
