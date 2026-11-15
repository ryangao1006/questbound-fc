# All-day calendar editing

Adds an English/Chinese all-day switch, inclusive first/last day controls, direct creation from the day/week all-day lane, and multi-day month rendering. Timed task windows remain timed. All-day blocks do not generate misleading timed-start reminders.

DATE imports now map civil dates to Asia/Shanghai midnight independently of the server/browser host timezone. The existing iCloud writer uses shared tested date serialization and removes obsolete VALUE/TZID/DURATION properties when converting between all-day and timed events. The provider retains its ETag conflict checks, persistent outbox, verified remote deletion and existing recurrence identity handling. Local recurring occurrence overrides retain their own all-day state.

Verification: all 295 automated tests and four migration tests pass; typecheck passes. New cases cover three host timezones, exclusive DTEND, default one-day duration, DATE/timed conversion, recurring exceptions, remote edit/deletion reconciliation, pending-write protection and local create/edit/delete queues. Isolated browser tests pass 12 combinations of three themes, English/Chinese and 1440/390px layouts: create a three-day event, reopen it and convert to timed. No production task statuses or credentials are changed by these fixtures.

Live Apple Calendar round-trip verification is recorded separately only when actually observed. No database table/schema migration or source-of-truth change is introduced. Existing career and presentation work remains preserved; new comic character geometry, full match-art upgrade and physical-phone performance remain unfinished.
