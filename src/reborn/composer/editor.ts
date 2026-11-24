import { clamp } from '../../core/random';
import { gardenReferences } from '../genome';
import type { GardenSpecimen } from '../genome';
import type { GroundPoint } from '../motion';
import type { ImageSettings } from '../photo';
import type { LandSettings } from '../terrain';
import { worldBounds } from '../terrain';
import type { GardenView } from '../view';
import { changeLand, createWorld, objectLimit, objectTitle,
  placeCenter, placeLimit, placeRoles, removeObject, transformObject } from '../world/document';
import type { ObjectKind, Place, PlaceRole, WorldDocument, WorldObject, WorldResident } from '../world/document';
import { WorldHistory } from '../world/history';
import type { Marker } from './scene';
import { WorkingDraftChanged, WorkingDraftStore } from '../world/recovery';
import type { MakeView } from './camera';
import { MakeInput } from './input';
import type { Cursor } from './input';
import { editorMarkup } from './markup';
import { brushSeed, makeBrush, onLand, stampObject } from './palette';
import { primaryColor, rollAppearance } from '../objects/appearance';

type Tab = 'objects' | 'places' | 'residents';
type Tool = 'select' | 'move' | 'place' | 'camera';
type ResidentTool = 'place' | 'relocate' | 'home' | 'preferred';
type Drag = { point: GroundPoint; object?: WorldObject; place?: Place };

const zoneColors: Record<PlaceRole, string> = {
  Neutral: '#5f645e', Shelter: '#315f83', Curiosity: '#b13e24', Gathering: '#755293', Quiet: '#156755',
};

export class WorldComposer {
  readonly history: WorldHistory;
  private active = false;
  private tab: Tab = 'objects';
  private view: MakeView = 'Perspective';
  private tool: Tool = 'select';
  private readonly input: MakeInput;
  private thumbnailsReady = false;
  private quickStartSeen = false;
  private kind: ObjectKind = 'arch';
  private brushes = new Map<ObjectKind, WorldObject>();
  private store?: WorkingDraftStore;
  private photo?: Blob;
  private writes = Promise.resolve();
  private revision = 0;
  private object?: string;
  private place?: string;
  private resident?: string;
  private draft?: WorldObject;
  private pendingPlace?: PlaceRole;
  private residentTool?: ResidentTool;
  private drag?: Drag;
  private ghost?: WorldObject;
  private cursor?: Cursor;

  constructor(
    private panel: HTMLElement,
    private garden: GardenView,
    private current: () => GardenSpecimen,
    private onChange: () => void,
    private onInspect: (item: GardenSpecimen, follow: boolean) => void,
  ) {
    const residents = [0, 3, 6, 1, 7].map(index => ({ specimen: gardenReferences[index] }));
    this.history = new WorldHistory(createWorld(garden.terrain, residents));
    this.garden.applyWorld(this.document);
    this.panel.innerHTML = editorMarkup;
    this.input = new MakeInput(garden.canvas, {
      active: () => this.active, camera: () => this.tool === 'camera',
      begin: point => this.startEdit(point), hover: point => this.hover(point),
      drag: point => this.dragEdit(point), end: (point, moved) => this.endEdit(point, moved),
      cancel: () => this.cancelEdit(), navigate: (action, x, y) => garden.navigateMake(action, x, y),
    });
    for (const name of ['compose-new-role', 'compose-zone-role']) this.options(name, placeRoles.map(role => [role, role]));
    this.optionsValue('compose-new-role', 'Curiosity');
    this.wire();
    this.sync();
  }

  get document() { return this.history.value; }
  get editing() { return this.active; }

  open(active: boolean) {
    if (active === this.active) return;
    if (!active) this.input.reset();
    this.active = active;
    this.panel.hidden = !active;
    this.garden.setArrange(active ? this.view : undefined);
    if (active && !this.thumbnailsReady) this.showThumbnails();
    if (active && !this.quickStartSeen) this.showHelp(true);
    if (active && !this.resident) this.resident = this.current().genome.seed;
    if (!active) this.stopPlacement();
    this.sync();
  }

