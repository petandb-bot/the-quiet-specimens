import { ChamberSound } from '../audio/scheduler';
import type { Action } from '../core/model';
import { fromGardenSeed, gardenReferences, newGardenSpecimen } from './genome';
import type { GardenSpecimen } from './genome';
import { bodyPlans } from './morphology';
import type { Gesture, MotionPose } from './motion';
import { GardenView, worldLimit } from './view';
import type { GardenMode } from './view';
import './style.css';

function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

element('app').innerHTML = `
  <a class="skip" href="#controls">Skip to controls</a>
  <main class="experience" id="experience">
    <div class="canvas" id="canvas"></div>
    <p class="graphics" id="graphics" role="status" hidden></p>
    <header class="identity" id="identity">
      <a class="brand" href="./" aria-label="The Quiet Specimens home"><span class="brand-mark" aria-hidden="true"><i></i></span><span>The Quiet<br>Specimens</span></a>
      <nav aria-label="Artwork controls">
        <a class="utility legacy" href="./legacy/">Legacy</a>
        <button class="utility" type="button" id="sound" aria-pressed="false">Sound off</button>
        <button class="utility" type="button" id="view">View</button>
      </nav>
    </header>
    <div class="caption" id="caption">
      <p class="label">REBORN / ART &amp; MOTION STUDY</p>
      <h1 id="title">Artificial Garden</h1>
      <p class="caption-line" id="subtitle">A small world inhabited by things<br>that should not be alive.</p>
    </div>
    <button class="utility exit" type="button" id="exit" hidden>Exit view</button>
    <div class="notice" id="notice" role="status" hidden></div>

    <div class="control-dock" id="controls">
      <div class="view-modes">
        <div class="mode-group" role="group" aria-label="View mode">
          <button type="button" data-mode="Observe" aria-pressed="true">Observe</button>
          <button type="button" data-mode="Inspect" aria-pressed="false">Inspect</button>
          <button type="button" data-mode="Action" aria-pressed="false">Action</button>
        </div>
        <span id="guide" class="guide">Tap a specimen to see how it reacts.</span>
        <button class="pause" type="button" id="pause" aria-pressed="false">Pause</button>
      </div>
      <section class="workbench" aria-label="Specimen controls">
        <div class="specimen-title">
          <p class="label" id="family"></p>
          <h2 id="specimen-name"></h2>
          <p class="motion-reading" id="motion-reading"></p>
        </div>
        <div class="specimen-selection">
          <label for="reference" class="label">REFERENCE SPECIMENS</label>
          <select id="reference"></select>
          <details class="seed" id="seed-details">
            <summary>Seed <span id="seed-code"></span></summary>
            <form id="seed-form">
              <label for="seed">Load by seed</label>
              <div><input id="seed" maxlength="48" autocomplete="off" spellcheck="false" required><button type="submit">Load</button></div>
            </form>
          </details>
        </div>
        <div class="specimen-actions">
          <div class="gesture" id="gesture" hidden>
            <label class="visually-hidden" for="gesture-choice">Specimen action</label>
            <select id="gesture-choice"></select>
            <button type="button" id="play-action">Perform</button>
          </div>
          <div class="world-buttons">
            <button type="button" id="new" class="new">New specimen</button>
            <button type="button" id="membership">Add to world</button>
            <button type="button" id="audition" aria-pressed="false">Audition</button>
          </div>
          <p class="occupancy" id="occupancy"></p>
        </div>
      </section>
    </div>
  </main>
`;

const reference = element<HTMLSelectElement>('reference');
for (const item of gardenReferences) {
  reference.add(new Option(`${item.name} · ${item.genome.plan}`, item.genome.seed));
}
const gesture = element<HTMLSelectElement>('gesture-choice');
const seedInput = element<HTMLInputElement>('seed');
const media = matchMedia('(prefers-reduced-motion: reduce)');
let current = gardenReferences[0];
let mode: GardenMode = 'Observe';
let enabled = false;
let audition = false;
let isPaused = media.matches;
let graphics: GardenView | undefined;
let lastReading = '';
let noteTimer = 0;
let eventSerial = 0;

function notice(message: string) {
  element('notice').textContent = message;
  element('notice').hidden = false;
  clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => { element('notice').hidden = true; }, 2900);
}

function graphicsProblem(message: string) {
  element('graphics').hidden = !message;
  element('graphics').textContent = message;
}

const sound = new ChamberSound((on, testing) => {
  enabled = on;
  audition = testing;
  element('sound').setAttribute('aria-pressed', String(on));
  element('sound').textContent = on ? 'Sound on' : 'Sound off';
  element('audition').setAttribute('aria-pressed', String(testing));
  element('audition').textContent = testing ? 'End audition' : 'Audition';
});
sound.setVolume(.52);

