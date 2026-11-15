# Development — comic character sample (`comic-human-v1`)

PLAN stage ③ opens with a new comic character sample. This tranche delivers it as a **versioned rendering profile plus an original character sheet**, not a new sculpt: the published `human-v1` / `human-v2` GLBs, rigs and clips are untouched, and `comic-human-v1` never replaces them.

## What shipped

### 1. Versioned profile and LOD table — `lib/comic-character.ts`

`COMIC_HUMAN_V1` records the asset identity (`id`, `version`), the geometry source (`human-v2`) with its published hashes, the shading profile, licence, provenance and `immutableAfterPublication`. `characterLod(surface)` resolves four surfaces to a concrete rendering tier:

| Surface | GLB | Kit atlas | Comics shading | Kit detail | Shadows | DPR |
|---|---|---|---|---|---|---|
| `presentation` (customiser, onboarding) | `player.glb` | 1024 px | yes | yes | yes | 1–1.75 |
| `dorm` | `player-mobile.glb` | 512 px | yes | yes | no | 1–1.35 |
| `match` / practice | `player-match.glb` | 512 px | yes | no | no | 1 |
| `phone` | `player-mobile.glb` | 512 px | yes | yes | no | 1–1.25 |

The resolver returns a copy, so callers cannot mutate the shared table.

### 2. Second-generation cel profile — `lib/comic-material.ts`

The material profile is now `qfc-comic-v2`: four luma bands quantised separately into a cool shadow ramp and a warm highlight ramp, mixed 62% into the lit colour. Geometry, UVs, kit textures and morphs are untouched; only the final colour is banded. `comic-presentation.ts` reports `comic-v2` while the device toggle keeps storing the existing `comic-v1` value so saved devices are not reset.

### 3. Kit detailing — `makeKitTexture(..., detail)`

When comic shading is active, the kit canvas gains raglan sleeve seams, side seams and a hem band drawn strictly inside the documented UV panels (U .04–.46 / .54–.96). This is the visible "new kit cut" in close-up, cards, dorm and matches; the plain path is unchanged for non-comic rendering.

### 4. Original character sheet — `components/comic-sample.tsx`

The Appearance tab gains **Show comic character sample**, which renders four deterministic SVG views built from the draft avatar: close-up, running, kicking and phone. Skin tone, hair style, hair colour, kit colours and number all come from the live draft, so the sheet updates before anything is saved. The phone view is drawn inside a 390 px frame and the sheet reflows to two columns on a phone viewport.

`public/assets/comic-human-v1/sample-sheet.svg` is the frozen poster version of the same character, with `manifest.json` (LOD table, geometry hashes, provenance, licence) and `LICENSES.json`. All three files are hash-frozen in `.openai/asset-contract.json`, so any later edit fails `npm run prebuild` until a new asset version is added.

## Evidence

- `npm run typecheck` — clean.
- `npm test` — 317 tests pass, including five new ones in `tests/comic-character.test.ts`: the profile reuses published human-v2 hashes; every surface resolves to a published LOD with its own kit budget; the manifest and asset-contract hashes match the shipped files byte for byte; the cel profile is a rendering change only (roughness/metalness/maps rewritten, cache key `qfc-comic-v2`); the four sample views stay in order.
- `npm run prebuild` — release identity, append-only migrations, engine contract and the new asset freeze all pass.
- Browser QA (synthetic local owner): the sheet renders four views with `data-character-profile="comic-human-v1"`, `data-geometry="human-v2"` and the presentation/phone LOD attributes; switching the skin swatch changes the face fill (`#bb825b` → `#c99470`) while nothing is saved; a 390 px viewport reflows to two columns with no horizontal overflow; no page errors.

## Not claimed

- No new sculpted face, hair mesh, skin weights, skeleton or animation clip. The plan's "new face, eyes, hair silhouette and athlete proportions" remain a Blender authoring task that must land as a separate asset directory, contract entry and test.
- The sheet is original 2D character art; it is not a render of in-engine frames, and it is not a likeness of any real player.
- Physical-phone frame rate and in-engine close-up evaluation are unverified; the match renderer still uses the trimmed 7.5k-vertex model.
- No XP, credits, inventory, saved appearance or production record changes: the sample is a preview and stays unsaved until the existing Save appearance action runs.
