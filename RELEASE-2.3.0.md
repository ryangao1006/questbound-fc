# Questbound FC 2.3.0 — retro career interface and foldable tasks

Implemented the user's new FIFA-reference interface and compact, expandable task-row request. The paused overnight automation was not restarted.

## Shipped changes

- Original angular football career UI: blue/purple/teal Night Stadium, numbered horizontal menu, poster-style player, objectives, training, fixtures and coach tiles. Light themes retain their saved identities and palettes. Header, forms, calendar, tables and dialogs inherit the same panel treatment.
- Original versioned SVG background, authored in the project. It uses geometric graphics and no game logos, licensed club assets or purchased artwork. Player models and their versioned asset contract are unchanged.
- Task list rows show only title, dates, priority flag/rim and disclosure control while closed. Open rows reveal notes, part/subject, checklist, estimate, source links, reminder/deadline details, priority choice, and edit/focus/complete controls. P1–P4 match Todoist's convention.
- Native Enter/Space operation, expand/collapse-all, expansion preserved through language/theme/view changes within the journal, and closed bodies omitted from rendering. Fresh visits start closed. Task list preference retains the existing internal cards ID; Board, Agenda and Subjects remain available.
- Main quests on the Hub also use foldable rows. Priority/checklist controls use the existing operation-ID, revision and field-baseline command path. Folding does not invoke a data command or award XP.
- Shared English/Simplified Chinese strings, date and priority labels, narrow-phone layouts, and reduced-motion support.

## Verification

- TypeScript and 83 automated tests, including priority numbering/fallbacks, summary date separation, and priority/checklist edits preserving classification, history, deadlines and rewards; 3 SQLite migration preservation tests.
- Browser preview exercised at 1200 CSS px for the desktop layout and 390 CSS px for phone layout (the preview's display scale was accounted for). No horizontal overflow. Checked all three themes in English and Chinese at phone width, native Enter/Space, expand/collapse-all, priority change, checklist save/undo, and one expanded row surviving display changes. Closed rows expose no hidden priority controls.
- A short local-only focus session stayed active through Task list/Board/Agenda switches and task editing/language changes. The draft survived and the session saved. No real schoolwork statuses were changed. Browser QA uses the isolated local mock account.
- Preview player canvas loaded with no reported browser errors. No new 3D assets or performance claims are introduced.
- Schema stays 5. No SQL migration, provider adapter, synchronization mapping rule, reward formula, external sharing or credential changed.
- Verified pre-update recovery archive in cloud storage and independent Mac copy: snapshot `867418ee-7071-485e-b6d6-bdbe40a550d5`, SHA-256 `8043043153218c9f4b9ed7a251deb939274536519709db758d9e68bdb73e4621`. This is not a claim of direct OneDrive cloud upload verification.

Publish through the official Sites build to the same private Site/database. Require a successful native deployment status and compare the owner's saved business collections with the before-release read before handoff. Real Todoist changes are not created for UI testing; the existing provider regression suite covers the unchanged synchronization implementation.
