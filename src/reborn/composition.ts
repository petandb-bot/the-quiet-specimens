import { clamp, random } from '../core/random';
import type { GroundPoint, Obstacle } from './motion';

export interface Landmark extends Obstacle {
  id: string;
  kind: 'arch' | 'monolith' | 'ring' | 'stones';
  yaw: number;
  scale: number;
  distant: boolean;
}
type Level = { seed: string; kind: string; openness: number; density: number };
export type PointOfInterest = { id: string; position: GroundPoint; shelter: number };

export function composeLandscape(settings: Level, slope: (x: number, z: number) => number) {
  const rng = random('elsewhere/composition/2/' + settings.seed);
  const heightFamily = settings.kind === 'Hollow Land' ? -1 : 1;
  const clear = .85 + settings.openness * .35;
  const positions: Array<[GroundPoint, Landmark['kind'], number]> = [
    [[-11 * clear, -9], 'arch', 2.65],
    [[12 * clear, -18 * heightFamily], 'monolith', 2.05],
    [[-7 * clear, 10], 'stones', .79],
    [[-10 * clear, 12], 'stones', .98],
    [[18 * clear, -8], 'ring', 1.72],
    [[20 * clear, -7], 'stones', .70],
    [[-22, -17], 'monolith', 1.70],
    [[9, -23], 'stones', .90],
  ];
  const landmarks: Landmark[] = [];
  function place([x, z]: GroundPoint, kind: Landmark['kind'], size: number, distant = false) {
    x += rng.range(-2.4, 2.4);
    z += rng.range(-2.0, 2.0);
    const scale = size * rng.range(.83, 1.20);
    const extent = kind === 'arch' ? 1.16 : kind === 'stones' ? 1.63 : 1.27;
    landmarks.push({ id: kind + '-' + landmarks.length, kind, x, z, scale, distant, yaw: rng.range(-.7, .7), radius: scale * extent });
  }
  const visible = Math.round(3 + settings.density * 5);
  for (const [position, kind, size] of positions.slice(0, visible)) place(position, kind, size);
  // Two asymmetric silhouettes sit beyond the inhabited area.
  place([-37, -42], 'monolith', 3.22, true);
  place([29, -62], 'arch', 3.4, true);

  const points: PointOfInterest[] = landmarks.filter(item => !item.distant).map(item => {
    const a = item.yaw + 1.2;
    const distance = item.radius + 2.25;
    return {
      id: item.id, shelter: item.kind === 'arch' || item.kind === 'stones' ? .9 : .36,
      position: [clamp(item.x + Math.cos(a) * distance, -25, 25), clamp(item.z + Math.sin(a) * distance, -25, 25)],
    };
  });
  points.push({ id: 'open-reach', position: [2, -10], shelter: .16 });
  const starting: GroundPoint[] = [[-5, 2], [3, -3], [5, 6], [-10, -3], [10, 0], [-4, -10], [2, 12], [-15, 4], [14, -7]];
  const anchors: GroundPoint[] = [];
  for (const [x, z] of starting) {
    let best: GroundPoint = [x, z];
    let low = Infinity;
    for (let i = 0; i < 52; i++) {
      const spread = i < 28 ? 6 : 12;
      const u = i === 0 ? x : clamp(x + rng.range(-spread, spread), -25, 25);
      const v = i === 0 ? z : clamp(z + rng.range(-spread, spread), -25, 25);
      const clearance = landmarks.reduce((closest, item) => Math.min(closest, Math.hypot(item.x - u, item.z - v) - item.radius), Infinity);
      const separation = anchors.reduce((closest, item) => Math.min(closest, Math.hypot(item[0] - u, item[1] - v)), Infinity);
      const score = slope(u, v) * 3 + Math.hypot(x - u, z - v) * .08
        + Math.max(0, 2.2 - clearance) * 5 + Math.max(0, 3 - separation) * 3;
      if (score < low) { best = [u, v]; low = score; }
      if (score < .62) break;
    }
    anchors.push(best);
  }
  return { anchors, landmarks, points };
}
