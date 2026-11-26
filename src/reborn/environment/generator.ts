import { clamp, hashText, hexSeed, random } from '../../core/random';
import { gardenReferences } from '../genome';
import type { GroundPoint } from '../motion';
import { defaultLand, makeTerrain, normalizeLand } from '../terrain';
import { landmarksFor, objectLimit } from '../world/document';
import type { WorldDocument, WorldResident } from '../world/document';
import { defaultEnvironment, layerNames, layerSeed } from './settings';
import type { Environment, Layer, LayerRecipe, WorldStyle } from './settings';
import { personalSpecimen, temperaments } from '../specimens/generator';
import type { ResidentPolicy } from '../specimens/generator';
import { sizes } from '../specimens/profiles';
import { morphologyStudy } from './morphology';
import type { WorldMorphology } from './morphology';
import { styles } from './styles';
import { generateStructures, keepAuthoredStructures } from './structures';

export function environmentOf(world: WorldDocument) {
  return world.environment ?? defaultEnvironment(world.land.seed);
}

function colorVariation(color: string, shift: number) {
  const value = Number.parseInt(color.slice(1), 16);
  const component = (bits: number) => clamp(((value >> bits) & 255) + shift, 0, 255).toString(16).padStart(2, '0');
  return '#' + component(16) + component(8) + component(0);
}

function residents(recipe: LayerRecipe, canonical: boolean, policy?: ResidentPolicy): WorldResident[] {
  const starting = [0, 3, 6, 1, 7];
  if (canonical && recipe.style === 'Elsewhere' && (!policy || policy === 'Reference')) return starting.map(index => ({ specimen: gardenReferences[index] }));
  const rng = random('world/residents/1/' + recipe.style + '/' + recipe.seed);
  const groups = [0, 3, 6].map(base => base + Math.floor(rng.range(0, 3)));
  const candidates = gardenReferences.map((_, index) => index).filter(index => !groups.includes(index));
  while (groups.length < 5) groups.push(candidates.splice(Math.floor(rng.range(0, candidates.length)), 1)[0]);
  const turn = rng.range(0, Math.PI * 2);
  const spread = styles[recipe.style].residentSpread;
  return groups.map((index, slot) => {
    const angle = turn + slot * Math.PI * 2 / 5;
    const radius = rng.range(7, 12) * spread;
    const point: GroundPoint = [Math.cos(angle) * radius, Math.sin(angle) * radius - 4];
    const reference = gardenReferences[index];
    const varied = policy === 'Wild' || (policy ?? 'Mixed') === 'Mixed' && (slot % 2 === 1);
    const specimenSeed = recipe.style + '/' + recipe.seed + '/' + slot;
    const traits = random('resident/' + specimenSeed);
    const specimen = varied ? personalSpecimen({ seed: hexSeed(hashText(specimenSeed)),
      body: slot < 3 ? reference.genome.plan : 'Any', material: 'Any', size: traits.pick(sizes),
      temperament: traits.pick(temperaments) }) : reference;
    return { specimen, start: point };
  });
}

