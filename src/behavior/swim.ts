import type { Action, Personality, Plan } from '../core/model';
import { clamp, mix, random } from '../core/random';

export const bounds = [1.05, .66, .85] as const;
export const actionDurations: Record<Action, number> = {
  CRUISE: 7.1, HOVER: 4.6, DART: 2.2, TURN: 3.1, INSPECT: 4.0,
  STARTLE: 1.9, DISPLAY: 3.5, TUMBLE: 3.4, REST: 4.8,
};
const repertoire: Record<Plan, Action[]> = {
  FISH: ['CRUISE', 'CRUISE', 'DART', 'TURN', 'INSPECT', 'DISPLAY', 'HOVER', 'REST'],
  RAY: ['CRUISE', 'TURN', 'TURN', 'HOVER', 'DART', 'INSPECT', 'DISPLAY', 'REST'],
  JELLY: ['CRUISE', 'HOVER', 'HOVER', 'STARTLE', 'TUMBLE', 'INSPECT', 'DISPLAY', 'REST'],
};
const speeds: Record<Action, number> = {
  CRUISE: .76, HOVER: .10, DART: 2.15, TURN: .6, INSPECT: .42,
  STARTLE: 1.4, DISPLAY: .26, TUMBLE: .21, REST: .045,
};
const smooth = (t: number) => { const p = clamp(t); return p * p * (3 - 2 * p); };
const blendAngle = (start: number, end: number, t: number) =>
  start + Math.atan2(Math.sin(end - start), Math.cos(end - start)) * t;

export interface MotionState {
  action: Action;
  serial: number;
  position: [number, number, number];
  yaw: number;
  pitch: number;
  roll: number;
  effort: number;
  display: number;
  phase: number;
}

export class Swim {
  readonly state: MotionState = {
    action: 'CRUISE', serial: 0, position: [0, 0, 0], yaw: -.13, pitch: 0, roll: 0, effort: .53, display: 0, phase: 0,
  };
  private elapsed = 0;
  private age = 0;
  private end = actionDurations.CRUISE;
  private lastTouch = -10;
  private velocity = [0, 0, 0];
  private target = [1.0, .2, -.20];
  private rng;
  private turnDirection = 1;

  constructor(private trait: Personality, private plan: Plan, seed: string) {
    this.rng = random(seed + '/swim');
  }

  trigger(action: Action) {
    this.state.action = action;
    this.state.serial++;
    this.state.phase = 0;
    this.elapsed = 0;
    this.end = action === 'REST' ? this.trait.rest : actionDurations[action];
    if (action === 'TURN' || action === 'STARTLE') {
      this.turnDirection = this.rng.next() < .5 ? -1 : 1;
      this.chooseTarget(true);
    }
    if (action === 'INSPECT') this.target = [.42, this.trait.depth * .55, .62];
  }

  tap() {
    if (this.age - this.lastTouch < 2.4) return false;
    this.lastTouch = this.age;
    this.trigger(this.rng.next() < this.trait.caution * .72 ? 'STARTLE' : this.trait.curiosity > .42 ? 'INSPECT' : 'DISPLAY');
    return true;
  }

  private chooseTarget(reverse = false) {
    const [x, y, z] = this.state.position;
    const spread = .58 + this.trait.exploration * .37;
    this.target = [
      (reverse ? -Math.sign(x || this.turnDirection) : (this.rng.next() < .5 ? -1 : 1)) * this.rng.range(.48, .96) * spread,
      clamp(this.trait.depth * .47 + this.rng.range(-.47, .47) * spread - y * .11, -.52, .52),
      this.rng.range(-.69, .69) * spread * (1 - .29 * this.trait.social) - z * .06,
    ];
  }

  step(seconds: number): MotionState {
    const dt = clamp(seconds, 0, .055);
    this.elapsed += dt;
    this.age += dt;
    if (this.elapsed >= this.end) {
      const list = repertoire[this.plan];
      const action = this.state.action !== 'CRUISE' && this.rng.next() < .57 ? 'CRUISE'
        : this.rng.next() < .19 ? this.trait.preferred
          : this.rng.next() > .57 + .33 * this.trait.activity ? 'REST' : this.rng.pick(list);
      this.trigger(action);
    }
    const state = this.state;
    const p = clamp(this.elapsed / this.end);
    state.phase = p;
    const attack = smooth((p - .12) / .22);
    const release = 1 - smooth((p - .51) / .44);
    const gesture = attack * release;
    const hesitation = smooth(p / .11) * (1 - smooth((p - .11) / .13));
    const delta = this.target.map((value, i) => value - state.position[i]);
    const distance = Math.hypot(...delta);
    if (distance < .31 && state.action !== 'INSPECT') this.chooseTarget(true);
    const speed = this.trait.speed * .39 * mix(speeds.CRUISE, speeds[state.action], Math.max(gesture, .27))
      * (1 - .69 * hesitation * Number(state.action === 'DART' || state.action === 'STARTLE'));
    const cruising = state.action === 'HOVER' || state.action === 'REST';
    for (let i = 0; i < 3; i++) {
      const dimension = bounds[i];
      const coordinate = state.position[i];
      const edge = smooth((Math.abs(coordinate) / dimension - .70) / .30);
      const pulse = this.plan === 'JELLY' && i === 1 ? .085 * Math.sin(this.age * this.trait.rhythm * 2.2) : 0;
      const desired = delta[i] / Math.max(.24, distance) * speed * (i === 1 ? .56 : 1) - Math.sign(coordinate) * edge * .78 + pulse;
      this.velocity[i] = mix(this.velocity[i], desired, 1 - Math.exp(-dt * this.trait.acceleration * 2.25));
      state.position[i] = clamp(coordinate + this.velocity[i] * dt, -dimension, dimension);
    }
    const course = Math.atan2(-this.velocity[2], this.velocity[0]);
    if (Math.hypot(this.velocity[0], this.velocity[2]) > .052 && !cruising) {
      state.yaw = blendAngle(state.yaw, course, 1 - Math.exp(-dt * this.trait.turning * .68));
    }
    const rotation = state.action === 'TUMBLE' ? Math.sin(p * Math.PI) * .95 : 0;
    state.pitch = mix(state.pitch, clamp(this.velocity[1] * 1.15, -.4, .4) + Math.sin(this.age * .88) * .075, dt * 2.1);
    state.roll = mix(state.roll, (state.action === 'TURN' ? this.turnDirection * gesture * .48 : rotation) + Math.sin(this.age * 1.15) * .05, dt * 2.8);
    state.effort = mix(state.effort, clamp(speed * 1.6 + .22 * gesture, .1, 1.3), dt * 4);
    state.display = state.action === 'DISPLAY' ? gesture : .12 + .10 * Math.sin(this.age * 1.4);
    return state;
  }
}
