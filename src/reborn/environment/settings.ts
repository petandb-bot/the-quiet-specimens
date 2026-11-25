import { morphologyNames } from './morphology';
import type { WorldMorphology } from './morphology';
import { policies } from '../specimens/generator';
import type { ResidentPolicy } from '../specimens/generator';
import { hashText, hexSeed } from '../../core/random';

export const worldStyles = ['Elsewhere', 'Pale Colony', 'Oxide Field', 'Shallow Memory', 'Uncertain Garden',
  'Black Mineral', 'Incorrect Paradise', 'Abandoned Geometry'] as const;
export type WorldStyle = typeof worldStyles[number];

export const layerNames = ['terrain', 'surface', 'structures', 'atmosphere', 'lighting', 'residents'] as const;
export type Layer = typeof layerNames[number];

export type Surface = { low: string; high: string; accent: string; roughness: number; metalness: number };
export type Atmosphere = { sky: string; fog: string; distance: number; depth: number };
export type Lighting = { key: string; ambient: string; bounce: string; intensity: number; fill: number; bearing: number; elevation: number };
export type LayerRecipe = { style: WorldStyle; seed: string; locked: boolean };
export type Environment = {
  style: WorldStyle;
  seed: string;
  layers: Record<Layer, LayerRecipe>;
  surface: Surface;
  atmosphere: Atmosphere;
  lighting: Lighting;
  structureDensity?: number;
  residentPolicy?: ResidentPolicy;
  morphology?: WorldMorphology;
};

export const defaultSurface: Surface = { low: '#899377', high: '#d6c6a6', accent: '#a4a58a', roughness: .94, metalness: 0 };
export const defaultAtmosphere: Atmosphere = { sky: '#ccd2c6', fog: '#ccd2c6', distance: 39, depth: 106 };
export const defaultLighting: Lighting = {
  key: '#fff0ce', ambient: '#fff7e7', bounce: '#ad9a79', intensity: 2.55, fill: 1.46, bearing: -45, elevation: 32,
};

export function layerSeed(seed: string, layer: Layer) {
  const text = layer + '/' + seed;
  return text.length <= 48 ? text : layer + '/' + hexSeed(hashText(text)) + '/' + seed.slice(0, 21);
}

export function defaultEnvironment(seed: string): Environment {
  const layers = Object.fromEntries(layerNames.map(layer => [layer, {
    style: 'Elsewhere', seed: layer === 'terrain' ? seed : layerSeed(seed, layer), locked: false,
  }])) as Environment['layers'];
  return { style: 'Elsewhere', seed, layers, surface: defaultSurface, atmosphere: defaultAtmosphere, lighting: defaultLighting };
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

const seed = (value: unknown) => typeof value === 'string' && Boolean(value.trim()) && value.length <= 160;
const color = (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const number = (value: unknown, low: number, high: number) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const style = (value: unknown) => (worldStyles as readonly unknown[]).includes(value);

export function isEnvironment(value: unknown): value is Environment {
  if (!record(value) || !style(value.style) || !seed(value.seed)) return false;
  const { layers, atmosphere, lighting, surface } = value;
  return (value.structureDensity === undefined || number(value.structureDensity, 0, 1))
    && (value.residentPolicy === undefined || (policies as readonly unknown[]).includes(value.residentPolicy))
    && (value.morphology === undefined || (morphologyNames as readonly unknown[]).includes(value.morphology))
    && record(layers) && layerNames.every(layer => {
    const recipe = layers[layer];
    return record(recipe) && style(recipe.style) && seed(recipe.seed) && typeof recipe.locked === 'boolean';
  }) && record(surface) && [surface.low, surface.high, surface.accent].every(color)
    && number(surface.roughness, 0, 1) && number(surface.metalness, 0, .6)
    && record(atmosphere) && [atmosphere.sky, atmosphere.fog].every(color)
    && number(atmosphere.distance, 8, 100) && number(atmosphere.depth, 24, 155)
    && record(lighting) && [lighting.key, lighting.ambient, lighting.bounce].every(color)
    && number(lighting.intensity, .5, 4) && number(lighting.fill, .5, 3)
    && number(lighting.bearing, -180, 180) && number(lighting.elevation, 10, 58);
}
