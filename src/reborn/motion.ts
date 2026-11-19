import { clamp, mix, random } from '../core/random';
import type { GardenGenome, GardenPlan } from './genome';

export const gestures = {
  HINGE: ['Hop', 'Fold', 'Stumble'],
  VESSEL: ['Contract', 'Tilt', 'Pulse'],
  RELAY: ['Stretch', 'Coil', 'Ripple'],
} as const satisfies Record<GardenPlan, readonly string[]>;

export const stepSeconds = 1 / 60;
export const field = { x: 4.47, z: 3.01 };
export type Gesture = typeof gestures[GardenPlan][number];
export type Phase = 'Explore' | 'Hesitate' | 'Act' | 'Recover' | 'Rest';
export type GroundPoint = readonly [x: number, z: number];
export type Obstacle = { x: number; z: number; radius: number };
export interface MotionPose {
  x: number; z: number; yaw: number; speed: number; time: number; stride: number;
  phase: Phase; gesture: Gesture; action: number; preparation: number; recovery: number;
}
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };

export function limitFrame(elapsed: number, carry: number) {
  const budget = Math.min(Math.max(elapsed, 0), .10) + carry;
  const steps = Math.floor(budget / stepSeconds);
  return { steps, remainder: budget - steps * stepSeconds };
}

export class GardenMotion {
  readonly pose: MotionPose;
  private rng;
  private home: GroundPoint;
  private target: GroundPoint;
  private limit: { x: number; z: number };
  private vx = 0;
  private vz = 0;
  private elapsed = 0;
  private duration: number;
  private burst = 0;

  constructor(
    private genome: GardenGenome, anchor: GroundPoint,
    private obstacles: readonly Obstacle[] = [], private radius = .68,
  ) {
    const clearance = Math.max(0, radius - .75);
    this.limit = { x: field.x - clearance, z: field.z - clearance };
    this.home = [clamp(anchor[0], -this.limit.x, this.limit.x), clamp(anchor[1], -this.limit.z, this.limit.z)];
    this.target = this.home;
    this.rng = random(genome.seed + '/motion');
    this.duration = this.rng.range(.75, 2.1);
    this.pose = {
      x: this.home[0], z: this.home[1], yaw: this.rng.range(-.35, .6), speed: 0, time: 0, stride: 0,
      phase: 'Explore', gesture: gestures[genome.plan][0], action: 0, preparation: 0, recovery: 0,
    };
    this.turn();
  }

  private turn() {
    for (let attempt = 0; attempt < 8; attempt++) {
      const reach = .8 + this.genome.curiosity * 1.35;
      const x = clamp(this.home[0] + this.rng.range(-reach, reach), -this.limit.x, this.limit.x);
      const z = clamp(this.home[1] + this.rng.range(-reach, reach), -this.limit.z, this.limit.z);
      if (!this.obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.radius + this.radius * .43)) {
        this.target = [x, z];
        break;
      }
    }
  }

  perform(action: Gesture = gestures[this.genome.plan][0]) {
    if (!(gestures[this.genome.plan] as readonly string[]).includes(action)) return;
    this.pose.gesture = action;
    this.phase('Hesitate', .23 + this.genome.caution * .34);
  }

  react() {
    if (this.burst > 0) return;
    this.burst = 1.2;
    this.perform(this.rng.pick(gestures[this.genome.plan] as readonly Gesture[]));
  }

  private phase(next: Phase, duration: number) {
    this.pose.phase = next;
    this.elapsed = 0;
    this.duration = duration;
  }

  step(dt = stepSeconds) {
    const pose = this.pose;
    pose.time += dt;
    this.elapsed += dt;
    this.burst -= dt;
    if (this.elapsed >= this.duration) {
      switch (pose.phase) {
        case 'Explore':
          this.perform(this.rng.pick(gestures[this.genome.plan] as readonly Gesture[]));
          break;
        case 'Hesitate': this.phase('Act', this.genome.plan === 'HINGE' ? .52 : .86); break;
        case 'Act': this.phase('Recover', .62 + this.genome.patience * .55); break;
        case 'Recover': this.phase('Rest', this.rng.range(.32, 1.15) + this.genome.patience); break;
        case 'Rest': this.turn(); this.phase('Explore', this.rng.range(1.6, 4.8)); break;
      }
    }
    const t = clamp(this.elapsed / this.duration);
    pose.preparation = pose.phase === 'Hesitate' ? smooth(t) : pose.phase === 'Act' ? 1 - smooth(t * 3) : 0;
    pose.action = pose.phase === 'Act' ? Math.sin(Math.PI * t) : 0;
    pose.recovery = pose.phase === 'Recover' ? (1 - t) ** 2 : 0;

    const dx = this.target[0] - pose.x, dz = this.target[1] - pose.z;
    const distance = Math.hypot(dx, dz);
    const baseline = { HINGE: .88, VESSEL: .64, RELAY: 1.04 }[this.genome.plan];
    let speed = pose.phase === 'Explore' ? baseline * this.genome.gait * smooth(distance / .69) : 0;
    if (pose.phase === 'Act' && pose.gesture === 'Hop') speed = pose.action * 1.36;
    const factor = distance > .001 ? speed / distance : 0;
    let tx = dx * factor, tz = dz * factor;
    // A soft perimeter around scenic structures keeps waists and feet out of the plinths.
    for (const item of this.obstacles) {
      const ox = pose.x - item.x, oz = pose.z - item.z;
      const separation = Math.hypot(ox, oz);
      const push = clamp((item.radius + this.radius * .56 - separation) / .46) * .78;
      tx += ox * push / Math.max(.05, separation);
      tz += oz * push / Math.max(.05, separation);
    }
    this.vx = mix(this.vx, tx, 1 - Math.exp(-dt * 4.8));
    this.vz = mix(this.vz, tz, 1 - Math.exp(-dt * 4.8));
    pose.x = clamp(pose.x + this.vx * dt, -this.limit.x, this.limit.x);
    pose.z = clamp(pose.z + this.vz * dt, -this.limit.z, this.limit.z);
    pose.speed = Math.hypot(this.vx, this.vz);
    if (pose.speed > .032) {
      const delta = Math.atan2(-this.vz, this.vx) - pose.yaw;
      pose.yaw += Math.atan2(Math.sin(delta), Math.cos(delta)) * (1 - Math.exp(-dt * 3.7));
    }
    pose.stride += pose.speed * dt * (this.genome.plan === 'HINGE' ? 9 : 4.3);
    return pose;
  }
}