  async recover() {
    try {
      this.store = new WorkingDraftStore();
      const draft = await this.store.load();
      if (draft) {
        this.history.restore(draft.world);
        this.refresh(false);
        if (draft.photo) {
          this.photo = draft.photo;
          try {
            if (!await this.garden.setPhoto(draft.photo)) throw new Error('Photo was not restored');
          } catch {
            this.recoveryStatus('Draft restored · photo unavailable');
            return false;
          }
        }
        this.recoveryStatus('Local draft restored');
      } else this.recoveryStatus('Autosave on this browser');
    } catch {
      this.store = undefined;
      this.recoveryStatus('Local draft unavailable');
    }
    return Boolean(this.photo);
  }

  setDraftPhoto(photo?: Blob) {
    this.photo = photo;
    this.save();
  }

  private recoveryStatus(message: string) { this.node('compose-recovery').textContent = message; }

  private save() {
    const store = this.store;
    if (!store) return;
    const sequence = ++this.revision;
    const snapshot = { version: 1 as const, world: this.document, photo: this.photo };
    this.recoveryStatus('Saving draft…');
    this.writes = this.writes.then(() => store.save(snapshot)).then(
      () => { if (sequence === this.revision) this.recoveryStatus('Saved on this browser'); },
      error => {
        if (sequence === this.revision) this.recoveryStatus(error instanceof WorkingDraftChanged
          ? 'Draft changed in another tab' : 'Draft could not be saved');
      },
    );
  }

  private showThumbnails() {
    this.thumbnailsReady = true;
    for (const entry of this.panel.querySelectorAll<HTMLButtonElement>('[data-kind]')) {
      const kind = entry.dataset.kind as ObjectKind;
      this.paintThumbnail(entry, this.getBrush(kind));
    }
    try { this.quickStartSeen = localStorage.getItem('quiet-specimens-make-help') === 'seen'; } catch { /* Help is optional. */ }
  }

  private paintThumbnail(entry: HTMLButtonElement, object: WorldObject) {
    const url = this.garden.objectThumbnail(object);
    if (!url) { entry.classList.add('shape-fallback'); return; }
    const image = new Image();
    image.alt = '';
    image.src = url;
    entry.classList.remove('shape-fallback');
    entry.querySelector('.shape-preview')?.replaceChildren(image);
  }

  private getBrush(kind: ObjectKind) {
    return this.brushes.get(kind) ?? makeBrush(kind);
  }

  private changeBrush(delta: Parameters<typeof transformObject>[1], redraw = false) {
    if (!this.draft) return;
    this.draft = transformObject(this.draft, delta);
    this.brushes.set(this.kind, this.draft);
    if (this.cursor) this.hover(this.cursor);
    if (redraw) {
      const entry = this.panel.querySelector<HTMLButtonElement>('[data-kind="' + this.kind + '"]');
      if (entry) this.paintThumbnail(entry, this.draft);
    }
    this.sync();
  }

  private showHelp(open: boolean) {
    this.node('compose-help-panel').hidden = !open;
    this.node('compose-help').setAttribute('aria-expanded', String(open));
    if (!open) {
      this.quickStartSeen = true;
      try { localStorage.setItem('quiet-specimens-make-help', 'seen'); } catch { /* Help is optional. */ }
    }
  }

  setLand(land: LandSettings) { this.commit(changeLand(this.document, land)); }
  setImage(image: ImageSettings) {
    if (Object.keys(image).some(key => image[key as keyof ImageSettings] !== this.document.image[key as keyof ImageSettings])) {
      this.commit({ ...this.document, image });
    }
  }

