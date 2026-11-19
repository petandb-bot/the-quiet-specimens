import { Box3, Group, Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { fromGardenSeed, gardenMaterials, gardenPlans, gardenReferences, gardenSpecimen } from '../src/reborn/genome';
import { bodyPlans, buildSpecimen } from '../src/reborn/morphology';
import { anchors, gardenObstacles } from '../src/reborn/garden';
import { field, GardenMotion, limitFrame, stepSeconds } from '../src/reborn/motion';

describe('Reborn study', () => {
  it('replays generated genomes and the nine reference specimens by seed', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 180; i++) {
      const seed = `plot-${i}`;
      expect(gardenSpecimen(seed)).toEqual(fromGardenSeed(seed));
      const g = gardenSpecimen(seed).genome;
      expect(g.modules).toBeGreaterThanOrEqual(3);
      expect(g.modules).toBeLessThanOrEqual(8);
      seen.add(g.material);
    }
    expect(seen).toEqual(new Set(gardenMaterials));
    for (const plan of gardenPlans) {
      const specimens = gardenReferences.filter(r => r.genome.plan === plan);
      expect(specimens).toHaveLength(3);
      for (const reference of specimens) expect(fromGardenSeed(reference.genome.seed)).toBe(reference);
    }
  });

  it('builds finite articulated geometry across plans, reference specimens, and new seeds', () => {
    const subjects = [...gardenReferences, ...gardenPlans.flatMap(plan =>
      Array.from({ length: 10 }, (_, i) => gardenSpecimen(plan + i, undefined, { plan })))];
    for (const { genome } of subjects) {
      const rig = buildSpecimen(genome);
      const motion = new GardenMotion(genome, [0, 0]);
      motion.perform();
      for (let frame = 0; frame < 160; frame++) rig.animate(motion.step());
      const bounds = new Box3().setFromObject(rig.root).getSize(new Vector3());
      expect(bounds.toArray().every(value => Number.isFinite(value) && value > .12)).toBe(true);
      rig.root.traverse(child => {
        if (!(child instanceof Mesh)) return;
        expect(child.geometry.getAttribute('position').array.every(Number.isFinite)).toBe(true);
        expect(child.geometry.getAttribute('normal').array.every(Number.isFinite)).toBe(true);
      });
      rig.dispose();
    }
  });

  it('cleans up geometry and shared materials when a model is removed', () => {
    const host = new Group();
    for (const plan of gardenPlans) {
      const rig = buildSpecimen(gardenSpecimen(plan, undefined, { plan }).genome);
      host.add(rig.root);
      let cleanedGeometry = 0, cleanedMaterial = 0, meshCount = 0;
      const materials = new Set<Mesh['material']>();
      rig.root.traverse(item => {
        if (!(item instanceof Mesh)) return;
        meshCount++;
        materials.add(item.material);
        item.geometry.addEventListener('dispose', () => { cleanedGeometry++; });
      });
      for (const material of materials) {
        if (!Array.isArray(material)) material.addEventListener('dispose', () => { cleanedMaterial++; });
      }
      rig.dispose();
      expect(host.children).toHaveLength(0);
      expect(cleanedGeometry).toBe(meshCount);
      expect(cleanedMaterial).toBe(materials.size);
    }
  });

  it('includes anticipation, action, recovery and rest for each plan', () => {
    for (const plan of gardenPlans) {
      const genome = gardenSpecimen(plan, undefined, { plan }).genome;
      const motion = new GardenMotion(genome, [0, 0]);
      motion.perform();
      const phases = new Set<string>();
      let maxAction = 0;
      for (let frame = 0; frame < 360; frame++) {
        const next = motion.step();
        phases.add(next.phase);
        maxAction = Math.max(maxAction, next.action);
        expect(Number.isFinite(next.yaw)).toBe(true);
      }
      expect([...phases].slice(0, 5)).toEqual(['Hesitate', 'Act', 'Recover', 'Rest', 'Explore']);
      expect(maxAction).toBeGreaterThan(.9);
    }
  });

  it('keeps movement finite, gradual, and inside the garden over several minutes', () => {
    for (const [i, reference] of gardenReferences.entries()) {
      const { genome } = reference;
      const motion = new GardenMotion(genome, anchors[i % anchors.length], gardenObstacles, bodyPlans[genome.plan].radius(genome));
      const clearance = Math.max(0, bodyPlans[genome.plan].radius(genome) - .75);
      let previous = [motion.pose.x, motion.pose.z];
      for (let frame = 0; frame < 10_800; frame++) {
        if (frame % 437 === 0) motion.react();
        const pose = motion.step();
        if (!(Math.abs(pose.x) <= field.x - clearance && Math.abs(pose.z) <= field.z - clearance &&
          Math.hypot(pose.x - previous[0], pose.z - previous[1]) < .07)) {
          throw new Error(`Discontinuous movement for ${reference.name} at frame ${frame}`);
        }
        previous = [pose.x, pose.z];
      }
    }
  });

  it('caps catch-up work and retains fractional simulation steps', () => {
    expect(limitFrame(7, 0).steps).toBe(6);
    const first = limitFrame(stepSeconds * .6, 0);
    expect(first.steps).toBe(0);
    expect(limitFrame(stepSeconds * .6, first.remainder).steps).toBe(1);
  });
});