function generateLayer(world: WorldDocument, environment: Environment, layer: Layer, recipe: LayerRecipe) {
  const profile = styles[recipe.style];
  const study = morphologyStudy(environment.morphology);
  const canonical = recipe.seed === layerSeed(defaultLand.seed, layer);
  const rng = random('world/' + layer + '/1/' + recipe.style + '/' + recipe.seed);
  const jitter = (amount: number) => canonical ? 0 : rng.range(-amount, amount);
  const shade = (color: string, amount: number) => colorVariation(color, Math.round(jitter(amount)));
  switch (layer) {
    case 'terrain': {
      const land = { ...profile.land, ...study?.land };
      world.land = normalizeLand({ ...land, seed: canonical && recipe.style === 'Elsewhere' ? defaultLand.seed : recipe.seed,
        elevation: clamp(land.elevation + jitter(.14)), roughness: clamp(land.roughness + jitter(.10)),
        openness: clamp(land.openness + jitter(.12)) });
      break;
    }
    case 'surface': {
      const s = profile.surface;
      environment.surface = { low: shade(s.low, 20), high: shade(s.high, 16), accent: shade(s.accent, 23),
        roughness: clamp(s.roughness + jitter(.13)), metalness: clamp(s.metalness + jitter(.048), 0, .6) };
      break;
    }
    case 'structures': {
      if (!study && canonical && recipe.style === 'Elsewhere') {
        const retained = keepAuthoredStructures(world);
        const excluded = new Set([...retained.map(item => item.id), ...world.suppressed]);
        const land = environment.structureDensity === undefined ? defaultLand : { ...defaultLand, density: environment.structureDensity };
        const landmarks = landmarksFor(makeTerrain(land)).filter(item => !excluded.has(item.id)
          && !retained.some(kept => Math.hypot(item.x - kept.x, item.z - kept.z) < item.radius + kept.radius + .7));
        world.objects = [...landmarks.slice(0, objectLimit - retained.length), ...retained];
      } else world.objects = generateStructures(world, recipe, environment.structureDensity, study?.structures);
      break;
    }
    case 'atmosphere': {
      const a = profile.atmosphere;
      environment.atmosphere = { sky: shade(a.sky, 18), fog: shade(a.fog, 19),
        distance: clamp(a.distance + jitter(14), 8, 100), depth: clamp(a.depth + jitter(22), 24, 155) };
      break;
    }
    case 'lighting': {
      const l = profile.lighting;
      environment.lighting = { key: shade(l.key, 22), ambient: shade(l.ambient, 15), bounce: shade(l.bounce, 20),
        intensity: clamp(l.intensity + jitter(.45), .5, 4), fill: clamp(l.fill + jitter(.19), .5, 3),
        bearing: clamp(l.bearing + jitter(68), -180, 180), elevation: clamp(l.elevation + jitter(12), 10, 58) };
      break;
    }
    case 'residents':
      world.residents = residents(recipe, canonical, environment.residentPolicy);
      break;
  }
}

export function generateWorld(world: WorldDocument, style: WorldStyle, seed: string, reset = false) {
  const previous = environmentOf(world);
  const environment = { ...previous, style, seed, layers: { ...previous.layers } };
  if ((reset || previous.style !== style) && !previous.layers.structures.locked) delete environment.structureDensity;
  const next = { ...world, environment };
  for (const layer of layerNames) {
    if (previous.layers[layer].locked) continue;
    const recipe = { style, seed: layerSeed(seed, layer), locked: false };
    environment.layers[layer] = recipe;
    generateLayer(next, environment, layer, recipe);
  }
  return next;
}

export function randomizeLayer(world: WorldDocument, layer: Layer, seed: string) {
  const previous = environmentOf(world);
  if (previous.layers[layer].locked) return world;
  const recipe = { style: previous.style, seed: layerSeed(seed, layer), locked: false };
  const environment = { ...previous, layers: { ...previous.layers, [layer]: recipe } };
  const next = { ...world, environment };
  generateLayer(next, environment, layer, recipe);
  return next;
}

export function lockLayer(world: WorldDocument, layer: Layer, locked: boolean) {
  const previous = environmentOf(world);
  if (previous.layers[layer].locked === locked) return world;
  const recipe = { ...previous.layers[layer], locked };
  return { ...world, environment: { ...previous, layers: { ...previous.layers, [layer]: recipe } } };
}

export function setStructureDensity(world: WorldDocument, density: number) {
  const previous = environmentOf(world);
  const recipe = previous.layers.structures;
  if (recipe.locked || density === previous.structureDensity) return world;
  const environment = { ...previous, structureDensity: density };
  const next = { ...world, environment };
  generateLayer(next, environment, 'structures', recipe);
  return next;
}

export function setMorphology(world: WorldDocument, morphology: WorldMorphology) {
  const previous = environmentOf(world);
  if ((previous.morphology ?? 'Style default') === morphology) return world;
  const environment = { ...previous, morphology };
  const next = { ...world, environment };
  for (const layer of ['terrain', 'structures'] as const) {
    const recipe = environment.layers[layer];
    if (!recipe.locked) generateLayer(next, environment, layer, recipe);
  }
  return next;
}
