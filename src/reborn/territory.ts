import { clamp, mix, random } from '../core/random';
import type { PointOfInterest } from './composition';
import type { GardenGenome } from './genome';
import type { GroundPoint, MotionField } from './motion';

export const visitLimit = 9;
export const visitLifetime = 135;
export type Intention = 'Explore' | 'Return Home' | 'Inspect Object' | 'Gather' | 'Seek Rest';
export type Destination = { point: GroundPoint; intent: Intention; interest?: string };
type Visit = { point: GroundPoint; time: number; interest?: string };

const distance = (a: GroundPoint, b: GroundPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export class LivingTerritory {
  readonly traits: { curiosity: number; caution: number; activity: number; social: number };
  readonly range: number;
  private ordinaryRest: GroundPoint;
  private restId?: string;
  private preferredId?: string;
  private pinnedPreferred?: GroundPoint;
  private ordinaryPreferred: GroundPoint;
  get preferredArea() { return this.pinnedPreferred ?? this.ordinaryPreferred; }
  get restingPlace() { return this.ordinaryRest; }
  private visits: Visit[] = [];
  private rng;
  private homeAt = 0;
  private restedAt = 0;
  private interestedAt = -Infinity;
  private interest?: string;

  constructor(
    private genome: GardenGenome,
    public home: GroundPoint,
    private field: MotionField,
    private limits: MotionField['bounds'],
    private walkable: (point: GroundPoint) => boolean,
  ) {
    this.rng = random(genome.seed + '/territory');
    const curiosity = clamp(genome.curiosity), caution = clamp(genome.caution);
    const activity = clamp((genome.gait - .45) * .65 + (1 - genome.patience) * .29 + this.rng.range(.05, .30));
    this.traits = { curiosity, caution, activity, social: this.rng.range(.18, .94) };
    this.range = 7 + curiosity * 9 + activity * 5 + (genome.plan === 'VESSEL' ? 3 : 0) - caution * 2;
    const nearby = (field.points ?? []).filter(point => distance(point.position, home) <= this.range * .9 && walkable(point.position));
    const favorite = this.favorite(nearby, home);
    const rest = this.favorite(nearby.filter(point => distance(point.position, home) < this.range * .61), home, true);
    this.ordinaryPreferred = favorite?.position ?? this.sample(home, this.range * .45);
    this.preferredId = favorite?.id;
    this.ordinaryRest = rest?.position ?? home;
    this.restId = rest?.id;
    this.record(home, 0);
  }

  updateField(field: MotionField) {
    const next = new Map((field.points ?? []).map(point => [point.id, point]));
    const changed = new Set((this.field.points ?? []).filter(old => {
      const current = next.get(old.id);
      return !current || distance(old.position, current.position) > .001
        || old.role !== current.role || old.weight !== current.weight;
    }).map(point => point.id));
    this.field = field;
    if (!changed.size) return changed;
    this.visits = this.visits.filter(visit => !visit.interest || !changed.has(visit.interest));
    if (this.interest && changed.has(this.interest)) { this.interest = undefined; this.interestedAt = -Infinity; }
    if (this.restId && changed.has(this.restId)) { this.ordinaryRest = this.home; this.restId = undefined; }
    if (this.preferredId && changed.has(this.preferredId)) { this.ordinaryPreferred = this.home; this.preferredId = undefined; }
    return changed;
  }

  setHabitat(home?: GroundPoint, preferred?: GroundPoint) {
    if (home) {
      this.home = home;
      if (!this.restId) this.ordinaryRest = home;
      if (!this.preferredId) this.ordinaryPreferred = home;
    }
    this.pinnedPreferred = preferred;
  }

  recentVisits(now: number): readonly Visit[] {
    while (this.visits.length && now - this.visits[0].time >= visitLifetime) this.visits.shift();
    return this.visits;
  }

  private record(point: GroundPoint, now: number, interest?: string) {
    this.recentVisits(now);
    this.visits = this.visits.filter(visit => distance(point, visit.point) > 1.75);
    this.visits.push({ point, time: now, interest });
    if (this.visits.length > visitLimit) this.visits.shift();
  }

  private comfort(point: GroundPoint, shelter = .25) {
    const slope = this.field.slope(...point);
    switch (this.genome.plan) {
      case 'HINGE': return 1 - slope * 1.8 + shelter * .22;
      case 'RELAY': {
        const lowGround = this.field.height(...this.home) - this.field.height(...point);
        return .55 - slope * .8 + shelter * 1.2 + clamp(lowGround * .25, -.25, .35);
      }
      case 'VESSEL': return 1.14 - shelter * .85 - slope * .12;
    }
  }

  private favorite(points: readonly PointOfInterest[], from: GroundPoint, rest = false) {
    let choice: PointOfInterest | undefined;
    let best = -Infinity;
    for (const point of points) {
      const { curiosity, caution, social } = this.traits;
      const influence = point.role === 'Shelter' ? caution * (rest ? 1.7 : .45)
        : point.role === 'Curiosity' ? curiosity * 1.7
        : point.role === 'Gathering' ? social * 1.42
        : point.role === 'Quiet' ? (1 - this.traits.activity) * (rest ? 1.65 : .50) : 0;
      const score = this.comfort(point.position, point.shelter) - distance(point.position, from) * (rest ? .065 : .025)
        + this.rng.next() * .38 + (rest && this.genome.plan !== 'VESSEL' ? point.shelter * .55 : 0)
        + influence * (point.weight ?? 0);
      if (score > best) { best = score; choice = point; }
    }
    return choice;
  }

  choose(from: GroundPoint, now: number): Destination {
    this.recentVisits(now);
    const t = this.traits;
    if (distance(from, this.home) > 3.2 && (now - this.homeAt > mix(69, 123, t.curiosity)
      || distance(from, this.home) > this.range)) {
      return { point: this.home, intent: 'Return Home' };
    }
    if (now - this.restedAt > mix(44, 90, t.activity)) {
      const shelter = (this.field.points ?? []).filter(point => (point.role === 'Shelter' || point.role === 'Quiet')
        && distance(point.position, this.home) < this.range && this.walkable(point.position));
      const chosen = this.favorite(shelter, from, true);
      if (chosen) return { point: chosen.position, intent: 'Seek Rest', interest: chosen.id };
      return { point: this.restingPlace, intent: 'Seek Rest', interest: this.restId };
    }
    if (this.rng.next() < .20 + t.curiosity * .29 && now - this.interestedAt > 16) {
      const available = (this.field.points ?? []).filter(point => distance(point.position, this.home) < this.range
        && distance(from, point.position) < 13 && this.walkable(point.position));
      const unvisited = available.filter(point => !this.visits.some(visit => visit.interest === point.id && now - visit.time < 40));
      const poi = this.favorite(unvisited.length ? unvisited : available, from);
      if (poi) {
        this.interest = poi.id;
        this.interestedAt = now;
        const gather = t.social > .47 && (poi.role === 'Gathering' || (!poi.role && poi.shelter > .65))
          && this.rng.next() < t.social * (poi.weight ?? 1);
        // Several residents can approach the same landmark with room for each body.
        const point = gather ? this.sample(poi.position, 2.25, true) : poi.position;
        return { point, intent: gather ? 'Gather' : 'Inspect Object', interest: this.interest };
      }
    }
    const center = this.rng.next() < .37 ? this.preferredArea : from;
    return { point: this.sample(center, 5 + t.curiosity * 8), intent: 'Explore' };
  }

  private sample(center: GroundPoint, radius: number, near = false) {
    let point = this.walkable(center) && distance(center, this.home) <= this.range ? center : this.home;
    let best = -Infinity;
    for (let i = 0; i < 13; i++) {
      const angle = this.rng.range(0, Math.PI * 2), reach = radius * this.rng.range(.34, 1);
      const candidate: GroundPoint = [
        clamp(center[0] + Math.cos(angle) * reach, -this.limits.x + .55, this.limits.x - .55),
        clamp(center[1] + Math.sin(angle) * reach, -this.limits.z + .55, this.limits.z - .55),
      ];
      if (distance(candidate, this.home) > this.range || !this.walkable(candidate)) continue;
      const recent = this.visits.some(visit => distance(visit.point, candidate) < 2.8);
      const score = this.comfort(candidate) + this.rng.next() * .95 + (near ? 0 : reach * .04) - (recent ? .64 : 0);
      if (score > best) { best = score; point = candidate; }
    }
    return point;
  }

  arrived(destination: Destination, now: number) {
    this.record(destination.point, now, destination.interest);
    if (destination.intent === 'Return Home') this.homeAt = now;
    if (destination.intent === 'Seek Rest') this.restedAt = now;
  }

  pauseTime(intent: Intention) {
    if (intent === 'Seek Rest') return this.rng.range(5, 10) + (1 - this.traits.activity) * 7 + (this.genome.plan === 'RELAY' ? 3 : 0);
    if (intent === 'Gather' || intent === 'Inspect Object') return this.rng.range(2.8, 5.5);
    return this.rng.range(.8, 2.8);
  }
}
