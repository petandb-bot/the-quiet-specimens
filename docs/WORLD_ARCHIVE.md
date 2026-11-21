# World Archive · B4.3 design scope

B4.1.2 automatically recovers one [local working draft](WORLD_COMPOSER.md#local-working-draft) per browser and site. It stores the current WorldDocument and optional photo in a dedicated IndexedDB database. The Undo history is held in memory.

B4.3 is planned to add a separate IndexedDB database for world records and image assets. The archive will store stable asset references and validate the document and assets before opening a portable world. A save should include a thumbnail captured from the actual world. The Legacy database continues to store its own specimen records independently.

The planned file format will record its schema and generator versions. Opening a world will reconstruct its layout, residents and habitat settings. Simulation timing and live social state belong to a separate future feature. Camera bookmarks will store a named position, target, field of view and zoom.

[Roadmap](ROADMAP.md)
