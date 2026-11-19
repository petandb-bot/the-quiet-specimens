import { aquariumPresets } from '../aquarium/motion';
import type { AquariumPreset } from '../aquarium/motion';
import { Archive } from '../archive/database';
import { deserialize, serialize } from '../archive/records';
import { ChamberSound } from '../audio/scheduler';
import type { MotionState } from '../behavior/swim';
import { actionLabels, defaultChoices, fishFormLabels, generatorVersion, generatorVersions, mutationModes } from '../core/model';
import type { Action, Choices, Generator, Mutation, Specimen } from '../core/model';
import { freshSeed } from '../core/random';
import { generate, mutate, specimen } from '../genesis/genome';
import { analyzeImage } from '../genesis/image';
import { featured, floorManager, references } from '../presets/reference';
import { LabView } from '../renderer/view';
import type { ViewMode } from '../renderer/view';
import { icon } from '../ui/icons';
import { discoverForm, escapeHtml, layout, mutationForm } from '../ui/layout';
import '../ui/style.css';

function get<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}
get('app').innerHTML = layout(featured);
const set = (id: string, text: string) => { get(id).textContent = text; };
const click = (id: string, fn: (event: MouseEvent) => void) => { get(id).addEventListener('click', fn); };
const archive = new Archive();
const owned = new Map<string, Specimen>();
const thumbnails = new Map<string, string>();
const writes = new Set<string>();
const dialog = get<HTMLDialogElement>('dialog');
const dialogContent = get('dialog-content');
const grid = get('archive-grid');
const saveButton = get<HTMLButtonElement>('save');
const photoInput = get<HTMLInputElement>('image-file');
const jsonInput = get<HTMLInputElement>('json-file');
let current = featured.find(item => item.genome.morphology.fishForm === 'halo') ?? references[0];
let mode: ViewMode = 'observe';
let oldMode: ViewMode = 'observe';
let filter: 'reference' | 'collection' | 'favorites' = 'reference';
let lastChoices = defaultChoices;
let stateSerial = -1;
let chamber: LabView | undefined;
let soundOn = false;
let auditioning = false;
let toastTimer = 0;
let result: { previous: Specimen; retry?: () => void } | undefined;
let photoJob = 0;
let photoWaiting = false;
let loadedArchive = false;
let aquariumActive = false;
let aquariumPaused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let aquariumPreset: AquariumPreset = 'mixed';

const audio = new ChamberSound((enabled, audition) => {
  if (enabled !== soundOn) {
    soundOn = enabled;
    const button = get('toggle-sound');
    button.setAttribute('aria-pressed', String(enabled));
    button.innerHTML = enabled ? `${icon('volume')} Sound on` : `${icon('mute')} Sound off`;
    document.querySelector('.sound-wave')?.classList.toggle('playing', enabled);
  }
  if (audition !== auditioning) {
    auditioning = audition;
    const button = get('audition');
    button.setAttribute('aria-pressed', String(audition));
    button.innerHTML = audition ? `${icon('stop')} Playing` : `${icon('play')} Audition`;
  }
});

function toast(message: string) {
  set('toast', message);
  get('toast').hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { get('toast').hidden = true; }, 4300);
}

function reportError(error: unknown, fallback: string) {
  toast(error instanceof Error ? error.message : fallback);
}

function graphicsError(message: string) {
  set('graphics-error', message);
  get('graphics-error').hidden = !message;
  const live = document.querySelector('.stage-live span');
  if (live) live.textContent = message ? 'GRAPHICS PAUSED' : aquariumActive ? (aquariumPaused ? 'MOTION PAUSED' : 'LIVE AQUARIUM') : 'LIVE OBSERVATION';
}

function swimState(state: MotionState) {
  if (stateSerial === state.serial) return;
  stateSerial = state.serial;
  set('swim-state', actionLabels[state.action]);
  audio.behavior(state.action, state.serial);
}

try { chamber = new LabView(get('canvas-host'), swimState, graphicsError); }
catch { graphicsError('A browser with WebGL 2 is required to see the live specimen.'); }

