import { engines } from '../src/core/model';
import { random } from '../src/core/random';
import { makeMaster, note } from '../src/audio/voices';
import { SoundEcology } from '../src/reborn/sound/ecology';
import { gardenReferences } from '../src/reborn/genome';
import { references } from '../src/legacy/presets/reference';

const button = document.querySelector<HTMLButtonElement>('#run')!;
const result = document.querySelector<HTMLPreElement>('#result')!;
button.onclick = async () => {
  button.disabled = true;
  result.textContent = 'Rendering…\n';
  let passed = 0;
  for (const rate of [44_100, 48_000]) {
    for (const engine of [...engines, 'World'] as const) {
      try {
        const duration = engine === 'World' ? 18 : 5;
        const recording = new OfflineAudioContext(2, rate * duration, rate);
        const master = makeMaster(recording, .75);
        const participants = new Set<string>();
        if (engine === 'World') {
          const score = new SoundEcology();
          score.setResidents(gardenReferences.map(specimen => ({ id: specimen.genome.seed, specimen })), 0);
          score.begin(0);
          let voices: Array<{ end: number; sustained: boolean }> = [];
          for (let time = 0; time < duration - .3; time += .03) {
            voices = voices.filter(voice => voice.end > time);
            const event = score.next(time, voices.length, voices.filter(voice => voice.sustained).length, .62);
            if (!event) continue;
            const voice = note(recording, master, event.sound, event.rng, event.at, event.strength);
            voices.push({ end: voice.end, sustained: event.sustained });
            participants.add(event.id);
          }
        } else {
          const sound = references.find(ref => ref.genome.sound.engine === engine)!.genome.sound;
          for (let i = 0; i < 4; i++) note(recording, master, sound, random(engine + i), .153 + i * .23);
        }
        const rendered = await recording.startRendering();
        let peak = 0, energy = 0, mean = 0;
        for (let i = 0; i < rendered.numberOfChannels; i++) {
          for (const sample of rendered.getChannelData(i)) {
            peak = Math.max(peak, Math.abs(sample));
            energy += sample * sample;
            mean += sample;
          }
        }
        const count = rendered.length * rendered.numberOfChannels;
        const rms = Math.sqrt(energy / count);
        const dc = Math.abs(mean / count);
        const valid = Number.isFinite(rms) && peak > .0005 && peak < .9 && dc < .003 && (engine !== 'World' || participants.size >= 2);
        if (valid) passed++;
        result.textContent += `${valid ? 'PASS' : 'FAIL'}  ${rate} Hz · ${engine} · peak ${peak.toFixed(5)} · RMS ${rms.toFixed(5)} · DC ${dc.toFixed(6)}${engine === 'World' ? ' · ' + participants.size + ' residents' : ''}\n`;
      } catch (error) {
        result.textContent += `FAIL  ${rate} Hz · ${engine} · ${String(error)}\n`;
      }
    }
  }
  result.textContent += `\n${passed} / 10 passed.\n`;
  button.disabled = false;
};
