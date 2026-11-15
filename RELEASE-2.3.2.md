# Questbound FC 2.3.2 — Todoist field round trips

Title, part/subject, planned work day, confirmed deadline date, P1–P4 priority and task notes use the existing durable two-way task mapping. Live disposable tasks were used to verify all fields through the full editor and the connected Todoist account, without completing any tasks or altering real schoolwork.

Fixed date handling shared by sync, import and import preview:

- Fixed-time Todoist due timestamps are converted to the planner's timezone before selecting the work day. Floating times retain their written day.
- Moving a timed task retains its wall-clock time, seconds, timezone and recurrence metadata, including across daylight-saving offset changes.
- Todoist deadlines contain a date only. Same-day echoes retain the site's selected deadline time. A changed remote deadline day uses 23:59 in the account's timezone. Pending local deadline edits compare against the acknowledged baseline so an unchanged remote date does not create a false conflict.
- Full editor explains the deadline-time boundary; completed the Chinese time/month-navigation labels.

Validation before publication: TypeScript, 93 automated tests and 3 populated SQLite migration tests. Added regressions for the full editor's combined field patch, inbound field changes, all priority values, explicit clears, midnight timezone boundaries, timed rescheduling, custom deadline echoes and genuine versus false conflicts. Existing source links, checklist, estimates, recurrence and reward behavior remain covered.

App 2.3.2; schema remains 5, with the same private Site, DB and BUCKET. Verified pre-update cloud archive and independent Mac recovery copy: snapshot 5c10c75b-4f09-47f4-8fc4-0842d2a89130, checksum d9bac731674ecf84d89deefc75e6f351b4ee5bb838a431b4635a91259bf37611. No direct OneDrive upload claim is made.

Complete post-release live verification and QA-project cleanup before final handoff. Temporary QA records never award XP. The overnight automation remains paused.
