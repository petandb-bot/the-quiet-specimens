import { expect, it } from 'vitest';
import { Group, Vector3 } from 'three';
import { gardenReferences } from '../src/reborn/genome';
import { buildSpecimen } from '../src/reborn/morphology';
import { GardenMotion } from '../src/reborn/motion';

it('adjusts HINGE feet and individual RELAY nodes to slopes and local heights', () => {
  for (const height of [
    () => 0,
    (x: number, z: number) => .29 * x - .26 * z,
    (x: number) => x > .1 ? .25 : 0,
  ]) {
    const origin = height(0, 0);
    const hinge = buildSpecimen(gardenReferences[0].genome);
    const hingeMotion = new GardenMotion(gardenReferences[0].genome, [0, 0]);
    hingeMotion.pose.yaw = 0;
    hinge.root.position.y = origin + .035;
    hinge.animate(hingeMotion.pose, { height, floor: origin });
    const frame = hinge.root.children[0];
    const feet = frame.children.filter(node => node instanceof Group).slice(0, 2)
      .map(knee => knee.children.find(node => node instanceof Group)!);
    const toeClearances = feet.map(foot => {
      const toe = foot.localToWorld(new Vector3(0, -.11, 0));
      return toe.y - height(toe.x, toe.z);
    });
    expect(Math.min(...toeClearances)).toBeGreaterThanOrEqual(-.00001);
    expect(Math.min(...toeClearances)).toBeLessThan(.09);
    hinge.dispose();

    const relay = buildSpecimen(gardenReferences[6].genome);
    const relayMotion = new GardenMotion(gardenReferences[6].genome, [0, 0]);
    relayMotion.pose.yaw = .45;
    relay.root.rotation.y = .45;
    relay.root.position.y = origin + .035;
    relay.animate(relayMotion.pose, { height, floor: origin });
    const segments = relay.root.children.filter(child => child instanceof Group);
    expect(segments).toHaveLength(gardenReferences[6].genome.modules);
    for (const segment of segments) {
      const point = segment.getWorldPosition(new Vector3());
      expect(point.y - height(point.x, point.z)).toBeCloseTo(.17);
    }
    relay.dispose();
  }
});
