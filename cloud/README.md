# Microsoft / OneDrive entry

This is a separate entry, not a change to the private Sites audience. Build the standalone client to `dist/cloud-client` before deploying. The separate entry has been deployed at https://questbound-fc-cloud.questbound-gaoryan680.workers.dev. Microsoft credentials/owner enrollment are not configured, so cloud actions fail closed and only local mode is active. Direct production browser access has not been verified from this Mac network.

Required secret configuration (values must never be tracked):

- `MICROSOFT_CLIENT_ID`: Microsoft personal-account application registration.
- `MICROSOFT_CLIENT_SECRET`: confidential-client credential.
- `MICROSOFT_ALLOWED_SUBJECTS`: newline-separated exact `issuer|sub` owner IDs. Establish the owner identity through trusted registration/linking, never accept the first public visitor or infer ownership from email.
- `APP_ENCRYPTION_KEY`: base64url 32-byte master key held separately from snapshots.
- `PUBLIC_ORIGIN`: HTTPS origin, without trailing slash.

Register `${PUBLIC_ORIGIN}/api/account/callback` as a Web redirect, not an SPA redirect. Scope: openid profile offline_access Files.ReadWrite.AppFolder. An empty/missing owner allowlist fails closed. Initial deployment requires live owner linking and Graph permission testing.

API: GET `/api/account/session`, GET `/api/account/start`, GET `/api/account/callback`, POST `/api/account/logout`, GET `/api/cloud/read`, POST `/api/cloud/commit`. Account identity is always resolved server-side from the HttpOnly session. POSTs require exact same-origin Origin. No cross-origin API support.

A cloud snapshot commit takes `{operationId,baseRevision,deviceId,snapshot:{state,career?}}`; reads and writes return `{snapshot,revision,updatedAt}`. Retry a timed-out commit with identical input and operation ID. A changed payload requires a new operation ID after resolving the outstanding operation. The per-account Durable Object stores only encrypted credentials and coordination fences, not snapshots. A persistent pending fence prevents a different operation from racing an uncertain write after a worker restart. A repeated exact operation resolves it through the OneDrive receipt. Never manually clear a fence without reading/validating the cloud head and preserving the client's pending operation.

Files are flat within approot, named by SHA-256 of their logical path; their format includes account hash, checksums, immutable snapshots and one published head. The worker is the sole supported writer. Direct OneDrive edits require validation/recovery, not blind upload. Previous immutable files are retained. Retention and encrypted QIBAK recovery remain release gates; these snapshot objects are live application records, not QIBAK archives.

Limitations to verify before release: live Microsoft consent, minimal-scope Graph operations on the personal account, Mac/phone browser restart/offline tests, existing account migration, independent QIBAK recovery and background reminder/Todoist adapter integration. Never report these as passed from unit tests alone.

## Owner enrollment

Alternatively configure an unpredictable `OWNER_SETUP_TOKEN` and keep `MICROSOFT_ALLOWED_SUBJECTS` empty. The already trusted owner submits this token through POST `/api/account/enroll/start` with `{setupToken}`. The response sets the browser-binding cookie and returns `{url}` for a top-level Microsoft redirect. After the signed Microsoft identity has been verified, the owner registry atomically checks/consumes enrollment authority and binds that exact subject. Other browsers cannot enroll after it is bound. Remove the setup token after successful setup. Never place it in URL query strings, source, logs or public UI defaults.

## Background and recovery APIs

A connected account's Durable Object wakes every minute. Todoist refresh uses persisted cache/cursor and queued command UUIDs. Reminder generation reads the committed OneDrive head, respects quiet hours and suppresses unfinished-task nudges without fresh Todoist verification; imported iCloud connections are conservatively unverified until an iCloud adapter exists. Delivery metadata is recorded before network transport; an uncertain delivery is not blindly replayed. This prioritizes duplicate prevention over guaranteed delivery after ambiguous provider errors.

POST `/api/push/key`, `/api/push/register`, `/api/push/test`, `/api/push/disable`; GET `/api/devices`. Subscription endpoints are restricted to supported browser push hosts. The background service cannot see unsynced offline edits.

GET `/api/backups`, GET `/api/backups/download/<id>`, POST `/api/backups/setup`, POST `/api/backups/create`, POST multipart `/api/restore/preview` (`archive`, `key`), POST `/api/restore/commit` (`id`, `revision`, `operationId`), POST `/api/service/check`. Backup setup returns the recovery key once requested for separate export; encrypted key custody is in the backend vault. Recovery archives and their metadata index live in OneDrive. Archives are uploaded, read back, checksum checked and decrypted before success. Retention keeps 24 recent, 30 daily, 12 monthly and 10 pre-update/pre-restore snapshots; cleanup occurs only after verifying a newer archive and index. Local Mac retention is independent and needs the companion enrollment adapter.