  toggleResident(specimen: GardenSpecimen) {
    const list = this.document.residents;
    if (list.some(item => item.specimen.genome.seed === specimen.genome.seed)) {
      this.commit({ ...this.document, residents: list.filter(item => item.specimen.genome.seed !== specimen.genome.seed) });
      return 'removed';
    }
    if (!this.garden.canJoin(specimen)) return undefined;
    this.commit({ ...this.document, residents: [...list, { specimen }] });
    return this.garden.has(specimen.genome.seed) ? 'added' : undefined;
  }

  private node<T extends HTMLElement = HTMLElement>(id: string) { return this.panel.querySelector<T>('#' + id)!; }
  private field(id: string) { return this.node<HTMLInputElement>(id); }
  private select(id: string) { return this.node<HTMLSelectElement>(id); }
  private options(id: string, items: Array<[string, string]>, value?: string) {
    this.select(id).replaceChildren(...items.map(([id, name]) => new Option(name, id)));
    if (value !== undefined) this.optionsValue(id, value);
  }
  private optionsValue(id: string, value: string) { this.select(id).value = value; }
  private click(id: string, callback: () => void) { this.node(id).addEventListener('click', callback); }
  private change(id: string, callback: () => void) { this.node(id).addEventListener('change', callback); }
  private message(message: string) { this.node('compose-message').textContent = message; }
  private get lastPlaced() { return [...this.document.objects].reverse().find(item => item.layoutIndex === undefined); }
  private get objectItem() { return this.document.objects.find(item => item.id === this.object); }
  private get zone() { return this.document.places.find(item => item.id === this.place); }
  private get chosenResident() { return this.document.residents.find(item => item.specimen.genome.seed === this.resident); }
  private get specimen() {
    return this.chosenResident?.specimen ?? gardenReferences.find(item => item.genome.seed === this.resident) ?? this.current();
  }

  private commit(document: WorldDocument) {
    if (!this.history.commit(document)) { this.message('This edit could not be applied.'); return false; }
    this.refresh();
    return true;
  }
  private refresh(persist = true) {
    this.garden.applyWorld(this.document);
    this.garden.arrangeDrag();
    this.onChange();
    this.sync();
    if (persist) this.save();
  }

  private moveHistory(back: boolean) {
    this.input.reset();
    this.pendingPlace = this.residentTool = undefined;
    if (back ? this.history.undo() : this.history.redo()) this.refresh();
    else this.sync();
    this.message(back ? 'Undo' : 'Redo');
  }

  private updateObject(delta: Parameters<typeof transformObject>[1]) {
    const item = this.objectItem;
    if (!item) return;
    const next = transformObject(item, delta);
    if (Object.keys(delta).every(key => item[key as keyof WorldObject] === next[key as keyof WorldObject])) return;
    this.commit({ ...this.document, objects: this.document.objects.map(object => object === item ? next : object) });
  }

  private updatePlace(delta: Partial<Place>) {
    const item = this.zone;
    if (item) this.commit({ ...this.document, places: this.document.places.map(place => place === item ? { ...place, ...delta } : place) });
  }

  private stopPlacement() {
    this.pendingPlace = this.residentTool = undefined;
    this.cancelEdit();
  }

  private setTool(tool: Tool) {
    this.input.reset();
    this.stopPlacement();
    if (tool === 'place') this.tab = 'objects';
    this.tool = tool;
    if (tool === 'place') this.draft = this.getBrush(this.kind);
    this.sync();
  }

