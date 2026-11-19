import { Mesh, Line, Vector3, Box3 } from 'three';
import { describe, expect, it } from 'vitest';
import { bounds, Swim } from '../src/behavior/swim';
import { actions, fishForms, plans } from '../src/core/model';
import { generate, specimen } from '../src/genesis/genome';
import { buildCreature } from '../src/morphology/creature';
import { featured, references } from '../src/presets/reference';

function checkGeometry(model: ReturnType<typeof buildCreature>) {
  const size = new Box3().setFromObject(model.group).getSize(new Vector3());
  expect(Math.max(size.x, size.y, size.z)).toBeGreaterThan(1.5);
  expect(size.y).toBeGreaterThan(.25);
  model.group.traverse(child => {
    if (!(child instanceof Mesh || child instanceof Line)) return;
    const vertex = child.geometry.getAttribute('position');
    const normal = child.geometry.getAttribute('normal');
    const index = child.geometry.index;
    expect(vertex.array.every(Number.isFinite)).toBe(true);
    expect(normal?.array.every(Number.isFinite) ?? true).toBe(true);
    expect(index?.array.every((value: number) => value >= 0 && value < vertex.count) ?? true).toBe(true);
  });
  model.dispose();
  return size;
}

describe('Mesh construction', () => {
  it('produces finite positions, normals, valid face indices and usable dimensions for many seeds', () => {
    for (const plan of plans) {
      for (let seed = 0; seed < 22; seed++) {
        const genome = generate(String(seed), 'Discover');
        genome.morphology.plan = plan;
        if (plan !== 'FISH') delete genome.morphology.fishForm;
        checkGeometry(buildCreature(specimen(genome), true));
      }
    }
  });
  it('keeps all eight forms well defined across seeds and visually distinct in their reference proportions', () => {
    for (const fishForm of fishForms) {
      for (let seed = 0; seed < 8; seed++) {
        const genome = generate(fishForm + seed, 'Discover');
        Object.assign(genome.morphology, { plan: 'FISH', fishForm });
        checkGeometry(buildCreature(specimen(genome), true));
      }
    }
    const sizes = new Map(featured.map(item => [item.genome.morphology.fishForm, checkGeometry(buildCreature(item))]));
    const round = sizes.get('round')!;
    const blade = sizes.get('blade')!;
    expect(round.y / round.x).toBeGreaterThan(.70);
    expect(blade.y / blade.x).toBeLessThan(.48);
    expect(round.y / round.x).toBeGreaterThan(blade.y / blade.x * 2);
    const seahorse = sizes.get('seahorse')!;
    const arowana = sizes.get('arowana')!;
    expect(seahorse.y / seahorse.x).toBeGreaterThan(1.6);
    expect(arowana.y / arowana.x).toBeLessThan(.35);
  });
});

describe('Behavior engine', () => {
  const make = (index = 0) => {
    const { genome } = references.find(item => item.genome.morphology.plan === plans[index])!;
    return new Swim(genome.behavior, genome.morphology.plan, genome.seed);
  };
  it('transitions through all manual states and recovers into another state', () => {
    for (const action of actions) {
      const swim = make();
      swim.trigger(action);
      const serial = swim.state.serial;
      expect(swim.state.action).toBe(action);
      expect(swim.state.phase).toBe(0);
      for (let t = 0; t < 600; t++) swim.step(1 / 60);
      expect(swim.state.serial).toBeGreaterThan(serial);
    }
  });
  it('limits reaction frequency and resumes responsiveness', () => {
    const swim = make();
    expect(swim.tap()).toBe(true);
    for (let i = 0; i < 20; i++) expect(swim.tap()).toBe(false);
    for (let i = 0; i < 150; i++) swim.step(1 / 60);
    expect(swim.tap()).toBe(true);
  });
  it('stays within all three chamber bounds across a long swim and a pause', () => {
    for (const i of [0, 1, 2]) {
      const swim = make(i);
      for (let frame = 0; frame < 9000; frame++) {
        if (frame % 288 === 0) swim.trigger(actions[(frame / 288) % actions.length]);
        const state = swim.step(frame === 100 ? 13 : 1 / 60);
        if (!state.position.every((value, k) => Number.isFinite(value) && Math.abs(value) <= bounds[k])) {
          throw new Error(`Specimen left the chamber at frame ${frame}`);
        }
      }
    }
  });
});
