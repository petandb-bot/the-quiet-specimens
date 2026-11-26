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

## B4.1.1 Still & Alive

### Published baseline and audio recovery

Development started from `48c9873`, the merged B4.1 and Vite Pages build. GitHub Actions reported a successful Pages deployment. A browser visit to that published app returned HTTP 200 and began producing audio 4.77 seconds after clicking Sound. The AudioContext was running on that visit. The previous score applied a probability gate to its initial note, which explains the delay in this reproduction.

The recovery build produced actual master output in 0.36 seconds. The World Audio build did so in 0.32 seconds. In both runs the audio graph passed through Chromium's real-time AudioContext. Playwright checked zero volume, a return to the prior audio state after Audition, stopping and restarting with one context, and Audio Reset creating a fresh context. Vitest covers a refused start, a user retry, and visibility recovery. Those visibility checks are simulated.

The [stereo WAV](audio/still-and-alive.wav) contains 7.20 seconds of post-master World output captured from the browser at 44.1 kHz. Its absolute peak was 0.0573 and RMS was 0.00436. All captured samples were finite. The scheduler test covers twelve simulated minutes with all nine residents, bounded concurrency and new-entry rates, a capped response to a given encounter, and single-track removal.

### Captures

[Fixed](screenshots/still-and-alive/fixed.jpg) · [Soft Follow](screenshots/still-and-alive/soft-follow.jpg) · [Observatory — Standing forms](screenshots/still-and-alive/observatory-forms.jpg) · [Observatory — Resident paths](screenshots/still-and-alive/observatory-paths.jpg) · [Residents](screenshots/still-and-alive/residents.jpg) · [Atlas](screenshots/still-and-alive/atlas.jpg) · [Sound controls](screenshots/still-and-alive/sound-controls.jpg)

### Production bundle and cameras

A clean `npm ci`, all 56 automated tests, the Vite production build, and `node scripts/check-dist.mjs` passed. The app also booted with its production assets served at the GitHub Pages project subpath. No deployment workflow changes were required.

Chromium 156 on Linux used ANGLE/SwiftShader for WebGL 2. The browser rendered the fixed camera while the resident clock continued to step. A rendered rig check verified an unchanged position, direction, and FOV in the dead zone, a measured reduced-motion speed limit of 0.47 world units per second, a fixed direction when the subject reversed, restoration after Compose, and a return to Fixed when the subject was removed. The desktop pass also exercised static Observatory cuts, the five rendered thumbnails, Atlas and Locate, Inspect and Action, object placement, Undo/Redo, and both photo modes. A separate 390 px touch pass exercised resident selection, Locate, Atlas, and the UI-hidden view.

Chromium's OfflineAudioContext passed all ten renders at 44.1 and 48 kHz. Both World renders included five residents. Their absolute peaks were 0.09830 and 0.09825, with RMS 0.00708. Across all renders the highest peak was 0.23025, and the checks found no non-finite output or DC offset above the defined threshold.

### Continuous watching

A ten-minute browser session ran with the integrated Fixed camera and World Audio before the final small-gesture pass. At 576 × 434, it completed 41,693 indexed draws and detected audible signal in 1,723 audio buffers. Each minute showed new draws and audio signal. The session ended in Fixed with zero context losses or console errors, finite audio samples, and a measured peak of 0.0597. This is an end-to-end observation test with software rendering. GPU memory use was not profiled.

### Device and release notes

Chromium software WebGL and browser audio graph capture establish the tested rendering and output paths. Physical-GPU performance, Safari and Edge on their target devices, device output levels, and motion comfort for individual viewers need device testing. The release build for B4.1.1 is prepared for review. The published site still runs the existing main build.

## B4.1.2 Playful Composer

Development started from latest main `6f9f8f4` (Quiet Observation UI). Clean install, all 59 Vitest checks, the TypeScript/Vite production build and `node scripts/check-dist.mjs` passed. The new checks cover repeatable stamps, placement and count bounds, validation and history recovery, and independently bounded Make cameras. Existing contact, obstacle, resident behavior, sound and photo tests continue to run.

### Chromium and production assets

