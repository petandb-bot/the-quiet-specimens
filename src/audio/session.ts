import { clamp } from '../core/random';
import { makeMaster } from './voices';

export type AudioSessionState = 'off' | 'starting' | 'running' | 'waiting' | 'blocked';
type Frame = (context: AudioContext, output: GainNode, opening: boolean) => void;

// One Web Audio graph and one look-ahead timer per page. Rendering never clocks notes.
export class AudioSession {
  private context?: AudioContext;
  private output?: GainNode;
  private timer?: number;
  private revision = 0;
  private opening?: Promise<boolean>;
  private requested = false;
  private volume = .56;
  state: AudioSessionState = 'off';

  constructor(private tick: Frame, private release: () => void, private changed: () => void) {
    document.addEventListener('visibilitychange', () => {
      if (!this.requested) return;
      if (document.hidden) this.quiet('waiting');
      else void this.start();
    });
  }

  get wantsSound() { return this.requested; }
  get time() { return this.context?.currentTime ?? 0; }

  frame() {
    if (this.state === 'running' && this.context?.state === 'running' && this.output && !document.hidden) {
      this.tick(this.context, this.output, false);
    }
  }

  setVolume(value: number) {
    this.volume = clamp(Number.isFinite(value) ? value : 0);
    this.level();
  }

  start() {
    if (this.opening) return this.opening;
    if (this.state === 'running' && this.context?.state === 'running') return Promise.resolve(true);
    this.requested = true;
    const revision = ++this.revision;
    this.update('starting');
    const pending = this.resume(revision).finally(() => {
      if (this.opening === pending) this.opening = undefined;
    });
    this.opening = pending;
    return pending;
  }

  private async resume(revision: number) {
    let deadline = 0;
    try {
      if (!this.context || this.context.state === 'closed') {
        const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Context) throw new Error('Web Audio unavailable');
        const context = this.context = new Context();
        this.output = makeMaster(context, 0);
        context.onstatechange = () => {
          if (this.context !== context || !this.requested || this.opening || document.hidden) return;
          if (context.state !== 'running') this.quiet('blocked');
          else if (this.state !== 'running') void this.start();
        };
      }
      const context = this.context;
      // Calling resume here keeps the original click's transient activation on Safari.
      if (context.state !== 'running') await Promise.race([
        context.resume(),
        new Promise<never>((_, reject) => { deadline = window.setTimeout(() => reject(new Error('Audio resume timed out')), 2300); }),
      ]);
      if (revision !== this.revision || !this.requested) return false;
      if (document.hidden) { this.quiet('waiting'); return true; }
      if (context.state !== 'running' || !this.output) throw new Error('Audio context is not running');
      this.update('running');
      this.level();
      this.tick(context, this.output, true);
      if (this.timer === undefined) this.timer = window.setInterval(() => this.frame(), 30);
      return true;
    } catch {
      if (revision === this.revision && this.requested) this.quiet('blocked');
      return false;
    } finally {
      window.clearTimeout(deadline);
    }
  }

  stop() {
    this.revision++;
    this.opening = undefined;
    this.requested = false;
    this.quiet('off');
  }

  reset() {
    this.stop();
    const previous = this.context;
    this.context = undefined;
    this.output = undefined;
    if (previous) {
      previous.onstatechange = null;
      if (previous.state !== 'closed') {
        // Leave the master fade time before shutting down its graph.
        window.setTimeout(() => { if (previous.state !== 'closed') void previous.close().catch(() => undefined); }, 55);
      }
    }
  }

  private quiet(state: AudioSessionState) {
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.update(state);
    this.level();
    this.release();
  }

  private level() {
    if (this.context?.state === 'closed' || !this.context || !this.output) return;
    this.output.gain.setTargetAtTime(this.state === 'running' ? this.volume * .75 : 0, this.context.currentTime, .025);
  }

  private update(state: AudioSessionState) {
    this.state = state;
    this.changed();
  }
}