  private wire() {
    this.click('compose-help', () => this.showHelp(this.node('compose-help-panel').hidden));
    this.click('compose-help-close', () => { this.showHelp(false); this.node('compose-help').focus(); });
    this.click('compose-reset', () => { this.cancelEdit(); this.garden.resetMakeCamera(); });
    this.change('compose-view', () => {
      this.input.reset();
      this.view = this.select('compose-view').value as MakeView;
      this.garden.setArrange(this.view);
      this.sync();
    });
    for (const control of this.panel.querySelectorAll<HTMLButtonElement>('[data-compose-tab]')) {
      control.addEventListener('click', () => {
        this.tab = control.dataset.composeTab as Tab;
        this.setTool(this.tab === 'objects' && this.tool === 'place' ? 'place' : 'select');
      });
    }
    for (const control of this.panel.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
      control.addEventListener('click', () => this.setTool(control.dataset.tool as Tool));
    }
    for (const control of this.panel.querySelectorAll<HTMLButtonElement>('[data-kind]')) {
      control.addEventListener('click', () => { this.kind = control.dataset.kind as ObjectKind; this.setTool('place'); });
    }
    for (const control of this.panel.querySelectorAll<HTMLButtonElement>('[data-finish]')) {
      control.addEventListener('click', () => this.updateObject({ finish: control.dataset.finish as WorldObject['finish'] }));
    }
    this.click('compose-undo', () => this.moveHistory(true));
    this.click('compose-redo', () => this.moveHistory(false));
    for (const button of this.panel.querySelectorAll<HTMLButtonElement>('[data-brush-size]')) {
      button.addEventListener('click', () => this.changeBrush({ scale: Number(button.dataset.brushSize) }));
    }
    for (const button of this.panel.querySelectorAll<HTMLButtonElement>('[data-object-size]')) {
      button.addEventListener('click', () => this.updateObject({ scale: Number(button.dataset.objectSize) }));
    }
    this.change('compose-brush-finish', () => {
      this.changeBrush({ finish: this.select('compose-brush-finish').value as WorldObject['finish'] }, true);
    });
    this.click('compose-randomize', () => { if (this.draft) this.changeBrush(rollAppearance(this.draft), true); });
    this.click('compose-object-randomize', () => { if (this.objectItem) this.updateObject(rollAppearance(this.objectItem)); });
    this.change('compose-seed', () => {
      this.changeBrush({ seed: this.field('compose-seed').value.trim() || brushSeed(this.kind), finish: 'Original' }, true);
    });
    this.click('compose-edit-last', () => {
      const item = this.lastPlaced;
      if (!item) return;
      this.object = item.id;
      this.setTool('select');
      this.field('compose-size').focus();
    });
    this.change('compose-object-seed', () => {
      const seed = this.field('compose-object-seed').value.trim();
      if (seed) this.updateObject({ seed });
      else this.sync();
    });
    this.click('compose-deselect', () => { this.object = undefined; this.sync(); });
    this.click('compose-object-move', () => this.setTool('move'));
    const transform = {
      'compose-angle': (n: number) => ({ yaw: n * Math.PI / 180 }),
      'compose-size': (n: number) => ({ scale: n }),
      'compose-height': (n: number) => ({ height: n }),
    };
    for (const [id, copy] of Object.entries(transform)) {
      this.node(id).addEventListener('input', () => {
        const item = this.objectItem;
        if (!item) return;
        const value = this.field(id).valueAsNumber;
        const preview = transformObject(item, copy(value));
        this.garden.arrangeDrag(preview);
        this.markers(preview);
        if (id === 'compose-size') this.syncSizeButtons('object', value);
        this.numberLabel(id, value);
      });
      this.change(id, () => this.updateObject(copy(this.field(id).valueAsNumber)));
    }
    this.change('compose-object-x', () => this.updateObject({ x: this.field('compose-object-x').valueAsNumber }));
    this.change('compose-object-z', () => this.updateObject({ z: this.field('compose-object-z').valueAsNumber }));
    this.click('compose-copy', () => {
      const item = this.objectItem;
      if (!item || this.document.objects.length >= objectLimit) return;
      const copy = transformObject({ ...item, id: crypto.randomUUID(), layoutIndex: undefined, distant: false }, {
        x: clamp(item.x + item.radius + 1.25, -worldBounds.x, worldBounds.x), z: clamp(item.z + 1.8, -worldBounds.z, worldBounds.z),
      });
      this.object = copy.id;
      this.commit({ ...this.document, objects: [...this.document.objects, copy] });
    });
    this.click('compose-delete', () => { const item = this.objectItem; if (item) this.commit(removeObject(this.document, item)); });
    this.click('compose-zone-add', () => {
      this.setTool('select');
      this.pendingPlace = this.select('compose-new-role').value as PlaceRole;
      this.sync();
      this.message('Click the ground for a region, or an object to link it.');
    });
    this.change('compose-zones', () => { this.place = this.select('compose-zones').value; this.sync(); });
    this.change('compose-zone-name', () => this.updatePlace({ name: this.field('compose-zone-name').value.trim() || this.zone!.role }));
    this.change('compose-zone-role', () => this.updatePlace({ role: this.select('compose-zone-role').value as PlaceRole }));
    this.change('compose-zone-link', () => {
      const point = this.zone && placeCenter(this.zone, this.document.objects);
      if (point) this.updatePlace({ linkedObjectId: this.select('compose-zone-link').value || undefined, x: point[0], z: point[1] });
    });
    for (const id of ['compose-radius', 'compose-influence']) {
      this.node(id).addEventListener('input', () => this.numberLabel(id, this.field(id).valueAsNumber));
      this.change(id, () => this.updatePlace({ [id === 'compose-radius' ? 'radius' : 'influence']: this.field(id).valueAsNumber }));
    }
    this.change('compose-zone-enable', () => this.updatePlace({ enabled: this.field('compose-zone-enable').checked }));
    this.click('compose-zone-delete', () => this.commit({ ...this.document, places: this.document.places.filter(place => place.id !== this.place) }));
    this.change('compose-life', () => { this.resident = this.select('compose-life').value; this.residentTool = undefined; this.sync(); });
    for (const button of this.panel.querySelectorAll<HTMLButtonElement>('[data-life-tool]')) {
      button.addEventListener('click', () => {
        this.setTool('select');
        this.residentTool = button.dataset.lifeTool as ResidentTool;
        this.sync();
        this.message('Click or tap a free point on the ground.');
      });
    }
    this.click('compose-life-inspect', () => this.onInspect(this.specimen, false));
    this.click('compose-life-follow', () => this.onInspect(this.specimen, true));
    this.click('compose-life-remove', () => this.toggleResident(this.specimen));
    document.addEventListener('keydown', event => {
      if (event.defaultPrevented || !this.active || (event.target instanceof Element && event.target.closest('input,select,textarea,[contenteditable=true]'))) return;
      if (event.key === 'Escape') {
        if (!this.node('compose-help-panel').hidden) this.showHelp(false);
        else if (this.tool !== 'select' || this.pendingPlace || this.residentTool) this.setTool('select');
        else return;
        event.preventDefault();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        this.moveHistory(!event.shiftKey);
      }
    });
  }

