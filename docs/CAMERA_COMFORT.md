# Still & Alive — Camera comfort

- **Fixed** holds the lens, position, and target while the world runs. Switch from Landscape to Fixed to keep the current composition.
- **Landscape** is the manual orbit and pan mode. Wheel and pinch zoom are gentler, and the target remains inside the field while retaining the same relative camera offset. Reset returns to Fixed.
- **Soft Follow** starts at a fixed compass angle. The subject can move inside a screen-space dead zone without moving the camera. Outside it the view translates while preserving angle and field of view. The movement caps are 0.90 world units per second, or 0.47 with Reduce Motion, with a separate acceleration limit. Ground and nearby structures can prompt a slow shared rise. Losing the subject returns to Fixed.
- **Observatory** holds four named viewpoints. Switch with Previous view and Next view. Auto-advance starts off and uses straight cuts at 100-second intervals when enabled.
- **Atlas** uses the top-down Plan projection for observation. It leaves the current perspective frame intact. The blue square marks that frame's target.

Reduce Motion starts on and responds when the system enables its reduced-motion preference. It widens the dead zone, lowers translation speed, and turns off remaining orbit damping. Compose uses an independent temporary editing view. Leaving it restores the observation frame. Inspect and Action retain their close-up camera.

[Controls and small events](OBSERVATION.md) · [Verification](VERIFICATION.md)
