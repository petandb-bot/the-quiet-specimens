import type { Action, Specimen } from '../core/model';
import { clamp, random } from '../core/random';
import { makeMaster, note } from './voices';

export const maxVoices = 4;
export const minimumInterval = .68;
export const reactionCooldown = 5.0;
const lookAhead = .14;
const accents: Partial<Record<Action, number>> = { DART: .31, STARTLE: .22, INSPECT: .48, DISPLAY: .40 };

export class Rhythm {
  private previous = -Infinity;
  private lastAccent = -Infinity;

  canAccent(at: number, action: Action, response: number, probability: number) {
    return at - this.lastAccent >= reactionCooldown && at - this.previous >= minimumInterval
      && probability < (accents[action] ?? 0) * response;
  }
  canPlay(at: number) { return at - this.previous >= minimumInterval; }
  played(at: number, accent = false) {
    this.previous = at;
    if (accent) this.lastAccent = at;
  }
}

type SoundSpecimen = { genome: Pick<Specimen['genome'], 'seed' | 'sound'> };

export class ChamberSound {
  private context?: AudioContext;
  private bus?: GainNode;
  private interval?: number;
  private voices: ReturnType<typeof note>[] = [];
  private specimen?: SoundSpecimen;
  private rng = random('initial chamber');
  private time = 0;
  private auditionUntil = 0;
  private auditionOnly = false;
  private volume = .6;
  private enabled = false;
  private revision = 0;
  private action: Action = 'CRUISE';
  private actionSerial = -1;
  private pending?: Action;
  private rhythm = new Rhythm();

  constructor(private onChange: (enabled: boolean, audition: boolean) => void) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clearVoices();
        this.notify();
      } else if (this.enabled) void this.recover();
    });
  }

  private async recover() {
    try {
      await this.context?.resume();
      if (this.context) this.time = this.context.currentTime + .18;
    } catch { /* Safari can require another user gesture. */ }
    this.notify();
  }

  setSpecimen(specimen: SoundSpecimen) {
    if (this.auditionOnly) this.stop();
    this.auditionUntil = 0;
    this.clearVoices();
    this.specimen = specimen;
    this.rng = random(specimen.genome.seed + '/audio');
    this.rhythm = new Rhythm();
    this.time = (this.context?.currentTime ?? 0) + .35;
    this.pending = undefined;
    this.action = 'CRUISE';
    this.actionSerial = -1;
    this.notify();
  }

  behavior(action: Action, serial: number) {
    this.action = action;
    if (this.actionSerial === serial) return;
    this.actionSerial = serial;
    if (this.enabled && accents[action]) this.pending = action;
  }

  setVolume(volume: number) {
    this.volume = clamp(volume);
    if (this.context && this.bus) {
      this.bus.gain.setTargetAtTime(this.enabled ? this.volume * .75 : 0, this.context.currentTime, .035);
    }
  }

  async start() {
    if (this.enabled && this.context?.state === 'running') return true;
    const revision = ++this.revision;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.bus = makeMaster(this.context, 0);
        this.context.onstatechange = () => this.notify();
      }
      await this.context.resume();
      if (revision !== this.revision) return false;
      if (this.context.state !== 'running') return false;
      this.enabled = true;
      this.setVolume(this.volume);
      this.time = this.context.currentTime + .12;
      if (this.interval === undefined) this.interval = window.setInterval(this.tick, 35);
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  stop() {
    this.revision++;
    this.enabled = false;
    this.auditionOnly = false;
    this.auditionUntil = 0;
    this.setVolume(this.volume);
    this.clearVoices();
    window.clearInterval(this.interval);
    this.interval = undefined;
    this.notify();
  }

  async audition() {
    const previewOnly = !this.enabled || this.auditionOnly;
    if (!await this.start() || !this.context) return false;
    this.clearVoices();
    this.pending = undefined;
    this.rhythm = new Rhythm();
    this.time = this.context.currentTime + .09;
    this.auditionUntil = this.time + 10;
    this.auditionOnly = previewOnly;
    this.tick();
    this.notify();
    return true;
  }

  endAudition() {
    if (this.auditionOnly) { this.stop(); return; }
    this.auditionUntil = 0;
    this.clearVoices();
    this.time = (this.context?.currentTime ?? 0) + .85;
    this.notify();
  }

  private notify() {
    this.onChange(this.enabled && this.context?.state === 'running', this.auditionUntil > 0);
  }

  private clearVoices() {
    this.voices.forEach(voice => voice.stop());
    this.voices = [];
  }

  private tick = () => {
    if (!this.context || !this.bus || !this.specimen || document.hidden || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const sound = this.specimen.genome.sound;
    const audition = this.auditionUntil > now;
    if (!audition && this.auditionUntil) {
      this.endAudition();
      return;
    }
    if (this.time < now - .5) this.time = now + .06;
    this.voices = this.voices.filter(voice => voice.end > now);
    const queue = (at: number, accent = false) => {
      if (this.voices.length >= maxVoices || !this.rhythm.canPlay(at)) return;
      this.voices.push(note(this.context!, this.bus!, sound, this.rng, at, accent ? .72 : 1,
        !audition && this.action === 'HOVER'));
      this.rhythm.played(at, accent);
    };
    if (this.pending) {
      const at = now + .095;
      if (!audition && this.rhythm.canAccent(at, this.pending, sound.response, this.rng.next())) queue(at, true);
      this.pending = undefined;
    }
    if (this.time <= now + lookAhead) {
      const resting = this.action === 'REST';
      const meso = .84 + .24 * Math.sin(now / 13 + sound.resonance * 4);
      if (audition || this.rng.next() < sound.probability * (resting ? .42 : 1)) queue(Math.max(now + .02, this.time));
      this.time += audition ? clamp(sound.interval * .39, .93, 2.35)
        : sound.interval * this.rng.range(.74, 1.41) * meso * (resting ? 1.55 : 1);
    }
  };
}
