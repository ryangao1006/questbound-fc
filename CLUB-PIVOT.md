# Club pivot — what exists, what is blocked, how to land it

`/Users/mac/Downloads/PLAN.md` replaces the player-career roadmap with a club-management game: one club per account, club XP and funds, squad building, DEF/MID/ATT lines, money-based training, tactics, transfers, facilities, league and cup, all driven by the existing task/focus planner. It supersedes `PLAN-STATUS.md`, which describes the earlier plan.

## Implemented and tested in this workspace (no persistence)

| Area | File | What it does |
|---|---|---|
| Club domain | `lib/club-model.ts` | Formations (4-4-2 / 4-3-3 / 4-2-3-1), line weights exactly as PLAN 3.2, position fit 100/95/85 %, DEF/MID/ATT/GK and the 30/30/30/10 overall, club level per 100 XP, training prices 20/40/60/100/160, training-centre caps 69/74/79/89/99, deterministic 20-player squad (2 GK, 7 DEF, 7 MID, 4 ATT, 56–62 OVR), auto-pick |
| Preview club | `lib/club-preview.ts` | Assembles the `ClubSave` shape the real implementation will use: identity, level, ratings, squad with per-player fit and next training quote, starters/bench, facilities, migration summary |
| Migration preview | `lib/club-migration.ts` | Read-only mapping from the current planner: XP carried 1:1, funds carried as-is, purchased frames/backdrops and unlocked kits become display rights, one-off 150 grant recorded, reward/session baselines, warnings for a running focus session or queued provider jobs |
| Economy ledger V2 | `lib/club-economy.ts` (parallel teammate) | Task/habit 10 XP + 20 funds, focus 20-minute buckets with a carried remainder, level bounty 40, one-off 150, undo that only withdraws unspent funds, match rewards 0 |
| Read-only page | `/club` (parallel teammate) | Club card, ratings, squad table, weight tables, migration panel, bilingual, labelled "preview, not saved" |

Tests: `tests/club-model.test.ts` (6), `tests/club-migration.test.ts` (4) and `tests/club-economy.test.ts` (14) — 24 new cases, 375 in the whole suite. The `/club` page was verified at 1440×1000 and 390×844 (no horizontal overflow), in dark and light themes, with live planner data and with the sample fallback when the API is unauthenticated; screenshots live in `work/qa/shots/club-preview*.png`.

## Persistence decision — no schema change, no backup needed

The original draft of this document said the 8 → 9 migration needed verified cloud and Mac snapshots first. That is still true for a SQL schema change, so this tranche **avoids one entirely**:

- The club lives in the existing versioned planner document as an optional `club` field (`lib/club-state.ts`, `PlannerState.club`). `SCHEMA_VERSION` stays 8; older documents simply have no club and keep working, and `migrateState` preserves the field.
- Club funds reuse the existing FC Credits ledger through a new additive `economy.clubSpend[]` receipt list, so there is still one balance. `spendClubFunds` allocates from the same sources, keeps a permanent receipt and never goes negative; `assertEconomy` now validates those receipts and includes them in the per-source spent totals.
- Reducer commands (`lib/domain.ts`): `club.create`, `club.train`, `club.lineup`. They are revision-checked and idempotent through the existing operation ledger like every other command.

Verified end to end against the local private database (no backup, no migration):
1. `club.create` → revision 1958, club **Northbridge FC**, 20 players, 11 starters, funds 320.
2. `club.train` → PAS 65 → 66, OVR updated, receipt "Yuri Thane · PAS 20", funds 320 → 300, one `clubSpend` entry.
3. `tests/club-state.test.ts` (7 cases) covers creation, validation, funds, the training-centre cap, lineup rules and ratings; `tests/club-economy.test.ts` (14) covers the reward rules; `tests/club-model.test.ts` (6) and `tests/club-migration.test.ts` (4) cover the domain and migration maths.

Trade-offs accepted for now: the whole document is rewritten on each command, so the club makes it roughly a few kilobytes larger; if the club save grows (match checkpoints, season history) it should move to its own table, and **that** change will need the verified-snapshot process again.

## If the club later moves to its own tables
## Proposed schema-9 shape (to execute once the snapshots exist)

Keep the task path fast (PLAN 4.2): the club must not be written inside the task transaction.

- `drizzle/0005_club.sql` — additive only, no rewrite of existing rows:
  - `qi_clubs(owner TEXT PRIMARY KEY, club_id TEXT NOT NULL, revision INTEGER NOT NULL, document TEXT NOT NULL, updated_at TEXT NOT NULL)`
  - `qi_club_operations(owner TEXT NOT NULL, id TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(owner,id))`
  - no club row is created until the owner confirms club creation, so existing accounts stay untouched.
