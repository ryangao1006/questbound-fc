# Dorm discovery, interaction and return flow

Room objects now have real 3D hit areas and accessible DOM markers: wardrobe, mirror, desk and trophy cabinet. Hover/focus labels describe each action; an Object labels toggle shows them together. Marker projection updates outside React's state loop and keeps tooltip panels inside the viewport. The same actions have keyboard/touch-friendly shortcuts and buttons on the low-power map. No bed action is implied.

Interactions use panels inside the existing dorm dialog. The room runtime, camera and Canvas stay mounted when visiting a panel, with room rendering and input paused. Back to dorm or Escape returns to the same place, restoring focus. Appearance drafts stay mounted between visits, Save uses the existing settings command, and leaving with an unsaved appearance offers keep-editing or explicit discard. Only the active appearance preview renders; inactive previews release their Canvas while retaining editor state. The shared preview's IntersectionObserver now rejects zero-size hidden elements.

The task desk reuses the existing full task form inline, including on phones, with existing draft storage, field baselines, conflict checks and planner commands. It supports search, add, full editing, completion and focus; it does not create a separate task database or sync path. Task drafts survive returning to the room. Saved task status and provider queue state remain distinct.

Further usability work adds a touch-friendly Jog toggle, camera reset, pointer-ID isolation/cancellation, actual saved milestone history in the collection panel, and a WebGL capability check before Canvas mounting. Without WebGL the usable map, movement, shortcuts and desk remain available without throwing a renderer error. All scene props remain code-authored original assets. No schema, account, source-of-truth, reward or simulation-version change.

Verification:
- 300 automated tests and four migration tests pass; typecheck and protected production build run for release.
- Twelve isolated browser cases: three themes × English/Chinese ×1440/390px, with no production data writes. Labels, each interaction, preserved position, appearance/task drafts, settings save, full task edit/save, Escape, unsaved-appearance guard, jog toggle and inert cleanup pass.
- Direct mouse hover/click on the wardrobe's 3D surface opens its panel; returning preserves the same room Canvas. A hidden 3D room and inactive preview produce zero draw calls in the checked task-desk sample.
- Display switches retain the appearance draft. Normal/reduced-motion control checks pass. Emulated real touch input moves the joystick with jogging enabled and stops after touch cancellation. These are browser/device-emulation checks, not a physical-phone performance certification.
- Forced unavailable WebGL enters the map without page errors; movement, desk interaction, return and exit pass.
- Screenshots of desktop labels and phone controls inspected. Rendering/art quality and ten-minute sustained FPS/memory/thermal gates remain unfinished; this does not claim a new character sculpt, full foot planting or the complete match-art upgrade.

Planner, XP, provider mappings, calendar, reminders, backup formats and existing saves remain on the existing private Site. No real schoolwork statuses were changed for verification.
