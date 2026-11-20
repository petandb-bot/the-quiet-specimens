export type SmallMoment = 'Waiting' | 'Greeting' | 'Sleeping' | 'Returned home';
export type WorldMoment = { kind: SmallMoment | 'Encounter' | 'Imitation'; actor: string; peer?: string; at: number };
const maxMoments = 20;
const lifetime = 135;

export class RecentMoments {
  private entries: WorldMoment[] = [];

  add(event: WorldMoment) {
    this.entries.push(event);
    if (this.entries.length > maxMoments) this.entries.shift();
  }

  recent(now: number) {
    while (this.entries.length && now - this.entries[0].at > lifetime) this.entries.shift();
    return this.entries;
  }

  clear() { this.entries.length = 0; }
}