The production build was served at `/the-quiet-specimens/`. Playwright drove Chromium 156.0.8078.79 on Linux with WebGL 2 through ANGLE/SwiftShader.

- At 1280 × 820, a palette choice armed Place. Two clicks produced two objects with distinct identities and the same seed, scale and rotation. Undo and Redo kept Place armed. Select opened the inspector without placement or movement. Move updated the saved coordinates in one Undo step. Finish, scale, rotation, seed, duplicate and delete all applied to the selected form.
- Space-drag and the mouse wheel moved the Make camera while Place stayed active. Subsequent ray hits matched the expected Plan pan and zoom. The Observatory station survived a round trip through the independent Make camera. Fixed, Landscape, Soft Follow, Atlas, Inspect, Action and Focus also rendered.
- A linked region followed its object reference and an independent region could be moved. Resident membership, home and preferred-area edits survived normal Undo. Rolling Field, Terraces and Hollow Land rendered, and a new terrain seed was applied and undone. The existing tests exercise simulated contact and clear resident placement around obstacles.
- A JPEG rendered as both Backdrop and Atmosphere, and the layout, photo and image mode survived reload. The app created a new Undo baseline. A second same-origin tab wrote a newer draft revision through IndexedDB. The earlier editor reported the conflict and did not overwrite the newer revision. Clearing the photo stayed cleared after reopening. Legacy rendered its WebGL canvas from the production entry. The completed browser passes reported no JavaScript or shader errors.
- The master Web Audio output showed a signal during World playback and Audition. Ending Audition restored the earlier Sound off state. Sound was accessible in both workspaces.
- At 390 × 844 with Chromium touch emulation, taps placed consecutive objects. A two-finger pinch changed the camera with no extra placement. The next tap placed the chosen form, Move dragged an earlier object, and Undo/Redo restored the coordinates. The page stayed within the viewport and Observe closed the editor. A second 320 × 668 touch layout check also placed an object without horizontal overflow.

### Captures

- [Observe](screenshots/playful-composer/observe.jpg)
- [Make with a placement preview](screenshots/playful-composer/make.jpg)
- [Object selection and contextual controls](screenshots/playful-composer/selection.jpg)
- [Quick start](screenshots/playful-composer/quick-start.jpg)
- [Make on a 390 px touch viewport](screenshots/playful-composer/mobile-make.jpg)

The low dock keeps the desktop foreground visible during placement. The preview outline and pale form show the next location before the click. Plan makes the footprint and selected shape easy to read, while Perspective retains the landscape's depth. The touch layout keeps the tools grouped at the bottom and leaves open ground available for taps.

### Scope

The working draft covers scenes and an accepted photo in this browser profile. Undo history, the current camera and live resident activity reset on reload. Selecting, replacing or clearing the photo file saves the new attachment separately from layout Undo. Physical iPhone Safari and Android devices, hardware-GPU performance and long-session storage eviction were outside this pass.

## B4.2 World Playground

The branch starts from main `e3bd32d`, the published Make refinements. The baseline passed a clean install, 61 tests, build and distribution checks. The review branch adds regression cases for schema 1 migration with photo attachment, eight deterministic compositions, footprint separation, six independent layers, lock behavior through a style change, edited and linked structure retention, Undo/Redo, object limits, explicit Place priority and resident activity time.

### Real WebGL views

Chromium 156 and ANGLE/SwiftShader rendered these standard-seed worlds through the production bundle. The images were captured at 960 × 640 in the observation view with the controls hidden. Small copies of the same captures supply the Generate preview.

| World style | Capture |
| --- | --- |
| Elsewhere | [Elsewhere](screenshots/world-playground/styles/elsewhere.jpg) |
| Pale Colony | [Pale Colony](screenshots/world-playground/styles/pale-colony.jpg) |
| Oxide Field | [Oxide Field](screenshots/world-playground/styles/oxide-field.jpg) |
| Shallow Memory | [Shallow Memory](screenshots/world-playground/styles/shallow-memory.jpg) |
| Uncertain Garden | [Uncertain Garden](screenshots/world-playground/styles/uncertain-garden.jpg) |
| Black Mineral | [Black Mineral](screenshots/world-playground/styles/black-mineral.jpg) |
| Incorrect Paradise | [Incorrect Paradise](screenshots/world-playground/styles/incorrect-paradise.jpg) |
| Abandoned Geometry | [Abandoned Geometry](screenshots/world-playground/styles/abandoned-geometry.jpg) |

