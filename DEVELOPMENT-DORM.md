# Free team dormitory — first playable room

Adds a lazy-loaded room from Career → My dormitory. Original procedural floor, cutaway walls and furniture share the saved versioned player renderer. Uses a capped, normalised movement step, axis-separated collision, proximity interactions, keyboard and pointer-capture direction controls; blur, hidden pages and cancellation clear held inputs. Room Canvas renders on demand at capped pixel ratio; other decorative canvases are suspended while open. Accessible low-power floor plan uses the same movement and collision model. The modal is portalled outside the inert background.

Wardrobe/mirror open the existing appearance editor; desk opens tasks; cabinet reads saved career totals and season awards. Exit and return-to-doorway remain available without walking. No account records, rewards, appearance versions or planner schema are changed. Room position deliberately resets at entry; no housing purchase or furniture save is claimed.

Verified: collision/boundaries, diagonal speed, long-frame cap and proximity unit tests. Isolated browser fixture passes keyboard movement, map mode, 390×844 direction-target size and exit with zero page errors. Existing automatic suite, migration checks, typecheck and protected production build required before publication.

Remaining: residence purchase and versioned ownership; durable layout drafts, inventory-backed placement, obstruction/escape validation and independent restore gates; more furnishings/room types, sit/interact animation blending and foot planting; physical phone/Mac sustained frame-time profiling, close-up room-player visual review and all-theme/all-language room interaction QA. The room uses the existing animation/model assets; this is not human-v3 or full housing completion.
