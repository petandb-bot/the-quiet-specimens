# Personal Land

## Working with the land

In **Make → Land**, use **Shape** to change the seeded terrain. **Regenerate base terrain** lays a new seed under the existing edits. **Sculpt** raises, lowers, smooths or flattens ground to the height where the stroke began. Set brush size and strength, then drag on the ground. **Paint** applies Chalk, Mineral, Oxide, Dust, Glass or Organic. **Erase** gradually reveals the underlying style. Clear relief and clear paint are independent undoable actions.

In **Water**, choose **Create water** and tap the ground. The pool starts at the selected offset above that point. After placement, **Water level** sets its absolute elevation. Adjust size, color and clarity in the same panel. Larger extents let water fill nearby folds in the terrain. A pool disappears from view when its surface sits below the land. Delete the pool from its selection to remove the saved region.

Use **Done** or Escape to leave a land tool. In Plan, ground positions are easy to read. Two fingers navigate on touch. Space-drag and the wheel navigate with a mouse. A second touch cancels the current stroke before navigation begins. Each completed stroke is one history action.

## Placing forms

**Objects** includes the six original families and Hollow, Fragment, Aggregate, Membrane, Canopy and Suspension. Choose a family and **Stamp**, **Scatter** or **Colony**. Scatter distributes forms across a radius. Colonies offer Cluster, Ring, Growth, Gradient and Debris. Use Area to preview the footprint and Advanced spacing to adjust density and variation. The same family, stamp seed, controls, position and free ground produce the same arrangement. Fewer pieces fit on steep or crowded ground.

The whole placement is one undoable edit. Each generated form keeps its own seed and transform. Select, drag, delete or mutate each form individually. Forms that result from a colony stay in the draft as editable objects. There is no live link to a colony parent. Original families still use their original geometry and seed recipes.

Hollows and canopies can suggest shelter. Aggregates suggest quiet sites. Fragments, membranes and suspensions can draw curiosity. An explicit Place takes priority. Residents evaluate these opportunities alongside territory, temperament and recent visits.

## Making residents

**Life → Residents** handles the roster and territory. **Discover** offers the nine references. **Generate** previews one candidate. Choose a body, material, size and temperament, then preview or reroll. You can add the candidate to the current world. When a resident is selected, **Mutate** creates a form or material variant. Preview it first, then add it or replace the selected resident. Replacement retains its authored habitat descriptors and finds a safe start for the new body.

Small and Large use 0.72 and 1.38 times the standard dimensions. Clearance, contact, stride, movement pacing, camera framing and acoustic timing follow the size. Large residents change gestures more slowly. Temperament biases existing motion parameters such as curiosity, caution and patience. Each new specimen includes a full genome, a versioned replay seed and its recipe. The replay seed in Advanced can be used with the observation seed control. The roster uses the replay seed as its unique key and disallows a second copy with that same seed.

**Make → Generate → Advanced → Resident generation** changes future roster generation. Reference draws from the original nine. Mixed introduces two generated residents in a five-resident roster. Wild generates all five. The original Elsewhere start still loads its reference roster. With Residents locked, world generation keeps the full resident record and its territory. Direct resident edits remain available.

## Morphology studies

In **Make → Generate → Advanced**, pick Expanse for a clearing, Folded Land for terraces and ridges, Thicket for clustered growth, or Basin for hollows. This setting changes unlocked generated terrain and structures. Style still supplies surface, light and atmosphere. Style default restores its established pattern. Authored terrain, paint, pools and structures survive changes to these layers. Preview shows the standard style study.

## Model, rendering and limits

- The version 1 document accepts optional relief, paint and up to four water regions, plus optional morphology and resident recipes. Older drafts use their original defaults. The separate IndexedDB working draft retains the photo and detects a newer revision from another tab.
- The 61 × 61 authored grid stores only touched values. Relief stays within ±5 units and tapers at the activity boundary. Renderer, brush rays, contact, water, placement and cameras use the same heightfield. Steep faces in edited cells use their triangle gradient in navigation. Unedited areas keep the original metre-scale gradient.
- A brush previews on the existing terrain mesh, updates edited positions and color/finish attributes, and commits on release. The mesh normals and bounds are recalculated for relief updates. The simulation clock pauses during the stroke. The shadow map is reused in static frames and refreshed when forms, lighting or poses change. Canceled strokes restore the previous geometry without writing history or storage.
- Painted vertices carry blended color, roughness and metalness. Paint and water add no per-stroke meshes. Each pool clips against water depth on the same terrain triangles and feathers its outer extent. It uses standard lighting and a subtle shader modulation.
- HINGE avoids water over 0.21 units deep. RELAY can cross shallows up to 0.58. VESSEL uses the higher of land and water level. If the edited environment blocks a resident, nearby sites and then a bounded field search are tried. If no safe site exists, it waits offstage with its placement and memory retained. Opening safe ground lets it return.
- History holds 48 edits. Each world holds up to 40 objects, 24 Places, nine residents and four pools. There is one recovering local draft per browser profile. The running simulation, camera and Undo stack restart on reload.
- WebGL 2 startup tries high-performance with antialiasing, default power with antialiasing and a fresh canvas without antialiasing. On context restoration, Three.js uploads the retained scene assets again. The app rebuilds the reflection map and discards cached resident portraits.

## Recommendations for Possible Worlds

Prove an island or enclosure on the current planar heightfield before adding vertical activity layers. Keep authored edits attached to the surface that owns their sampling coordinates. Define surface-space rays, gravity and resident navigation together before attempting suspended terrains or a spherical planet. Water needs separate catchments where disconnected surfaces share the same horizontal coordinates. Treat Deep Surface, Suspended Land, and Small Planet as independent prototypes with contact and camera tests. Use physical mobile sessions to choose any new density or rendering limits.

[Roadmap](ROADMAP.md) · [Verification and rendered worlds](VERIFICATION.md)