- Planner document: add only a small `clubLedger` section (XP, funds sources, spending, focus remainder, initial-grant receipt) so a task completion still commits one small document; the big `ClubSave` lives in `qi_clubs` and is saved on its own cadence (PLAN 4.4: ~2 s local, ~15 s cloud and at stoppages).
- APIs: `GET /api/club/state`, `POST /api/club/command`, `GET /api/club/match`, each revision-checked with a unique operation id (same pattern as `lib/store.ts`).
- Command set for stage 1: `club.create`, `squad.setLineup`, `player.train`, `tactics.upgrade`, later `transfer.sign/sell`, `facility.upgrade`, `cosmetic.buy`.
- Migration: on first activation compute `previewClubMigration`, write the receipts (initial grant, display rights, frozen personal attributes) in one transaction, then flip a `club.enabledVersion` flag. Existing task/outbox tables are untouched.
- Recovery: include `qi_clubs` and the ledger in the archive and the restore preview; restoring keeps the newer of the two economy states and never stacks old spending onto a new squad.
- Release: snapshot → migrate → `tests/migration_test.py` + new club migration test → build → deploy → verify populated records → advance `.openai/release-contract.json` to schema 9 with the new migration hashes.

## Stage-1 loop, verified through the real API

The full loop now works against the private database without any schema change:

1. Create a club (`club.create`) → 20 players, 11 starters, funds from the existing ledger.
2. Complete a **new** task → +20 funds (old tasks whose reward identity predates the economy baseline correctly pay nothing; 280 → 300 in the check).
3. Train a player (`club.train`) → −20 funds (300 → 280), attribute +1, OVR recomputed, receipt `Yuri Thane · DRI 20` recorded in `club.receipts` and `economy.clubSpend`.
4. `club.lineup` validates eleven unique players with exactly one keeper and recomputes DEF/MID/ATT.

## Player career removed from the product (entry points)

The pivot is now visible in the app, not just in data:

- the navigation entry `Career` became **Club** and opens `/club` (both desktop and mobile navigation);
- the hub's personal-player 3D tile was replaced with a club tile (crest, name, level, funds, DEF/MID/ATT, 20 players) that links to `/club`;
- the header identity is the club (name, short name, DEF/MID/ATT, XP) instead of the footballer's name/number/position;
- Settings no longer has the "Your player profile" name/squad-number form, and the hub is titled **Club central** instead of "Career central";
- the in-app career route now only offers a link to the club workspace; the old `components/football-career.tsx` page (appearance, dorm, player growth, training lab) is unreachable and kept only as reference until it is deleted.

Consequence to be aware of: the old free-practice/training-lab entry lived in that removed page, so the game currently has no playable match. The manager match (stage 2) is the next build; nothing else about tasks, calendar, focus, sync or offline changed.

## Tactics and facilities (PLAN 3.4 / 3.5)

- **Tactics**: five presets (balanced / possession / counter / wide / press) with per-preset training levels 0–5 at 100/200/350/550/800. Each level adds +1 to the preset's attribute on its line group (balanced: outfield DRI, possession: outfield PAS, counter: midfield+attack PAC, wide: PAS on the wider roles, press: midfield+attack DEF), capped at 99, and the active tactic feeds `clubRatings`, so DEF/MID/ATT move immediately. Switching is free and keeps levels. Commands: `club.tactic`, `club.tactic.train`.
- **Facilities**: training centre L1–L5 (300/700/1600/3200, caps 69/74/79/89/99, gates at club level 3/6/10), scout centre L1–L4 (400/1000/2200, gates 5/10/15), stadium L1–L5 (400/900/1800/3600). Command: `club.facility`; the training centre level is what the training panel's cap reads.
- Verification: `tests/club-tactics.test.ts` (8 cases: price curve, purchase and receipt, max-level refusal, line-restricted bonuses with the 99 cap, free switching that keeps levels, ratings including the bonus, facility prices/gates/max, gate and funds refusals). Browser: buying `possession L1` cost 100 FC (200 → 100) and moved DEF 61.3→61.4, MID 60.4→60.9, ATT 55.8→56.0, OVR 59.4→59.7, with the receipt in the flash; switching back to balanced reverted the numbers exactly. Facility upgrades were verified as disabled/gated with the real server errors (`Reach club level 5 to upgrade scoutCentre.`, `Not enough club funds.`) because the club only had 100 FC left; the success path was checked with a route mock.