function setMode(next: ViewMode) {
  mode = next;
  chamber?.setMode(mode);
  document.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach(button => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  get('action-bar').hidden = mode !== 'action';
  get('zoom').hidden = mode !== 'inspect';
  set('mode-hint', { observe: 'Tap the specimen to interact', inspect: 'Drag to orbit · Scroll or pinch to zoom', action: 'Choose a behavior to play' }[mode]);
}

document.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach(button => {
  button.addEventListener('click', () => setMode(button.dataset.mode as ViewMode));
});
click('trigger-action', () => chamber?.trigger(get<HTMLSelectElement>('action-choice').value as Action));
click('zoom-in', () => chamber?.zoom(.84));
click('zoom-out', () => chamber?.zoom(1.19));
click('reset-view', () => chamber?.resetView());

function viewing(enabled: boolean) {
  if (document.body.classList.contains('viewing') === enabled) return;
  const page = get('stage');
  if (enabled) {
    oldMode = mode;
    setMode('observe');
    document.body.classList.add('viewing');
    get('exit-view').focus({ preventScroll: true });
  } else {
    document.body.classList.remove('viewing');
    setMode(oldMode);
    get('view-mode').focus({ preventScroll: true });
  }
  for (const selector of ['.site-header', '#aquarium', '#laboratory', '.record', '#form-strip', '#tank-strip', '#tank-residents', '.mode-bar', '.action-bar', '.result-bar', '.discovery', '.archive', '.site-footer']) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element && !element.contains(page)) element.inert = enabled;
  }
}
click('view-mode', () => viewing(true));
click('exit-view', () => viewing(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('viewing')) viewing(false);
});

function displayInfo() {
  const { genome, name, id } = current;
  set('specimen-name', name);
  set('record-id', id);
  set('stage-id', id);
  const { plan, fishForm } = genome.morphology;
  set('body-plan', fishForm ? plan + ' / ' + fishFormLabels[fishForm] : plan);
  get('form-strip').querySelectorAll<HTMLButtonElement>('[data-reference]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.reference === id));
  });
  set('material', genome.morphology.material + (genome.morphology.anomalous ? ' / MUTANT' : ''));
  set('generation', String(genome.generation).padStart(2, '0'));
  set('origin', genome.origin);
  set('seed', genome.seed);
  set('sound-name', genome.sound.engine);
  updateSaveButton();
}

function updateSaveButton() {
  const saved = owned.get(current.id)?.name === current.name;
  saveButton.classList.toggle('saved', saved);
  saveButton.disabled = writes.has(current.id);
  saveButton.setAttribute('aria-disabled', String(saved || saveButton.disabled));
  saveButton.innerHTML = saved ? `${icon('check')} Saved to collection` : `${icon('save')} Save specimen`;
}

function updateResult(message?: string) {
  get('result-bar').hidden = aquariumActive || !result;
  get('retry').hidden = !result?.retry;
  if (message) set('result-text', message);
}

function load(next: Specimen) {
  current = next;
  stateSerial = -1;
  audio.setSpecimen(next);
  chamber?.load(next);
  displayInfo();
}

function pick(next: Specimen, message: string, retry?: () => void) {
  result = { previous: result?.previous ?? current, retry };
  load(owned.get(next.id) ?? next);
  updateResult(message);
  toLab();
}

function showRecord(next: Specimen, scroll = true) {
  result = undefined;
  updateResult();
  if (next !== current) load(next);
  if (scroll) toLab();
}
click('form-strip', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-reference]');
  if (!button || button.dataset.reference === current.id) return;
  const next = featured.find(item => item.id === button.dataset.reference);
  if (next) showRecord(owned.get(next.id) ?? next, false);
});

function openDialog(title: string, body: string) {
  set('dialog-title', title);
  dialogContent.innerHTML = body;
  if (!dialog.open) dialog.showModal();
}
dialog.addEventListener('click', event => {
  if ((event.target as Element).closest('[data-close]')) dialog.close();
  else if (event.target === dialog) dialog.close();
});
dialog.addEventListener('close', () => {
  if (photoWaiting) {
    photoWaiting = false;
    photoJob++;
  }
});
click('revert', () => {
  if (!result) return;
  const previous = result.previous;
  result = undefined;
  load(owned.get(previous.id) ?? previous);
  updateResult();
});
click('retry', () => result?.retry?.());

