# WorldDocument

`src/reborn/world/document.ts` defines the versioned world data used by Place Composer. A document carries identity, dates, normalized land settings, placed forms with their seeds and finishes, place roles and links, resident genomes and habitat anchors, and image adjustments. The existing land seed is the generator seed. B4.1 uses schema and generator version 1.

Three.js meshes and materials belong to the renderer. The document holds data that can reconstruct them. The simulation keeps current positions, social responses, and recent visits in separate runtime state. A document edit that only changes objects or places updates the environment of the existing residents in place.

Initial landmarks are records with stable layout IDs. Changing the terrain seed regenerates unedited landmarks. Moved or changed landmarks stay where they were edited, and removed landmarks stay suppressed. An intentional terrain rebuild can reset activity positions. Object and place edits apply directly to the current land.

`isWorldDocument` checks the version, roles, links, IDs, numeric bounds, counts, and resident genome data. Undo and redo keep up to 48 versions in memory. History entries share unchanged records and hold image settings separately from loaded image pixels.

[Place Composer](WORLD_COMPOSER.md) · [World Archive](WORLD_ARCHIVE.md)
