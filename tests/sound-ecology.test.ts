import { expect, it } from 'vitest';
import { gardenReferences } from '../src/reborn/genome';
import { localSoundField, SoundEcology, worldGap, worldSustainLimit, worldVoiceLimit } from '../src/reborn/sound/ecology';
import type { PointOfInterest } from '../src/reborn/composition';

const roster = gardenReferences.map((specimen, id) => ({ id: String(id), specimen }));

it('starts the world promptly, rotates the full roster and bounds overlapping voices and note births', () => {
  const ecology = new SoundEcology();
  ecology.setResidents(roster, 0);
  ecology.begin(0);
  let voices: Array<{ end: number; sustained: boolean }> = [];
  const played = new Map<string, number>();
  const notes: number[] = [];
  for (let frame = 0; frame < 18000; frame++) {
    const now = frame * .04;
    voices = voices.filter(voice => voice.end > now);
    const score = ecology.next(now, voices.length, voices.filter(voice => voice.sustained).length, .85);
    if (!score) continue;
    expect(score.at - (notes.at(-1) ?? -Infinity)).toBeGreaterThanOrEqual(worldGap - 1e-7);
    expect(notes.filter(at => score.at - at < 2).length).toBeLessThanOrEqual(3);
    expect(score.strength).toBeLessThan(.8);
    notes.push(score.at);
    voices.push({ end: score.at + 2.7, sustained: score.sustained });
    expect(voices.length).toBeLessThanOrEqual(worldVoiceLimit);
    expect(voices.filter(voice => voice.sustained).length).toBeLessThanOrEqual(worldSustainLimit);
    played.set(score.id, (played.get(score.id) ?? 0) + 1);
  }
  expect(notes[0]).toBeLessThan(.2);
  expect(played.size).toBe(roster.length);
  expect(Math.min(...played.values())).toBeGreaterThan(5);
  expect(notes.length).toBeLessThan(850);
});

it('gives two identical genomes independent participants and removes only the absent participant', () => {
  const score = new SoundEcology();
  const [item] = roster;
  score.setResidents([{ ...item, id: 'A' }, { ...item, id: 'B' }], 0);
  score.begin(0);
  expect(score.size).toBe(2);
  expect(score.next(0, 0, 0, .62)?.id).toBe('A');
  expect(score.setResidents([{ ...item, id: 'B' }], .3)).toEqual(['A']);
  let heard = new Set<string>();
  for (let time = 0; time < 50; time += .08) {
    const note = score.next(time, 0, 0, .62);
    if (note) heard.add(note.id);
  }
  expect([...heard]).toEqual(['B']);
});

it('caps overlapping local effects and never resends a simulation interaction as a chain', () => {
  const center = { x: 0, z: 0, resting: true, gathering: true };
  const place = { id: 'first', center: [0, 0], role: 'Quiet', radius: 8, weight: .8, position: [0, 0], shelter: 0 } as PointOfInterest;
  expect(localSoundField(center, [place, { ...place, id: 'second', weight: .95 }])).toEqual({
    shelter: 0, quiet: .95, curiosity: 0, gathering: 0,
  });
  expect(localSoundField({ ...center, x: 8 }, [place]).quiet).toBe(0);
  const score = new SoundEcology();
  score.setResidents(roster.slice(0, 2), 0);
  score.begin(0);
  const events = Array.from({ length: 12 }, (_, at) => ({ kind: 'Encounter' as const, actor: '0', peer: '1', at }));
  let responses = 0;
  for (let time = 0; time < 100; time += .05) {
    score.observe(events, time, () => center);
    if (score.next(time, 0, 0, 1)?.response) responses++;
  }
  expect(responses).toBe(1);
});
