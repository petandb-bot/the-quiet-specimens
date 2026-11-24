# WorldDocument

`src/reborn/world/document.ts` defines the versioned world data used by World Composer. A document carries identity, dates, normalized land settings, placed forms with their seeds and finishes, place roles and links, resident genomes and habitat anchors, and image adjustments. B4.2 adds an environment record with a style, a world seed, six layer recipes, and the selected surface, atmosphere and lighting values. The original schema and generator versions remain readable.

Three.js meshes and materials belong to the renderer. The document holds data that can reconstruct them. The simulation keeps current positions, social responses, and recent visits in separate runtime state. A document edit that only changes objects or places updates the environment of the existing residents in place.

Generated landmarks carry stable layout IDs. Changing terrain updates height and collision. Structures are generated in their own layer. Moved, edited and linked landmarks are retained, and removed landmarks stay suppressed. Only blocked residents need to relocate when the environment changes.

`isWorldDocument` checks the version, roles, links, IDs, numeric bounds, counts, and resident genome data. Undo and redo keep up to 48 versions in memory. History entries share unchanged records and hold image settings separately from loaded image pixels.

The local working draft stores a current document and an optional photo in a dedicated IndexedDB store. It validates the document on read, fills in Elsewhere settings for older documents and creates a new history baseline after recovery. The stored photo stays attached to the working draft.

[World Composer](WORLD_COMPOSER.md) · [World Archive](WORLD_ARCHIVE.md)