function discover(choices: Choices, seed?: string, version: Generator = generatorVersion) {
  lastChoices = choices;
  pick(specimen(generate(seed || freshSeed(), 'Discover', choices, undefined, version)), 'A new specimen is ready to observe.', () => discover(choices, undefined, version));
}
click('new-specimen', () => discover(lastChoices));
click('discover', () => {
  const previous = current.genome.origin === 'Discover' ? current.genome.choices : undefined;
  const version = previous
    ? generatorVersions.find(item => item === current.genome.generatorVersion) ?? generatorVersion
    : generatorVersion;
  openDialog('Discover a specimen', discoverForm(previous ?? lastChoices, version));
  get('discover-form').addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const choices = [0, 1, 2].map(i => String(data.get('choice' + i))) as Choices;
    const seed = String(data.get('seed') ?? '').normalize().trim();
    dialog.close();
    const version = generatorVersions.find(item => item === data.get('generator')) ?? generatorVersion;
    discover(choices, seed, version);
  });
});

function variation(parent: Specimen, intensity: Mutation) {
  pick(specimen(mutate(parent, freshSeed(), intensity)), `${intensity} variation of ${parent.name}.`, () => variation(parent, intensity));
}
click('mutate', () => {
  const parent = current;
  openDialog('Mutate specimen', mutationForm());
  get('mutate-form').addEventListener('submit', event => {
    event.preventDefault();
    const intensity = new FormData(event.currentTarget as HTMLFormElement).get('mutation');
    if (!mutationModes.includes(intensity as Mutation)) return;
    dialog.close();
    variation(parent, intensity as Mutation);
  });
});

function openExtract() {
  openDialog('Extract from a photo', `<p>Color, light, and texture guide the shape and sound of a new specimen.</p>
    <button type="button" id="drop-photo" class="drop-photo">${icon('image')} <strong>Choose an image</strong><span>or drop it here · JPEG, PNG, WebP</span></button>
    <p class="field-note" id="extract-note">The image is analyzed on this device.</p>
    <div class="dialog-actions"><button type="button" class="button" data-close>Cancel</button></div>`);
  const area = get('drop-photo');
  area.addEventListener('click', () => photoInput.click());
  area.addEventListener('dragover', event => { event.preventDefault(); area.classList.add('over'); });
  area.addEventListener('dragleave', () => area.classList.remove('over'));
  area.addEventListener('drop', event => {
    event.preventDefault();
    area.classList.remove('over');
    const file = event.dataTransfer?.files[0];
    if (file) void extract(file);
  });
}
click('extract', openExtract);
photoInput.addEventListener('change', () => {
  const file = photoInput.files?.[0];
  photoInput.value = '';
  if (file) void extract(file);
});

async function extract(file: File) {
  const serial = ++photoJob;
  photoWaiting = true;
  set('extract-note', 'Reading the image…');
  try {
    const features = await analyzeImage(file);
    if (!dialog.open || photoJob !== serial) return;
    photoWaiting = false;
    dialog.close();
    pick(specimen(generate(features.seed, 'Extract', undefined, features)), 'A specimen emerged from your photo.');
  } catch (error) {
    if (dialog.open && photoJob === serial) {
      photoWaiting = false;
      set('extract-note', error instanceof Error ? error.message : 'This image could not be read.');
    }
  }
}

async function audition() {
  if (!await audio.audition()) toast('Sound is unavailable. Tap Sound on to try again.');
}
click('toggle-sound', async () => {
  if (soundOn) audio.stop();
  else if (!await audio.start()) toast('Sound could not start. Try again from an active browser tab.');
});
click('audition', () => {
  if (auditioning) audio.endAudition();
  else void audition();
});
get<HTMLInputElement>('volume').addEventListener('input', event => {
  const value = Number((event.target as HTMLInputElement).value);
  audio.setVolume(value / 100);
  set('volume-label', value + '%');
});

