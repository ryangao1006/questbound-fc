# Questbound FC 2.2.0 — matchday desk

This release implements the user's new task-view, task-entry, click-sound and animation request after the overnight automation was paused. It does not restart that automation.

## Completed

- Four views over existing task records: Cards, Planning Board, Agenda and Subjects. The board partitions main/dated/unscheduled work without inventing completion or a doing state. Agenda keeps confirmed deadlines separate from work dates.
- Search titles, notes and steps; exact-ID subject filters; part filters; work-date/priority/deadline/estimate/newest sorting; quick filters. View and sort choices persist on the current device.
- Wide task composer with a live summary, prominent classification and briefing, inline subject/part creation through existing idempotent commands, quick work dates and durations, and a bilingual Monday-start date picker. Separate deadline day/time controls explicitly default date-only deadlines to 23:59.
- Existing draft persistence, concurrent-edit comparison, changed-field saves and retry remain in use. Unsaved new quests can be resumed or deliberately replaced. Command/Control+Enter saves; journal N opens a quest and / focuses search. Picker Escape returns to the editor, and arrow keys move among dates.
- Original, brief two-layer tactile clicks for enabled buttons, menus and calendar selections. Soft/Crisp/Minimal styles use device-local preferences. No hover or typing sounds. Muting, volume, quiet hours, trusted interaction and hidden-page policy remain enforced; clicks do not interrupt a committed achievement cue.
- Small card/view/dialog transitions, selection and press feedback, with both saved and system reduced-motion support. The phone toolbar folds additional filters away; controls and the persistent focus bar remain available.
- Shared English/Simplified Chinese copy and colours across all three existing themes.

## Preservation and verification

- App version 2.2.0; data schema remains 5. No SQL, provider adapter, reward rule, database identity, encrypted backup format or player asset changed.
- TypeScript check; 80 automated tests, including task partitions, distinct same-name subject IDs, real-deadline separation, note/step search, nonmutating sorts, Monday/leap-month date grids, click envelope/throttle, reward deduplication, Todoist sync, backups and old-state migration; 3 SQLite migration tests.
- Browser QA on the isolated local test account at 1512×796 and 390×844. Checked new views, inline subject creation, a task save with distinct work/deadline dates, keyboard save, picker arrow/Escape, reload of view preferences, language/theme changes with an edited draft, an active focus session across view/theme/language changes, reduced-motion CSS, quiet-hour-disabled previews, and no horizontal overflow.
- Three themes and both languages were exercised in the preview; real phone hardware and subjective speaker/headphone sound quality were not measured. Audio policy and synthesis were tested with a controlled audio context; preview remained muted during the user's quiet hours.
- No real schoolwork statuses were changed for QA. All UI test tasks/subjects and the short test focus record belong to the local mock account. Live provider round trips were not fabricated; the existing provider regression suite remains the check for this UI-only release.
- Verified pre-update cloud recovery snapshot and independent Mac archive: `2ea6d56a-f044-460c-bf4a-a50d6c52dd4a`, checksum `a4589ce8c4569f2764d8f4215cd50b9f8edd434db43b34ddcb3e97f6fc93ef7f`. This does not assert direct OneDrive cloud upload.

Publication uses the existing owner-private Site and DB/BUCKET bindings. The official Sites build and native deployment status must succeed before handoff. Compare the signed-in owner's saved collections after publication with the before-release read; background service timestamps may move independently.
