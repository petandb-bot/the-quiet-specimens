# Genome

Genome schema and exchange envelope use version 1. The default generator is 1.2.0. Discover also offers 1.0.0 and 1.1.0 to replay seeds from earlier releases. All 18 earlier references retain their IDs and genomes. Each record has a stable ID, timestamp, name, genome, favorite flag, and optional JPEG thumbnail. The stored genome is the authoritative instance format. The lineage array can hold two parent IDs for a later release.

- Morphology contains a body plan, procedural form seed, proportions, curvature, asymmetry, palette, primary and membrane materials, surface pattern, reflectivity, transparency, fin scale, appendage count, eye geometry, and organ emission.
- Behavior contains preferred action, speed, acceleration, turning, curiosity, caution, activity, rest, exploration, social tendency, depth, and movement rhythm.
- Sonotype contains a synthesis engine, register and pitch vocabulary, harmonic weighting, modulation, noise, envelope, rhythm, reaction probability, stereo placement, and resonance.

Discover combines the source label, generator version, Seed, and selected conditions into independent seeded random streams for shape, behavior, and sound. Extract hashes normalized pixel data and uses dominant color clusters, luminance, contrast, saturation, edge density and orientation, quadrant luminance distribution, and texture complexity. Source traits weight the output while leaving room for variation. A curated Reference uses generated defaults with intentional overrides.

Subtle and Strange select one domain per mutation. Anomaly ensures a morphology change and can also alter behavior and sound. Inherited morphology keeps its own form seed, so a sound-only mutation preserves the geometry. Numeric domains clamp to their documented ranges in `src/genesis/genome.ts` and categorical fields are checked before a record enters the app. Unknown schema versions are rejected with an explanation. Unwrapped version 1 records are accepted, and older records that omitted the form seed use the record seed.

Version 1.1 adds an optional fish form field. It is only valid on the FISH plan and drives the shape profile, organs, and fins. Its omission retains the original fish builder. Anomaly can select another form when the plan remains FISH.

Version 1.2 adds the arowana and seahorse forms. The aquarium shoal presets use compact species-specific meshes and motion patterns for many subjects.
