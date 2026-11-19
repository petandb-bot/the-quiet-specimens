export const plans = ['FISH', 'RAY', 'JELLY'] as const;
export const materials = ['ORGANIC', 'METALLIC', 'TRANSLUCENT', 'SYNTHETIC'] as const;
export const engines = ['Hollow Pulse', 'Thin Membrane', 'Metallic Residue', 'Soft Debris'] as const;
export const actions = ['CRUISE', 'HOVER', 'DART', 'TURN', 'INSPECT', 'STARTLE', 'DISPLAY', 'TUMBLE', 'REST'] as const;
export const patterns = ['striated', 'mottled', 'geometric', 'contour'] as const;
export const origins = ['Reference', 'Discover', 'Extract', 'Mutate'] as const;
export const mutationModes = ['Subtle', 'Strange', 'Anomaly'] as const;
export const schemaVersion = 1;
export const legacyGeneratorVersion = '1.0.0';
export const generatorVersion = '1.1.0';
export const fishForms = ['lagoon', 'halo', 'machine', 'cosmic', 'round', 'blade'] as const;
export const fishFormLabels: Record<typeof fishForms[number], string> = {
  lagoon: 'Lagoon', halo: 'Halo', machine: 'Machine', cosmic: 'Cosmic', round: 'Round', blade: 'Blade',
};

export type FishForm = typeof fishForms[number];
export type Generator = typeof generatorVersion | typeof legacyGeneratorVersion;
export type Plan = typeof plans[number];
export type Material = typeof materials[number];
export type Engine = typeof engines[number];
export type Action = typeof actions[number];
export type Origin = typeof origins[number];
export type Mutation = typeof mutationModes[number];
export type Palette = [string, string, string];
export type Choices = [string, string, string];

export interface Morphology {
  plan: Plan;
  formSeed: string;
  fishForm?: FishForm;
  material: Material;
  accentMaterial: Material;
  pattern: typeof patterns[number];
  palette: Palette;
  length: number;
  girth: number;
  curvature: number;
  asymmetry: number;
  reflectivity: number;
  transparency: number;
  fin: number;
  appendages: number;
  eye: number;
  emission: number;
  anomalous: boolean;
}
export interface Personality {
  speed: number;
  acceleration: number;
  turning: number;
  curiosity: number;
  caution: number;
  activity: number;
  rest: number;
  exploration: number;
  social: number;
  depth: number;
  rhythm: number;
  preferred: Action;
}
export interface Sonotype {
  engine: Engine;
  harmonics: number;
  register: number;
  pitches: number[];
  modulation: number;
  noise: number;
  envelope: number;
  interval: number;
  probability: number;
  spatial: number;
  resonance: number;
  response: number;
}
export interface Genome {
  schemaVersion: typeof schemaVersion;
  generatorVersion: string;
  seed: string;
  origin: Origin;
  choices?: Choices;
  lineage: string[];
  generation: number;
  morphology: Morphology;
  behavior: Personality;
  sound: Sonotype;
}
export interface Specimen {
  id: string;
  name: string;
  discoveredAt: string;
  genome: Genome;
  user: { favorite: boolean; thumbnail?: string };
}
export const discoveryOptions = [
  ['Frozen Lake', 'Unknown Planet', 'Sunken Factory', 'Black Ocean', 'Forgotten Garden'],
  ['Before Dawn', 'After Rain', 'Noon', 'Midnight', 'A Long Time Ago'],
  ['A Reflection', 'A Vibration', 'A Fragment', 'A Shadow', 'An Unknown Signal'],
] as const;
export const defaultChoices: Choices = ['Black Ocean', 'Before Dawn', 'An Unknown Signal'];
export const actionLabels: Record<Action, string> = {
  CRUISE: 'Cruise', HOVER: 'Hover', DART: 'Dart', TURN: 'Turn', INSPECT: 'Inspect',
  STARTLE: 'Startle', DISPLAY: 'Display', TUMBLE: 'Tumble', REST: 'Rest',
};
