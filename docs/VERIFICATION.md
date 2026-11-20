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
