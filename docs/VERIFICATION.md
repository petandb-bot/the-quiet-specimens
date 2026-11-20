# Verification

## Automated

Run `npm test` for the Vitest suite. It covers deterministic choices and image-derived seeds, validation and normalization, mutation scope and lineage, 21 reference identities, JSON round-trip and damaged input handling, mesh attributes and indices for all plans over 66 trials plus 64 trials across eight fish forms, action transitions, cooldown, boundary handling, and sound pacing. Run `npm run build` for TypeScript checking and the production bundle.

## Browser

At `/tests/browser-check.html`, run **Run audio checks** to render four voices at 44.1 kHz and 48 kHz through the actual Web Audio graphs. The page also embeds a 390 px-wide view of the app. The embedded viewport is a layout check and does not simulate Safari hardware.

A browser acceptance pass can verify that the first specimen renders, 3D rotation and zoom work, each generation dialog produces a result, Audition returns to the prior sound state, Save survives reload, and exported JSON can be imported. Test actual touch and browser background recovery on a physical iPhone. Repeat the renderer check in macOS Safari and Windows Edge. Sustained frame rates are hardware-dependent. Long-duration playback, context loss recovery on physical GPUs, and full platform coverage have not been certified.

## 1.0.0 release results

- Clean installation, TypeScript, and the Vite production build completed. All 12 Vitest tests passed.
- The hosted capture displayed the opening Ember Veil specimen with lit geometry, fins, and its observation controls. The deployed app and source ZIP responded successfully through Sites. The ZIP matched the checksummed local release package.
- The production audio graphs also passed all eight offline checks at 44.1 kHz and 48 kHz using `node-web-audio-api`. This independently exercised the graph and output guard with four overlapping voices per run. Absolute peaks were 0.02922–0.30091, and all eight DC offsets were below 0.000001.
- Interactive desktop and mobile-width flows could not be completed in the available browser session. The local preview relay timed out and the private deployment required an account sign-in. Physical iPhone Safari validation remains open.
- The production archive module saved, reopened, and deleted a record in an emulated IndexedDB run. Genome, custom name, and favorite data survived reconnection.

## 1.1.0 release results

- TypeScript and the Vite production build passed. All 14 Vitest tests passed, including validation of the new fish forms and compatibility with original references.
- A DOM emulation check exercised all six reference buttons, the selection states, Observe and Inspect controls, legacy generator selection, and the initial archive load.
- The hosted capture shows Vesper Crown and the reference selector. The shared browser reached the private sign-in gate, so physical touch, orbit, and camera transition feel remain unverified.

[Hosted WebGL capture](../public/downloads/specimen-lab.jpg)

## 1.2.0 release checks

The production build and all 17 Vitest tests passed. The tests cover the two new body profiles, reproducibility of earlier references, separation between shoal depths, movement ranges for aquarium residents, preset population changes, and pause and resume.

The Aquarium screen was checked through the hosted WebGL capture. DOM emulation exercised preset switching, the pause control, selecting a resident to open the Laboratory, and archive initialization. The local browser preview relay timed out, so interaction and performance on physical iPhone hardware remain unverified.

[Living Aquarium screenshot](../public/downloads/living-aquarium.jpg)

## Reborn Phase A

The Reborn suite verifies seeds and reference presets, finite geometry after animation, disposal, gesture state order, bounded continuous motion, and capped simulation catch-up. The original suite continues to exercise the aquarium, image-derived genomes, archive, and audio code under the Legacy route.

- All 23 Vitest checks, TypeScript, and the Vite production build passed.
- Reborn controls for reference selection, seed replay, Action, and View were exercised in DOM emulation. An older specimen record was loaded by Legacy using the existing IndexedDB store in emulation.
- The managed browser relay timed out, and Chrome reached the private sign-in gate on the hosted URL. Live input, extended frame timing, iPhone operation, individual close-up captures, and motion recordings were not verified in this environment.
- The host captured the Three.js garden at 1200 × 750. Hinge was airborne, Vessel showed its suspended interior, and Relay showed its linked body. The camera and shadow fill were revised after the first hosted image. [Final WebGL capture](../public/downloads/reborn-artificial-garden.jpg)
- All nine reference sonotypes rendered offline at 44.1 and 48 kHz. The 18 checks produced finite output, with a maximum peak of 0.1186 in the offline Web Audio implementation.

