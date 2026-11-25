# The Quiet Specimens

**Elsewhere · B4.2.1 Personal Land**

A playground for living worlds. Build strange landscapes, arrange sculptural objects, and observe artificial life moving, interacting, and making sound.

[Play in your browser](https://petandb-bot.github.io/the-quiet-specimens/)

## Play

- **Make → Generate:** explore eight world styles, reroll individual layers, and lock the parts you want to keep.
- **Land / Objects:** brush relief and surface finishes onto the land, create pools, and place individual forms or colonies.
- **Life:** discover reference specimens or generate new forms with different sizes and temperaments. Give them places to explore.
- **Atmosphere:** adjust light, sky, fog, and surface colors, or use a local photograph.
- **Observe:** watch residents with fixed or gentle follow cameras. Use Focus to hide the interface.
- **Sound:** enable generative world audio or audition individual specimens.

Paused, Slow, and Live control resident activity while editing. One working draft, including its photograph, is saved locally in the browser. Use Undo / Redo to revise edits.

Three procedural body plans are available: HINGE, VESSEL, and RELAY. The earlier aquarium and specimen laboratory remain available under [Legacy](https://petandb-bot.github.io/the-quiet-specimens/legacy/).

## Development

Requires Node.js 22.12+ and a WebGL 2-capable browser.

```sh
npm ci
npm run dev
npm test
npm run build
node scripts/check-dist.mjs
npm run preview
```

Built with TypeScript, Three.js, Vite, and Web Audio. GitHub Actions tests and deploys the production `dist/` bundle to GitHub Pages on updates to `main`.

If WebGL 2 fails to initialize, check browser graphics acceleration and GPU support.

## Documentation

[Personal Land](docs/PERSONAL_LAND.md) · [World Composer](docs/WORLD_COMPOSER.md) · [World Generator](docs/WORLD_GENERATOR.md) · [World Styles](docs/WORLD_STYLES.md) · [Body Plans](docs/BODY_PLANS.md) · [Living Territories](docs/LIVING_TERRITORIES.md) · [Audio Ecology](docs/AUDIO_ECOLOGY.md) · [Roadmap](docs/ROADMAP.md) · [Verification](docs/VERIFICATION.md)
