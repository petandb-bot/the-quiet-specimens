# Places

Places can be regions on their own or attached to objects. In **Make → Places**, the circle shows the area associated with a role. The circles are hidden in observation.

| Role | Effect |
| --- | --- |
| Neutral | Decorative location |
| Shelter | A possible destination for rest |
| Curiosity | An attractive inspection destination for curious residents |
| Gathering | A chance to visit together with nearby, sociable residents |
| Quiet | Slower movement near the center and a possible rest stop |

Influence scales the effect. Personality, reachability, current activity, and recent visits influence which destinations residents choose. Places use the existing territory decisions and stay independent of the audio engine.

A linked place takes its center from the object. Residents approach a reachable point around its footprint. Deleting the object leaves an independent place at the last center. Moving, disabling, or deleting a place invalidates visits specific to it. Geography and unrelated visits stay intact, and a resident can choose a new valid destination without restarting its life.

[World Composer](WORLD_COMPOSER.md) · [Living Territories](LIVING_TERRITORIES.md)
