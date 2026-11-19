import {
  actions, discoveryOptions, engines, fishForms, generatorVersion, legacyGeneratorVersion, materials, originalFishForms, patterns, plans, schemaVersion,
} from '../core/model';
import type { Choices, FishForm, Generator, Genome, Morphology, Mutation, Palette, Personality, Sonotype, Specimen } from '../core/model';
import { clamp, hashText, hexSeed, mix, random } from '../core/random';
import type { ImageFeatures } from './image';

export const paletteBank: Palette[] = [
  ['#cf682a', '#651d17', '#ffcc64'], ['#40818e', '#123751', '#abfcdf'],
  ['#9b6ed0', '#2d2151', '#e8b9ff'], ['#b25a66', '#422545', '#ffad8b'],
  ['#829c56', '#253d27', '#dfef89'], ['#68859d', '#2f3f59', '#ffa473'],
  ['#d9b67a', '#594044', '#fff2cb'], ['#4a75ae', '#272956', '#83f3fe'],
  ['#ab6b42', '#274145', '#e9d69e'], ['#8b5ec9', '#522751', '#ed8ba8'],
  ['#a0b1bb', '#394457', '#d9ffdc'], ['#a65066', '#542f3e', '#ffe371'],
];

export const morphBounds = {
  length: [.62, 1.45], girth: [.55, 1.35], curvature: [-.32, .32], asymmetry: [0, .85],
  reflectivity: [0, 1], transparency: [0, 1], fin: [.45, 1.55], appendages: [0, 12],
  eye: [0, 1], emission: [0, 1],
} as const;
export const behaviorBounds = {
  speed: [.25, 1.45], acceleration: [.5, 2.2], turning: [.65, 2.3], curiosity: [0, 1],
  caution: [0, 1], activity: [0, 1], rest: [1, 8], exploration: [0, 1],
  social: [0, 1], depth: [-.7, .7], rhythm: [.45, 1.65],
} as const;
export const soundBounds = {
  harmonics: [.1, 1], register: [72, 620], modulation: [.02, 1], noise: [0, .8],
  envelope: [.12, 3.1], interval: [1.15, 8.5], probability: [.24, .98],
  spatial: [-.72, .72], resonance: [.1, 1], response: [0, 1],
} as const;

export function bounded<T extends object, K extends keyof T>(
  input: T, bounds: Record<K, readonly [number, number]>,
): T {
  const output = { ...input };
  for (const key of Object.keys(bounds) as K[]) {
    const value = input[key];
    const [min, max] = bounds[key];
    output[key] = clamp(typeof value === 'number' && Number.isFinite(value) ? value : (min + max) / 2, min, max) as T[K];
  }
  return output;
}

export function normalizeGenome(g: Genome): Genome {
  const morphology = bounded(g.morphology, morphBounds);
  morphology.appendages = Math.round(morphology.appendages);
  const sound = bounded(g.sound, soundBounds);
  sound.pitches = sound.pitches.filter(Number.isFinite).slice(0, 12).map(v => clamp(v, -18, 18));
  if (!sound.pitches.length) sound.pitches = [0];
  return { ...g, morphology, behavior: bounded(g.behavior, behaviorBounds), sound };
}

export function generate(
  seed: string, origin: 'Discover' | 'Extract' | 'Reference', choices?: Choices,
  image?: ImageFeatures, version: Generator = generatorVersion,
): Genome {
  const key = `${version}|${seed}|${origin}|${choices?.join('/') ?? ''}`;
  const m = random(key + '/morph');
  const b = random(key + '/behavior');
  const s = random(key + '/sound');
  const where = choices ? discoveryOptions[0].findIndex(x => x === choices[0]) : -1;
  const when = choices ? discoveryOptions[1].findIndex(x => x === choices[1]) : -1;
  const trace = choices ? discoveryOptions[2].findIndex(x => x === choices[2]) : -1;
  const favoredPlans = ['JELLY', 'RAY', 'FISH', 'FISH', 'RAY'] as const;
  const favoredMaterials = ['TRANSLUCENT', 'SYNTHETIC', 'METALLIC', 'ORGANIC', 'ORGANIC'] as const;
  const plan = where >= 0 && m.next() < .54 ? favoredPlans[where] : m.pick(plans);
  const palette = image && m.next() < .9 ? image.palette : m.pick(paletteBank);
  const morphology: Morphology = {
    plan, formSeed: seed, palette, material: where >= 0 && m.next() < .58 ? favoredMaterials[where] : m.pick(materials),
    accentMaterial: m.pick(materials), pattern: image && image.complexity > .5 && m.next() < .55 ? 'mottled' : m.pick(patterns),
    length: clamp(m.range(.75, 1.28) + (image ? Math.abs(image.orientation - .5) * .46 : 0), .62, 1.45),
    girth: m.range(.64, 1.24), curvature: m.range(-.23, .23), asymmetry: m.range(0, .48),
    reflectivity: image ? mix(m.next(), image.contrast, .45) : m.next(),
    transparency: m.range(.3, .73), fin: m.range(.65, 1.33), appendages: Math.floor(m.range(2, 10)),
    eye: m.range(.16, .84), emission: image ? mix(m.next(), 1 - image.brightness, .48) : m.range(.18, .9),
    anomalous: false,
  };
  if (plan === 'FISH' && version !== legacyGeneratorVersion) {
    const shape = random(key + '/shape');
    const regional: FishForm[] = ['halo', 'cosmic', 'machine', 'blade', 'lagoon'];
    morphology.fishForm = where >= 0 && shape.next() < .38 ? regional[where] : shape.pick(version === generatorVersion ? fishForms : originalFishForms);
  }
  const behavior: Personality = {
    speed: b.range(.48, 1.15) * (plan === 'JELLY' ? .74 : 1),
    acceleration: b.range(.6, 1.85), turning: b.range(.8, 1.85),
    curiosity: b.next(), caution: b.next(), activity: image ? mix(b.next(), image.edges, .4) : b.next(),
    rest: b.range(1.8, 6.5), exploration: image ? mix(b.next(), image.distribution, .32) : b.next(),
    social: b.next(), depth: when === 3 ? b.range(-.65, .12) : b.range(-.5, .5), rhythm: b.range(.68, 1.38),
    preferred: b.pick(actions),
  };
  const sound: Sonotype = {
    engine: trace >= 0 && s.next() < .47 ? engines[trace % engines.length] : s.pick(engines),
    register: s.range(106, 365), harmonics: image ? mix(s.next(), image.complexity, .55) : s.range(.24, .9),
    pitches: [0, s.range(-8, -2), s.range(3, 11), s.range(10, 15)],
    modulation: image ? mix(s.next(), image.saturation, .42) : s.range(.15, .88),
    noise: s.range(.1, .56), envelope: s.range(.27, 2.2), interval: s.range(2.2, 6.2),
    probability: s.range(.52, .9), spatial: s.range(-.6, .6), resonance: s.range(.23, .86), response: s.range(.25, .8),
  };
  return normalizeGenome({
    schemaVersion, generatorVersion: version, seed, origin, choices, lineage: [], generation: 1,
    morphology, behavior, sound,
  });
}