  private startEdit(point: Cursor) {
    this.cursor = point;
    if (this.tool === 'place') { this.hover(point); return; }
    if (this.pendingPlace || this.residentTool) return;
    if (this.tool !== 'move' || this.tab === 'residents') return;
    const { ground, object } = this.garden.arrangeHit(point.x, point.y, true);
    if (this.tab === 'objects') {
      this.object = object;
      const item = this.objectItem;
      if (item && ground) this.drag = { point: ground, object: item };
      this.sync();
    } else if (ground) {
      const place = this.placeAt(ground, object);
      this.place = place?.id;
      if (place && !place.linkedObjectId) this.drag = { point: ground, place };
      this.sync();
    }
  }

  private placeAt(point: GroundPoint, object?: string) {
    return [...this.document.places].reverse().find(item => {
      if (item.linkedObjectId && item.linkedObjectId === object) return true;
      const center = placeCenter(item, this.document.objects);
      return Math.hypot(center[0] - point[0], center[1] - point[1]) < item.radius;
    });
  }

  private hover(point: Cursor) {
    this.cursor = point;
    if (this.tool !== 'place' || !this.draft) return;
    const { ground } = this.garden.arrangeHit(point.x, point.y, false);
    this.ghost = ground && onLand(ground) && this.document.objects.length < objectLimit
      ? transformObject(this.draft, { x: ground[0], z: ground[1] }) : undefined;
    this.garden.arrangeDraft(this.ghost);
    this.markers();
  }

