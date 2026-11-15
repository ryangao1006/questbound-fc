# Deployment guide

The repository has two deployable shapes.

## 1. Static game demo (already automated)

`.github/workflows/pages.yml` builds `vite.demo.config.ts` → `dist-demo` on every push to `main` and publishes it to GitHub Pages:

**https://ryangao1006.github.io/questbound-fc/**

The demo runs the whole club game in the browser: `/api/state` and `/api/command` are replaced by `lib/club-demo-store.ts`, which applies the same reducer to a document kept in `localStorage` with revision and operation-id semantics. No account, no server, no planner data leaves the device. “Reset demo” clears the local document.

`?tab=` deep links and `#base` work the same as in the hosted app.

## Why this repository cannot publish the full app from here

The full build imports private hosting metadata from `.openai/` (project id, D1/R2 bindings) and the release guard requires a verified pre-update snapshot before publication. The generated `dist/server/wrangler.json` contains a **placeholder D1 database id**, so a raw `wrangler deploy` would ship a worker without a working database. Publishing therefore happens through the platform's official Sites workflow (or your own Wrangler config with real bindings), not from the GitHub repo. CI checks only run typecheck, tests, migration tests and the static demo build.

## 2. Full application (planner + club + sync) — needs your own Cloudflare resources

The full app adds the planner, command API, D1 storage, R2 assets, sign-in and sync. It is intentionally not deployed from this repository because it needs account-specific identifiers.

1. Create a Cloudflare account setup with a Workers project, a **D1** database and an **R2** bucket.
2. Create the local-only metadata file `.openai/hosting.json` (never commit it):
   ```json
   { "d1": "DB", "r2": "BUCKET", "capabilities": ["mcp"], "project_id": "appprj_<your-project-id>" }
   ```
   The repository's `.gitignore` already excludes `.openai/`.
3. Put your account id in `cloud/wrangler.jsonc` and `background/wrangler.jsonc` (the committed versions contain `<your-cloudflare-account-id>` placeholders). Keep local copies in `cloud/wrangler.local.jsonc` / `background/wrangler.local.jsonc`, which are ignored.
4. Apply the migrations in `drizzle/` to your D1 database, then run the checks:
   ```bash
   npm run typecheck
   npm test
   python3 tests/migration_test.py
   npm run prebuild
   npm run build
   ```
5. Deploy with your Sites/Workers workflow. `npm run start` runs the built server locally against a local D1/R2 emulation for a smoke test.

Schema rules: applied migrations are immutable, `SCHEMA_VERSION` must stay aligned with `.openai/release-contract.json`, and any schema change requires a verified pre-update snapshot of the cloud database and a fresh migration test.

## Release checklist (PLAN stage four)

| Item | Status |
|---|---|
| Typecheck, unit tests (549), migration tests, prebuild, production build | green in this repository |
| Static demo build and GitHub Pages deployment | automated and live |
| Migration drill (`work/qa/migration-drill.ts`, 9/9 checks) | green |
| 3D watch 60 FPS, zero ball teleports, reduced-motion and WebGL fallback | measured on this machine |
| Demo index chunk 650 KB with lazy roster and lazy 3D chunks | measured |
| Real-phone FPS and touch checks | **needs a physical device** |
| Todoist / iCloud round trips, reminders and restore against real providers | **needs your accounts** |
| Full hosted deployment | **needs your Cloudflare project ids** |
