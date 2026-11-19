import { InstancedMesh, Matrix4, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { Aquarium } from '../src/aquarium/scene';
import { shoalCounts, shoalMembers, shoalPose, tankFloor, tankPose } from '../src/aquarium/motion';
import type { Pose, Shoal } from '../src/aquarium/motion';

const pose = (): Pose => ({ position: [0, 0, 0], yaw: 0, roll: 0, pitch: 0 });

describe('Aquarium', () => {
  it('keeps the two shoals at different depths and inside the viewing volume', () => {
    const means: Record<Shoal, number[]> = { guppies: [], goldfish: [] };
    for (const kind of ['guppies', 'goldfish'] as const) {
      const school = shoalMembers(kind);
      expect(school).toEqual(shoalMembers(kind));
      expect(new Set(school.map(member => member.phase)).size).toBe(school.length);
      const out = pose();
      for (let time = 0; time < 120; time += .5) {
        let mean = 0;
        for (const member of school) {
          shoalPose(kind, member, time, out);
          expect(out.position.every(Number.isFinite)).toBe(true);
          expect(Math.abs(out.position[0])).toBeLessThan(6.7);
          expect(Math.abs(out.position[2])).toBeLessThan(4.6);
          expect(Number.isFinite(out.yaw)).toBe(true);
          mean += out.position[1] / school.length;
        }
        means[kind].push(mean);
      }
    }
    expect(means.guppies.every((y, i) => y - means.goldfish[i] > .5)).toBe(true);
  });

  it('gives the floor fish smaller excursions than the surface cruiser and the hovering seahorse', () => {
    const floor = pose(), mayor = pose(), clerk = pose();
    const x: number[] = [], y: number[] = [];
    for (let t = 0; t < 120; t += .2) {
      tankPose('floor', t, floor);
      tankPose('arowana', t, mayor);
      tankPose('seahorse', t, clerk);
      expect(floor.position[1]).toBeGreaterThan(tankFloor);
      expect(floor.position[1]).toBeLessThan(tankFloor + .3);
      expect(Math.abs(floor.position[0] + 1.15)).toBeLessThan(.5);
      expect(mayor.position[1]).toBeGreaterThan(1.35);
      x.push(mayor.position[0]);
      y.push(clerk.position[1]);
    }
    expect(Math.max(...x) - Math.min(...x)).toBeGreaterThan(9);
    expect(Math.max(...y) - Math.min(...y)).toBeGreaterThan(.45);
  });

  it('changes live instance counts per scene and keeps fish still while paused', () => {
    const tank = new Aquarium(new Texture());
    const guppies = tank.scene.getObjectByName('guppies') as InstancedMesh;
    const goldfish = tank.scene.getObjectByName('goldfish') as InstancedMesh;
    expect(guppies.count).toBe(shoalCounts.mixed.guppies);
    expect(goldfish.count).toBe(shoalCounts.mixed.goldfish);
    tank.setPreset('goldfish');
    expect(guppies.visible).toBe(false);
    expect(goldfish.count).toBe(shoalCounts.goldfish.goldfish);
    const start = new Matrix4();
    const next = new Matrix4();
    goldfish.getMatrixAt(0, start);
    tank.paused = true;
    tank.update(1);
    goldfish.getMatrixAt(0, next);
    expect(next.equals(start)).toBe(true);
    tank.paused = false;
    tank.update(1);
    goldfish.getMatrixAt(0, next);
    expect(next.equals(start)).toBe(false);
    tank.setPreset('guppies');
    expect(goldfish.visible).toBe(false);
    expect(guppies.count).toBe(shoalCounts.guppies.guppies);
  });
});
