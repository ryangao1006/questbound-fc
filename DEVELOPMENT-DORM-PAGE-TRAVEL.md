# Dorm to complete pages, with return navigation

Supersedes the previous in-dialog appearance/task/collection panels. Interactive objects now navigate to the existing full application screens: wardrobe/mirror → Career Appearance, desk → Quests, trophy cabinet → Career History. The duplicate room desk component is removed. The normal page navigation, tools and full editors remain available. A return bar retains the dorm origin; on phones it sits above bottom navigation without pushing the first task downward.

Room travel captures position, facing, yaw/pitch, distance, map/3D choice, labels and source object in account-scoped in-memory navigation context. Return opens the dorm with those values and no held input, then consumes the return context. The renderer starts at the restored camera. This context lasts through in-app navigation; it is not a new persisted residence/save format. Returning from Quests closes the detail editor so it cannot reopen over the dorm; the existing task draft store preserves its unsaved values.

Source departure fades/slides for180ms, the complete destination page enters for220ms, and the returning dorm uses a220ms entrance. These transitions do not wait for provider sync or save responses. Saved/device reduced motion removes movement and the departure delay. Scaling the room container caused canvas size-measurement drift in browser verification, so room transitions deliberately use opacity and translation only.

Appearance preview drafts now use the existing account-scoped local draft storage, including baseline and validated appearance values. They survive returning, reopening and reload, without changing authoritative appearance until Save. Cancel discards the local preview; concurrent saved changes still trigger the existing conflict UI. The original settings command, planner task commands, XP/rewards, provider mappings, data bindings and private audience are retained. No SQL/data schema migration.

Verification:
-303 automated tests pass; four migration tests pass; typecheck and protected official build run for release.
-Twelve isolated browser combinations: three themes × English/Chinese ×1440/390px. Each checks actual full-page navigation (not a dorm subpanel), return, preserved map position, unsaved appearance/task drafts, full edit/save, return from History and no XP/task completion changes. One combination explicitly checks device reduced motion.
-A separate3D test moves the player and changes camera yaw/pitch/distance, verifies the page entrance animation, and compares projected room-marker positions after returning (within2px). It also reloads the full site and verifies the appearance preview remains available.
-Desktop appearance and phone task screenshots inspected. No real schoolwork or provider records changed during fixtures. Physical-phone and sustained frame/memory tests, new comic geometry and full match-art gates remain outstanding.
