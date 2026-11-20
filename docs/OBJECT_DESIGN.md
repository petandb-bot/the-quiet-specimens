# Object design

The world still uses the asymmetric arches, monoliths, rings, and stone groups from B2.1. Their generated layout can be edited in Place Composer. New objects use the selected form and a seed to vary their silhouette and proportions. **Original**, **Chalk**, **Oxide**, **Mineral**, and **Jade** give different material treatments.

**Flora** is a small cluster of curved stems and hard geometric leaves. Individual stems bend with different phases. **Kinetic** has a lightweight arm with two mismatched weights. Its turning and swinging movements use separate periods. Both can be grouped to create local concentrations within an open landscape.

Preview and placement share the same geometry generator. A transform edit reuses the existing mesh. New geometry or finishes replace only the edited object and release its old resources. On the ground, object position is sampled from the rendered terrain. Rotation is around the vertical axis. Height is measured above the surface.

The simulation uses a circular footprint scaled with the form. A sufficiently elevated object lets residents move beneath it. The footprint is an approximation for solid ground structures, including the arches.

[Place Composer](WORLD_COMPOSER.md)
