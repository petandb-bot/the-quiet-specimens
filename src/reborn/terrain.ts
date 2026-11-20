import { clamp, hashText, mix, random } from '../core/random';
import type { GroundPoint, Obstacle } from './motion';

export const terrainKinds = ['Rolling Field', 'Terraces', 'Hollow Land'] as const;
export type TerrainKind = typeof terrainKinds[number];
export interface LandSettings { seed: string; kind: TerrainKind; elevation: number; roughness: number }
export const defaultLand: LandSettings = { seed: 'ELSEWHERE-01', kind: 'Rolling Field', elevation: .48, roughness: .26 };
export const worldBounds = { x: 30, z: 30 };
export const landExtent = 120;
export const gridSpacing = 1;
export interface Landmark extends Obstacle { kind: 'arch' | 'monolith' | 'ring' | 'stones'; yaw: number; scale: number }
export interface Terrain {
  settings: LandSettings;
  height: (x: number, z: number) => number;
  slope: (x: number, z: number) => number;
  anchors: GroundPoint[];
  landmarks: Landmark[];
}
const ease = (t: number) => t * t * (3 - 2 * t);

export function makeTerrain(input: LandSettings): Terrain {
  const settings: LandSettings = { seed: input.seed.trim().slice(0, 48) || defaultLand.seed,
    kind: terrainKinds.includes(input.kind) ? input.kind : defaultLand.kind,
    elevation: Number.isFinite(input.elevation) ? clamp(input.elevation) : defaultLand.elevation,
    roughness: Number.isFinite(input.roughness) ? clamp(input.roughness) : defaultLand.roughness };
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
    return h * settings.elevation;
  };
  // Same triangle interpolation as the rendered PlaneGeometry. No separate physics height map.
  const height = (x: number, z: number) => {
    const ix = Math.floor(x / gridSpacing) * gridSpacing, iz = Math.floor(z / gridSpacing) * gridSpacing;
    const u = (x - ix) / gridSpacing, v = (z - iz) / gridSpacing;
    const a = raw(ix, iz), b = raw(ix, iz + gridSpacing), d = raw(ix + gridSpacing, iz);
    if (u + v <= 1) return a + (d - a) * u + (b - a) * v;
    const c = raw(ix + gridSpacing, iz + gridSpacing);
    return c + (b - c) * (1 - u) + (d - c) * (1 - v);
  };
  const slope = (x: number, z: number) => Math.hypot(height(x + .5, z) - height(x - .5, z), height(x, z + .5) - height(x, z - .5));
  const rng = random('elsewhere/landmarks/1/' + settings.seed);
  const landmarks: Landmark[] = [];
  const places: GroundPoint[] = [[-12,-9],[10,-15],[16,5],[-20,11],[-5,-24],[22,-22],[-25,-20],[3,16]];
  const kinds = ['arch', 'monolith', 'ring', 'stones'] as const;
  for (const [i, p] of places.entries()) {
    const x = p[0] + rng.range(-2, 2), z = p[1] + rng.range(-2, 2);
    const scale = rng.range(1.2, 2.4);
    landmarks.push({ x, z, kind: kinds[i % kinds.length], yaw: rng.range(-.7,.7), scale, radius: scale * 1.4 });
  }
  const anchors: GroundPoint[] = [[-5,2],[3,-3],[5,6],[-10,-3],[10,0],[-4,-10],[2,12],[-15,4],[14,-7]];
  const valid = (x: number,z: number) => slope(x,z) < .72 && landmarks.every(o => Math.hypot(x-o.x,z-o.z)>o.radius+1.6);
  return { settings, height, slope, landmarks, anchors: anchors.map(([x,z]): GroundPoint => {
    if(valid(x,z)) return [x,z];
    for(let i=0;i<48;i++){const u=clamp(x+rng.range(-6,6),-26,26),v=clamp(z+rng.range(-6,6),-26,26);if(valid(u,v))return [u,v];}
    return [x,z];
  }) };
}