  private dragEdit(point: Cursor) {
    if (this.tool === 'place') this.hover(point);
    else if (this.drag) {
      const { ground } = this.garden.arrangeHit(point.x, point.y, false);
      if (ground) this.previewDrag(this.drag, ground);
    }
  }

  private endEdit(point: Cursor, moved: boolean) {
    const drag = this.drag;
    this.cancelEdit();
    if (moved && !drag) return;
    const hit = this.garden.arrangeHit(point.x, point.y, Boolean(this.pendingPlace) || !moved && this.tool === 'select');
    const ground = hit.ground;
    if (!moved && (this.tool === 'place' || this.pendingPlace || this.residentTool)) {
      if (ground && onLand(ground)) this.finishPlacement(ground, hit.object);
      else this.message('Choose a point inside the activity area.');
    } else if (drag && moved && ground) {
      const delta = this.dragDelta(drag, ground);
      if (drag.object) this.updateObject(delta);
      else this.updatePlace({ x: clamp(delta.x, -worldBounds.x, worldBounds.x), z: clamp(delta.z, -worldBounds.z, worldBounds.z) });
    } else if (!moved && this.tool === 'select') {
      if (this.tab === 'objects') this.object = hit.object;
      else if (this.tab === 'places') this.place = ground ? this.placeAt(ground, hit.object)?.id : undefined;
      this.sync();
    }
  }

  private cancelEdit() {
    const hadDraft = Boolean(this.ghost), hadDrag = Boolean(this.drag);
    this.drag = this.ghost = this.cursor = undefined;
    if (hadDraft) this.garden.hideArrangeDraft();
    if (hadDrag) this.garden.arrangeDrag();
    if (hadDraft || hadDrag) this.markers();
  }

  private dragDelta(drag: Drag, point: GroundPoint) {
    const origin = (drag.object ?? drag.place)!;
    return { x: origin.x + point[0] - drag.point[0], z: origin.z + point[1] - drag.point[1] };
  }
  private previewDrag(drag: Drag, point: GroundPoint) {
    const delta = this.dragDelta(drag, point);
    if (drag.object) {
      const item = transformObject(drag.object, delta);
      this.garden.arrangeDrag(item);
      this.markers(item);
    } else if (drag.place) this.markers(undefined, { ...drag.place, x: clamp(delta.x, -30, 30), z: clamp(delta.z, -30, 30) });
  }

  private finishPlacement(point: GroundPoint, object?: string) {
    if (this.tool === 'place' && this.draft) {
      const item = stampObject(this.document, this.draft, point);
      if (!item) { this.message('The object limit has been reached.'); return; }
      this.object = item.id;
      if (this.commit({ ...this.document, objects: [...this.document.objects, item] })) {
        this.message(objectTitle(item.kind) + ' placed. Tap or click again to keep going.');
      }
    } else if (this.pendingPlace) {
      const place: Place = { id: crypto.randomUUID(), name: this.pendingPlace, role: this.pendingPlace,
        x: point[0], z: point[1], radius: 5.5, influence: .8, enabled: true, linkedObjectId: object };
      this.place = place.id;
      this.pendingPlace = undefined;
      if (this.commit({ ...this.document, places: [...this.document.places, place] })) this.message(place.role + ' place added.');
    } else if (this.residentTool) {
      const specimen = this.specimen;
      const safe = this.garden.canPlace(point, specimen);
      if (!safe) { this.message('There is no safe spot nearby. Choose another point.'); return; }
      const old = this.chosenResident;
      let resident: WorldResident;
      switch (this.residentTool) {
        case 'place': resident = { specimen, start: safe, home: safe }; break;
        case 'relocate': resident = { ...old, specimen, start: safe }; break;
        case 'home': resident = { ...old, specimen, home: safe }; break;
        case 'preferred': resident = { ...old, specimen, preferred: safe }; break;
      }
      this.resident = specimen.genome.seed;
      this.residentTool = undefined;
      if (this.commit({ ...this.document, residents: old ? this.document.residents.map(item => item === old ? resident : item)
        : [...this.document.residents, resident] })) {
        this.message(Math.hypot(safe[0] - point[0], safe[1] - point[1]) > .4 ? 'Used a nearby safe spot.' : 'Resident placement updated.');
      }
    }
  }