click('rename', () => {
  const id = current.id;
  openDialog('Name this specimen', `<form id="rename-form">
    <label class="name-field">Name<input name="name" maxlength="64" required value="${escapeHtml(current.name)}" autofocus></label>
    <div class="dialog-actions"><button type="button" class="button" data-close>Cancel</button><button type="submit" class="button primary">Apply name</button></div>
  </form>`);
  get('rename-form').addEventListener('submit', event => {
    event.preventDefault();
    const field = (event.currentTarget as HTMLFormElement).elements.namedItem('name') as HTMLInputElement;
    const name = field.value.trim();
    if (!name) { field.setCustomValidity('Enter a name.'); field.reportValidity(); return; }
    if (current.id === id) {
      current = { ...current, name };
      displayInfo();
    }
    dialog.close();
  });
  dialogContent.querySelector('input')?.addEventListener('input', event => (event.target as HTMLInputElement).setCustomValidity(''));
});

click('details', () => {
  openDialog('Specimen genome', '<pre class="genome-code" id="genome-code"></pre><div class="dialog-actions"><button type="button" class="button" data-close>Close</button></div>');
  set('genome-code', JSON.stringify({ id: current.id, discoveredAt: current.discoveredAt, ...current.genome }, null, 2));
});

async function storeRecord(next: Specimen) {
  if (writes.has(next.id)) return false;
  writes.add(next.id);
  updateSaveButton();
  try {
    await archive.save(next);
    owned.set(next.id, next);
    return true;
  } catch (error) {
    reportError(error, 'The browser could not save this specimen.');
    return false;
  } finally {
    writes.delete(next.id);
    updateSaveButton();
    renderArchive();
  }
}

function withThumbnail(item: Specimen): Specimen {
  if (item.user.thumbnail) return item;
  const thumbnail = thumbnails.get(item.id) ?? chamber?.thumbnail(item);
  return { ...item, user: { ...item.user, thumbnail } };
}

click('save', async () => {
  if (owned.get(current.id)?.name === current.name || writes.has(current.id)) return;
  const prior = owned.get(current.id);
  const item = withThumbnail({ ...current, user: prior ? { ...prior.user } : { ...current.user } });
  if (await storeRecord(item)) {
    if (current.id === item.id && current.name === item.name) {
      current = item;
      result = undefined;
      updateResult();
    }
    toast('Specimen saved to My collection.');
  }
});

click('import', () => jsonInput.click());
jsonInput.addEventListener('change', async () => {
  const file = jsonInput.files?.[0];
  jsonInput.value = '';
  if (!file) return;
  try {
    if (file.size > 1_200_000) throw new Error('The specimen file is too large.');
    const item = withThumbnail(deserialize(await file.text()));
    const existing = owned.get(item.id);
    if (!existing && await storeRecord(item)) {
      setArchiveFilter('collection');
      showRecord(item);
      toast('Specimen imported to My collection.');
    } else if (existing) {
      showRecord(existing);
      toast('This specimen is already in My collection.');
    }
  } catch (error) { reportError(error, 'The specimen file could not be read.'); }
});

