# One football menu, two appearances

The selectable list now contains only Dark / Light (暗色 / 亮色). Both use the same original football-career layout: horizontal game navigation, stadium scenery, rectangular tiles, athletic headings, opaque work surfaces and yellow selection/primary fills with dark labels. Dark uses navy panels and night scenery. Light uses icy silver/blue panels, dark text and new original daylight stadium SVG art. The light header/navigation/footer, career panels, calendars, forms, dialogs and dorm chrome follow the same palette; 3D world colours and intentionally dark player showcases stay legible.

The saved identifiers night-stadium and classic-career remain stable. Legacy training-day reads/updates normalize to classic-career, including archived state, local IndexedDB records, early display cache and older client commands. Unknown identifiers still fail validation. No SQL/schema/version/source-of-truth change or reseeding is introduced. Existing tasks, reminders, XP, active focus, appearance and provider mappings are retained.

Retired Training Day CSS branches were removed. app/fc-themes.css owns the final two palettes and appearance rules. Scene/subject/priority colours remain semantic. Menus and cards expose exactly two options. Both palettes have explicit foreground/surface/selection/error pairs; calendar labels use readable text with category colour retained in borders. Daylight art in assets/menu-v2 is project-original, versioned and hash-protected; no EA imagery, fonts, logos or bought resources are used.

Verification:
-306 automated tests and four migration tests pass; typecheck and the official protected build run for release.
-36 page/menu/dialog cases (two themes × two languages × nine states) pass the bounded computed-text contrast audit on opaque surfaces. Two additional dorm/map contrast cases pass. This is not a universal accessibility audit of image/3D-backed pixels or every possible record/error.
-Four delayed-save desktop/phone language cases switch modes repeatedly during an active focus session and task edit. Draft, timer and rewards remain intact; reload restores the draft, and a second isolated browser reads the saved preference through the fixture API. Legacy cached/server preference renders Light with exactly two choices.
-Eight dorm → full page → return cases pass across both appearances, languages and1440/390px layouts, including draft/edit/save preservation. Original production task states are never changed for QA.
-Actual desktop screenshots for Dark/Light hub/tasks inspected. Physical-phone sustained performance and a complete live cross-device integration test are not newly certified by this visual change.
