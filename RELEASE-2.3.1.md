# Questbound FC 2.3.1 — full task editing

Implemented the user's clarification that editing must expose the specific task information, while preserving the foldable overview.

- A pencil button opens the full editor directly from every folded row in Task list, Board, Agenda and Hub. E on the focused row provides the keyboard equivalent. Expanded rows explicitly offer Edit all details.
- The full editor includes title, part/subject, work date, confirmed deadline and time, estimate, P1–P4 priority, notes, checklist, main-quest status, reminders, import review and source links. All changes save together. Existing completion, record IDs and provider mappings are protected.
- Source links can be added, renamed, edited or removed. The existing draft whitelist now includes this existing data field, with conflict review and compatibility for old or malformed drafts. Source references are preserved by the unchanged Todoist inbound reconciliation.
- English/Chinese labels, mobile controls and stable notes accessibility labels. The visible notes limit matches the existing 10,000-character server limit.

Validation: TypeScript, 86 automated tests and 3 SQLite migration tests. New tests cover a complete multi-field edit while retaining completion/rewards/provider identity, source draft reopen/conflict/rebase, and older/malformed draft preservation. Local browser QA saved and reloaded title, classification, dates, estimate, priority, notes, steps, source reference and reminder settings; verified direct pencil and E entry, Chinese display, and a 390 px phone layout without horizontal overflow. UI test records belong to the local mock account. Preview images are delivered separately in the chat outputs.

App version 2.3.1; data schema remains 5. No SQL migration, provider credentials, sharing or reward rule changed. Verified pre-update cloud recovery archive and independent Mac copy: snapshot `ceeea556-450c-4513-b01e-de4ca6288d91`, checksum `38c005faa8c0ab488769aa7a40051c6e5d4d3636fd699818ef06a3d8191c6d2d`. No direct OneDrive upload claim is made.

Publication uses the official Sites workflow and the same private Site, DB and BUCKET. Require successful deployment and compare the owner's business records with the pre-release read before final handoff.
