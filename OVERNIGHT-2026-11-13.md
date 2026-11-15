# Overnight development — 13 November 2026, Asia/Shanghai

Work is authorised for this night only and must stop by 07:00. Continue from the
current source and published release; preserve the existing Site and database.

## 2.1.1 — player presentation

- Added neutral key/fill/rim lighting and locally generated studio reflections
  that follow Night Stadium, Classic Career and Training Day.
- Kept the existing photo textures and human-v1 models. Reduced exaggerated skin
  and kit surface detail, improved fabric/boots/eye response, and reused cloned
  materials instead of recreating the player for every appearance adjustment.
- Fixed the reduced-motion bind pose: the player holds a relaxed rigged idle
  stance. Idle and achievement clips pause while hidden; confirmed reward events
  remain the only trigger for achievement reactions.
- Added height/viewport-aware framing, safe zoom buttons, reset and portrait/full
  views, plus a local pause control with English and Chinese labels. Camera
  controls have 44-pixel targets on phones and no longer cover the boots.
- Deferred 3D loading until the preview approaches the viewport. Phones use the
  existing lighter model, lower resolution reflections, no shadow passes, and a
  demand render loop capped by a 30 Hz clock while animated. Hidden/reduced-motion
  previews render only on changes.
- Allowed vertical phone scrolling over the player; zoom buttons remain available
  without intercepting the page's wheel/vertical pan gestures.

Verification: 59 automated tests passed, including camera projection at 150/180/205
cm over tall/narrow/wide views, zoom bounds, a real Three.js animation-mixer pause
fixture, and render policy. Type checks and all three migration tests passed.
The official Sites production build runs through the release workflow.

Visual checks used a separate local mock account: all three themes, EN/中文
switching with an appearance draft, light/dark skin, extreme body sliders, desktop
and a 375-pixel phone preview, relaxed reduced-motion pose, portrait/zoom/reset
controls, keyboard page navigation and scrolling over the canvas. Live tasks were
not edited. No database, appearance format, reward rule, model asset, provider
mapping or backup identifier changed.

Limits: browser phone emulation is not a physical iPhone performance measurement;
60/30 FPS targets are not benchmarked. Existing hair and shorts geometry can still
look coarse at extreme body settings. Retain human-v1 assets for old backups.
Physical phone testing and broader running-timer/fallback checks remain useful.

## 2.1.2 — phone planner controls and safer drafts

- Added versioned local task drafts with original field baselines. Reopening a
  draft incorporates unrelated saved changes, preserves user edits and requires
  explicit review of overlapping edits. Legacy drafts require review rather than
  silently overwriting newer content. Completion, rewards and provider IDs are
  never restored from draft contents. Part/subject/area choices move together.
- Added saved/draft notices, visible conflict comparisons and save retry feedback.
  Fixed multiline subtask entry so Enter retains the new line while typing.
- Distinguished unsaved changes from saved planner data waiting for connected
  services. Added a readable connection-status panel with refresh/settings links.
- Added task name, pause state and progress to the persistent focus controls;
  labelled the pause/resume/save actions and enlarged phone targets to 44 pixels.
  Focus hints now state the existing 20-active-minute XP threshold accurately.
- Made phone forms a single column, kept save actions visible while scrolling,
  enlarged language/theme/form controls and prevented the page behind a dialog
  from receiving focus or scrolling. All new messages have Chinese translations.

Verification: 65 automated tests passed, including draft reopen/merge/conflict
resolution, grouped part/subject changes, preserved completion/rewards, timer
pause/target rules and saved-versus-provider-sync feedback. Production checks also
include type checks, migration tests and the official Sites build.

Local mock-account UI checks covered desktop and a 375x667 phone preview, all
three themes, English/Chinese switching with an open draft, typed multiline
steps, closing/reopening the draft, saving a disposable test quest, and focus
pause/resume/save across navigation and appearance switches. The paused timer
kept its remaining time, short saved focus time earned no XP, and saving time did
not complete the quest. Sync feedback and sticky form actions were inspected.
The existing reduced-motion preference remained active. No real schoolwork was
changed.

Limits: phone checks used browser emulation, not a physical iPhone keyboard.
Conflict, connection-failure and storage-unavailable paths have logic coverage;
not every failure path was reproduced manually. The local preview retained its
clearly named disposable QA quest when native browser controls stopped responding
at teardown; it is not in the production account. Use the installed Mac helper
interpreter `/opt/homebrew/bin/python3` for release recovery snapshots.

## 2.1.3 — career milestones and optional audio

- Added a career path with level progress, the next equipment reward, exact XP
  distance, ready-to-claim rewards and existing claimed/equipped status. The
  existing 100 XP levels and six equipment tiers are unchanged.
- Coach feedback now follows saved quests or the active/paused focus session and
  keeps a gentle starting point on quiet days. No streak or missed-day penalty
  was introduced.
- Celebrations now follow the specific confirmed reward activation for the user's
  action. Duplicate responses and unrelated preference changes cannot replay a
  reward; undo and re-completion retain the existing reward ledger behaviour.
- Added original, short synthesised selection, completion, focus and level-up
  cues. The existing account sound switch is preserved. Mute, volume and four
  preview buttons use versioned device preferences. Quiet hours, hidden tabs,
  muted/zero volume and disabled sound suppress playback, including previews.
- Audio is created/resumed only after trusted interaction or an explicit preview.
  One context is reused, voices are bounded and released, repeated event IDs are
  suppressed, and unavailable audio leaves the planner usable. No sample download,
  microphone, API key, new dependency or paid asset is involved.

Verification: 71 automated tests passed, including milestone/undo behaviour,
confirmed reward deduplication, the existing 10/5/100 XP rules, quiet-hour
boundaries, mute/volume/visibility gates, no context before interaction, bounded
synthesis gain and voice cleanup. Six server-rendered theme/language markup
checks also passed; quiet hours disabled all four preview buttons. These checks
created no browser or audio context. Type checks and three migration tests passed;
publication also uses the official production build. All new messages have
English and Simplified Chinese wording. Database schema remains version 5.

The new audio and career panels could not receive a full manual browser pass
because native browser controls had stopped responding. No sound was played
through the Mac during overnight quiet hours; auditory balance and physical
phone playback remain unverified. The available 3D fallback remains in place,
but broader manual fallback testing is also still useful. These are verification
limits, not claims of completed physical-device or audible testing.

Implementation reference: [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

## End-of-night follow-up

The three cohesive passes cover player presentation, phone planner controls,
safer drafts, career feedback and optional audio. Stop the overnight schedule
after final publication/record-preservation checks, before 07:00. Further model
geometry polish, physical-phone/keyboard/FPS testing and an audible preview
review belong to a later authorised session. Do not automatically extend work
past this night or change real schoolwork statuses to test rewards.
