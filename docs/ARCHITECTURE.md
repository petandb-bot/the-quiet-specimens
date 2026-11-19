# Architecture

Vite serves a TypeScript application with Three.js and Web Audio. The app runs on a static host, with a relative base for subdirectory deployment. There is no application service, and the fonts ship with the project.

| Module | Responsibility |
| --- | --- |
| `src/core` | Shared record shapes, registries, bounds helpers, and seeded randomness |
| `src/genesis` | Local image analysis, deterministic generation, genome normalization, and mutation |
| `src/morphology` | Body-plan registry, materials, parametric surfaces, membranes, and organ geometry |
| `src/behavior` | Per-individual action state, kinematics, and reaction cooldown |
| `src/renderer` | WebGL chamber, camera and controls, vessel lighting, model lifetime, and thumbnails |
| `src/audio` | Voice registry, synthesis graphs, AudioContext scheduling, and shared output |
| `src/archive` | IndexedDB transactions, record validation, migration, and JSON exchange |
| `src/presets` | Curated reference definitions |
| `src/app` and `src/ui` | Composition, control handlers, and responsive presentation |

The application owns the subject being observed. It passes the genome to independent render and audio components. The renderer observes the swim state and publishes only action transitions to the application, which supplies action identifiers to the audio engine. The latter schedules against AudioContext time and does not import Three.js. The position and pose remain ephemeral.

A swim instance owns its position, momentum, target, and gesture phase. The renderer fits that state to a view-specific chamber. A future habitat can own multiple swim instances and supply real tank-space limits and targets. The voice cap applies to the current scheduler. A future tank can arbitrate multiple schedules before granting voices.

Images are decoded transiently, fit into a 64×64 raster, read once, and released. IndexedDB writes commit before the archive UI reports success. JSON import validates the data version, identifiers, enums, scalar fields, and embedded thumbnail type. Imported records preserve lineage data and cannot trigger external thumbnail requests.
