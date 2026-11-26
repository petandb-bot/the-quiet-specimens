import { clamp, mix } from '../../core/random';
import type { GroundPoint } from '../motion';

export const editEdge = 30;
export const editSide = editEdge * 2 + 1;
export const editCells = editSide ** 2;
export type Grid<T> = Readonly<Record<number, T>>;
export const surfaceFamilies = {
  Chalk: { color: '#d8cdb9', roughness: .94, metalness: 0 },
  Mineral: { color: '#807a7d', roughness: .62, metalness: .13 },
  Oxide: { color: '#a26748', roughness: .80, metalness: .22 },
  Dust: { color: '#bba782', roughness: 1, metalness: 0 },
  Glass: { color: '#779b9d', roughness: .24, metalness: .24 },
  Organic: { color: '#71816a', roughness: .74, metalness: .03 },
} as const;

export type SurfaceFamily = keyof typeof surfaceFamilies;
export type PaintCell = readonly [SurfaceFamily, number];
export type Sculpt = 'Raise' | 'Lower' | 'Smooth' | 'Flatten';
export type WaterRegion = { id: string; x: number; z: number; radius: number; level: number; color: string; clarity: number };
export type PersonalLand = { relief: Grid<number>; paint: Grid<PaintCell>; water: readonly WaterRegion[] };
export const emptyLand: PersonalLand = { relief: {}, paint: {}, water: [] };
export const waterLimit = 4;

export function cellKey(x: number, z: number) {
  return (z + editEdge) * editSide + x + editEdge;
}

export function cellPoint(key: number): GroundPoint {
  return [key % editSide - editEdge, Math.floor(key / editSide) - editEdge];
}

export function reliefAt(relief: Grid<number>, x: number, z: number) {
  return Math.abs(x) <= editEdge && Math.abs(z) <= editEdge ? relief[cellKey(x, z)] ?? 0 : 0;
}

function visit(point: GroundPoint, radius: number, apply: (x: number, z: number, weight: number) => void) {
  const [x, z] = point;
  for (let a = Math.max(-editEdge, Math.ceil(x - radius)); a <= Math.min(editEdge, x + radius); a++) {
    for (let b = Math.max(-editEdge, Math.ceil(z - radius)); b <= Math.min(editEdge, z + radius); b++) {
      const t = 1 - Math.hypot(a - x, b - z) / radius;
      if (t > 0) apply(a, b, t * t * (3 - 2 * t));
    }
  }
}

export function sculpt(relief: Grid<number>, point: GroundPoint, mode: Sculpt, radius: number, strength: number,
  base: (x: number, z: number) => number, flatten: number): Grid<number> {
  let next: Record<number, number> | undefined;
  const height = (x: number, z: number) => base(x, z) + reliefAt(relief, x, z);
  visit(point, radius, (x, z, weight) => {
    const original = base(x, z);
    const current = height(x, z);
    const target = mode === 'Smooth' ? (height(x - 1, z) + height(x + 1, z) + height(x, z - 1) + height(x, z + 1)) / 4
      : mode === 'Flatten' ? flatten : current + (mode === 'Raise' ? .65 : -.65);
    const edge = clamp((editEdge - Math.max(Math.abs(x), Math.abs(z))) / 2);
    const delta = mix(current, target, strength * weight * edge) - original;
    const amount = Math.round(clamp(delta, -5, 5) * 1000) / 1000;
    const key = cellKey(x, z);
    if ((relief[key] ?? 0) === amount) return;
    next ??= { ...relief };
    if (amount) next[key] = amount;
    else delete next[key];
  });
  return next ?? relief;
}

export function paintSurface(paint: Grid<PaintCell>, point: GroundPoint, family: SurfaceFamily | undefined, radius: number) {
  let next: Record<number, PaintCell> | undefined;
  visit(point, radius, (x, z, influence) => {
    const key = cellKey(x, z), old = paint[key];
    const weight = family ? mix(old?.[0] === family ? old[1] : 0, 1, influence) : (old?.[1] ?? 0) * (1 - influence);
    const cell = weight > .025 && (family || old) ? [family ?? old[0], Math.round(weight * 255) / 255] as const : undefined;
    if (cell?.[0] === old?.[0] && cell?.[1] === old?.[1]) return;
    next ??= { ...paint };
    if (cell) next[key] = cell;
    else delete next[key];
  });
  return next ?? paint;
}

// Sample by travelled world distance so the input event rate does not control brush strength.
export class BrushPath {
  private last?: GroundPoint;
  private remainder = 0;

  constructor(private spacing: number, private dab: (point: GroundPoint) => void) {}

  add(point: GroundPoint) {
    const last = this.last;
    this.last = point;
    if (!last) { this.dab(point); return; }
    const distance = Math.hypot(point[0] - last[0], point[1] - last[1]);
    let cursor = this.spacing - this.remainder;
    for (; cursor <= distance; cursor += this.spacing) {
      const t = cursor / distance;
      this.dab([mix(last[0], point[0], t), mix(last[1], point[1], t)]);
    }
    this.remainder = distance + this.spacing - cursor;
  }
}

export function waterHeight(water: readonly WaterRegion[], height: (x: number, z: number) => number, x: number, z: number) {
  let level = height(x, z);
  for (const item of water) {
    if (Math.hypot(x - item.x, z - item.z) <= item.radius) level = Math.max(level, item.level);
  }
  return level;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
const within = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
function validGrid(value: unknown, entry: (value: unknown) => boolean) {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= editCells && entries.every(([key, cell]) => /^\d+$/.test(key)
    && String(Number(key)) === key && within(Number(key), 0, editCells - 1) && entry(cell));
}

export function isPersonalLand(value: unknown): value is PersonalLand {
  if (!isRecord(value) || !validGrid(value.relief, cell => within(cell, -5, 5))
    || !validGrid(value.paint, cell => Array.isArray(cell) && cell.length === 2 && typeof cell[0] === 'string'
      && Object.hasOwn(surfaceFamilies, cell[0]) && within(cell[1], 0, 1))
    || !Array.isArray(value.water) || value.water.length > waterLimit) return false;
  const ids = new Set<string>();
  return value.water.every(item => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id || item.id.length > 100 || ids.has(item.id)
      || !within(item.x, -30, 30) || !within(item.z, -30, 30) || !within(item.radius, 2, 16)
      || !within(item.level, -12, 12) || !within(item.clarity, 0, 1)
      || typeof item.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(item.color)) return false;
    ids.add(item.id);
    return true;
  });
}
