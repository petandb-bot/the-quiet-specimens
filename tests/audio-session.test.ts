import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { gardenReferences } from '../src/reborn/genome';
import { GardenSound } from '../src/reborn/sound/garden-sound';
import { note } from '../src/audio/voices';

vi.mock('../src/audio/voices', () => ({
  makeMaster: () => ({ gain: { setTargetAtTime: vi.fn() } }),
  note: vi.fn((_, _output, _sound, _rng, start: number) => ({ end: start + .2, stop: vi.fn() })),
}));

class FakeContext {
  static count = 0;
  static blocked = false;
  currentTime = 0;
  state = 'suspended';
  onstatechange?: () => void;
  constructor() { FakeContext.count++; }
  async resume() {
    if (FakeContext.blocked) throw Error('Activation needed');
    this.state = 'running';
  }
  async close() { this.state = 'closed'; }
}

let page: EventTarget & { hidden: boolean };
const states: string[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  FakeContext.count = 0;
  FakeContext.blocked = false;
  states.length = 0;
  page = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('document', page);
  vi.stubGlobal('window', { AudioContext: FakeContext, setInterval, clearInterval, setTimeout, clearTimeout });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('plays an initial note under a running context, coalesces starts and releases its timer', async () => {
  const sound = new GardenSound(status => states.push(status.state));
  sound.setSpecimen(gardenReferences[0]);
  sound.setMix('Solo');
  sound.behavior('REST');
  expect(await sound.toggle()).toBe(true);
  expect(note).toHaveBeenCalledOnce();
  expect(vi.mocked(note).mock.calls[0][4]).toBeLessThan(1);
  expect(states.at(-1)).toBe('running');
  expect(FakeContext.count).toBe(1);
  expect(vi.getTimerCount()).toBe(1);
  sound.stop();
  expect(vi.getTimerCount()).toBe(0);
  expect(states.at(-1)).toBe('off');
  expect(await sound.toggle()).toBe(true);
  expect(FakeContext.count).toBe(1);
  expect(vi.getTimerCount()).toBe(1);
});

it('reports a blocked start and allows a visible user retry or visibility recovery', async () => {
  const sound = new GardenSound(status => states.push(status.state));
  sound.setSpecimen(gardenReferences[0]);
  sound.setMix('Solo');
  FakeContext.blocked = true;
  expect(await sound.toggle()).toBe(false);
  expect(states.at(-1)).toBe('blocked');
  expect(note).not.toHaveBeenCalled();
  FakeContext.blocked = false;
  expect(await sound.toggle()).toBe(true);
  page.hidden = true;
  page.dispatchEvent(new Event('visibilitychange'));
  expect(states.at(-1)).toBe('waiting');
  expect(vi.getTimerCount()).toBe(0);
  page.hidden = false;
  page.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(50);
  expect(states.at(-1)).toBe('running');
  expect(FakeContext.count).toBe(1);
  expect(vi.getTimerCount()).toBe(1);
});

it('keeps the World score playing on selection and returns to it after Audition', async () => {
  const messages: string[] = [];
  const sound = new GardenSound(status => messages.push(status.message));
  const [first, second] = gardenReferences;
  sound.setResidents([{ id: 'first', specimen: first }, { id: 'second', specimen: second }]);
  sound.setSpecimen(first);
  expect(await sound.toggle()).toBe(true);
  const worldVoice = vi.mocked(note).mock.results[0].value;
  sound.setSpecimen(second);
  expect(worldVoice.stop).not.toHaveBeenCalled();
  expect(await sound.audition()).toBe(true);
  expect(worldVoice.stop).toHaveBeenCalledOnce();
  expect(messages.at(-1)).toMatch(/selected specimen/);
  sound.endAudition();
  expect(messages.at(-1)).toMatch(/World is playing/);
  expect(FakeContext.count).toBe(1);
  expect(vi.getTimerCount()).toBe(1);
  sound.setResidents([]);
  expect(messages.at(-1)).toMatch(/no residents/);
});
