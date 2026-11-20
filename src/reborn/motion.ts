import { clamp, mix, random } from '../core/random';
import type { GardenGenome, GardenPlan } from './genome';
import type { PointOfInterest } from './composition';
import { LivingTerritory } from './territory';
import type { Destination, Intention } from './territory';

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
export interface MotionField {
  bounds: { x: number; z: number };
  height: (x: number, z: number) => number;
  slope: (x: number, z: number) => number;
  points?: readonly PointOfInterest[];
}
export function canTraverse(terrain: MotionField, plan: GardenPlan, radius: number, obstacles: readonly Obstacle[],
  x: number, z: number, nextX: number, nextZ: number) {
  for (const obstacle of obstacles) {
    const buffer = obstacle.radius + radius * .44;
    const distance = Math.hypot(nextX - obstacle.x, nextZ - obstacle.z);
    if (distance < buffer && distance < Math.hypot(x - obstacle.x, z - obstacle.z) - .0001) return false;
  }
  if (plan === 'VESSEL') return true;
  const distance = Math.max(.03, Math.hypot(nextX - x, nextZ - z));
  const maximum = plan === 'HINGE' ? .69 : .87;
  const localSlope = terrain.slope(x, z), nextSlope = terrain.slope(nextX, nextZ);
  const slope = Math.abs(terrain.height(nextX, nextZ) - terrain.height(x, z)) / distance;
  return (nextSlope <= maximum && slope <= maximum + .1)
    || (localSlope > maximum && nextSlope < localSlope - .00002 && slope <= maximum + .28);
}

export type SocialAction = 'Observe Other' | 'Avoid' | 'Follow' | 'Imitation';
type GestureOrigin = 'natural' | 'manual' | 'imitation';
type Response = { action: SocialAction; peer: GardenMotion; until: number; due: number; gesture?: Gesture };
const pace = { HINGE: .88, VESSEL: .64, RELAY: 1.04 } satisfies Record<GardenPlan, number>;

export interface MotionPose {
  x: number; z: number; yaw: number; speed: number; time: number; stride: number;
  phase: Phase; gesture: Gesture; action: number; preparation: number; recovery: number;
  intent: Intention; social: SocialAction | null; attention: number; compression: number;
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
  private blockedFor = 0;
  private detour = 1;
  readonly territory?: LivingTerritory;
  private destination?: Destination;
  private response?: Response;
  private nextSocial = 0;
  private origin: GestureOrigin = 'natural';
  private gestureStrength = 1;
  private gestureSerial = 0;
  get naturalGesture() { return this.pose.phase === 'Act' && this.origin === 'natural' ? this.gestureSerial : 0; }
  get seed() { return this.genome.seed; }

  get canRespond() {
    return Boolean(this.territory && !this.response && this.pose.time >= this.nextSocial
      && this.pose.phase === 'Explore' && this.pose.intent !== 'Seek Rest' && this.pose.intent !== 'Return Home');
  }

  get gestureIndex() { return (gestures[this.genome.plan] as readonly Gesture[]).indexOf(this.pose.gesture); }

  reserveSocial(seconds: number) { this.nextSocial = Math.max(this.nextSocial, this.pose.time + seconds); }

  respond(action: SocialAction, peer: GardenMotion, duration: number, delay = 0, gestureIndex = 0) {
    if (!this.canRespond || peer === this) return false;
    const gesture = gestures[this.genome.plan][gestureIndex % gestures[this.genome.plan].length];
    this.response = { action, peer, until: this.pose.time + duration, due: this.pose.time + delay, gesture };
    this.pose.social = action;
    this.reserveSocial(duration + 8 + this.genome.caution * 7);
    return true;
  }

  detach(peer: GardenMotion) {
    if (this.response?.peer === peer) this.endResponse();
  }

  private endResponse() {
    this.response = undefined;
    this.pose.social = null;
  }