function vary<T extends object, K extends keyof T>(
  input: T, bounds: Record<K, readonly [number, number]>, rng: ReturnType<typeof random>, strength: number,
): T {
  const output = { ...input };
  for (const key of Object.keys(bounds) as K[]) {
    const [min, max] = bounds[key];
    output[key] = (Number(input[key]) + rng.range(-1, 1) * (max - min) * strength) as T[K];
  }
  return bounded(output, bounds);
}

export function mutate(parent: Specimen, seed: string, mode: Mutation): Genome {
  const g = parent.genome;
  const rng = random(`${generatorVersion}|${parent.id}|${seed}|${mode}`);
  const strength = { Subtle: .09, Strange: .3, Anomaly: .58 }[mode];
  const focus = rng.pick(['morphology', 'behavior', 'sound'] as const);
  const morph = focus === 'morphology' || mode === 'Anomaly';
  const behavior = focus === 'behavior' || (mode === 'Anomaly' && rng.next() < .7);
  const sound = focus === 'sound' || (mode === 'Anomaly' && rng.next() < .7);
  const result: Genome = {
    ...g, schemaVersion, generatorVersion, seed, origin: 'Mutate', choices: undefined,
    generation: g.generation + 1, lineage: [parent.id],
    morphology: morph ? vary(g.morphology, morphBounds, rng, strength) : { ...g.morphology },
    behavior: behavior ? vary(g.behavior, behaviorBounds, rng, strength) : { ...g.behavior },
    sound: sound ? vary(g.sound, soundBounds, rng, strength) : { ...g.sound },
  };
  if (morph) result.morphology.formSeed = seed;
  if (morph && mode !== 'Subtle') {
    result.morphology.accentMaterial = rng.pick(materials.filter(v => v !== g.morphology.accentMaterial));
    result.morphology.pattern = rng.pick(patterns.filter(v => v !== g.morphology.pattern));
    if (rng.next() < strength) result.morphology.palette = rng.pick(paletteBank);
  }
  if (mode === 'Anomaly') {
    result.morphology.anomalous = true;
    result.morphology.asymmetry = rng.range(.58, .85);
    result.morphology.appendages = Math.round(rng.range(7, 12));
    if (rng.next() < .36) result.morphology.plan = rng.pick(plans.filter(v => v !== g.morphology.plan));
    if (result.morphology.plan === 'FISH') {
      result.morphology.fishForm = rng.pick(fishForms.filter(form => form !== g.morphology.fishForm));
    } else {
      delete result.morphology.fishForm;
    }
  }
  if (sound && mode !== 'Subtle' && rng.next() < .65) result.sound.engine = rng.pick(engines.filter(v => v !== g.sound.engine));
  return normalizeGenome(result);
}

const first = ['Velum', 'Cinder', 'Vesper', 'Lacuna', 'Orison', 'Aster', 'Nacre', 'Silt', 'Obsidian', 'Lithic', 'Ilex', 'Isobar'];
const second = ['Drift', 'Veil', 'Signal', 'Wisp', 'Spindle', 'Bloom', 'Trace', 'Lumen', 'Echo', 'Spore', 'Thread', 'Mote'];

export function specimen(genome: Genome, name?: string): Specimen {
  const rng = random(JSON.stringify(genome));
  return {
    id: 'QS-' + hexSeed(hashText(JSON.stringify(genome))),
    name: name ?? `${rng.pick(first)} ${rng.pick(second)}`,
    discoveredAt: new Date().toISOString(),
    genome, user: { favorite: false },
  };
}
