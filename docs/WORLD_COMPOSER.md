# World Composer

Open **Make** to create a world. Choose a form in **Objects** and point at the ground to see a translucent preview. Click or tap once to place it. The form stays active for the next placement. **Randomize** changes the active form's seed and thumbnail. Open **Seed** to repeat a particular variation.

| Tool | What it does |
| --- | --- |
| **Select** | Opens the controls for an object you click or tap. Click empty ground to clear the selection. |
| **Move** | Drags an object over the terrain. An independent place can be dragged from the **Places** tab. |
| **Place** | Stamps the form from the palette. |
| **Camera** | Drags the view without changing the layout. **Plan** gives you a top-down view with a field boundary. |

On a computer, hold **Space** and drag to turn the camera from any tool. Right-drag pans and the mouse wheel zooms. In **Plan**, Space-drag pans. On a phone, use **Camera** to drag with one finger, or pan and pinch with two fingers in any tool. **Esc** returns to Select after you close Help. **?** opens the quick start and shortcuts.

With an object selected, drag the Rotate or Scale slider, choose a finish, or use **Move**, **Duplicate**, and **Delete**. Coordinates, seed and height are in **Advanced**. **Undo** and **Redo** work for world edits, including whole drags and each placement in a series. Use Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z from the keyboard.

**Places** adds a region or links a place to a structure. **Residents** sets where a specimen starts, lives, or prefers to visit. Obstructed resident placements can use nearby safe ground. **Inspect** and **Follow** bring you to Observe with the selected resident. **Terrain** and **Photo** open directly from the Make dock.

Make pauses resident motion while you edit. **Observe** resumes the previous motion state and returns to the observation camera. **Focus** clears the controls and guide marks. Sound is available in both workspaces. Each world can hold 40 objects, 24 places, and nine residents.

## Local working draft

World edits and the last accepted photo are automatically saved in one IndexedDB working draft per browser profile and site. **Saved on this browser** confirms the write. It restores on reload when browser storage is available. Photo changes save alongside the layout and the photo file selection is outside the Undo history. Reopening restores residents' settings and starts fresh motion, camera, and Undo history. Clearing the site's data removes the draft. If another tab has saved a newer draft, reload this tab before continuing. The newer draft is protected from being overwritten.

[Places](PLACE_SYSTEM.md) · [World document](WORLD_DOCUMENT.md) · [World Archive](WORLD_ARCHIVE.md) · [Verification](VERIFICATION.md)
