import { describe, expect, it } from 'vitest';
import { gardenReferences, gardenSpecimen } from '../src/reborn/genome';
import { bodyPlans } from '../src/reborn/morphology';
import { GardenMotion, stepSeconds } from '../src/reborn/motion';
import type { MotionField } from '../src/reborn/motion';
import { GardenRelations } from '../src/reborn/relations';
import { makeTerrain, defaultLand, worldBounds } from '../src/reborn/terrain';
import { LivingTerritory, visitLifetime, visitLimit } from '../src/reborn/territory';

const openField: MotionField = { bounds: worldBounds, height: () => 0, slope: () => 0, points: [] };
function localResident(index: number, x: number) {
  return new GardenMotion(gardenReferences[index].genome, [x, 0], [], .6, openField);
}

describe('Living Territories', () => {
  it('derives differences from genome while bounding and expiring spatial memory', () => {
    const specimen = gardenSpecimen('same traits', undefined, { curiosity: .2, caution: .5 });
    const a = new LivingTerritory(specimen.genome, [0, 0], openField, worldBounds, () => true);
    const replay = new LivingTerritory(specimen.genome, [0, 0], openField, worldBounds, () => true);
    const curious = new LivingTerritory({ ...specimen.genome, curiosity: .93 }, [0, 0], openField, worldBounds, () => true);
    expect(curious.range).toBeGreaterThan(a.range + 6);
    expect(a.traits).toEqual(replay.traits);
    expect(a.choose([0, 0], 1)).toEqual(replay.choose([0, 0], 1));
    expect(a.choose([10, 0], 200).intent).toBe('Return Home');
    for (let i = 0; i < 22; i++) {
      a.arrived({ point: [i * 2.1, 0], intent: 'Inspect Object', interest: 'landmark-' + i }, i + 2);
    }
    expect(a.recentVisits(24)).toHaveLength(visitLimit);
    expect(a.recentVisits(24)[0].interest).toBe('landmark-13');
    a.arrived({ point: [21 * 2.1 - .1, 0], intent: 'Explore' }, 25);
    expect(a.recentVisits(25)).toHaveLength(visitLimit);
    expect(a.recentVisits(25 + visitLifetime)).toHaveLength(0);
  });

  it('allows one delayed partial imitation without starting a new natural gesture', () => {
    const vessel = localResident(3, 2);
    const relay = localResident(6, 0);
    expect(vessel.respond('Imitation', relay, 4.25, .7, 2)).toBe(true);
    const active = new Set<string>();
    let peak = 0;
    let acts = 0;
    for (let frame = 0; frame < 360; frame++) {
      const previous = vessel.pose.phase;
      const pose = vessel.step();
      if (pose.phase === 'Act') {
        if (previous !== 'Act') acts++;
        peak = Math.max(peak, pose.action);
        active.add(pose.gesture);
        expect(vessel.naturalGesture).toBe(0);
        expect(pose.time).toBeGreaterThan(.7);
      }
    }
    expect([...active]).toEqual(['Pulse']);
    expect(acts).toBe(1);
    expect(peak).toBeCloseTo(.59, 2);
    expect(vessel.pose.social).toBeNull();
    expect(vessel.respond('Imitation', relay, 4.25)).toBe(false);
  });

  it('ends pursuit when a peer leaves or when the short response expires', () => {
    const relations = new GardenRelations('follow');
    const actor = localResident(0, 0), peer = localResident(1, 3);
    expect(actor.respond('Follow', peer, 4)).toBe(true);
    for (let i = 0; i < 90; i++) actor.step();
    expect(actor.pose.x).toBeGreaterThan(.28);
    relations.remove(peer, [actor]);
    expect(actor.pose.social).toBeNull();

    const other = localResident(0, 0);
    expect(other.respond('Follow', peer, 3.7)).toBe(true);
    for (let i = 0; i < 236; i++) other.step();
    expect(other.pose.social).toBeNull();
    expect(other.respond('Follow', peer, 3.7)).toBe(false);
  });

  it('runs all nine residents for over ten simulated minutes with returns, rest, and bounded social visits', () => {
    const terrain = makeTerrain(defaultLand);
    const field = { ...terrain, bounds: worldBounds };
    const residents = gardenReferences.map((item, slot) =>
      new GardenMotion(item.genome, terrain.anchors[slot], terrain.landmarks, bodyPlans[item.genome.plan].radius(item.genome), field));
    const world = new GardenRelations(defaultLand.seed);
    const perResident = residents.map(() => ({ range: 0, home: 0, rest: 0 }));
    const observed = new Set<string>();
    const previousPairs = new Map<string, number>();
    let mostRecent = -1;
    for (let tick = 0; tick < 37_200; tick++) {
      for (const resident of residents) resident.step(stepSeconds, residents);
      world.step(stepSeconds, residents);
      if (tick % 12) continue;
      for (const [i, actor] of residents.entries()) {
        const p = actor.pose, stats = perResident[i], territory = actor.territory!;
        if (Math.abs(p.x) > worldBounds.x || Math.abs(p.z) > worldBounds.z || !Number.isFinite(terrain.height(p.x, p.z))) {
          throw new Error('A resident left the valid field');
        }
        const distance = Math.hypot(p.x - territory.home[0], p.z - territory.home[1]);
        stats.range = Math.max(stats.range, distance);
        if (p.phase === 'Rest' && p.intent === 'Return Home' && distance < .8) stats.home++;
        if (p.phase === 'Rest' && p.intent === 'Seek Rest') stats.rest++;
        if (territory.recentVisits(p.time).length > visitLimit) throw new Error('Unbounded memory');
        observed.add(p.intent);
      }
      if (world.events.length > 12) throw new Error('Unbounded relations');
      for (const event of world.events) {
        if (event.at <= mostRecent) continue;
        const pair = [event.actor, event.peer].sort().join('|');
        expect(event.at - (previousPairs.get(pair) ?? -Infinity)).toBeGreaterThan(14);
        previousPairs.set(pair, event.at);
        observed.add(event.kind);
      }
      mostRecent = world.events.at(-1)?.at ?? mostRecent;
    }
    expect(perResident.every(stats => stats.range > 3 && stats.rest > 10)).toBe(true);
    expect(perResident.filter(stats => stats.home > 1).length).toBeGreaterThanOrEqual(6);
    expect(Math.max(...perResident.map(stats => stats.range))).toBeGreaterThan(12);
    for (const behavior of ['Explore', 'Inspect Object', 'Gather', 'Return Home', 'Seek Rest', 'Encounter', 'Follow', 'Imitation']) {
      expect(observed.has(behavior), behavior).toBe(true);
    }
  }, 15_000);
});
