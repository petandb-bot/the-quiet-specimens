import type { SpecimenRecipe } from './specimens/generator';
import type { SpecimenSize } from './specimens/profiles';
import type { Sonotype } from '../core/model';
import { clamp, freshSeed, random } from '../core/random';

export const gardenPlans = ['HINGE', 'VESSEL', 'RELAY'] as const;
export type GardenPlan = typeof gardenPlans[number];

export const gardenMaterials = ['CERAMIC', 'METALLIC', 'MEMBRANE', 'MINERAL', 'SYNTHETIC', 'COMPOSITE'] as const;
export type GardenMaterial = typeof gardenMaterials[number];
type Palette = readonly [shell: string, accent: string, joint: string];

export interface GardenGenome {
  seed: string;
  shapeSeed?: string;
  plan: GardenPlan;
  material: GardenMaterial;
  palette: Palette;
  modules: number;
  proportion: number;
  curvature: number;
  asymmetry: number;
  aperture: number;
  gait: number;
  curiosity: number;
  caution: number;
  patience: number;
  sound: Sonotype;
}
export interface GardenSpecimen {
  name: string;
  genome: GardenGenome;
  size?: SpecimenSize;
  recipe?: SpecimenRecipe;
}

const palettes: Palette[] = [
  ['#b64830', '#de8c60', '#263630'], ['#cdb385', '#f0ded0', '#39322d'],
  ['#385977', '#d9a852', '#273b34'], ['#809d84', '#e0b848', '#224039'],
  ['#678c8e', '#da8d54', '#203d53'], ['#c4a5ce', '#e2c4d9', '#562a46'],
  ['#d49045', '#f6dc9c', '#4a3929'], ['#9c504c', '#578480', '#262a38'],
  ['#5f6942', '#d5ca9c', '#47423c'],
];
const affinities: Record<GardenPlan, Sonotype['engine']> = {
  HINGE: 'Metallic Residue', VESSEL: 'Thin Membrane', RELAY: 'Hollow Pulse',
};
const names: Record<GardenPlan, string[]> = {
  HINGE: ['Lame Bracket', 'Restless Trestle', 'Fold of Doubt', 'Misplaced Latch'],
  VESSEL: ['Weather Jar', 'A Pocket of Air', 'Second Skin', 'Unfinished Bell'],
  RELAY: ['Long Errand', 'After You', 'Slow Sentence', 'Distant Chorus'],
};

export function gardenSpecimen(seed: string, name?: string, overrides: Partial<Omit<GardenGenome, 'seed' | 'sound'>> = {}): GardenSpecimen {
  const rng = random('garden/1/' + seed);
  const plan = overrides.plan ?? rng.pick(gardenPlans);
  const material = overrides.material ?? rng.pick(gardenMaterials);
  const engine = rng.next() < .80 ? affinities[plan] : rng.pick(Object.values(affinities));
  const genome: GardenGenome = {
    seed, plan, material, palette: rng.pick(palettes), modules: Math.round(rng.range(3, 7)),
    proportion: rng.range(.72, 1.25), curvature: rng.range(.16, .91), asymmetry: rng.range(.12, .80),
    aperture: rng.range(.30, .83), gait: rng.range(.55, 1.25), curiosity: rng.next(),
    caution: rng.next(), patience: rng.next(),
    sound: {
      engine, register: rng.range(112, 315), harmonics: rng.range(.19, .64), pitches: [0, 3.2, 7.5, -2.7],
      modulation: rng.range(.11, .78), noise: rng.range(.11, .55), envelope: rng.range(.3, 1.8),
      interval: rng.range(1.7, 4.8), probability: rng.range(.55, .85), spatial: rng.range(-.32, .32),
      resonance: rng.range(.31, .81), response: rng.range(.20, .72),
    },
    ...overrides,
  };
  genome.modules = Math.round(clamp(genome.modules, 3, 8));
  genome.proportion = clamp(genome.proportion, .68, 1.35);
  genome.aperture = clamp(genome.aperture, .20, .93);
  genome.asymmetry = clamp(genome.asymmetry);
  genome.curvature = clamp(genome.curvature);
  genome.gait = clamp(genome.gait, .45, 1.4);
  return { name: name ?? rng.pick(names[plan]), genome };
}

export function newGardenSpecimen() { return gardenSpecimen(freshSeed()); }

const studies: [string, GardenPlan, GardenMaterial, Partial<GardenGenome>][] = [
  ['Fold of Doubt', 'HINGE', 'SYNTHETIC', { palette: palettes[0], proportion: 1.12, asymmetry: .68, curvature: .33, gait: .88, caution: .72 }],
  ['Left on Read', 'HINGE', 'METALLIC', { palette: palettes[2], proportion: .79, asymmetry: .86, curvature: .70, gait: 1.22 }],
  ['The Apology', 'HINGE', 'CERAMIC', { palette: palettes[1], proportion: 1.31, asymmetry: .19, aperture: .38, curvature: .12, gait: .57 }],
  ['Weather Jar', 'VESSEL', 'MEMBRANE', { palette: palettes[3], proportion: 1.24, curvature: .85, aperture: .62, gait: .58 }],
  ['Second Skin', 'VESSEL', 'CERAMIC', { palette: palettes[4], proportion: .74, curvature: .21, aperture: .84, gait: .92 }],
  ['Air in Pieces', 'VESSEL', 'MINERAL', { palette: palettes[5], proportion: .95, curvature: .58, aperture: .42, gait: .72 }],
  ['Long Errand', 'RELAY', 'COMPOSITE', { palette: palettes[6], modules: 7, proportion: .91, asymmetry: .55, gait: .82 }],
  ['After You', 'RELAY', 'CERAMIC', { palette: palettes[7], modules: 4, proportion: 1.22, asymmetry: .62, curvature: .94, gait: 1.18 }],
  ['Slow Sentence', 'RELAY', 'METALLIC', { palette: palettes[8], modules: 8, proportion: .71, asymmetry: .25, curvature: .18, gait: .58 }],
];

export const gardenReferences = studies.map(([name, plan, material, overrides], i) =>
  gardenSpecimen('STUDY-' + (i + 1), name, { ...overrides, plan, material }));

export function fromGardenSeed(seed: string) {
  const normalized = seed.trim();
  return gardenReferences.find(item => item.genome.seed === normalized.toUpperCase()) ?? gardenSpecimen(normalized);
}