## Manager match, first slice (PLAN 3.6 / stage 2)

`lib/club-match.ts` is a deterministic manager-match model built from the saved club:

- teams come from `teamFromClub` (line ratings with the active tactic already applied, scorer names from the starting XI);
- the five tactics have a shape (possession shifts midfield, counter shifts attack, wide shifts both flanks, press defends higher but exposes space — the exposure is modelled, so pressing concedes measurably more than possession over 150 seeds);
- 18 five-minute blocks produce chances, shots, saves and goals from a seeded stream, with home advantage;
- the report carries score, possession, shots/on target, per-side ratings and an explanation (dominant line and side, where the chances came from, why goals were conceded, a tactic note and a next step);
- `club.match` (tier 0–3) runs the model on the server, appends the result to `club.matches` (last 30) and pays no funds; the same operation id and tier reproduce the same match.

Tests: `tests/club-match.test.ts` (10 cases — determinism, internal consistency, stronger attack wins more, home advantage over 200 matches, tactic shape effect, team built from the saved lineup, opponent tiers, no mutation, summary text, and the persisted `club.match` command).

This is the **quick-simulation** half of stage 2. The 3D watch view is expected to drive the same model later; until it exists this is explicitly a fast simulation, not a claim of visual parity.

## First-club grant

Creating a club now records a one-off 150 FC source (`grant:club-initial`). `reconcileEconomy` preserves `grant` sources like match sources, so it survives later recomputes, and the command cannot run twice because a second club is refused.

## Transfers and the league (PLAN 3.5 / 3.6)

- **Transfers**: `lib/club-transfers.ts` holds the PLAN rules — signing price `max(300, 500 + 100·(OVR−60) + 8·max(0, OVR−75)²)` (65 OVR ≈ 1 000, 80 ≈ 2 700), scout-centre caps 68/76/84/99, sale at 50 % of the paid price with no training refund, zero income for the gifted squad, a starting-XI legality check and world uniqueness. Commands: `club.sign {worldPlayerId}` (debits the price, adds the roster player, writes a `signing` receipt, 25-player cap) and `club.sell {playerId}` (removes the player, credits a preserved `transfer` source of kind, writes a `sale` receipt).
- **League**: `lib/club-league.ts` builds a four-tier, eight-club double round-robin (14 rounds, 56 fixtures), keeps a sorted table (3/1/0, goal difference), simulates every fixture with the same seeded match model, and reports promotion for the top two / relegation for the bottom two with the lowest tier protected. Commands: `club.league.start {tier}` and `club.league.play` (one round per call); the season lives in `club.season`.

Tests: `tests/club-transfers.test.ts` (15 from the rules owner), `tests/club-signings.test.ts` (5 command-level cases), `tests/club-league.test.ts` (5: fixture shape, reproducible table updates, a full 14-round season, promotion/relegation, and the persisted commands). 426 tests pass in total; typecheck, migration checks, `npm run prebuild` and the build pass. Both the transfers and league **UIs** are still being built; the commands are usable from `/club` only after those panels land.

## Cup, honours and match ratings

- **Challenge cup** (`lib/club-cup.ts`): a four-club fictional cup (own club + three real clubs from the versioned directory, explicitly labelled as fictional), two semi-finals and a final, penalties for level scores, seeded and reproducible. Commands `club.cup.start {tier}` and `club.cup.play`.
- **Honours** (`club.trophies`): winning the cup records one trophy; finishing a league season in first place records a league title. Trophy ids are stable (`cup:<id>`, `league:<seasonId>`) so a replay cannot duplicate them.
- **Player ratings**: `simulateClubMatch` now returns per-player ratings for both sides (every outfield starter, goals rewarded, clamped 3–10), available to the result card.

The full league (14 rounds) and the cup were played for real against the local database: the Rookie season finished 1st with 29 points (promoted to Rising, table 8 teams, 14 rounds), and the cup ended with the club eliminated 0–2 in the semi-final while Coventry City won the final on penalties. Funds never moved (seasons and cups pay nothing).

Tests: `tests/club-cup.test.ts` (5: bracket shape, semi→final progression, determinism, command persistence, trophy count), `tests/club-league.test.ts` (5), `tests/club-match.test.ts` (11 including player ratings). 432 tests pass in total.

## Honours, ratings and the migration grant

- **Honours**: `club.trophies` is written on a cup win or a league title (stable ids `cup:<id>` / `league:<seasonId>`), displayed newest-first in the club workspace; the hub strip shows the count.
- **Player ratings**: `simulateClubMatch` returns per-player ratings for both sides; the result card rebuilds the stored seed locally and lists every outfield starter (goals + 3–10 rating, best highlighted, GK excluded) with a note that it is a seeded rebuild.
- **Legacy migration**: `club.migrate {confirm:true}` grants the one-off 150 FC to clubs created before the grant rule, stamps `club.migratedAt`, requires the explicit confirm and never duplicates the grant.

