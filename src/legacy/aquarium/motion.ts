import { clamp, random } from '../../core/random';

export const aquariumPresets = ['mixed', 'guppies', 'goldfish'] as const;
export type AquariumPreset = typeof aquariumPresets[number];
export type Shoal = Exclude<AquariumPreset, 'mixed'>;
type Point = [x: number, y: number, z: number];
export type TankSubject = 'arowana' | 'seahorse' | 'floor';

export const shoalCounts: Record<AquariumPreset, Record<Shoal, number>> = {
  mixed: { guppies: 12, goldfish: 10 },
  guppies: { guppies: 19, goldfish: 0 },
  goldfish: { guppies: 0, goldfish: 17 },
};

export const tankFloor = -2.55;
export interface Pose {
  position: Point;
  yaw: number;
  pitch: number;
  roll: number;
}

export interface ShoalMember {
  phase: number;
  lag: number;
  lane: number;
  rise: number;
  spread: number;
  size: number;
}

export function shoalMembers(kind: Shoal): ShoalMember[] {
  const rng = random('aquarium/' + kind);
  return Array.from({ length: shoalCounts[kind][kind] }, (_, i) => {
    const ring = Math.floor(i / 4);
    return {
      phase: rng.range(0, Math.PI * 2),
      lag: -0.19 + ring * .16 + rng.range(-.082, .082),
      lane: ((i % 4) - 1.5) * .58 + rng.range(-.21, .21),
      rise: rng.range(-.54, .54),
      spread: rng.range(-.27, .27),
      size: rng.range(.32, .50) * (kind === 'goldfish' ? 1.13 : 1),
    };
  });
}

export function shoalPose(kind: Shoal, member: ShoalMember, time: number, output: Pose): void {
  const guppy = kind === 'guppies';
  const cadence = guppy ? .235 : -.142;
  const travel = (guppy ? -.47 : .59) + time * cadence - member.lag;
  const span = guppy ? 5.27 : 4.74;
  const depth = guppy ? 1.38 : 1.61;
  const vx = span * Math.cos(travel) * cadence;
  const vz = -depth * Math.sin(travel) * cadence;
  const tangent = Math.hypot(vx, vz);
  const breath = 1 + .16 * Math.sin(time * .78 + (guppy ? 0 : 2.3));
  const lane = member.lane * breath + .095 * Math.sin(time * 2.2 + member.phase);
  output.position[0] = span * Math.sin(travel) - lane * vz / tangent;
  output.position[1] = (guppy ? .37 : -.82) + .29 * Math.sin(travel * 2 + .35)
    + member.rise * breath + .075 * Math.sin(time * 2 + member.phase);
  output.position[2] = depth * Math.cos(travel) + (guppy ? -1.87 : -.36) + lane * vx / tangent + member.spread;
  output.yaw = Math.atan2(-vz, vx) + .105 * Math.sin(time * 2.6 + member.phase);
  output.pitch = clamp(.44 * Math.cos(travel * 2 + .35) * cadence / tangent, -.28, .28);
  output.roll = .09 * Math.sin(time * 2.3 + member.phase);
}

export function tankPose(subject: TankSubject, t: number, pose: Pose): void {
  if (subject === 'arowana') {
    const a = t * .089 - .62;
    pose.position[0] = 5.05 * Math.sin(a);
    pose.position[1] = 1.58 + .21 * Math.sin(2 * a + .8);
    pose.position[2] = -.55 + .94 * Math.cos(a);
    pose.yaw = Math.atan2(.94 * Math.sin(a), 5.05 * Math.cos(a));
    pose.pitch = .043 * Math.cos(2 * a + .8);
    pose.roll = .07 * Math.sin(a);
    return;
  }
  if (subject === 'seahorse') {
    pose.position[0] = 4.02 + .41 * Math.sin(t * .23);
    pose.position[1] = -.24 + .28 * Math.sin(t * .96 + .34) + .04 * Math.sin(t * 3.2);
    pose.position[2] = .46 + .29 * Math.sin(t * .31);
    pose.yaw = -.29 + .62 * Math.sin(t * .22);
    pose.pitch = .105 + .078 * Math.sin(t * 1.24);
    pose.roll = .037 * Math.sin(t * 1.45);
    return;
  }
  pose.position[0] = -1.15 + .48 * Math.sin(t * .037 + .58);
  pose.position[1] = tankFloor + .22 + .028 * Math.sin(t * .71);
  pose.position[2] = .60 + .31 * Math.sin(t * .045);
  pose.yaw = -.35 + .14 * Math.sin(t * .061);
  pose.pitch = -.018 * Math.sin(t * .18);
  pose.roll = .038 * Math.sin(t * .22);
}
