# World Generator

In **Make → Generate**, choose a world style from the list. The preview shows that style at its standard seed. **Randomize world** generates a new world seed. **Reset to style** restores the selected style's standard seed and settings for the unlocked layers. The current edit camera stays where you left it.

Open **Layers** to randomize Terrain, Surface, Structures, Atmosphere, Lighting or Residents individually. Check **Lock** to hold a layer's settings and contents during a style change or world randomization. A single-layer reroll uses a fresh seed for that layer and keeps the displayed World Seed. **Advanced → World seed → Generate** repeats the whole recipe with that seed. Exact reproduction also depends on the selected style, locks, retained objects, and any structure-density override. A seed does not encode the user's editing history.

Manually placed and edited objects and structures linked to a Place are retained. The generator keeps any prior removals and respects the object limit. A world roll can change the roster if Residents is unlocked. Changing the terrain can move a resident out of a blocked position; it keeps the saved Genome and habitat settings. **Undo** restores the document before any one generation, lock change, or settings edit.

Use **Land** for direct land settings and **Atmosphere** for surface colors, light, sky, fog and the local photo. These controls edit the current scene explicitly. Locks govern the generator. Layer settings are included in the same local working draft as objects, places and photo data.

[World Styles](WORLD_STYLES.md) · [Make controls](WORLD_COMPOSER.md)
