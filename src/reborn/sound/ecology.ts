import type { Sonotype } from '../../core/model';
import { clamp, random } from '../../core/random';
import type { PointOfInterest } from '../composition';
import type { GardenSpecimen } from '../genome';
import type { RelationEvent } from '../relations';

export const worldVoiceLimit = 4;
export const worldSustainLimit = 2;
export const worldGap = .52;
const relationGap = 8;

type Rng = ReturnType<typeof random>;
export type SoundResident = { id: string; specimen: GardenSpecimen };
export type SoundPresence = { x: number; z: number; resting: boolean; gathering: boolean };
export type SoundField = { shelter: number; quiet: number; curiosity: number; gathering: number };

export function localSoundField(presence: SoundPresence, points: readonly PointOfInterest[]): SoundField {
  const field = { shelter: 0, quiet: 0, curiosity: 0, gathering: 0 };
  for (const place of points) {
    if (!place.center || !place.radius || !place.role || place.role === 'Neutral') continue;
    const distance = Math.hypot(presence.x - place.center[0], presence.z - place.center[1]);
    const weight = clamp(place.weight ?? 0) * clamp(1 - distance / place.radius);
    const effect = place.role.toLowerCase() as keyof SoundField;
    field[effect] = Math.max(field[effect], weight);
  }
  return field;
}

const neutral = { x: 0, z: 0, resting: false, gathering: false };
const emptyField: SoundField = { shelter: 0, quiet: 0, curiosity: 0, gathering: 0 };
type Role = 'Pulse' | 'Resonance' | 'Fragment' | 'Tone' | 'Texture' | 'Substrate';
const scales: Record<Role, number> = { Pulse: .74, Resonance: 1, Fragment: .68, Tone: .86, Texture: .97, Substrate: 1.35 };

function musicalRole(sound: Sonotype, rng: Rng): Role {
  if (sound.engine === 'Hollow Pulse') return rng.next() < .79 ? 'Pulse' : 'Fragment';
  if (sound.engine === 'Metallic Residue') return rng.next() < .68 ? 'Resonance' : 'Fragment';
  if (sound.engine === 'Thin Membrane') return rng.next() < .72 ? 'Tone' : 'Substrate';
  return 'Texture';
}

type Track = {
  id: string; source: Sonotype; role: Role; rng: Rng; voiceRng: Rng; motif: number[];
  note: number; next: number; last: number; incoming?: { expires: number; imitation: boolean };
};
export type EcologicalNote = { id: string; at: number; sound: Sonotype; rng: Rng; strength: number; sustained: boolean; response: boolean };

export class SoundEcology {
  private tracks = new Map<string, Track>();
  private cohort: Track[] = [];
  private rotatesAt = -Infinity;
  private last = -Infinity;
  private recent: number[] = [];
  private heard = new Set<string>();
  private responseAt = -Infinity;
  private open = false;

  get size() { return this.tracks.size; }

  setResidents(items: readonly SoundResident[], now: number) {
    const ids = new Set(items.map(item => item.id));
    const removed = [...this.tracks.keys()].filter(id => !ids.has(id));
    for (const id of removed) this.tracks.delete(id);
    let added = false;
    for (const [i, { id, specimen }] of items.entries()) {
      if (this.tracks.has(id)) continue;
      added = true;
      const source = specimen.genome.sound;
      const seed = specimen.genome.seed + '/' + id;
      const rng = random(seed + '/score');
      const role = musicalRole(source, rng);
      const motif = [source.pitches[0], rng.pick(source.pitches), rng.pick(source.pitches)];
      this.tracks.set(id, { id, source, rng, role, voiceRng: random(seed + '/voice'), motif,
        note: 0, next: now + i * .38, last: -Infinity });
    }
    if (added || removed.length) this.rotatesAt = -Infinity;
    return removed;
  }