Pale Colony and Shallow Memory leave broad clearings. Oxide Field gives its structures a diagonal rhythm. Uncertain Garden places small forms in groups, and Abandoned Geometry gives the vertical structures room to establish scale. Black Mineral keeps the residents legible against darker ground.

### Browser interaction

The production app ran at the GitHub Pages project subpath. The desktop pass placed and directly dragged a model, rotated and resized it, duplicated and deleted it, applied a finish, and mutated it while retaining the finish. It linked a Place and reopened a deliberately old schema 1 IndexedDB record with its real JPEG and linked contents. The desktop generator changed styles, respected terrain and resident locks, retained the JPEG and authored structure through successive rolls, randomized only lighting, and restored style and light edits with Undo/Redo.

For Living Make, a paused region of the canvas remained pixel-identical across renders. Slow and Live changed that region. The fixed-step tests separately verify the 30% and normal clock rates and preserve movement state when obstacles change. The browser detected output on the master audio graph and the same context through Observe, Make and Focus. Reload restored saved locks and style, and Legacy rendered WebGL. There were no JavaScript or shader errors in the completed interactions.

The 390 × 844 touch pass placed by tap, dragged the placed form, pinched without an accidental placement, folded the dock, and changed style without horizontal overflow. The inspector moves above or below the selection on smaller screens so the selected object remains reachable. The displayed screenshots are from the running app.

[Desktop Make](screenshots/world-playground/desktop-make.jpg) · [Mobile Make](screenshots/world-playground/mobile-make.jpg)

On the review branch, `npm ci`, all 68 automated tests, `npm run build` and `node scripts/check-dist.mjs` passed.

### Resource check

At 680 × 560 in Paused Make, Chromium ran four cycles of Abandoned Geometry, a world reroll, Elsewhere, and Reset to Style. The equivalent Elsewhere scenes each held 356 live WebGL buffers, 6 textures, 5 framebuffers, 2 renderbuffers and 7 shader programs. JavaScript heap after forced collection measured 13.18, 13.25, 13.43 and 13.40 MB across the four samples. The test measures resource counts and short-session heap behavior with software rendering. Hardware frame rate and long-session memory still need device measurements.

### Remaining verification and next phase

Physical iPhone Safari, Android devices, sustained rendering on a hardware GPU, and a formal usability study remain pending. The short-session creation goals are design targets. For B4.2.1, test the existing selection, touch gestures and generation on those devices first, then use the current terrain layer and safe placement rules as the basis for terrain brushes and surface paint.

## B4.2.1 Personal Land

Development starts from main at `6653e8e`. The baseline clean install, 68 tests, TypeScript, production build and distribution check passed. The branch incorporates the English README from PR #9. The Personal Land suite adds eight cases covering optional schema 1 fields and working drafts, bounded brush strokes, ray/height/slope and shoreline agreement, locks, family and colony variation, roster replay, scaled contact and bounded WebGL startup. The final clean install, all 76 tests, the production build and `node scripts/check-dist.mjs` passed. The published-entry check covers the garden, Legacy and the audio-check page.

### Production WebGL

Chromium 156.0.8078.79 used ANGLE/SwiftShader and the production project path `/the-quiet-specimens/`. The desktop checks exercised Raise, Lower, Smooth and Flatten, stroke cancellation, material painting and erasing, water placement and clarity, atomic colony Undo/Redo, direct dragging, new resident previews and replacement, Paused / Slow / Live, camera pan and zoom, and terrain, surface and resident locks. The desktop tested the JPEG as Atmosphere and Backdrop and restored it with the scene from IndexedDB after reload. A second tab recovered the authored draft and then rejected its own stale write after the first tab saved again. The photo composite uses the same NASA Rocknest JPEG credited above.