click('export', () => {
  const url = URL.createObjectURL(new Blob([serialize(withThumbnail(current))], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = current.id + '.json';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function nav(section: 'archive' | 'lab' | 'aquarium') {
  for (const id of ['aquarium-nav', 'archive-nav', 'lab-nav']) {
    const selected = id === section + '-nav';
    const link = get(id);
    link.classList.toggle('is-active', selected);
    if (selected) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

const sceneDescriptions: Record<AquariumPreset, string> = {
  mixed: 'Two shoals pass the surface cruiser and the seahorse.',
  guppies: 'Fan-tailed guppies turn together through midwater.',
  goldfish: 'Small goldfish make a slower circuit above the floor.',
};

function renderAquariumControls() {
  get('tank-strip').querySelectorAll<HTMLButtonElement>('button[data-tank-preset]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.tankPreset === aquariumPreset));
  });
  set('tank-description', sceneDescriptions[aquariumPreset]);
  get('tank-residents').querySelectorAll<HTMLButtonElement>('button[data-resident]').forEach(button => {
    button.hidden = aquariumPreset !== 'mixed' && button.dataset.resident !== 'floor';
  });
  const pause = get('tank-pause');
  pause.setAttribute('aria-pressed', String(aquariumPaused));
  pause.innerHTML = aquariumPaused ? `${icon('play')} Resume motion` : `${icon('pause')} Pause motion`;
  chamber?.setAquariumPaused(aquariumPaused);
  if (get('graphics-error').hidden) document.querySelector('.stage-live span')!.textContent = aquariumPaused ? 'MOTION PAUSED' : 'LIVE AQUARIUM';
}

function showScreen(active: boolean) {
  if (active !== aquariumActive && active) {
    audio.stop();
    setMode('observe');
  }
  aquariumActive = active;
  document.body.dataset.screen = active ? 'aquarium' : 'laboratory';
  for (const id of ['laboratory', 'form-strip', 'stage-id', 'archive']) get(id).hidden = active;
  for (const selector of ['.record', '.mode-bar', '.discovery']) document.querySelector<HTMLElement>(selector)!.hidden = active;
  for (const id of ['aquarium', 'tank-strip', 'tank-stage-meta', 'tank-residents']) get(id).hidden = !active;
  get('observation').setAttribute('aria-label', active ? 'Aquarium viewing area' : 'Observation chamber');
  if (!get('graphics-error').hidden) {
    graphicsError(get('graphics-error').textContent ?? '');
  } else {
    document.querySelector('.stage-live span')!.textContent = active ? 'LIVE AQUARIUM' : 'LIVE OBSERVATION';
  }
  updateResult();
  chamber?.showAquarium(active);
  if (active) {
    chamber?.selectAquariumPreset(aquariumPreset);
    renderAquariumControls();
  }
}

function toLab() {
  if (location.hash !== '#laboratory') history.replaceState(null, '', '#laboratory');
  showScreen(false);
  nav('lab');
  get('laboratory').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

function hashNav() {
  if (location.hash === '#archive') {
    showScreen(false);
    nav('archive');
    requestAnimationFrame(() => get('archive').scrollIntoView({ block: 'start' }));
  } else if (location.hash === '#laboratory') {
    showScreen(false);
    nav('lab');
    requestAnimationFrame(() => get('laboratory').scrollIntoView({ block: 'start' }));
  } else {
    showScreen(true);
    nav('aquarium');
    if (location.hash === '#aquarium') requestAnimationFrame(() => get('aquarium').scrollIntoView({ block: 'start' }));
  }
}
click('tank-strip', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-tank-preset]');
  const next = aquariumPresets.find(item => item === button?.dataset.tankPreset);
  if (!next || next === aquariumPreset) return;
  aquariumPreset = next;
  chamber?.selectAquariumPreset(next);
  renderAquariumControls();
});
click('tank-pause', () => {
  aquariumPaused = !aquariumPaused;
  renderAquariumControls();
});
click('tank-residents', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-resident]');
  const subject = button?.dataset.resident;
  const next = subject === 'floor' ? floorManager : featured.find(item => item.genome.morphology.fishForm === subject);
  if (next) showRecord(owned.get(next.id) ?? next);
});
window.addEventListener('hashchange', hashNav);
hashNav();

function setArchiveFilter(next: typeof filter) {
  filter = next;
  document.querySelectorAll<HTMLButtonElement>('[data-archive]').forEach(button => {
    const selected = button.dataset.archive === filter;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  renderArchive();
}
document.querySelectorAll<HTMLButtonElement>('[data-archive]').forEach(button => {
  button.addEventListener('click', () => setArchiveFilter(button.dataset.archive as typeof filter));
});

function archiveCard(item: Specimen) {
  const label = escapeHtml(item.name);
  const thumb = item.user.thumbnail ?? thumbnails.get(item.id);
  const image = thumb;
  const favorite = owned.get(item.id)?.user.favorite ?? false;
  const saved = owned.has(item.id);
  return `<article class="archive-card" data-id="${item.id}">
    <button class="archive-image" type="button" data-card="observe" aria-label="Observe ${label}">${icon('chamber')}${image ? `<img src="${image}" loading="lazy" alt="">` : ''}</button>
    <div class="archive-card-body">
      <div class="archive-name-row"><h3>${label}</h3><button class="icon-button favorite" data-card="favorite" type="button" aria-label="Favorite ${label}" aria-pressed="${favorite}">${icon('star')}</button></div>
      <p class="archive-meta">${item.id}<br>${item.genome.origin} · Gen ${String(item.genome.generation).padStart(2, '0')}</p>
      <div class="archive-card-actions">
        <button type="button" class="button small" data-card="observe">Observe</button>
        <button type="button" class="button small" data-card="audition">${icon('play')} Audition</button>
        ${saved && filter !== 'reference' ? `<button type="button" class="icon-button" data-card="delete" title="Delete specimen" aria-label="Delete ${label}">${icon('trash')}</button>` : ''}
      </div>
    </div>
  </article>`;
}

const thumbnailObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting || !chamber) continue;
    const button = entry.target as HTMLButtonElement;
    thumbnailObserver.unobserve(button);
    setTimeout(() => {
      if (!button.isConnected || button.querySelector('img')) return;
      const id = button.closest<HTMLElement>('.archive-card')?.dataset.id;
      const item = owned.get(id ?? '') ?? references.find(ref => ref.id === id);
      if (!item) return;
      const imageUrl = thumbnails.get(item.id) ?? chamber?.thumbnail(item);
      if (!imageUrl) return;
      thumbnails.set(item.id, imageUrl);
      const image = new Image();
      image.alt = '';
      image.src = imageUrl;
      button.append(image);
    }, 45);
  }
}, { rootMargin: '100px' });