## Elsewhere B1/B2 preview

See [Elsewhere](ELSEWHERE.md). Pure terrain and motion logic smoke-tested using type-stripped JavaScript from the branch. Full npm test/build, GPU rendering, shader compilation, UI interactions and physical mobile tests were not run. Do not treat Phase A verification as verification of Elsewhere.

## Elsewhere B2.1 / B3 review

- On the incoming PR branch, `npm ci`, all 26 existing Vitest checks, and the TypeScript/Vite production build passed. The updated branch passes 37 tests and the production build. The build emits both the Elsewhere and `/legacy/` entry points.
- World checks trace the Three.js ground mesh on both halves of the terrain triangles and compare hit heights with motion queries. The tests cover three land types, 24 additional seeds, obstacle retreat, camera framing and clearance, HINGE and RELAY contact on flat land, slopes and steps, and geometry/material disposal across terrain replacement.
- Photo checks cover portrait and landscape cropping, offsets, the backdrop/atmosphere visibility switch, replacement, clearing while a decode is pending, size limits, Blob URL cleanup, and texture disposal. Image decode and canvas sampling use test doubles for these checks.
- In 620 simulated seconds, all nine reference residents stayed inside the field and displayed exploration and rest. The test captures returns to home, object visits, encounters, follow and imitation, verifies pair cooldown, and checks that spatial memory and recent events stay bounded. Additional tests verify that imitation cannot supply a new source gesture, and that pursuit expires or ends on removal.
- A DOM emulation pass exercised panel switching, focus restoration, Hide/Exit View, reference and seed replay, Action controls, the Legacy link, and the WebGL 2 fallback. The existing audio check rendered four synthesis voices at 44.1 and 48 kHz through an offline Web Audio implementation. All eight checks passed, with absolute peaks from 0.02055 to 0.21761.
- The managed preview relay timed out before opening the branch in Chromium. Actual WebGL shader compilation and photograph compositing, visual review of the layouts and camera transitions, screenshots, GPU and frame timing over a live ten-minute session, interactive audio, and physical iPhone Safari checks remain open. The automated checks above exercise CPU geometry, behavior, and resource lifecycles.

## Elsewhere B2.1 / B3 merge review

The review started from `a18ede9284ba83f91ebeb981b41a6eb40a931c4c` on `elsewhere-expanded-world`. A clean install, all 40 Vitest tests, and the TypeScript/Vite production build passed. Two new camera tests verify that clamped pans preserve the complete camera-to-target vector through repeated pan, turn, and zoom operations, and that landmark clearance translates the entire orbit.

In Landscape, the target stays within the 60×60 activity area and normally within 0.42–14 units above the local ground. Terrain and landmark clearance can raise the whole orbit when needed. With real right-drag pans, left-drag turns, and wheel zoom in Chromium, 96 instrumented frames included 28 horizontal-boundary hits and eight vertical-limit hits. The pan correction changed the camera-to-target vector by less than 4 × 10⁻¹⁵ world units.

### Live WebGL and interaction

Playwright drove Chromium 156.0.8078.79 with WebGL 2 through ANGLE/SwiftShader. The desktop viewport was 1280 × 760. The production build rendered Rolling Field, Terraces, and Hollow Land. Applying and regenerating land kept the resident count. Adding and removing a resident worked, including the fallback from Follow to Landscape when its subject was removed. Landscape, Wander, Follow, Inspect, the Fold gesture in Action, and the View toggle were exercised in the browser.

The browser compiled and linked the GLSL in `src/reborn/photo.ts` and `src/reborn/landscape.ts`. A JPEG loaded as a Backdrop, Atmosphere applied its colors, a different PNG replaced it, and clearing the image restored the regular landscape. The first visual pass showed overlapping hill outlines where the translucent terrain crossed the photo. The final Backdrop uses the closest terrain surface before applying the fade. A second browser pass confirmed that the depth-only draw was active with Backdrop, paused in Atmosphere, and that the two shaders linked without errors after the change. The new capture shows the photographed ground blending into the near terrain without the overlapping hill outlines.

An instrumented browser run with lit specimens checked contact over thirty simulated seconds on Terraces. Across 242 non-hop HINGE samples on sloped ground, the lowest foot probe stayed between 0.048 and 0.171 units above its sampled surface. RELAY node pivots held their ground-relative offsets across 2,765 samples. The VESSEL pod center varied between 1.09 and 1.31 units above the local surface. This measures points on the rendered rigs. It leaves small mesh-level contact differences and hardware-dependent frame pacing for physical-device review.