World audio and Audition both produced a signal on the Web Audio output. Ending Audition retained the previous Sound on state. Inspect and Action rendered, and the Legacy project route opened with a live WebGL 2 canvas.

The 390 × 844 Chromium touch run sculpted with a single finger, pinched without saving a second stroke, stamped a Canopy, undid and redid the stamp, and previewed and added a Small VESSEL. It stayed within the viewport. It used emulated touch input.

A separate context-loss pass used Chromium's `WEBGL_lose_context` on a world with authored relief, Glass paint and a pool. The app reported the loss, drew again after restoration and retained the exact draft. Draw calls advanced from 2,056 at loss to 2,482 after restoration, with no reported script or shader errors in that pass.

[Desktop Sculpt](screenshots/personal-land/desktop-sculpt.jpg) · [Mobile Life Generator](screenshots/personal-land/mobile-life-generator.jpg) · [Photo and Personal Land](screenshots/personal-land/photo-and-personal-land.jpg)

### Rendered worlds

These are production WebGL captures from worlds assembled through Make. The studies use different authored details, densities, lighting and camera positions.

| Study | Composition | Capture |
| --- | --- | --- |
| Expanse | Two Small residents move through a pale clearing with a few widely spaced structures. | [Expanse](screenshots/personal-land/01-expanse.jpg) |
| Basin | Hollow Land with a quiet pool, muted water and a mineral shell near its edge. | [Basin](screenshots/personal-land/02-basin.jpg) |
| Mineral surfaces | A band of painted glass, mineral and oxide follows the low ground between terraced ridges. | [Mineral surfaces](screenshots/personal-land/03-mineral-surfaces.jpg) |
| Thicket | Branching shades and irregular understory leave openings for the residents. | [Thicket](screenshots/personal-land/04-thicket.jpg) |
| Different times | Small and Large residents share an open territory. Soft Follow frames the Large VESSEL. | [Different times](screenshots/personal-land/05-different-times.jpg) |
| Chalk garden | An open ring of architectural fragments in white chalk. | [Chalk garden](screenshots/personal-land/06-chalk-garden.jpg) |
| Dark membranes | Translucent forms cluster against mineral ground and narrow terraces. | [Dark membranes](screenshots/personal-land/07-dark-membranes.jpg) |
| Personal Elsewhere | The original roster and landmarks share the terrain with local relief, Dust, a pool and a Hollow. | [Personal Elsewhere](screenshots/personal-land/08-elsewhere-edited.jpg) |

The sparse composition keeps the two Small residents readable with generous negative space. The canopy stand gains depth from overlapping branches and cast shadows. The painted mineral band follows the slope and stays soft at its edges. Light water has low contrast on the palest profiles. Darker water or a higher viewpoint makes the shoreline easier to read. On narrow viewports, **Hide tools** makes the foreground reachable while keeping the current brush active.

### Short-session resource measurements

At 720 × 560 in Paused Make, three cycles each changed the world style, rerolled the world, scattered a procedural family, sculpted, painted and added a Large RELAY. Each operation was undone to the same Elsewhere layout before measuring. Live WebGL allocations were counted from matching create/delete calls. JavaScript heap was sampled after requesting a collection.

| Sample | GL buffers | Textures | Framebuffers | Renderbuffers | Programs | JS heap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 358 | 6 | 5 | 2 | 14 | 13.45 MB |
| Cycle 1 | 348 | 6 | 5 | 2 | 10 | 14.34 MB |
| Cycle 2 | 348 | 6 | 5 | 2 | 10 | 14.58 MB |
| Cycle 3 | 348 | 6 | 5 | 2 | 10 | 14.72 MB |

The GL counts stabilized across all three repeated cycles. The heap rose by 1.27 MB from baseline and by 0.38 MB across the three post-cycle samples. This short run leaves steady-state memory under longer play open. Twelve unthrottled animation-frame intervals had a median of 1.33 s and a 90th percentile of 2.83 s. SwiftShader and the concurrent browser checks shared two vCPUs during the timing sample.

### Verification limits

Physical iPhone Safari, Android and hardware-GPU throughput remain unverified. No formal usability study was conducted. The gallery documents possible outcomes and the checks exercise specific creation flows.