  constructor(
    private genome: GardenGenome, anchor: GroundPoint,
    private obstacles: readonly Obstacle[] = [], private radius = .68,
    private terrain?: MotionField,
  ) {
    const clearance = Math.max(0, radius - .75);
    const limits = terrain?.bounds ?? field;
    this.limit = { x: limits.x - clearance, z: limits.z - clearance };
    this.home = [clamp(anchor[0], -this.limit.x, this.limit.x), clamp(anchor[1], -this.limit.z, this.limit.z)];
    this.target = this.home;
    this.rng = random(genome.seed + '/motion');
    this.duration = this.rng.range(.75, 2.1);
    this.detour = this.rng.next() < .5 ? -1 : 1;
    this.pose = {
      x: this.home[0], z: this.home[1], yaw: this.rng.range(-.35, .6), speed: 0, time: 0, stride: 0,
      intent: 'Explore', social: null, attention: 0, compression: 0, phase: 'Explore', gesture: gestures[genome.plan][0], action: 0, preparation: 0, recovery: 0,
    };
    if (terrain?.points) this.territory = new LivingTerritory(genome, this.home, terrain, this.limit, point => this.walkable(point));
    this.journey();
  }

  private walkable([x, z]: GroundPoint) {
    const slopeLimit = this.genome.plan === 'RELAY' ? .76 : .58;
    return Math.abs(x) <= this.limit.x && Math.abs(z) <= this.limit.z
      && (!this.terrain || this.genome.plan === 'VESSEL' || this.terrain.slope(x, z) <= slopeLimit)
      && !this.obstacles.some(item => Math.hypot(item.x - x, item.z - z) < item.radius + this.radius * .7);
  }

  private journey() {
    if (!this.territory) {
      this.turn();
      return;
    }
    this.blockedFor = 0;
    this.destination = this.territory.choose([this.pose.x, this.pose.z], this.pose.time);
    this.target = this.destination.point;
    this.pose.intent = this.destination.intent;
    const distance = Math.hypot(this.pose.x - this.target[0], this.pose.z - this.target[1]);
    const speed = pace[this.genome.plan] * this.genome.gait;
    this.phase('Explore', Math.min(54, 4 + distance / speed * 1.75));
  }

  private turn() {
    for (let attempt = 0; attempt < 8; attempt++) {
      const reach = this.terrain ? 4 + this.genome.curiosity * 9 : .8 + this.genome.curiosity * 1.35;
      const center = this.terrain && this.rng.next() > .13 ? [this.pose.x, this.pose.z] : this.home;
      const x = clamp(center[0] + this.rng.range(-reach, reach), -this.limit.x, this.limit.x);
      const z = clamp(center[1] + this.rng.range(-reach, reach), -this.limit.z, this.limit.z);
      if (this.walkable([x, z])) {
        this.target = [x, z];
        break;
      }
    }
  }

  perform(action: Gesture = gestures[this.genome.plan][0]) {
    if (!(gestures[this.genome.plan] as readonly string[]).includes(action)) return;
    this.endResponse();
    this.startGesture(action, 'manual');
  }

  private startGesture(action: Gesture, origin: GestureOrigin) {
    this.pose.gesture = action;
    this.origin = origin;
    this.gestureStrength = origin === 'imitation' ? .59 : 1;
    this.phase('Hesitate', .23 + this.genome.caution * .34);
  }

