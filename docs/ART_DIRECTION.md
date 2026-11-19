# Art direction

A pale paper interface and archival blue separate the records from a dark, teal-lit chamber. Vesper Crown opens the chamber with an articulated, luminous halo. Ember Veil remains in the reference archive. The reference collection moves from cold glass and ivory through oxidized metal, coral, rust, and geometric violets. Material and creature silhouette are the primary visual signals.

Fish bodies follow warped cross-sections along a spine. Their translucent tails, dorsal sails, and paired fins carry curved ribs and long filaments. Rays spread across two converging cambered wings, with undulating margins and multiple trailing organs. Jellies use a scalloped, ribbed bell around a visible inner body, with trailing tendrils and folded membranes.

Body deformation runs in the vertex shader. Fish flex more strongly aft. Rays propagate a wave from the centerline to the tips. Jellies pulse and pass a delayed motion into the tendrils. The lighting uses a generated environment map and colored directional sources. Vertex patterns and material contrast preserve form detail without a bloom pass. Model switching releases the current mesh and material resources. Filaments and small organs are batched by material to reduce draw calls.

Thumbnails use the actual production renderer and are captured on demand from a fixed observation angle. Saving a record captures that preview for later archive sessions.

## Fish forms

Lagoon follows a small wild fish with a forked tail and lateral stripe. Halo suspends a curved crown and fine streamers around a long profile. Machine layers nine shell sections and mounts paired fins on a narrower internal shaft. Cosmic loops bony arches below the body to frame an open cavity. Round brings prominent eyes and short paddles to a deep, compact body. Blade pulls a tapered head, wing edges, and swept fins into long points.

The profiles apply to live geometry, including newly generated fish. The camera centers each form by its bounds, preserving differences in length and height.


## Living Aquarium

Guppies have pale blue bodies and fan tails and swim in the upper part of the water column. The warm goldfish have rounder bodies and turn through a lower circuit. The Surface Mayor has a long body, an upturned jaw, and thin barbels at the waterline. The Clinging Clerk balances upright with a curled tail and repeatedly corrects its height. The Floor Manager barely leaves the sediment. The camera keeps the size difference and all three depths visible.
