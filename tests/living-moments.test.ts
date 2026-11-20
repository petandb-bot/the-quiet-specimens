import { expect, it } from 'vitest';
import { random } from '../src/core/random';
import { gardenReferences } from '../src/reborn/genome';
import { RecentMoments } from '../src/reborn/observation/moments';
import { GardenMotion, stepSeconds } from '../src/reborn/motion';
import { makeTerrain, defaultLand, worldBounds } from '../src/reborn/terrain';

it('keeps only a bounded, expiring set of events actually supplied by the simulation', () => {
  const journal = new RecentMoments();
  expect(journal.recent(4)).toEqual([]);
  for (let i = 0; i < 50; i++) journal.add({ actor: String(i), at: i, kind: 'Waiting' });
  expect(journal.recent(50).map(item => item.actor)).toEqual(Array.from({ length: 20 }, (_, i) => String(i + 30)));
  expect(journal.recent(200)).toEqual([]);
});

it('delivers a greeting as a gradual response and records autonomous waiting and sleep', () => {
  const terrain = makeTerrain(defaultLand);
  const field = { bounds: worldBounds, height: terrain.height, slope: terrain.slope, points: terrain.points };
  const study = gardenReferences.find(item => random(item.genome.seed + '/moments').next() < .72)!;
  const resident = new GardenMotion(study.genome, [0, 0], [], .65, field);
  const peer = new GardenMotion(gardenReferences[1].genome, [0, 2], [], .65, field);
  const events = new Set<string>();
  resident.respond('Observe Other', peer, 2.3);
  const known = resident.takeMoment();
  expect(known).toEqual({ kind: 'Greeting', peer: peer.seed });
  expect(resident.pose.greet).toBe(0);
  for (let f = 0; f < 70; f++) resident.step(stepSeconds);
  expect(resident.pose.greet).toBeGreaterThan(.1);
  for (let i = 0; i < 30_000; i++) {
    resident.step(stepSeconds);
    const moment = resident.takeMoment();
    if (moment) events.add(moment.kind);
  }
  expect(events.has('Sleeping')).toBe(true);
  expect(events.has('Waiting')).toBe(true);
});
