# Quiet Observation UI

The opening Observe view hides the large **Elsewhere** title and subtitle visually while retaining a semantic heading for assistive technology. The home brand is represented by a small icon with a tooltip and descriptive accessible name.

The persistent controls are **Compose**, **Sound**, **View**, and **Menu**. Menu reveals Legacy, World, Residents, Image, Camera, and Audio without removing or renaming any existing control IDs. The disclosure is keyboard accessible (Escape closes it), and closes when a panel is opened, a command is selected, or the user clicks outside.

Inspect / Action show the selected specimen name as a modest label rather than a large headline. The existing View mode still hides all navigation. Smartphone controls preserve touch-sized targets and access to the same tools.

This change is purely interface presentation and disclosure state; terrain, residents, sound, world documents, and their persistence are unchanged.

## Verification required

- CI: npm test, npm run build, node scripts/check-dist.mjs.
- Browser: desktop and mobile opening; menu keyboard focus and Escape; Compose/World/Residents/Image/Camera/Audio/Legacy; Observe/Inspect/Action; View/Exit; sound, Resident controls.
- Confirm no giant Elsewhere title overlays the world in Observe and no loss of access to controls.