The full desktop run reached 29,248 draw calls without a WebGL context loss or shader error. Sound and Audition both produced nonzero samples at the browser's master output. Ending Audition restored the prior sound state whether the sound had been on or off. The Legacy link opened `/legacy/` and that page rendered WebGL. At an emulated 390 px touch viewport, the camera and Life controls were usable without horizontal page overflow.

### Captures

All captures are 1280 × 760 browser frames with controls hidden.

| View | Capture |
| --- | --- |
| Landscape / Rolling Field | [Landscape](screenshots/elsewhere-final/landscape.jpg) |
| Terraces | [Terraces](screenshots/elsewhere-final/terraces.jpg) |
| Hollow Land | [Hollow Land](screenshots/elsewhere-final/hollow-land.jpg) |
| Photo Backdrop | [Photo Backdrop](screenshots/elsewhere-final/photo-backdrop.jpg) |
| Follow | [Follow](screenshots/elsewhere-final/follow.jpg) |
| Inspect | [Inspect](screenshots/elsewhere-final/inspect.jpg) |

The photo used for the composite is *Panoramic View From Rocknest Position of Curiosity Mars Rover*, credited to NASA/JPL-Caltech/Malin Space Science Systems. [NASA image record](https://images.nasa.gov/details/PIA16453)

The captures show the open foreground, the scale difference between residents and landmarks, and the distant structures fading into the sky. Terraces keeps visible breaks in relief, Hollow Land places a larger silhouette in the foreground, and Follow frames nearby life as well as the selected resident. Lighting and material colors were reviewed in these views and in the Inspect close-up.

### Continuous integration

The [Build and test workflow](../.github/workflows/ci.yml) runs `npm ci`, `npm test`, and `npm run build` on pull requests and on pushes to `main`. All three commands passed on the application and workflow revision. [GitHub Actions run](https://github.com/petandb-bot/the-quiet-specimens/actions/runs/44686836842)

### Remaining verification

Physical iPhone Safari, hardware-GPU performance, extended live-session GPU memory, and recovery from forced WebGL context loss are still open. The earlier 620-second run covers simulation behavior. This browser pass covers rendering and interaction in Chromium with a software renderer.

## B4.1 Personal Places

The branch starts from the merge of PR #1 at `70d76b8`. A clean install and the baseline 40 checks passed on the merged code. B4.1 passes 44 tests and the production build. The additional checks cover the versioned document, invalid data, bounded history, durable landmark edits through regeneration, object geometry and ground contact, linked and neutral places, localized memory cleanup, and safe placement. The existing 620-second behavior regression continues to pass.

Playwright exercised the production app in Chromium with WebGL 2 through ANGLE/SwiftShader. Desktop used a 1120 × 720 viewport. The test previewed and randomized objects, clicked to place them, dragged a Flora, edited its finish and transform, duplicated and deleted objects, and checked that Undo and Redo restored the coordinates. It created a Shelter linked to a Kinetic form and an independent Quiet region. It also exercised resident placement, relocation, home and preferred area, Follow, both editing cameras, View, and the photo controls. A terrain rebuild retained the authored forms, a moved generated arch, and all six residents. A 390 px touch profile placed an object while the tools were collapsed. A separate pass on the final bundle detected a nonzero Audition signal in Chromium, verified restoration of the prior sound state, and rendered WebGL after navigating to Legacy.

The visual pass moved the two forms into the foreground and midground while retaining open land. In Plan, a thin boundary and location markers help read the field, with clear visibility from above. Perspective and View use the usual atmosphere. The screenshots show real browser frames.

- [Composer](screenshots/personal-places/composer.jpg)
- [Object placement](screenshots/personal-places/objects.jpg)
- [Plan with two places](screenshots/personal-places/plan.jpg)
- [Flora](screenshots/personal-places/flora.jpg)
- [Kinetic](screenshots/personal-places/kinetic.jpg)
- [World with controls hidden](screenshots/personal-places/observed-world.jpg)

This review build covers the session editor. Sculpting, surface regions, style presets, a persistent archive, portable photos, and camera bookmarks belong to B4.2 and B4.3. Physical iPhone Safari, hardware GPU performance, and long-duration GPU resource tests remain open.
