# Development — measured attribute trials

PLAN stage ⑥ asks for a same-scenario, same-seed comparison before and after a skill-point allocation, with measured differences rather than an invented percentage. This tranche replaces the two-number preview with a real five-metric trial suite.

## What ships

`lib/attribute-trial.ts` runs five fixed-seed trials in the real practice engine (v2 solo, `createPractice`, `practiceInput`, `stepMatch`) — no formulas, no synthetic bonuses:

| Metric | How it is measured | Better when |
|---|---|---|
| Acceleration to 8 m | ticks from standstill to 8 m of travel ÷ 30 | lower |
| Pass error at 20 m | mean lateral error where a 0.55-power ground pass crosses the 20 m line, five seeds | lower |
| Shot spread | mean lateral deviation of five 18 m shots at the same corner, only counting shots under the bar | lower |
| Turn to reverse | ticks from full sprint to −2 m/s the other way ÷ 30 | lower |
| Last-second sprint | metres covered in the fifth second of a five-second sprint (fatigue included) | higher |

Each metric is attributed to the engine inputs it actually uses: pace/acceleration/agility for the movement trials, passing and finishing for the ball trials, stamina for the late sprint. The panel shows metres and seconds, not ratings.

The practice lab's "Measured in the match engine" block now lists all five, with an arrow and a colour-coded second value whenever an unapplied build is being previewed through the existing build-comparison selector.

## Evidence

- `npm test` — 340 tests, four new in `tests/attribute-trial.test.ts`:
  - the same attributes produce identical numbers and never mutate the career;
  - a 92-rated pace/acceleration/agility/stamina build beats a 40-rated one on acceleration, turn and late sprint;
  - a 95-rated passing/finishing build cuts pass error (1.21 m → 0.30 m in the probe) and shot spread (2.28 m → 0.22 m) while leaving acceleration untouched;
  - every reported number is finite, non-negative and inside a human range.
- A direct probe on the default build reported: 1.60 s to 8 m, 1.21 m pass error, 2.28 m shot spread, 1.20 s to reverse, 7.12 m in the last sprint second. Raising pace/acceleration/agility/stamina to 92 gave 1.43 s, 1.10 s and 8.31 m; raising passing/finishing to 95 gave 0.30 m and 0.22 m.
- Browser check of the lab footer: five labelled rows render in the saved language (Chinese in the fixture), values in seconds and metres, no page errors.

## Limits

- The "after" column is exercised by the unit tests and by the same code path the lab already used for build previews; the local fixture had **no unapplied skill points**, so the browser check could only confirm the "before" column and the table itself.
- Trials are single-player and without opponents: they measure the player's own movement and ball contact, not decision-making, positioning or match rating.
- The plan's "same scene, same opponents, same random seed" is met by the fixed seeds and identical setup, but the trial is solo practice, not a competitive fixture.
- Nothing is rewarded, saved or spent by running a trial; attributes only change through the existing allocation command.
