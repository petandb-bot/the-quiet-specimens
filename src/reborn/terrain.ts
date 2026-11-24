import { clamp, hashText, mix } from '../core/random';
import { composeLandscape } from './composition';
import type { Landmark, PointOfInterest } from './composition';
import type { GroundPoint } from './motion';

export const terrainKinds = ['Rolling Field', 'Terraces', 'Hollow Land'] as const;
export type TerrainKind = typeof terrainKinds[number];
export interface LandSettings { seed: string; kind: TerrainKind; elevation: number; roughness: number; openness?: number; density?: number }
export const defaultLand: Required<LandSettings> = { seed: 'ELSEWHERE-01', kind: 'Rolling Field', elevation: .48, roughness: .26, openness: .61, density: .66 };
export const worldBounds = { x: 30, z: 30 };
export const landExtent = 120;
export const gridSpacing = 1;
export interface Terrain {
  settings: Required<LandSettings>;
  height: (x: number, z: number) => number;
  slope: (x: number, z: number) => number;
  anchors: GroundPoint[];
  landmarks: Landmark[];
  points: PointOfInterest[];
}
const ease = (t: number) => t * t * (3 - 2 * t);

export function normalizeLand(input: LandSettings): Required<LandSettings> {
  const normalized = (value: number | undefined, fallback: number) => Number.isFinite(value) ? clamp(value!) : fallback;
  return {
    seed: input.seed.trim().slice(0, 48) || defaultLand.seed,
    kind: terrainKinds.includes(input.kind) ? input.kind : defaultLand.kind,
    elevation: normalized(input.elevation, defaultLand.elevation),
    roughness: normalized(input.roughness, defaultLand.roughness),
    openness: normalized(input.openness, defaultLand.openness),
    density: normalized(input.density, defaultLand.density),
  };
}

export function makeTerrain(input: LandSettings): Terrain {
  const settings = normalizeLand(input);
  const seed = hashText('elsewhere/terrain/1/' + settings.seed);
  const corner = (x: number, z: number) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295 * 2 - 1;
  };
  const noise = (x: number, z: number) => {
    const ix = Math.floor(x), iz = Math.floor(z), u = ease(x - ix), v = ease(z - iz);
    return mix(mix(corner(ix, iz), corner(ix + 1, iz), u), mix(corner(ix, iz + 1), corner(ix + 1, iz + 1), u), v);
  };
  const raw = (x: number, z: number) => {
    const broad = noise(x * .065, z * .065);
    const detail = noise(x * .15 + 37, z * .15 - 18);
    const fine = noise(x * .31 - 9, z * .31 + 51);
    let h = broad * 4.5 + detail * (1.1 + settings.roughness * 1.4) + fine * settings.roughness * .65;
    if (settings.kind === 'Terraces') {
      // Soft ramps between levels rather than impassable vertical steps.
      const n = h / 1.5, k = Math.floor(n);
      h = (k + ease(clamp((n - k - .16) / .68))) * 1.5;
    } else if (settings.kind === 'Hollow Land') {
      h = broad * 2.6 - 4.6 * Math.max(0, 1 - Math.hypot(x + 7, z - 2) / 15) ** 2
        - 3.8 * Math.max(0, 1 - Math.hypot(x - 13, z + 13) / 14) ** 2 + detail * .9 + fine * settings.roughness * .4;
    }
    const openBasin = Math.exp(-((x - 1) ** 2 / 250 + (z - 3) ** 2 / 220));
    return h * settings.elevation * (1 - openBasin * settings.openness * .47);
  };
  // Float32 matches the vertices uploaded by PlaneGeometry, including both triangle halves.
  const side = landExtent * 2 / gridSpacing + 1;
  const vertices = new Float32Array(side * side);
  for (let zi = 0; zi < side; zi++) {
    for (let xi = 0; xi < side; xi++) {
      vertices[zi * side + xi] = raw(xi * gridSpacing - landExtent, zi * gridSpacing - landExtent);
    }
  }
  const vertex = (x: number, z: number) => {
    const xi = (x + landExtent) / gridSpacing, zi = (z + landExtent) / gridSpacing;
    return xi >= 0 && xi < side && zi >= 0 && zi < side ? vertices[zi * side + xi] : Math.fround(raw(x, z));
  };
  const height = (x: number, z: number) => {
    const ix = Math.floor(x / gridSpacing) * gridSpacing, iz = Math.floor(z / gridSpacing) * gridSpacing;
    const u = (x - ix) / gridSpacing, v = (z - iz) / gridSpacing;
    const a = vertex(ix, iz), b = vertex(ix, iz + gridSpacing), d = vertex(ix + gridSpacing, iz);
    if (u + v <= 1) return a + (d - a) * u + (b - a) * v;
    const c = vertex(ix + gridSpacing, iz + gridSpacing);
    return c + (b - c) * (1 - u) + (d - c) * (1 - v);
  };
  const slope = (x: number, z: number) => Math.hypot(height(x + .5, z) - height(x - .5, z), height(x, z + .5) - height(x, z - .5));
  return { settings, height, slope, ...composeLandscape(settings, slope) };
}