  begin(now: number) {
    this.open = true;
    this.rotatesAt = now;
    this.recent = [];
    this.last = -Infinity;
    for (const [i, track] of [...this.tracks.values()].entries()) track.next = now + i * .38;
  }

  observe(events: readonly RelationEvent[], now: number, position: (id: string) => SoundPresence): void {
    for (const event of events) {
      const key = event.kind + '/' + event.at + '/' + event.actor + '/' + event.peer;
      if (this.heard.has(key)) continue;
      this.heard.add(key);
      if (this.heard.size > 48) this.heard.delete(this.heard.values().next().value!);
      if (now - this.responseAt < relationGap || event.kind === 'Follow') continue;
      const source = this.tracks.get(event.actor), peer = this.tracks.get(event.peer);
      if (!source || !peer) continue;
      const place = position(event.actor);
      const chance = .13 + source.source.response * .26 + (place.gathering ? .13 : 0);
      if (source.rng.next() > chance) continue;
      peer.incoming = { expires: now + 4.5, imitation: event.kind === 'Imitation' };
      this.responseAt = now;
    }
  }

  next(now: number, voices: number, sustained: number, density: number, point: (id: string) => SoundPresence = () => neutral,
    local: (at: SoundPresence) => SoundField = () => emptyField): EcologicalNote | undefined {
    if (!this.tracks.size || voices >= worldVoiceLimit) return;
    const d = clamp(density);
    const horizon = now + .12;
    if (this.last + worldGap + (1 - d) * .46 > horizon) return;
    this.recent = this.recent.filter(at => horizon - at < 2);
    if (this.recent.length >= 2 + Math.round(d * 2)) return;

    if (now >= this.rotatesAt) {
      this.rotatesAt = now + 11 + (1 - d) * 5;
      this.cohort = [...this.tracks.values()].sort((a, b) => a.last - b.last || a.next - b.next)
        .slice(0, 2 + Math.round(d * 2));
    }
    const eligible = this.cohort.filter(track => track.next <= horizon
      && (sustained < worldSustainLimit || (track.role !== 'Tone' && track.role !== 'Substrate')));
    for (const track of eligible) {
      const position = point(track.id);
      const effect = local(position);
      const meso = (track.note % 5 === 4 ? 1.75 : 1) * scales[track.role];
      const pause = Math.min(2.2, 1 + effect.shelter * .27 + effect.quiet * .56 + (position.resting ? .48 : 0));
      const probability = clamp(track.source.probability - effect.shelter * .20 - effect.quiet * .26
        - (position.resting ? .14 : 0) + effect.gathering * .12 + effect.curiosity * .05, .21, .93);
      const response = track.incoming && now < track.incoming.expires ? track.incoming : undefined;
      track.incoming = undefined;
      const at = Math.max(now + (this.open ? .065 : .027), track.next, this.last + worldGap + (1 - d) * .46);
      const phrase = track.motif[track.note % track.motif.length];
      track.next = at + clamp(track.source.interval * .79 * pause * meso * track.rng.range(.89, 1.18), .89, 8.4);
      track.note++;
      if (!this.open && now - this.last <= 8 && !response && track.rng.next() >= probability) continue;
      const long = track.role === 'Tone' || track.role === 'Substrate';
      const sound: Sonotype = { ...track.source, pitches: [response?.imitation ? phrase * .5 : phrase],
        register: track.source.register * (track.role === 'Substrate' ? .62 : 1),
        envelope: track.source.envelope * (long ? 1.08 : .82),
        harmonics: clamp(track.source.harmonics + effect.curiosity * .16),
        spatial: clamp(track.source.spatial * .72 + clamp(position.x / 30, -1, 1) * .22, -.59, .59) };
      track.last = this.last = at;
      this.recent.push(at);
      this.open = false;
      return { id: track.id, at, sound, rng: track.voiceRng, strength: response ? .40 : .55 + d * .12,
        sustained: long, response: Boolean(response) };
    }
  }
}