  private numberLabel(id: string, value: number) {
    this.node(id + '-value').textContent = id === 'compose-angle' ? Math.round(value) + '°'
      : id === 'compose-size' ? Math.round(value * 100) + '%' : value.toFixed(2);
  }

  private syncSizeButtons(scope: 'brush' | 'object', size: number) {
    const key = scope === 'brush' ? 'brushSize' : 'objectSize';
    for (const button of this.panel.querySelectorAll<HTMLButtonElement>('[data-' + scope + '-size]')) {
      button.setAttribute('aria-pressed', String(Math.abs(Number(button.dataset[key]) - size) < .001));
    }
  }

  private sync() {
    const { objects, places, residents } = this.document;
    this.garden.canvas.dataset.makeTool = this.active ? this.tool : '';
    this.node<HTMLButtonElement>('compose-undo').disabled = !this.history.canUndo;
    this.node<HTMLButtonElement>('compose-redo').disabled = !this.history.canRedo;
    for (const button of this.panel.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
      button.setAttribute('aria-pressed', String(button.dataset.tool === this.tool));
    }
    for (const button of this.panel.querySelectorAll<HTMLButtonElement>('[data-kind]')) {
      button.setAttribute('aria-pressed', String(this.tool === 'place' && button.dataset.kind === this.kind));
    }
    for (const tab of this.panel.querySelectorAll<HTMLButtonElement>('[data-compose-tab]')) tab.setAttribute('aria-pressed', String(tab.dataset.composeTab === this.tab));
    for (const panel of this.panel.querySelectorAll<HTMLElement>('[data-compose-panel]')) panel.hidden = panel.dataset.composePanel !== this.tab;
    this.node('compose-brush').hidden = this.tool !== 'place';
    this.node('compose-object-count').hidden = this.tab !== 'objects';
    this.node<HTMLButtonElement>('compose-copy').disabled = objects.length >= objectLimit;
    this.node<HTMLButtonElement>('compose-zone-add').disabled = places.length >= placeLimit;
    this.node('compose-object-count').textContent = objects.length + ' / ' + objectLimit;
    this.node('compose-place-count').textContent = places.length + ' / ' + placeLimit;
    const object = this.objectItem, zone = this.zone;
    const label = (item: WorldObject, index: number): [string, string] => [item.id, objectTitle(item.kind) + ' ' + (index + 1)];
    this.options('compose-zones', [['', 'Choose or click a place'], ...places.map(place => [place.id, place.name] as [string, string])], zone?.id ?? '');
    this.node('compose-edit-last').hidden = !this.lastPlaced;
    if (this.draft && this.tool === 'place') {
      this.field('compose-seed').value = this.draft.seed;
      this.optionsValue('compose-brush-finish', this.draft.finish);
      this.node('compose-brush-color').style.backgroundColor = primaryColor(this.draft);
      this.syncSizeButtons('brush', this.draft.scale);
    }
    const showObject = Boolean(object && this.tab === 'objects' && (this.tool === 'select' || this.tool === 'move'));
    this.node('compose-object-edit').hidden = !showObject;
    if (object && showObject) {
      this.node('compose-object-name').textContent = objectTitle(object.kind);
      this.field('compose-object-seed').value = object.seed;
      this.syncSizeButtons('object', object.scale);
      this.panel.querySelector<HTMLButtonElement>('[data-finish="Original"]')?.style.setProperty('--swatch',
        primaryColor({ ...object, finish: 'Original' }));
      for (const button of this.panel.querySelectorAll<HTMLButtonElement>('[data-finish]')) {
        button.setAttribute('aria-pressed', String(button.dataset.finish === object.finish));
      }
      const values = { 'compose-angle': object.yaw * 180 / Math.PI, 'compose-size': object.scale, 'compose-height': object.height };
      for (const [id, value] of Object.entries(values)) { this.field(id).value = String(value); this.numberLabel(id, value); }
      this.field('compose-object-x').value = object.x.toFixed(2);
      this.field('compose-object-z').value = object.z.toFixed(2);
    }
    this.node('compose-place-edit').hidden = !zone;
    if (zone) {
      this.field('compose-zone-name').value = zone.name;
      this.optionsValue('compose-zone-role', zone.role);
      this.options('compose-zone-link', [['', 'Independent region'], ...objects.map(label)], zone.linkedObjectId ?? '');
      this.field('compose-radius').value = String(zone.radius); this.numberLabel('compose-radius', zone.radius);
      this.field('compose-influence').value = String(zone.influence); this.numberLabel('compose-influence', zone.influence);
      this.field('compose-zone-enable').checked = zone.enabled;
    }
    const specimen = this.specimen;
    const candidates = new Map([...gardenReferences, this.current(), ...residents.map(resident => resident.specimen)]
      .map(item => [item.genome.seed, item]));
    this.options('compose-life', [...candidates.values()].map(item => [item.genome.seed, item.name]), specimen.genome.seed);
    for (const button of this.panel.querySelectorAll<HTMLButtonElement>('[data-life-tool]')) {
      button.disabled = button.dataset.lifeTool === 'place' ? Boolean(this.chosenResident) || !this.garden.canPlaceResidents : !this.chosenResident;
    }
    this.node<HTMLButtonElement>('compose-life-follow').disabled = !this.chosenResident;
    this.node<HTMLButtonElement>('compose-life-remove').disabled = !this.chosenResident;
    this.markers();
    if (!this.active || this.pendingPlace || this.residentTool) return;
    this.message(this.tool === 'camera' ? 'Drag to look around. Scroll or pinch to zoom.'
      : this.tool === 'place' ? (objects.length >= objectLimit ? 'Object limit reached. Delete or undo to make room.' : 'Click or tap the ground to place ' + objectTitle(this.kind) + '.')
      : this.tab === 'places' ? 'Create a region, link a shape, or use Move to adjust a region.'
      : this.tab === 'residents' ? 'Place a resident or mark its home and preferred area.'
      : this.tool === 'move' ? 'Drag a shape to move it.' : 'Pick a shape to place, or tap a placed object to edit its size and finish.');
  }

  private markers(moving?: WorldObject, movedPlace?: Place) {
    if (!this.active) return;
    const markers: Marker[] = [];
    const active = this.tool === 'place' ? this.ghost : this.tool === 'camera' ? undefined : moving ?? this.objectItem;
    if (active && this.tab === 'objects') markers.push({ center: [active.x, active.z], radius: active.radius + .23, color: '#a73823', selected: true });
    if (this.tab === 'places') for (const saved of this.document.places) {
      const place = movedPlace?.id === saved.id ? movedPlace : saved;
      markers.push({ center: placeCenter(place, this.document.objects), radius: place.radius,
        color: place.enabled ? zoneColors[place.role] : '#797873', selected: place.id === this.place });
    }
    if (this.tab === 'residents') {
      const resident = this.chosenResident;
      if (resident?.home) markers.push({ center: resident.home, radius: 1.4, color: '#315f83', selected: true });
      if (resident?.preferred) markers.push({ center: resident.preferred, radius: 2.15, color: '#a73823' });
    }
    this.garden.arrangeMarkers(markers);
  }
}
