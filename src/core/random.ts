export function hashBytes(bytes: Iterable<number>): number {
  let hash = 0x811c9dc5;
  for (const value of bytes) hash = Math.imul(hash ^ value, 0x01000193);
  return hash >>> 0;
}

export const hashText = (text: string) => hashBytes(new TextEncoder().encode(text));
export const hexSeed = (value: number) => (value >>> 0).toString(16).toUpperCase().padStart(8, '0');
export const freshSeed = () => hexSeed(crypto.getRandomValues(new Uint32Array(1))[0]);

export function random(seed: string) {
  let state = hashText(seed);
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const range = (min: number, max: number) => min + (max - min) * next();
  const pick = <T>(values: readonly T[]) => values[Math.floor(next() * values.length)];
  return { next, range, pick };
}
export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
