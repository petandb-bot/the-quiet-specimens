import { expect, it } from 'vitest';
import { minimumInterval, reactionCooldown, Rhythm } from '../src/audio/scheduler';

it('blocks note bursts and inhibits closely spaced behavioral accents', () => {
  const rhythm = new Rhythm();
  expect(rhythm.canAccent(1, 'CRUISE', 1, 0)).toBe(false);
  expect(rhythm.canAccent(1, 'DISPLAY', 1, 0)).toBe(true);
  rhythm.played(1, true);
  expect(rhythm.canPlay(1 + minimumInterval / 2)).toBe(false);
  expect(rhythm.canPlay(1 + minimumInterval + .001)).toBe(true);
  expect(rhythm.canAccent(1 + reactionCooldown - .01, 'DISPLAY', 1, 0)).toBe(false);
  expect(rhythm.canAccent(1 + reactionCooldown, 'DISPLAY', 1, .99)).toBe(false);
  expect(rhythm.canAccent(1 + reactionCooldown, 'DISPLAY', 1, 0)).toBe(true);
});