Restore preview uploads an encrypted temporary archive, with its secret key/revision/hash held in the encrypted vault. Commit requires the same head revision, makes a verified pre-restore backup, restores validated operation receipts, pauses provider sync and rebuilds future reminders. Preview does not replace data. Existing Site archives remain readable. An initial cloud backup is possible only after uploading the planner head.

## Conditional publication and interrupted writes

The cloud HEAD is now the `description` of a dedicated app-folder child folder, not file content. Graph DriveItem metadata PATCH documents `If-Match` and returns 412 if the ETag changed: https://learn.microsoft.com/en-us/graph/api/driveitem-update?view=graph-rest-1.0 . The expected ETag is durably pinned before publication; retries retain it, so a delayed old request cannot overwrite a later HEAD. The outer journal holds only the small pointer and hashes, and resolves completed-but-unacknowledged writes by read-back. Conditional replay is enabled only for this metadata adapter. A conflicting external edit remains blocked for explicit recovery.

Live acceptance must verify personal-account folder descriptions, conditional PATCH and app-folder-only permissions. Do not silently request broader OneDrive permissions if unsupported. Provider authorization rotation is independent of browser-session expiry; logout expires the browser session without extending it or destroying background connector consent.

## Mac backup helper

POST `/api/helper/enroll` with the authenticated same-origin browser session returns `{id,token,recoveryKey,siteUrl}`. Keep this setup file private and store it with the existing Keychain identifiers; the token is backup-only. Bearer helper endpoints: GET `/api/helper/backups`, GET `/api/helper/download/<id>` (includes `X-Checksum-Sha256`), POST `/api/helper/pre-update`, POST `/api/helper/ack` with `{id,checksum}`. The helper cannot read/edit tasks or restore. Acknowledgement updates `local_at` only for a matching verified archive. Independent local pruning remains the Mac helper's responsibility.

GET `/api/account/session` includes `setupRequired` and authenticated `background:{checkedAt,lastError?}`. Background failures are visible without dumping credentials or complete planner records. Empty-cloud restoration first initializes a verified blank head, backs it up, then restores the chosen archive; no imported tasks are completed or rewarded by this initialization.

Browser account isolation: every authenticated browser POST (except account login/logout/enrollment) must send `X-QFC-Account` matching the local cache owner. GET requests carrying this header also reject mismatches. `/api/cloud/commit` and `/api/cloud/recover` additionally require body `accountId`; `/api/cloud/read`, commit and recovery return `accountId`. Missing or changed identities fail with 403 `ACCOUNT_CHANGED` before writes. This prevents a stale tab from uploading one account's local cache using another tab's newly changed login cookie. Backup-only bearer helper requests remain separately scoped and exempt from this browser header.


## Current verification and migration boundary

The owner selected the **gaoborui2020 personal Microsoft account**, not s25016. Do not register/link the school identity as a fallback. No Supabase is used. Microsoft app registration, owner consent, live minimal-scope Graph metadata publication, and end-to-end Mac/OneDrive recovery remain outstanding; never call them connected based on mocked tests.

`npm test`, `python3 tests/migration_test.py`, `python3 tests/helper_test.py`, `npm run typecheck`, and the official Sites build are release checks. Browser verification script `scripts/verify-cloud-browser.mts` uses isolated installed Chrome contexts and a synthetic cloud API backed by the actual snapshot store; a phone viewport is not a physical iPhone. `scripts/verify-todoist-live.mts` exercised real Todoist writes only in newly created QA projects and verified cleanup. Original Todoist synchronization observed one temporary task during the test; its normal deletion tombstone and archived project remain as audit history, with no active QA task or XP change. Never purge real history to make counts look unchanged.

The original private Site remains authoritative and writable now. After Microsoft authorization and a verified rehearsal restore: activate `PLANNER_READ_ONLY=1` on that Site, wait for in-flight work to finish, take and verify final cloud and independent Mac recovery copies, import the final archive into OneDrive, compare all record IDs/relationships/XP/history, reconnect providers, then resume outbound synchronization. The flag blocks legacy planner/game writes, provider synchronization and reminder delivery, while keeping original records and recovery downloads. Do not activate it while cloud setup is incomplete. Restore pauses provider synchronization until reconciliation succeeds. Existing career data is preserved opaquely; this release adds no game mechanics.

Subject deletion controls are intentionally unavailable because Todoist section deletion also deletes its tasks. Subject/part creation, renaming, movement and task membership are implemented; a future removal flow must preview and safely preserve/move affected records before any destructive provider operation.