## Season history and migration confirm (done)

- **Season history**: `club.history` keeps the last 20 archived seasons (tier, position, points, W/D/L, GF/GA, outcome including `abandoned`, date); a finished season is archived once by stable season id, and starting a new season over an unfinished one records it as abandoned.
- **Migration**: the `/club` summary now shows the whole PLAN 4.3 preview and a confirm action; verified against the real database (100 → 250 FC, `migratedAt` stamped, announcement, idempotent second confirm, unconfirmed request refused with the real error).

## Base navigation and season history (done)

`/club` starts with a ten-link base navigation strip (smooth scroll, hash, sticky offset, focus move; horizontally scrollable at 390 px) and a season-history panel fed by the archived `club.history`. A real Rookie season was played through the API for the verification: **1st, 36 points, 12-0-2, 32:9, league champion**, with the replaced Rising season archived as abandoned; the honours section now shows that trophy.

## The base overview (PLAN 3.7)

`/club/base` collects the rooms in one place with live numbers — training ground (level + cap), tactics room (active tactic + trained level), dressing room (squad + OVR), stadium (season round/tier), trophy room (trophies/seasons), transfer office (funds + scout cap), league office and cup room — each linking to its section of `/club`. The club workspace links to it from the base navigation. It is text/data only and says so; the 3D base view is still ahead.

## 3D watch, first version

`components/club-watch-3d.tsx` is a lazy-loaded three.js scene that visualises a saved match timeline: perspective pitch with simple player tokens and a ball, broadcast camera, 0–90 clock at 1×/2×/4×, play/pause/seek, goal/save/chance animations, score and commentary sync, aria-live announcements, reduced-motion fallback and a 390 px layout. It is explicitly labelled **“事件动画（非物理模拟）”** — no 11-a-side physics or tactical AI is simulated, and the watch cannot change a result. Measured 60 FPS on this Mac, no three.js on first paint, canvas unmounted on close.

## Formations and substitutions

`lib/club-lineup.ts` maps the starting XI onto formation slots (4-3-3 / 4-4-2 / 4-2-3-1) with real pitch coordinates and role-correct assignment; saved matches carry `lineups` for both sides. Live matches support `club.live.sub` (five per match, re-rating the remaining blocks, appending a `sub` event, refusing to break the keeper slot), and the UI adds the pickers, the 0/5 counter and the goalkeeper guard. The 3D watch places its 22 tokens on the recorded slots and shows substitutions in the commentary; old records fall back to the formation layout. Verified with a real live match: Dima Orrin → Jae Rook at 11′, final 4–0 with `subs: 1`, 22/22 slot coordinates matching (maxDiff 0), 60 FPS.

## Focus buckets (PLAN 2.2)

Focus rewards now follow the 20-minute bucket rule: 5 XP + 10 funds per accumulated 20 minutes with the remainder carried across sessions. It is forward-only — the first session after the release records `economy.focus.from`; earlier sessions keep the old per-session reward, so no existing balance is rewritten. Tests cover 50-minute sessions, two 25-minute sessions, short-session carry and a legacy session before the cutoff.

## Remaining work for PLAN stage 1

1. ~~Interactive `/club` UI~~ — done: create form (validated, server errors shown verbatim), training panel with price/cap/OVR/DEF-MID-ATT preview and confirm, receipt list, one-tap line-up, formation switch, wallet, 409 reload, aria-live feedback, bilingual, 1440/390 verified.
2. The "saved locally, reward confirming" split from PLAN 2.4 for the completion cue (the task path already saves first; the reward text still needs the confirming state).
3. Focus reward buckets: the current ledger still pays 10 per saved ≥20-minute session, while PLAN 2.2 wants 5 XP/10 funds per full 20 minutes with a carried remainder (50 min ≡ 25 + 25). Changing it alters existing entitlements, so it needs an explicit go-ahead.
4. Migration activation summary (PLAN 4.3) once the club UI exists.
5. Hub integration: club card and funds on the planner hub instead of the preview page only.

## Verification of this tranche

`npx tsc --noEmit`, `npm test` (club-model + club-migration tests), `python3 tests/migration_test.py`, `npm run prebuild`, `npm run build`, and a browser check of `/club` at 1440 px and 390 px. No database, schema, site id, backup or production record was changed.
