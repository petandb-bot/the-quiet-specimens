import type { Engine, Sonotype } from '../core/model';
import { clamp, random } from '../core/random';

type Rng = ReturnType<typeof random>;
type Voice = { stop: (at?: number) => void; end: number };
type Notes = {
  context: BaseAudioContext; output: AudioNode; sound: Sonotype;
  at: number; pitch: number; duration: number; strength: number; rng: Rng;
};

export function makeMaster(context: BaseAudioContext, volume: number) {
  const bus = context.createGain();
  bus.gain.value = volume;
  const dcBlock = context.createBiquadFilter();
  dcBlock.type = 'highpass';
  dcBlock.frequency.value = 24;
  dcBlock.Q.value = .5;
  const peakGuard = context.createDynamicsCompressor();
  peakGuard.threshold.value = -7;
  peakGuard.knee.value = 1;
  peakGuard.ratio.value = 10;
  peakGuard.attack.value = .003;
  peakGuard.release.value = .13;
  bus.connect(dcBlock).connect(peakGuard).connect(context.destination);
  return bus;
}

const registered: Record<Engine, (notes: Notes) => Voice> = {
  'Hollow Pulse': fm,
  'Thin Membrane': membrane,
  'Metallic Residue': residue,
  'Soft Debris': debris,
};

export function note(context: BaseAudioContext, output: AudioNode, sound: Sonotype, rng: Rng, at: number, strength = 1, hover = false): Voice {
  const pitch = clamp(sound.register * 2 ** (rng.pick(sound.pitches) / 12), 45, 1000);
  const duration = clamp(sound.envelope * rng.range(.72, 1.22) * (hover ? 1.25 : 1), .16, 3.4);
  return registered[sound.engine]({ context, output, sound, rng, at, strength, pitch, duration });
}

function envelope(n: Notes, duration: number, attack: number, level: number) {
  const gain = n.context.createGain();
  const panner = n.context.createStereoPanner();
  panner.pan.value = clamp(n.sound.spatial + n.rng.range(-.16, .16), -.85, .85);
  gain.gain.setValueAtTime(.0001, n.at);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002, level * n.strength), n.at + attack);
  gain.gain.exponentialRampToValueAtTime(.0001, n.at + duration);
  gain.connect(panner).connect(n.output);
  const nodes: AudioNode[] = [gain, panner];
  const sources: AudioScheduledSourceNode[] = [];
  const end = n.at + duration + .015;
  const play = () => {
    let resting = 0;
    sources.forEach(source => {
      source.onended = () => {
        if (++resting === sources.length) nodes.forEach(node => node.disconnect());
      };
      source.start(n.at);
      source.stop(end);
    });
    return { end, stop: (at = n.context.currentTime) => {
      const fade = at + .033;
      if (typeof gain.gain.cancelAndHoldAtTime === 'function') gain.gain.cancelAndHoldAtTime(at);
      else gain.gain.cancelScheduledValues(at);
      gain.gain.setTargetAtTime(.0001, at, .007);
      sources.forEach(source => { if (fade < end) source.stop(fade); });
    } };
  };
  function osc(pitch: number, target: AudioNode | AudioParam) {
    const oscillator = n.context.createOscillator();
    oscillator.frequency.setValueAtTime(pitch, n.at);
    if ('frequency' in target || 'channelCount' in target) oscillator.connect(target as AudioNode);
    else oscillator.connect(target as AudioParam);
    nodes.push(oscillator);
    sources.push(oscillator);
    return oscillator;
  }
  return { gain, nodes, sources, play, osc };
}

function fm(n: Notes): Voice {
  const duration = clamp(n.duration * .59, .13, 1.4);
  const v = envelope(n, duration, .022, .18);
  const carrier = v.osc(n.pitch * 1.014, v.gain);
  carrier.frequency.exponentialRampToValueAtTime(n.pitch * (.89 + n.rng.next() * .11), n.at + duration * .50);
  const index = n.context.createGain();
  index.gain.setValueAtTime(n.pitch * (.16 + n.sound.harmonics * 1.5), n.at);
  index.gain.exponentialRampToValueAtTime(.8, n.at + duration * .75);
  index.connect(carrier.frequency);
  v.nodes.push(index);
  v.osc(n.pitch * (1.27 + n.sound.modulation * 2.04), index);
  return v.play();
}

function membrane(n: Notes): Voice {
  const v = envelope(n, n.duration, clamp(n.duration * .20, .048, .54), .15);
  const lead = v.osc(n.pitch, v.gain);
  const drift = n.context.createGain();
  drift.gain.value = .5 + n.sound.modulation * 8;
  drift.connect(lead.detune);
  v.nodes.push(drift);
  v.osc(n.rng.range(.8, 3.1), drift);
  const overtone = n.context.createGain();
  overtone.gain.value = .06 + n.sound.harmonics * .25;
  overtone.connect(v.gain);
  v.nodes.push(overtone);
  v.osc(n.pitch * (2 + n.rng.range(-.023, .023)), overtone);
  return v.play();
}

function residue(n: Notes): Voice {
  const duration = clamp(n.duration * (.64 + n.sound.resonance * .81), .19, 3.4);
  const v = envelope(n, duration, .008, .13);
  [1, 1.47, 2.17, 3.64, 5.29].forEach((ratio, i) => {
    const partial = n.context.createGain();
    const level = i === 0 ? .69 : n.sound.harmonics * .49 / i ** .67;
    partial.gain.setValueAtTime(level, n.at);
    partial.gain.exponentialRampToValueAtTime(.0005, n.at + duration * (1 - i * .135));
    partial.connect(v.gain);
    v.nodes.push(partial);
    v.osc(n.pitch * (ratio + i * .039 * n.sound.modulation), partial);
  });
  return v.play();
}

function debris(n: Notes): Voice {
  const duration = clamp(n.duration * .62, .15, 1.26);
  const v = envelope(n, duration, .018, .19);
  const buffer = n.context.createBuffer(1, Math.ceil(duration * n.context.sampleRate), n.context.sampleRate);
  const samples = buffer.getChannelData(0);
  const flutter = n.rng.range(12, 28);
  let tint = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = n.rng.range(-1, 1);
    tint = .78 * tint + .22 * value;
    const grain = clamp(Math.sin(i / n.context.sampleRate * Math.PI * 2 * flutter) * 1.18, .06, 1);
    samples[i] = (tint * .67 + value * n.sound.noise) * grain;
  }
  const source = n.context.createBufferSource();
  source.buffer = buffer;
  const filter = n.context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.4 + n.sound.resonance * 8;
  filter.frequency.setValueAtTime(n.pitch * 4.5, n.at);
  filter.frequency.exponentialRampToValueAtTime(n.pitch * (1.6 + n.sound.modulation * 2.2), n.at + duration * .76);
  source.connect(filter).connect(v.gain);
  v.nodes.push(source, filter);
  v.sources.push(source);
  return v.play();
}
