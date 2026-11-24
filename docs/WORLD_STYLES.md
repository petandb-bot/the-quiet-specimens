# World Styles

B4.2 combines terrain, structure placement, surface materials, resident starts, light, sky, and fog. The goal is to make compositions recognizable by their shapes and use of space as well as by color.

| Style | Composition | Terrain and atmosphere |
| --- | --- | --- |
| Elsewhere | Original landmarks and horizons at the default seed. Other seeds use a distributed layout. | Rolling ground, sage and clay, warm light. |
| Pale Colony | Sparse, mostly chalk forms at the edge of a wide clearing. | Gentle ground, mineral whites and soft shadows. |
| Oxide Field | An offset axis of structures along a diagonal. | Terraces, iron colors and low warm light. |
| Shallow Memory | Structures around the perimeter of an open center. | Low basin, blue-green ground and softened reflections. |
| Uncertain Garden | Three loose clusters of flora, stones and kinetic forms. | Rolling green relief, mixed materials and patches of open ground. |
| Black Mineral | A bank of structures on one side of an asymmetric field. | Dark terraces, cool ambient fill and a warm key to separate resident silhouettes. |
| Incorrect Paradise | Small and medium shapes distributed across the field. | A muted pink and blue atmosphere and varied sculpture colors. |
| Abandoned Geometry | Two large structures anchor a looser ring of smaller forms. | Broad ground, distant fog and low directional light. |

Structure layouts sample candidates from a seeded composition, then test footprint separation, field bounds and clearance around the central activity area. The generator keeps links and manually edited structures. New candidates clear existing authored footprints. Sparse layouts keep more open ground; clustered styles leave space between their three groups. Resident starts use a separate seed and are projected to safe terrain at runtime. Surface changes update the ground's vertex colors and material in place. They share the photo blend used by Elsewhere.

The canonical Elsewhere recipe reuses the original terrain, landmark layout and residents. An old draft keeps its original terrain, object data, identity, photograph and explicit habitat settings when it gains an Elsewhere environment record. The new layer properties are optional additions to the v1 document and keep the same IndexedDB store and revision check.

[Actual WebGL views](VERIFICATION.md#b42-world-playground) · [Layer controls](WORLD_GENERATOR.md)
