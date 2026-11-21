import { Vector3 } from 'three';
import { clamp } from '../../core/random';
import { keptAboveLand, landscapeFrame } from '../camera';
import type { ObservationView } from '../camera';
import type { GroundPoint } from '../motion';
import type { Terrain } from '../terrain';

export type Station = ObservationView & { name: string };
export const stationDuration = 100;

export function observationStations(terrain: Terrain, portrait: boolean, homes: readonly GroundPoint[]): Station[] {
  const lens = new Vector3(), target = new Vector3(), fov = portrait ? 53 : 40;
  landscapeFrame(terrain, portrait, lens, target);
  lens.y = keptAboveLand(lens, terrain, target);
  const stations: Station[] = [{ name: 'Open field', position: lens.toArray(), target: target.toArray(), zoom: 1, fov }];
  const nearestMonument = terrain.landmarks.find(item => !item.distant);
  const points: Array<{ name: string; at: GroundPoint; offset: [number, number, number] }> = [
    { name: 'Standing forms', at: nearestMonument ? [nearestMonument.x, nearestMonument.z] : [-10, -7], offset: [-9, 7.5, 19] },
    { name: 'Resident paths', at: homes[1] ?? homes[0] ?? [3, 1], offset: [12, 6, 15] },
    { name: 'Far rise', at: [11, -15], offset: [5, 9, 23] },
  ];
  for (const { name, at: [x, z], offset: [dx, dy, dz] } of points) {
    const h = terrain.height(x, z);
    target.set(x, h + 1.2, z);
    lens.set(x + dx, h + dy, z + dz);
    lens.y = keptAboveLand(lens, terrain, target);
    stations.push({ name, position: lens.toArray(), target: target.toArray(), zoom: 1, fov });
  }
  return stations;
}

export class Observatory {
  private elapsed = 0;
  private index = 0;
  private stations: readonly Station[] = [];
  auto = false;

  load(stations: readonly Station[]) {
    this.stations = stations;
    this.index = 0;
    this.elapsed = 0;
  }

  get station(): Station | undefined { return this.stations[this.index]; }

  step(direction: number) {
    if (!this.stations.length) return undefined;
    this.index = (this.index + direction + this.stations.length) % this.stations.length;
    this.elapsed = 0;
    return this.station;
  }

  advance(dt: number) {
    if (!this.auto || !this.stations.length) return undefined;
    this.elapsed += clamp(dt, 0, 1);
    return this.elapsed >= stationDuration ? this.step(1) : undefined;
  }
}
