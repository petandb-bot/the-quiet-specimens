import type { Action } from '../../core/model';
import { clamp, random } from '../../core/random';
import { AudioSession } from '../../audio/session';
import type { AudioSessionState } from '../../audio/session';
import { note } from '../../audio/voices';
import type { GardenSpecimen } from '../genome';
import type { RelationEvent } from '../relations';
import { localSoundField, SoundEcology } from './ecology';
import type { SoundPresence, SoundResident } from './ecology';
import type { PointOfInterest } from '../composition';

const safeStart = .065;
type Voice = ReturnType<typeof note> & { id?: string; sustained?: boolean };
export type SoundMix = 'World' | 'Solo';
type SoundScenery = {
  presence: (id: string) => SoundPresence;
  points: () => readonly PointOfInterest[];
  events: () => readonly RelationEvent[];
};
export type GardenAudioStatus = { state: AudioSessionState; audition: boolean; message: string };

export class GardenSound {
  private session: AudioSession;
  private selected?: GardenSpecimen;
  private preview?: { item: GardenSpecimen; ends: number; only: boolean; rng: ReturnType<typeof random> };
  private voices: Voice[] = [];
  private rng = random('garden sound');
  private next = 0;
  private force = true;
  private resting = false;
  private volume = .56;
  private density = .62;
  private mix: SoundMix = 'World';
  private score = new SoundEcology();
  private scenery?: SoundScenery;
  private lastSolo = -Infinity;

  constructor(private changed: (status: GardenAudioStatus) => void) {
    this.session = new AudioSession(this.tick, () => this.release(), () => this.report());
  }

  private report() {
    const state = this.session.state;
    const audition = Boolean(this.preview);
    const message = state === 'blocked' ? 'Audio could not start. Press Sound to retry or use Audio Reset.'
      : state === 'starting' ? 'Starting audio…'
      : state === 'waiting' ? 'Audio is paused while this tab is hidden.'
      : state !== 'running' ? 'Sound is off.'
      : !this.volume ? 'Volume is at zero.'
      : audition ? 'Playing the selected specimen.'
      : this.mix === 'World' && !this.score.size ? 'There are no residents to play World audio.'
      : this.mix === 'World' ? 'World is playing. Quiet intervals are part of the score.'
      : !this.selected ? 'Choose a specimen to hear it.'
      : 'Solo is playing.';
    this.changed({ state, audition, message });
  }

  setSpecimen(item: GardenSpecimen) {
    if (this.selected?.genome.seed === item.genome.seed) return;
    if (this.preview) this.endAudition();
    if (this.mix === 'Solo') this.release();
    this.selected = item;
    this.rng = random(item.genome.seed + '/audio');
    this.next = 0;
    this.force = true;
    this.session.frame();
    this.report();
  }

  setResidents(items: readonly SoundResident[]) {
    const removed = this.score.setResidents(items, this.session.time);
    if (removed.length) {
      this.voices = this.voices.filter(voice => {
        if (!voice.id || !removed.includes(voice.id)) return true;
        voice.stop();
        return false;
      });
    }
    this.session.frame();
    this.report();
  }

  setScenery(scenery: SoundScenery) { this.scenery = scenery; }

  setMix(mix: SoundMix) {
    if (mix === this.mix) return;
    this.mix = mix;
    if (!this.preview) {
      this.release();
      this.force = true;
      this.next = 0;
      if (mix === 'World') this.score.begin(this.session.time);
      this.session.frame();
    }
    this.report();
  }

  setDensity(value: number) { this.density = clamp(Number.isFinite(value) ? value : .62); }

  behavior(action: Action, _serial?: number) { this.resting = action === 'REST'; }

  setVolume(value: number) {
    this.volume = clamp(Number.isFinite(value) ? value : 0);
    this.session.setVolume(this.volume);
    this.report();
  }

  toggle() {
    const { state } = this.session;
    if (state === 'running' || state === 'starting' || state === 'waiting') {
      this.stop();
      return Promise.resolve(true);
    }
    return this.session.start();
  }

  stop() {
    this.preview = undefined;
    this.session.stop();
  }

  reset() {
    this.preview = undefined;
    this.next = 0;
    this.force = true;
    this.session.reset();
  }

  async audition() {
    if (!this.selected) return false;
    const item = this.selected;
    const only = !this.session.wantsSound || this.session.state === 'blocked';
    this.release();
    const preview = this.preview = { item, ends: Infinity, only, rng: random(item.genome.seed + '/audition') };
    this.next = 0;
    this.force = true;
    const ok = await this.session.start();
    if (this.preview !== preview) return false;
    if (!ok) this.preview = undefined;
    else {
      preview.ends = this.session.time + 10;
      this.session.frame();
    }
    this.report();
    return ok;
  }

  endAudition() {
    if (!this.preview) return;
    const { only } = this.preview;
    this.preview = undefined;
    if (only) this.session.stop();
    else {
      this.release();
      this.next = this.session.time + .25;
      this.force = true;
      this.report();
    }
  }

  private release() {
    for (const voice of this.voices) voice.stop();
    this.voices.length = 0;
  }

  private tick = (context: AudioContext, output: GainNode, opening: boolean) => {
    const now = context.currentTime;
    if (this.preview && this.preview.ends <= now) { this.endAudition(); return; }
    const aud = this.preview;
    this.voices = this.voices.filter(voice => voice.end > now);
    if (!aud && this.mix === 'World') {
      if (opening) this.score.begin(now);
      const scenery = this.scenery;
      const points = scenery?.points() ?? [];
      if (scenery) this.score.observe(scenery.events(), now, scenery.presence);
      const planned = this.score.next(now, this.voices.length, this.voices.filter(voice => voice.sustained).length,
        this.density, scenery?.presence, at => localSoundField(at, points));
      if (planned) this.voices.push({ ...note(context, output, planned.sound, planned.rng, planned.at, planned.strength),
        id: planned.id, sustained: planned.sustained });
      return;
    }
    const item = aud?.item ?? this.selected;
    if (!item) return;
    if (opening || this.next < now - .5) this.next = now + safeStart;
    if (this.next > now + .12 || this.voices.length >= 3) return;
    const sound = item.genome.sound;
    const rng = aud?.rng ?? this.rng;
    if (opening || this.force || aud || now - this.lastSolo > 8 || rng.next() < sound.probability * (this.resting ? .58 : 1)) {
      this.lastSolo = Math.max(now + .026, this.next);
      this.voices.push(note(context, output, sound, rng, this.lastSolo, .82));
    }
    this.force = false;
    this.next = Math.max(this.next, now) + (aud ? clamp(sound.interval * .46, .96, 2.35)
      : Math.min(5.2, sound.interval * rng.range(.84, 1.21) * (this.resting ? 1.45 : 1)));
  };
}