  private pauseJourney(arrived: boolean) {
    const { destination, territory } = this;
    if (!destination || !territory) return;
    if (arrived) territory.arrived(destination, this.pose.time);
    if (destination.intent === 'Return Home' || destination.intent === 'Seek Rest' || destination.intent === 'Gather') {
      this.phase('Rest', arrived ? territory.pauseTime(destination.intent) : .85);
    } else {
      this.startGesture(this.rng.pick(gestures[this.genome.plan] as readonly Gesture[]), 'natural');
    }
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

  step(dt = stepSeconds, neighbors: readonly GardenMotion[] = []) {
    const pose = this.pose;
    pose.time += dt;
    this.elapsed += dt;
    this.burst -= dt;
    this.updateResponse();
    const waiting = this.response && pose.phase === 'Explore';
    const reached = this.destination && pose.phase === 'Explore' && Math.hypot(pose.x - this.target[0], pose.z - this.target[1]) < .64;
    if (!waiting && (this.elapsed >= this.duration || reached)) {
      switch (pose.phase) {
        case 'Explore':
          if (this.destination) this.pauseJourney(Boolean(reached));
          else this.startGesture(this.rng.pick(gestures[this.genome.plan] as readonly Gesture[]), 'natural');
          break;
        case 'Hesitate':
          this.phase('Act', this.genome.plan === 'HINGE' ? .52 : .86);
          if (this.origin === 'natural') this.gestureSerial++;
          break;
        case 'Act': this.phase('Recover', .62 + this.genome.patience * .55); break;
        case 'Recover': {
          const intent = this.destination?.intent;
          const rest = intent === 'Inspect Object' && this.territory ? this.territory.pauseTime(intent) : this.rng.range(.32, 1.15) + this.genome.patience;
          this.phase('Rest', rest);
          break;
        }
        case 'Rest':
          this.phase('Explore', this.terrain ? this.rng.range(5, 13) : this.rng.range(1.6, 4.8));
          this.journey();
          break;
      }
    }
    const t = clamp(this.elapsed / this.duration);
    pose.preparation = (pose.phase === 'Hesitate' ? smooth(t) : pose.phase === 'Act' ? 1 - smooth(t * 3) : 0) * this.gestureStrength;
    pose.action = (pose.phase === 'Act' ? Math.sin(Math.PI * t) : 0) * this.gestureStrength;
    pose.recovery = (pose.phase === 'Recover' ? (1 - t) ** 2 : 0) * this.gestureStrength;
    pose.attention = mix(pose.attention, this.response ? 1 : 0, 1 - Math.exp(-dt * 2.7));

    let dx = this.target[0] - pose.x, dz = this.target[1] - pose.z, intensity = 1;
    if (this.response && pose.phase === 'Explore') {
      const peer = this.response.peer.pose;
      dx = peer.x - pose.x;
      dz = peer.z - pose.z;
      if (this.response.action === 'Avoid') {
        if (Math.hypot(dx, dz) < .05) { dx = Math.cos(peer.yaw); dz = -Math.sin(peer.yaw); }
        dx *= -1; dz *= -1; intensity = .61;
      } else if (this.response.action === 'Follow') {
        dx -= Math.cos(peer.yaw) * 1.7 + Math.sin(peer.yaw) * this.detour * .55;
        dz += Math.sin(peer.yaw) * 1.7 - Math.cos(peer.yaw) * this.detour * .55;
        intensity = Math.hypot(dx, dz) > .88 ? .83 : 0;
      } else {
        intensity = 0;
        this.face(dx, dz, dt * .47);
      }
    }
    const distance = Math.hypot(dx, dz);
    const activity = this.territory ? .84 + this.territory.traits.activity * .27 : 1;
    let speed = pose.phase === 'Explore' ? pace[this.genome.plan] * this.genome.gait * smooth(distance / .69) * intensity * activity : 0;
    if (pose.phase === 'Act' && pose.gesture === 'Hop') speed = pose.action * 1.36;
    if (this.terrain && this.genome.plan !== 'VESSEL') speed *= 1 / (1 + this.terrain.slope(pose.x,pose.z) * 1.8);
    const factor = distance > .001 ? speed / distance : 0;
    let tx = dx * factor, tz = dz * factor;
    // Use soft separation even while social decisions and gestures are on cooldown.
    for (const neighbor of neighbors) {
      if (neighbor === this) continue;
      const nx = pose.x - neighbor.pose.x, nz = pose.z - neighbor.pose.z;
      const spacing = (this.radius + neighbor.radius) * .69;
      const distance = Math.hypot(nx, nz);
      if (distance >= spacing) continue;
      const separation = (1 - distance / spacing) * .84;
      tx += distance > .01 ? nx / distance * separation : (this.seed < neighbor.seed ? -separation : separation);
      tz += distance > .01 ? nz / distance * separation : 0;
    }
    // A soft perimeter around scenic structures keeps waists and feet out of the plinths.
    let compression = 0;
    for (const item of this.obstacles) {
      const ox = pose.x - item.x, oz = pose.z - item.z;
      const separation = Math.hypot(ox, oz);
      if (this.genome.plan === 'RELAY') compression = Math.max(compression, clamp((item.radius + this.radius + 1 - separation) * .62));
      const push = clamp((item.radius + this.radius * .56 - separation) / .46) * .78;
      tx += ox * push / Math.max(.05, separation);
      tz += oz * push / Math.max(.05, separation);
    }
    pose.compression = mix(pose.compression, compression, 1 - Math.exp(-dt * 3.2));
    if (this.terrain && speed > .05) {
      const course = Math.atan2(tz, tx);
      const lookAhead = .68 + this.radius * .18;
      const canMove = (angle: number) => {
        const x = pose.x + Math.cos(angle) * lookAhead, z = pose.z + Math.sin(angle) * lookAhead;
        return Math.abs(x) <= this.limit.x && Math.abs(z) <= this.limit.z
          && canTraverse(this.terrain!, this.genome.plan, this.radius, this.obstacles, pose.x, pose.z, x, z);
      };
      if (!canMove(course)) {
        const turn = [this.detour * .82, -this.detour * .82, this.detour * 1.55, -this.detour * 1.55]
          .find(offset => canMove(course + offset));
        this.blockedFor += dt;
        if (turn === undefined) { tx = 0; tz = 0; }
        else { tx = Math.cos(course + turn) * speed * .73; tz = Math.sin(course + turn) * speed * .73; }
        if (this.blockedFor > 1.5) {
          if (this.response) this.endResponse();
          else if (this.destination) {
            if (turn === undefined || this.blockedFor > 3.6) this.pauseJourney(false);
          } else {
            this.detour *= -1;
            this.turn();
          }
          if (!this.destination || turn === undefined || pose.phase !== 'Explore') this.blockedFor = 0;
        }
      } else this.blockedFor = 0;
    }
    this.vx = mix(this.vx, tx, 1 - Math.exp(-dt * 4.8));
    this.vz = mix(this.vz, tz, 1 - Math.exp(-dt * 4.8));
    const nextX = clamp(pose.x + this.vx * dt, -this.limit.x, this.limit.x);
    const nextZ = clamp(pose.z + this.vz * dt, -this.limit.z, this.limit.z);
    if (!this.terrain || canTraverse(this.terrain, this.genome.plan, this.radius, this.obstacles, pose.x, pose.z, nextX, nextZ)) {
      pose.x = nextX;
      pose.z = nextZ;
    } else {
      this.vx *= .40;
      this.vz *= .40;
    }
    pose.speed = Math.hypot(this.vx, this.vz);
    if (pose.speed > .032) this.face(this.vx, this.vz, dt);
    pose.stride += pose.speed * dt * (this.genome.plan === 'HINGE' ? 9 : 4.3);
    return pose;
  }

  private updateResponse() {
    const response = this.response;
    if (!response) return;
    const peer = response.peer.pose;
    const distance = Math.hypot(this.pose.x - peer.x, this.pose.z - peer.z);
    if (this.pose.time >= response.until || distance > (response.action === 'Follow' ? 7.4 : 6.2)) {
      this.endResponse();
    } else if (response.action === 'Imitation' && this.pose.phase === 'Explore' && this.pose.time >= response.due) {
      response.due = Infinity;
      this.startGesture(response.gesture!, 'imitation');
    }
  }

  private face(x: number, z: number, dt: number) {
    if (Math.hypot(x, z) < .01) return;
    const delta = Math.atan2(-z, x) - this.pose.yaw;
    this.pose.yaw += Math.atan2(Math.sin(delta), Math.cos(delta)) * (1 - Math.exp(-dt * 3.7));
  }
}
