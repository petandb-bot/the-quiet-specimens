import { engines } from '../src/core/model';
import { random } from '../src/core/random';
import { makeMaster, note } from '../src/audio/voices';
import { references } from '../src/presets/reference';

const button = document.querySelector<HTMLButtonElement>('#run')!;
const result = document.querySelector<HTMLPreElement>('#result')!;
button.onclick = async () => {
  button.disabled = true;
  result.textContent = 'Rendering…\n';
  let passed = 0;
  for (const rate of [44_100, 48_000]) {
    for (const engine of engines) {
      try {
        const recording = new OfflineAudioContext(2, rate * 5, rate);
        const master = makeMaster(recording, .75);
        const sound = references.find(ref => ref.genome.sound.engine === engine)!.genome.sound;
        for (let i = 0; i < 4; i++) note(recording, master, sound, random(engine + i), .153 + i * .23);
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
        const valid = Number.isFinite(rms) && peak > .0005 && peak < .98 && dc < .003;
        if (valid) passed++;
        result.textContent += `${valid ? 'PASS' : 'FAIL'}  ${rate} Hz · ${engine} · peak ${peak.toFixed(5)} · RMS ${rms.toFixed(5)} · DC ${dc.toFixed(6)}\n`;
      } catch (error) {
        result.textContent += `FAIL  ${rate} Hz · ${engine} · ${String(error)}\n`;
      }
    }
  }
  result.textContent += `\n${passed} / 8 passed.\n`;
  button.disabled = false;
};
