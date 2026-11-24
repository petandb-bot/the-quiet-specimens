import { limitFrame } from '../motion';

const rates = { Paused: 0, Slow: .3, Live: 1 } as const;
export type MakeActivity = keyof typeof rates;

export function activityFrame(delta: number, carry: number, activity: MakeActivity) {
  const speed = rates[activity];
  return speed ? limitFrame(Math.min(.10, delta) * speed, carry) : { steps: 0, remainder: carry };
}