function renderArchive() {
  thumbnailObserver.disconnect();
  const collection = [...owned.values()].sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt));
  const favorites = collection.filter(item => item.user.favorite);
  set('reference-count', String(references.length));
  set('collection-count', String(collection.length));
  set('favorites-count', String(favorites.length));
  const list = filter === 'reference' ? references : filter === 'collection' ? collection : favorites;
  if (!list.length) {
    grid.innerHTML = `<div class="archive-empty">${!loadedArchive ? 'Opening the archive…' : filter === 'favorites' ? 'Star a specimen to find it here.' : 'Save or import a specimen to start your collection.'}</div>`;
    return;
  }
  grid.innerHTML = list.map(archiveCard).join('');
  grid.querySelectorAll('.archive-image').forEach(button => {
    if (!button.querySelector('img')) thumbnailObserver.observe(button);
  });
}

grid.addEventListener('click', async event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-card]');
  const id = button?.closest<HTMLElement>('.archive-card')?.dataset.id;
  if (!id || !button || writes.has(id)) return;
  const item = owned.get(id) ?? references.find(value => value.id === id);
  if (!item) return;
  if (button.dataset.card === 'observe') showRecord(item);
  if (button.dataset.card === 'audition') {
    showRecord(item);
    void audition();
  }
  if (button.dataset.card === 'favorite') {
    const favorite = !item.user.favorite;
    const next = withThumbnail({ ...item, user: { ...item.user, favorite } });
    if (await storeRecord(next)) {
      if (current.id === id) current = { ...current, user: { ...next.user } };
      toast(favorite ? 'Added to Favorites.' : 'Removed from Favorites.');
      grid.querySelector<HTMLButtonElement>(`[data-id="${id}"] .favorite`)?.focus({ preventScroll: true });
    }
  }
  if (button.dataset.card === 'delete') {
    openDialog('Delete specimen?', `<p>Remove <strong>${escapeHtml(item.name)}</strong> from My collection.</p><div class="dialog-actions"><button type="button" class="button" data-close>Cancel</button><button type="button" id="confirm-delete" class="button primary">Delete specimen</button></div>`);
    click('confirm-delete', async () => {
      if (writes.has(id)) return;
      writes.add(id);
      dialog.close();
      updateSaveButton();
      try {
        await archive.delete(id);
        owned.delete(id);
        if (current.id === id) current = { ...current, user: { ...current.user, favorite: false } };
        toast('Specimen deleted from My collection.');
      } catch (error) { reportError(error, 'The specimen could not be deleted.'); }
      finally { writes.delete(id); updateSaveButton(); renderArchive(); }
    });
  }
});

load(current);
renderArchive();
void archive.load().then(({ items, skipped }) => {
  items.forEach((item, id) => { if (!owned.has(id) && !writes.has(id)) owned.set(id, item); });
  if (skipped) toast(`${skipped} invalid archive record${skipped === 1 ? ' was' : 's were'} skipped.`);
}).catch(() => toast('Browser storage is unavailable. You can still export specimens as JSON.'))
  .finally(() => { loadedArchive = true; updateSaveButton(); renderArchive(); });
