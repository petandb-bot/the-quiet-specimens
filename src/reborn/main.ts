import { ResidentBrowser } from './observation/residents';
import { WorldComposer } from './composer/editor';
import { GardenSound } from './sound/garden-sound';
import type { Action } from '../core/model';
import { fromGardenSeed, gardenReferences, newGardenSpecimen } from './genome';
import type { GardenSpecimen } from './genome';
import { bodyPlans } from './morphology';
import type { Gesture, MotionPose } from './motion';
import { GardenView, worldLimit } from './view';
import type { CameraMode } from './view';
import { defaultLand, terrainKinds } from './terrain';
import type { TerrainKind } from './terrain';
import { defaultImage } from './photo';
import type { ImageSettings } from './photo';
import { freshSeed } from '../core/random';
import type { GardenMode } from './view';
import './style.css';
import './composer/style.css';

function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

element('app').innerHTML = `
  <a class="skip" href="#observe-mode">Skip to controls</a>
  <main class="experience" id="experience">
    <div class="canvas" id="canvas"></div>
    <p class="graphics" id="graphics" role="status" hidden></p>
    <header class="identity" id="identity">
      <a class="brand" href="./" aria-label="The Quiet Specimens home" title="The Quiet Specimens — Elsewhere">
        <span class="brand-mark" aria-hidden="true"><i></i></span>
        <span class="brand-wordmark">The Quiet<br>Specimens</span>
      </a>
      <nav class="primary-nav" aria-label="World controls">
        <div class="mode-switch" role="group" aria-label="Workspace">
          <button class="utility" type="button" id="observe-mode" aria-pressed="true">Observe</button>
          <button class="utility compose-toggle" type="button" id="compose-settings" aria-controls="compose-panel" aria-pressed="false" disabled>Make</button>
        </div>
        <button class="utility observe-only" type="button" id="life-settings" aria-controls="residents-panel" aria-expanded="false">Residents</button>
        <button class="utility observe-only" type="button" id="camera-settings" aria-controls="camera-panel" aria-expanded="false">Camera</button>
        <button class="utility observe-only" type="button" id="view" title="Hide controls and focus on the world">Focus</button>
        <button class="utility" type="button" id="sound" aria-pressed="false">Sound off</button>
        <button class="utility menu-toggle" type="button" id="more-controls" aria-controls="secondary-nav" aria-expanded="false">More</button>
      </nav>
      <nav class="secondary-nav" id="secondary-nav" aria-label="More controls" hidden>
        <button class="utility" type="button" id="audio-settings" aria-controls="audio-panel" aria-expanded="false">Sound mix</button>
        <a class="utility legacy" href="./legacy/">Legacy</a>
      </nav>
    </header>
    <div class="caption" id="caption">
      <p class="label">ELSEWHERE / FIELD STUDY</p>
      <h1 id="title">Elsewhere</h1>
      <p class="caption-line" id="subtitle">A world continuing beyond the frame.</p>
    </div>
    <section class="composer" id="compose-panel" aria-label="World Composer" hidden></section>
    <section class="land-panel" id="land-panel" aria-label="World settings" hidden>
      <label>Terrain<select id="land-kind"></select></label>
      <label>Elevation<input id="land-height" type="range" min="0" max="100" value="48"></label>
      <label>Roughness<input id="land-rough" type="range" min="0" max="100" value="26"></label>
      <label>World seed<input id="land-seed" maxlength="48" value="ELSEWHERE-01"></label>
      <details><summary>Composition</summary>
        <label>Openness<input id="land-open" type="range" min="0" max="100" value="61"></label>
        <label>Landmark density<input id="land-density" type="range" min="0" max="100" value="66"></label>
      </details>
      <div class="land-buttons"><button id="land-apply" type="button">Apply land</button><button id="land-new" type="button">New terrain</button></div>
      <p class="land-note">Terrain changes keep your residents.</p>
    </section>
    <section class="land-panel" id="image-panel" aria-label="Image settings" hidden>
      <label>Local photo<input id="land-photo" type="file" accept="image/*"></label>
      <div id="photo-controls" class="region-fields" hidden>
        <label>Image mode<select id="image-mode"><option>Backdrop</option><option>Atmosphere</option></select></label>
        <label>Image scale<input id="image-scale" type="range" min="100" max="250" value="100"></label>
        <label>Horizontal offset<input id="image-x" type="range" min="-100" max="100" value="0"></label>
        <label>Vertical offset<input id="image-y" type="range" min="-100" max="100" value="0"></label>
        <label>Horizon position<input id="image-horizon" type="range" min="0" max="100" value="50"></label>
        <label>Blur<input id="image-blur" type="range" min="0" max="100" value="9"></label>
        <label>Color influence<input id="image-color" type="range" min="0" max="100" value="52"></label>
        <label>Ground blend<input id="image-ground" type="range" min="0" max="100" value="73"></label>
        <button id="land-clear" type="button">Clear photo</button>
      </div>
      <p class="land-note">An accepted photo is included in your local draft.</p>
    </section>
    <section class="land-panel resident-panel" id="residents-panel" aria-label="Resident browser" hidden>
      <div class="resident-actions"><button id="resident-atlas" type="button">Atlas</button><button id="open-life" type="button">Discover</button></div>
      <div id="resident-list" class="resident-list"></div>
      <div class="resident-actions">
        <button id="resident-locate" type="button">Locate</button><button id="resident-follow" type="button">Soft Follow</button>
        <button id="resident-inspect" type="button">Inspect</button><button id="resident-audition" type="button">Audition</button>
      </div>
      <details id="moment-details"><summary>Recent moments</summary><ul id="moment-list" class="moment-list"></ul></details>
    </section>
    <section class="land-panel" id="audio-panel" aria-label="Audio controls" hidden>
      <label>Mix<select id="audio-mode"><option>World</option><option>Solo</option></select></label>
      <label>Master volume <output id="master-level">56%</output><input id="master-volume" type="range" min="0" max="100" value="56"></label>
      <label id="density-control">World density <input id="audio-density" type="range" min="0" max="100" value="62"></label>
      <p class="land-note" id="audio-state" role="status">Sound is off.</p>
      <div class="land-buttons"><button id="audio-audition" type="button" aria-pressed="false">Audition</button>
        <button id="audio-reset" type="button">Audio Reset</button></div>
    </section>
    <section class="land-panel" id="camera-panel" aria-label="Camera settings" hidden>
      <label>Camera<select id="camera-mode"><option>Fixed</option><option>Landscape</option><option>Soft Follow</option><option>Observatory</option><option>Atlas</option></select></label>
      <label>Resident<select id="camera-resident"></select></label>
      <div class="land-buttons"><button id="zoom-out" type="button">Zoom out</button><button id="zoom-in" type="button">Zoom in</button></div>
      <button id="camera-reset" type="button">Reset camera</button>
      <label class="check-line"><input id="camera-still" type="checkbox"> Reduce motion</label>
      <div id="camera-tour" class="region-fields" hidden>
        <strong id="camera-station"></strong>
        <div class="land-buttons"><button id="previous-view" type="button">Previous view</button><button id="next-view" type="button">Next view</button></div>
        <label class="check-line"><input id="camera-auto" type="checkbox"> Auto-advance every 100 seconds</label>
      </div>
      <p class="land-note" id="camera-help"></p>
    </section>
    <button class="utility exit" type="button" id="exit" hidden>Exit focus</button>
    <div class="notice" id="notice" role="status" hidden></div>

    <div class="control-dock" id="controls" hidden>
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
let audition = false;
let isPaused = false;
let graphics: GardenView | undefined;
let composer: WorldComposer | undefined;
let lastReading = '';
let lastSoundReading = '';
let noteTimer = 0;
let panel: 'land' | 'image' | 'camera' | 'life' | 'audio' | 'residents' | undefined;
let making = false;
let draftLoading = true;
const cameraMode = element<HTMLSelectElement>('camera-mode');
const cameraResident = element<HTMLSelectElement>('camera-resident');
let browseSeed = '';
let browserAt = -Infinity;
const residents = new ResidentBrowser(element('resident-list'), item => graphics?.residentThumbnail(item) ?? '', item => {
  browseSeed = item.genome.seed;
  select(item, false);
  updateResidents();
});

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

const sound = new GardenSound(({ state, audition: testing, message }) => {
  audition = testing;
  const on = state === 'running';
  element('sound').setAttribute('aria-pressed', String(on));
  element('sound').textContent = on ? 'Sound on' : state === 'starting' ? 'Starting sound…' : state === 'blocked' ? 'Retry sound' : 'Sound off';
  element('audio-state').textContent = message;
  for (const id of ['audition', 'audio-audition', 'resident-audition']) {
    element(id).setAttribute('aria-pressed', String(testing));
    element(id).textContent = testing ? 'End audition' : 'Audition';
  }
});

function syncMotion() {
  if (graphics && cameraMode.value !== graphics.camera) { cameraMode.value = graphics.camera; syncCameraControls(); }
  if (panel === 'camera' && element('camera-station').textContent !== graphics?.observationStation) {
    element('camera-station').textContent = graphics?.observationStation ?? '';
  }
  if (panel === 'residents' && performance.now() - browserAt >= 330) updateResidents();
  const pose = graphics?.getPose(current.genome.seed);
  const reading = !pose ? 'Outside the garden'
    : isPaused ? 'Motion paused'
    : pose.moment ?? pose.social ?? (pose.phase === 'Act' ? pose.gesture : pose.phase === 'Explore' ? pose.intent : pose.phase);
  if (reading !== lastReading) {
    lastReading = reading;
    element('motion-reading').textContent = reading;
  }
  const audioReading = isPaused ? 'Paused' : pose?.phase === 'Act' ? pose.gesture : pose?.phase ?? 'Absent';
  if (audioReading === lastSoundReading) return;
  lastSoundReading = audioReading;
  const sonotype = { Act: 'DISPLAY', Rest: 'REST', Explore: 'CRUISE', Hesitate: 'HOVER', Recover: 'HOVER' } satisfies Record<MotionPose['phase'], Action>;
  sound.behavior(pose ? sonotype[pose.phase] : 'REST');
}

try {
  graphics = new GardenView(element('canvas'), item => {
    browseSeed = item.genome.seed;
    if (current !== item) select(item, false);
    if (graphics?.camera === 'Atlas') showPanel('residents');
  }, syncMotion, graphicsProblem);
  const view = graphics;
  sound.setScenery({ presence: id => view.soundPresence(id), points: () => view.soundPoints(), events: () => view.soundEvents() });
  composer = new WorldComposer(element('compose-panel'), graphics, () => current, () => {
    syncMembership();
    syncWorldControls();
  }, (item, follow) => {
    setWorkspace(false);
    showPanel(follow ? undefined : 'life');
    select(item, false);
    setMode(follow ? 'Observe' : 'Inspect');
    if (follow) { graphics?.setCamera('Soft Follow'); syncMotion(); }
  });
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
  member.disabled = draftLoading || !composer || !graphics || (!present && graphics.count >= worldLimit);
  element('occupancy').textContent = graphics ? `${graphics.count} / ${worldLimit} in the world` : '';
  const residents = graphics?.residents ?? [];
  sound.setResidents(residents.map(specimen => ({ id: specimen.genome.seed, specimen })));
  cameraResident.replaceChildren(...residents.map(item => new Option(item.name, item.genome.seed)));
  cameraResident.value = residents.some(item => item.genome.seed === current.genome.seed)
    ? current.genome.seed : (residents[0]?.genome.seed ?? '');
  cameraResident.disabled = !residents.length;
  cameraMode.options[2].disabled = !residents.length;
  syncMotion();
}

function select(item: GardenSpecimen, inspectIfAbsent: boolean) {
  current = item;
  sound.setSpecimen(item);
  lastReading = '';
  lastSoundReading = '';
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
  element('title').textContent = mode === 'Observe' ? 'Elsewhere' : current.name;
  element('subtitle').hidden = mode !== 'Observe';
  element('gesture').hidden = mode !== 'Action';
  element('guide').textContent = {
    Observe: 'Tap a specimen to see how it reacts.',
    Inspect: 'Drag to orbit. Scroll or pinch to zoom.',
    Action: 'Choose a gesture and watch its preparation and recovery.',
  }[mode];
  lastReading = '';
  lastSoundReading = '';
  syncMotion();
}

function pause(next: boolean) {
  isPaused = next;
  graphics?.setPaused(isPaused);
  element('pause').setAttribute('aria-pressed', String(isPaused));
  element('pause').textContent = isPaused ? 'Resume' : 'Pause';
  syncMotion();
}

const click = (id: string, callback: () => void) => element(id)?.addEventListener('click', callback);

const menuButton = element<HTMLButtonElement>('more-controls');
const secondaryNav = element<HTMLElement>('secondary-nav');
function showMore(open: boolean) {
  if (!open && secondaryNav.contains(document.activeElement)) menuButton.focus();
  secondaryNav.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
}
click('more-controls', () => {
  const open = secondaryNav.hidden;
  showMore(open);
  if (open) secondaryNav.querySelector<HTMLElement>('button, a')?.focus();
});
secondaryNav.addEventListener('click', event => {
  if ((event.target as HTMLElement).closest('button, a')) showMore(false);
});
document.addEventListener('pointerdown', event => {
  if (!secondaryNav.hidden && event.target instanceof Node && !element('identity').contains(event.target)) {
    showMore(false);
  }
});

const landKind = element<HTMLSelectElement>('land-kind');
for (const kind of terrainKinds) landKind.add(new Option(kind, kind));
landKind.value = defaultLand.kind;
const landSeed = element<HTMLInputElement>('land-seed');
const panels = { land: ['world-settings', 'land-panel'],
  residents: ['life-settings', 'residents-panel'], life: ['open-life', 'controls'],
  image: ['image-settings', 'image-panel'], audio: ['audio-settings', 'audio-panel'], camera: ['camera-settings', 'camera-panel'] } as const;
function showPanel(next?: keyof typeof panels) {
  showMore(false);
  panel = next;
  element('experience').classList.toggle('make-overlay', making && Boolean(next));
  for (const key of Object.keys(panels) as Array<keyof typeof panels>) {
    const [button, content] = panels[key];
    element(content).hidden = next !== key;
    element(button)?.setAttribute('aria-expanded', String(next === key || (key === 'residents' && next === 'life')));
  }
  if (next === 'residents') updateResidents();
  if (next === 'camera') syncCameraControls();
}
for (const key of Object.keys(panels) as Array<keyof typeof panels>) {
  click(panels[key][0], () => showPanel(panel === key ? undefined : key));
}
function setWorkspace(make: boolean) {
  if (making === make || (make && !composer)) return;
  making = make;
  showPanel();
  if (mode !== 'Observe') setMode('Observe');
  element('experience').classList.toggle('composing', make);
  element('observe-mode').setAttribute('aria-pressed', String(!make));
  element('compose-settings').setAttribute('aria-pressed', String(make));
  composer?.open(make);
}
click('observe-mode', () => {
  if (making) setWorkspace(false);
  else if (mode !== 'Observe' || panel) { showPanel(); setMode('Observe'); }
});
click('compose-settings', () => setWorkspace(true));

const value = (id: string) => Number(element<HTMLInputElement>(id).value) / 100;

function applyLand() {
  if (!graphics) return;
  try {
    composer?.setLand({
      seed: landSeed.value.trim() || defaultLand.seed, kind: landKind.value as TerrainKind,
      elevation: value('land-height'), roughness: value('land-rough'), openness: value('land-open'), density: value('land-density'),
    });
    setMode('Observe');
    notice('Landscape regenerated.');
  } catch (error) { notice(error instanceof Error ? error.message : 'Terrain could not be created.'); }
}
click('land-apply', applyLand);
click('land-new', () => { landSeed.value = freshSeed(); applyLand(); });

function selectCamera(selected: CameraMode) {
  if (selected === 'Soft Follow') {
    const resident = graphics?.residents.find(item => item.genome.seed === cameraResident.value);
    if (resident) select(resident, false);
  }
  setMode('Observe');
  graphics?.setCamera(selected);
  syncMotion();
  syncCameraControls();
}

function syncCameraControls() {
  const camera = graphics?.camera ?? 'Fixed';
  element('camera-tour').hidden = camera !== 'Observatory';
  element('zoom-in').parentElement!.hidden = camera === 'Atlas';
  cameraResident.closest('label')!.hidden = camera !== 'Soft Follow';
  element('camera-help').textContent = {
    Fixed: 'The frame stays fixed while the residents move.',
    Landscape: 'Drag to turn. Right-drag or use two fingers to pan.',
    'Soft Follow': 'The frame drifts only when a resident nears its edge.',
    Observatory: '',
    Atlas: 'Tap a resident to select it. The blue square marks your last view.',
  }[camera];
  element('camera-help').hidden = camera === 'Observatory';
}

function updateResidents() {
  browserAt = performance.now();
  const items = graphics?.residents ?? [];
  if (!items.some(item => item.genome.seed === browseSeed)) {
    browseSeed = items.find(item => item.genome.seed === current.genome.seed)?.genome.seed ?? items[0]?.genome.seed ?? '';
  }
  residents.update(items, browseSeed, id => graphics?.residentPose(id));
  if (!items.length) element('resident-list').textContent = 'There are no residents yet.';
  if (element<HTMLDetailsElement>('moment-details').open) {
    const named = (id: string) => items.find(item => item.genome.seed === id)?.name ?? id;
    const descriptions = (graphics?.recentMoments() ?? []).map(event =>
      named(event.actor) + ' · ' + event.kind + (event.peer ? ' · ' + named(event.peer) : ''));
    const list = element('moment-list');
    if (!descriptions.length) descriptions.push('No recent moments yet.');
    if (descriptions.join('\n') !== Array.from(list.children, item => item.textContent).join('\n')) {
      list.replaceChildren(...descriptions.map(description => {
        const li = document.createElement('li');
        li.textContent = description;
        return li;
      }));
    }
  }
  for (const id of ['resident-locate', 'resident-follow', 'resident-inspect', 'resident-audition']) {
    element<HTMLButtonElement>(id).disabled = !browseSeed;
  }
}

function targetResident(action: 'locate' | 'follow' | 'inspect' | 'audition') {
  const item = graphics?.residents.find(item => item.genome.seed === browseSeed);
  if (!item) return;
  select(item, false);
  if (action === 'audition') { auditionSelected(); return; }
  if (action === 'inspect') { setMode('Inspect'); showPanel('life'); return; }
  setMode('Observe');
  if (action === 'locate') graphics?.locate(browseSeed);
  else graphics?.setCamera('Soft Follow', browseSeed);
  syncMotion();
}

click('resident-atlas', () => { selectCamera(graphics?.camera === 'Atlas' ? 'Fixed' : 'Atlas'); updateResidents(); });
for (const action of ['locate', 'follow', 'inspect', 'audition'] as const) click('resident-' + action, () => targetResident(action));
cameraMode.addEventListener('change', () => selectCamera(cameraMode.value as CameraMode));
cameraResident.addEventListener('change', () => selectCamera('Soft Follow'));
click('zoom-in', () => graphics?.zoom(1.14));
click('zoom-out', () => graphics?.zoom(1 / 1.14));
click('camera-reset', () => { setMode('Observe'); graphics?.resetCamera(); syncMotion(); });
click('previous-view', () => { graphics?.nextStation(-1); syncMotion(); });
click('next-view', () => { graphics?.nextStation(1); syncMotion(); });
element<HTMLInputElement>('camera-auto').addEventListener('change', event => graphics?.setObservationAuto((event.currentTarget as HTMLInputElement).checked));
const still = element<HTMLInputElement>('camera-still');
still.checked = true;
media.addEventListener('change', () => { if (media.matches) { still.checked = true; graphics?.setStillCamera(true); } });
still.addEventListener('change', () => graphics?.setStillCamera(still.checked));
graphics?.setStillCamera(still.checked);

const photoInput = element<HTMLInputElement>('land-photo');
const imageMode = element<HTMLSelectElement>('image-mode');
imageMode.value = defaultImage.mode;
function applyImage(committed = false) {
  const settings: ImageSettings = {
    mode: imageMode.value as ImageSettings['mode'], scale: value('image-scale'), x: value('image-x'), y: value('image-y'),
    horizon: value('image-horizon'), blur: value('image-blur'), color: value('image-color'), ground: value('image-ground'),
  };
  graphics?.setImage(settings);
  if (committed) composer?.setImage(settings);
}
function syncWorldControls() {
  if (!composer) return;
  const { land, image } = composer.document;
  landKind.value = land.kind;
  landSeed.value = land.seed;
  imageMode.value = image.mode;
  const values = { 'land-height': land.elevation, 'land-rough': land.roughness, 'land-open': land.openness, 'land-density': land.density,
    'image-scale': image.scale, 'image-x': image.x, 'image-y': image.y, 'image-horizon': image.horizon, 'image-blur': image.blur,
    'image-color': image.color, 'image-ground': image.ground };
  for (const [id, value] of Object.entries(values)) element<HTMLInputElement>(id).value = String(Math.round(value * 100));
}
element('photo-controls').addEventListener('input', () => applyImage());
element('photo-controls').addEventListener('change', () => applyImage(true));
photoInput.addEventListener('change', () => {
  const file = photoInput.files?.[0];
  if (file && graphics) void graphics.setPhoto(file).then(loaded => {
    if (!loaded) return;
    composer?.setDraftPhoto(file);
    element('photo-controls').hidden = false;
    applyImage();
    setMode('Observe');
  }).catch(error => notice(error instanceof Error ? error.message : 'Photo could not be loaded.'));
  photoInput.value = '';
});
click('land-clear', () => {
  graphics?.clearPhoto();
  composer?.setDraftPhoto();
  element('photo-controls').hidden = true;
});
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
  const result = composer?.toggleResident(current);
  if (result === 'removed') notice(`${current.name} was removed from the garden.`);
  else if (result === 'added') {
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
  void sound.toggle().then(ok => {
    if (!ok && element('sound').textContent === 'Retry sound') notice('Audio could not start. Try Sound again or use Audio Reset.');
  });
});
function auditionSelected() {
  if (audition) sound.endAudition();
  else void sound.audition().then(ok => {
    if (!ok && element('sound').textContent === 'Retry sound') notice('Audition could not start. Use Audio Reset to try again.');
  });
}
click('audition', auditionSelected);
click('audio-audition', auditionSelected);
click('audio-reset', () => { sound.reset(); notice('Audio reset. Press Sound to start.'); });
const mix = element<HTMLSelectElement>('audio-mode');
mix.addEventListener('change', () => {
  sound.setMix(mix.value === 'Solo' ? 'Solo' : 'World');
  element('density-control').hidden = mix.value === 'Solo';
});
element('audio-density').addEventListener('input', () => sound.setDensity(value('audio-density')));
element('master-volume').addEventListener('input', () => {
  const level = value('master-volume');
  element('master-level').textContent = Math.round(level * 100) + '%';
  sound.setVolume(level);
});

let panelBeforeView: typeof panel;
function viewing(show: boolean) {
  showMore(false);
  if (show) { panelBeforeView = panel; showPanel(); graphics?.clearLocate(); }
  else showPanel(panelBeforeView);
  for (const name of ['identity', 'caption']) element(name).hidden = show;
  element('exit').hidden = !show;
  element(show ? 'exit' : 'view').focus();
  syncMotion();
}
click('view', () => viewing(true));
click('exit', () => viewing(false));
document.addEventListener('keydown', event => {
  if (event.defaultPrevented) return;
  if (event.key === 'Escape' && !element('exit').hidden) viewing(false);
  else if (event.key === 'Escape' && !secondaryNav.hidden) { showMore(false); menuButton.focus(); }
  else if (event.key === 'Escape' && panel) {
    const [button] = panels[panel];
    showPanel();
    element(button === 'open-life' ? 'life-settings' : button).focus();
  }
});

sound.setSpecimen(current);
syncWorldControls();
syncSelection();
pause(isPaused);
setMode('Observe');

if (composer) {
  void composer.recover().then(hasPhoto => {
    element('photo-controls').hidden = !hasPhoto;
    draftLoading = false;
    syncMembership();
    element<HTMLButtonElement>('compose-settings').disabled = false;
  });
}