function syncMotion() {
  const pose = graphics?.getPose(current.genome.seed);
  const reading = !pose ? 'Outside the garden'
    : isPaused ? 'Motion paused'
    : pose.phase === 'Act' ? pose.gesture : pose.phase;
  if (reading === lastReading) return;
  lastReading = reading;
  element('motion-reading').textContent = reading;
  const sonotype = { Act: 'DISPLAY', Rest: 'REST', Explore: 'CRUISE', Hesitate: 'HOVER', Recover: 'HOVER' } satisfies Record<MotionPose['phase'], Action>;
  sound.behavior(pose ? sonotype[pose.phase] : 'REST', ++eventSerial);
}

try {
  graphics = new GardenView(element('canvas'), item => { if (current !== item) select(item, false); }, syncMotion, graphicsProblem);
  for (const item of [gardenReferences[0], gardenReferences[3], gardenReferences[6]]) graphics.add(item);
} catch (error) {
  graphicsProblem(error instanceof Error ? error.message : 'The garden could not open on this device.');
}

function syncSelection() {
  element('family').textContent = `${current.genome.plan} / ${current.genome.material}`;
  element('specimen-name').textContent = current.name;
  element('seed-code').textContent = current.genome.seed;
  seedInput.value = current.genome.seed;
  reference.querySelector('[data-generated]')?.remove();
  if (!gardenReferences.some(item => item.genome.seed === current.genome.seed)) {
    const option = new Option(`${current.name} · ${current.genome.plan}`, current.genome.seed);
    option.dataset.generated = 'true';
    reference.add(option);
  }
  reference.value = current.genome.seed;
  gesture.replaceChildren(...bodyPlans[current.genome.plan].actions.map(item => new Option(item, item)));
  syncMembership();
}

function syncMembership() {
  const present = graphics?.has(current.genome.seed) ?? false;
  const member = element<HTMLButtonElement>('membership');
  member.textContent = present ? 'Remove from world' : 'Add to world';
  member.disabled = !graphics || (!present && graphics.count >= worldLimit);
  element('occupancy').textContent = graphics ? `${graphics.count} / ${worldLimit} in the garden` : '';
  syncMotion();
}

function select(item: GardenSpecimen, inspectIfAbsent: boolean) {
  current = item;
  sound.setSpecimen(item);
  lastReading = '';
  syncSelection();
  setMode(inspectIfAbsent && mode === 'Observe' && !graphics?.has(item.genome.seed) ? 'Inspect' : mode);
}

function setMode(next: GardenMode) {
  mode = next;
  graphics?.setMode(mode, current);
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  });
  element('experience').dataset.mode = mode;
  element('title').textContent = mode === 'Observe' ? 'Artificial Garden' : current.name;
  element('subtitle').hidden = mode !== 'Observe';
  element('gesture').hidden = mode !== 'Action';
  element('guide').textContent = {
    Observe: 'Tap a specimen to see how it reacts.',
    Inspect: 'Drag to orbit. Scroll or pinch to zoom.',
    Action: 'Choose a gesture and watch its preparation and recovery.',
  }[mode];
  lastReading = '';
  syncMotion();
}

function pause(next: boolean) {
  isPaused = next;
  graphics?.setPaused(isPaused);
  element('pause').setAttribute('aria-pressed', String(isPaused));
  element('pause').textContent = isPaused ? 'Resume' : 'Pause';
  syncMotion();
}

const click = (id: string, callback: () => void) => element(id).addEventListener('click', callback);
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button =>
  button.addEventListener('click', () => setMode(button.dataset.mode as GardenMode)));
reference.addEventListener('change', () => {
  const specimen = gardenReferences.find(item => item.genome.seed === reference.value);
  if (specimen) select(specimen, true);
});
click('new', () => select(newGardenSpecimen(), true));
element<HTMLFormElement>('seed-form').addEventListener('submit', event => {
  event.preventDefault();
  const seed = seedInput.value.trim();
  if (!seed) return;
  element<HTMLDetailsElement>('seed-details').open = false;
  select(fromGardenSeed(seed), true);
  element('seed-details').querySelector('summary')?.focus();
});
click('membership', () => {
  if (!graphics) return;
  const key = current.genome.seed;
  if (graphics.has(key)) {
    if (graphics.remove(key)) notice(`${current.name} was removed from the garden.`);
  } else if (graphics.add(current)) {
    setMode('Observe');
    notice(`${current.name} joined the garden.`);
  }
  syncMembership();
});
click('play-action', () => {
  if (isPaused) pause(false);
  graphics?.perform(gesture.value as Gesture);
});
click('pause', () => pause(!isPaused));
click('sound', () => {
  if (enabled) sound.stop();
  else void sound.start().then(ok => { if (!ok) notice('Audio did not start on this device.'); });
});
click('audition', () => {
  if (audition) sound.endAudition();
  else void sound.audition().then(ok => { if (!ok) notice('Audio did not start on this device.'); });
});

function viewing(show: boolean) {
  for (const name of ['identity', 'caption', 'controls']) element(name).hidden = show;
  element('exit').hidden = !show;
  element(show ? 'exit' : 'view').focus();
}
click('view', () => viewing(true));
click('exit', () => viewing(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !element('exit').hidden) viewing(false);
});

sound.setSpecimen(current);
syncSelection();
pause(isPaused);
setMode('Observe');
