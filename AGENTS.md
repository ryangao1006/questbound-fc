# Questbound FC maintenance

Preserve the Site project ID, DB and BUCKET bindings in `.openai/hosting.json` and the application folder. The name `quest-island`, archive magic QIBAK1, Keychain service names, backup folder, and table prefixes are compatibility identifiers. Do not rename them as part of visual changes.

Never seed or reset production records during deployment. All live records belong to authenticated owners. Keep credentials and recovery keys out of Git, client code, logs, screenshots, and backup contents.

Run `npm run typecheck`, `npm test`, `python3 tests/migration_test.py` and the official Sites build workflow before publication. `npm run prebuild` checks `.openai/release-contract.json`. Applied migrations are immutable. Append numbered schema-only migrations. A database/schema change requires migration tests and a verified pre-update cloud and Mac snapshot through the enrolled backup helper. Never bypass that guard to publish.

After a successful schema-changing deployment, validate populated records and relationships, then advance `.openai/release-contract.json` to that successfully deployed schema and its migration hashes. A failed publication may still have applied SQL migrations. Investigate before retrying. Roll back code only when compatible with the current schema.

Restore previews require an explicit user choice in the UI, a pre-restore snapshot, paused outbound sync/reminders and fresh provider reconciliation. Keep confirmed deadlines, suggested work dates, blocks, actual sessions, imported status and reward history distinct. Never infer completion from past chat discussion.

Keep the football RPG secondary to working planner functions. Use positions, kit, career levels and encouraging coaching; missed days do not subtract progress.
