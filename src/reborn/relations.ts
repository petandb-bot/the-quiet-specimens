import { random } from '../core/random';
import type { GardenMotion, SocialAction } from './motion';

export type RelationEvent = { kind: 'Encounter' | 'Follow' | 'Imitation'; at: number; actor: string; peer: string };
const interval = .30;
const eventLimit = 12;

export class GardenRelations {
  private rng;
  private readyAt = 0;
  private elapsed = 0;
  private pairs = new Map<string, { until: number; actor: GardenMotion; peer: GardenMotion }>();
  private gesturesSeen = new Map<GardenMotion, number>();
  private recent: RelationEvent[] = [];

  constructor(seed: string) {
    this.rng = random(seed + '/relations');
  }

  get events(): readonly RelationEvent[] { return this.recent; }

  remove(resident: GardenMotion, remaining: readonly GardenMotion[]) {
    for (const other of remaining) {
      other.detach(resident);
      resident.detach(other);
    }
    this.gesturesSeen.delete(resident);
    for (const [key, pair] of this.pairs) {
      if (pair.actor === resident || pair.peer === resident) this.pairs.delete(key);
    }
  }

  step(dt: number, residents: readonly GardenMotion[]) {
    this.elapsed += dt;
    if (this.elapsed < this.readyAt) return;
    const now = this.elapsed;
    this.readyAt = now + interval;
    this.recent = this.recent.filter(event => now - event.at <= 100);
    for (const [key, pair] of this.pairs) if (pair.until <= now) this.pairs.delete(key);
    if (residents.length < 2) return;

    // Rotate the first candidate so slot order does not favor the first resident in the garden.
    const first = Math.floor(now / interval) % residents.length;
    for (let i = 0; i < residents.length; i++) {
      const source = residents[(first + i) % residents.length];
      const gesture = source.naturalGesture;
      if (!gesture || gesture === this.gesturesSeen.get(source)) continue;
      this.gesturesSeen.set(source, gesture);
      for (const target of residents) {
        if (!target.canRespond || !target.territory || target === source) continue;
        const distance = separation(target, source);
        if (distance < 1.1 || distance > 4.9 || this.rng.next() > .32 + target.territory.traits.social * .48) continue;
        if (this.start('Imitation', target, source, 4.25, this.rng.range(.48, 1.23), source.gestureIndex)) break;
      }
    }
    for (let i = 0; i < residents.length; i++) {
      const actor = residents[(first + i) % residents.length];
      if (!actor.canRespond || !actor.territory) continue;
      for (let j = 1; j < residents.length; j++) {
        const peer = residents[(first + i + j) % residents.length];
        if (!peer.canRespond || !peer.territory) continue;
        const distance = separation(actor, peer);
        if (distance > 3.7) continue;
        const { caution, social } = actor.territory.traits;
        const close = distance < 1.45;
        if (!close && this.rng.next() > .31) continue;
        const action = close || this.rng.next() < caution * .31 ? 'Avoid'
          : peer.pose.speed > .23 && this.rng.next() < social * .65 ? 'Follow' : 'Observe Other';
        const duration = action === 'Follow' ? this.rng.range(3.2, 5.7) : this.rng.range(1.45, 2.8);
        if (this.start(action, actor, peer, duration)) break;
      }
    }
  }

  private start(action: SocialAction, actor: GardenMotion, peer: GardenMotion, duration: number, delay = 0, gesture = 0) {
    const pair = JSON.stringify([actor.seed, peer.seed].sort());
    if (this.pairs.has(pair) || !actor.respond(action, peer, duration, delay, gesture)) return false;
    const at = this.elapsed;
    this.pairs.set(pair, { actor, peer, until: at + duration + this.rng.range(14, 24) });
    peer.reserveSocial(duration + 6);
    const kind = action === 'Avoid' || action === 'Observe Other' ? 'Encounter' : action;
    this.recent.push({ kind, at, actor: actor.seed, peer: peer.seed });
    if (this.recent.length > eventLimit) this.recent.shift();
    return true;
  }
}

function separation(a: GardenMotion, b: GardenMotion) {
  return Math.hypot(a.pose.x - b.pose.x, a.pose.z - b.pose.z);
}
