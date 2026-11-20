import { clamp, freshSeed } from '../../core/random';
import { gardenReferences } from '../genome';
import type { GardenSpecimen } from '../genome';
import type { GroundPoint } from '../motion';
import type { ImageSettings } from '../photo';
import type { LandSettings } from '../terrain';
import { worldBounds } from '../terrain';
import type { GardenView } from '../view';
import { changeLand, createWorld, finishes, newObject, objectKinds, objectLimit, objectTitle,
  placeCenter, placeLimit, placeRoles, removeObject, transformObject } from '../world/document';
import type { ObjectKind, Place, PlaceRole, WorldDocument, WorldObject, WorldResident } from '../world/document';
import { WorldHistory } from '../world/history';
import type { Marker } from './scene';

type Tab = 'objects' | 'places' | 'residents';
type ResidentTool = 'place' | 'relocate' | 'home' | 'preferred';
type Drag = { pointer: number; x: number; y: number; point: GroundPoint; object?: WorldObject; place?: Place; moved?: boolean };

const zoneColors: Record<PlaceRole, string> = {
  Neutral: '#5f645e', Shelter: '#315f83', Curiosity: '#b13e24', Gathering: '#755293', Quiet: '#156755',
};

const editorMarkup = `
  <div class="compose-title"><h2>Personal Places</h2><span id="compose-dirty" hidden>Unsaved edits</span>
    <button type="button" id="compose-tools" aria-pressed="false">Hide tools</button></div>
  <div class="compose-bar">
    <label>View<select id="compose-view"><option>Perspective</option><option>Plan</option></select></label>
    <button type="button" id="compose-navigation" aria-pressed="false">Navigate</button>
    <button type="button" id="compose-undo">Undo</button><button type="button" id="compose-redo">Redo</button>
  </div>
  <div class="compose-tabs" role="group" aria-label="Edit">
    <button type="button" data-compose-tab="objects" aria-pressed="true">Objects</button>
    <button type="button" data-compose-tab="places" aria-pressed="false">Places</button>
    <button type="button" data-compose-tab="residents" aria-pressed="false">Life</button>
  </div>
  <section data-compose-panel="objects">
    <div class="compose-line"><label>Object form<select id="compose-kind"></select></label>
      <button type="button" id="compose-add">Preview object</button></div>
    <div id="compose-draft" class="compose-line" hidden><label>Object seed<input id="compose-seed" maxlength="48"></label>
      <button type="button" id="compose-randomize">Randomize</button><button type="button" id="compose-cancel">Cancel</button></div>
    <label>Placed objects <span id="compose-object-count"></span><select id="compose-objects"></select></label>
    <div id="compose-object-edit" class="compose-fields" hidden>
      <label>Finish<select id="compose-finish"></select></label>
      <label>Rotation <output id="compose-angle-value"></output><input type="range" id="compose-angle" min="-180" max="180" step="1"></label>
      <label>Size <output id="compose-size-value"></output><input type="range" id="compose-size" min=".25" max="4" step=".01"></label>
      <label>Height <output id="compose-height-value"></output><input type="range" id="compose-height" min="0" max="9" step=".05"></label>
      <div class="compose-line">
        <label>X<input type="number" id="compose-object-x" step=".25" min="-112" max="112"></label>
        <label>Z<input type="number" id="compose-object-z" step=".25" min="-112" max="112"></label>
        <button type="button" id="compose-copy">Duplicate</button><button type="button" id="compose-delete">Delete</button>
      </div>
    </div>
  </section>
  <section data-compose-panel="places" hidden>
    <div class="compose-line"><label>Place role<select id="compose-new-role"></select></label>
      <button type="button" id="compose-zone-add">Add place</button></div>
    <label>Places <span id="compose-place-count"></span><select id="compose-zones"></select></label>
    <div id="compose-place-edit" class="compose-fields" hidden>
      <label>Name<input id="compose-zone-name" maxlength="48"></label>
      <div class="compose-line"><label>Role<select id="compose-zone-role"></select></label>
        <label>Linked object<select id="compose-zone-link"></select></label></div>
      <label>Radius <output id="compose-radius-value"></output><input type="range" id="compose-radius" min="1" max="15" step=".25"></label>
      <label>Influence <output id="compose-influence-value"></output><input type="range" id="compose-influence" min="0" max="1" step=".05"></label>
      <div class="compose-line"><label class="compose-check"><input type="checkbox" id="compose-zone-enable"> Active</label>
        <button type="button" id="compose-zone-delete">Delete place</button></div>
    </div>
  </section>
  <section data-compose-panel="residents" hidden>
    <label>Specimen<select id="compose-life"></select></label>
    <div class="compose-line">
      <button type="button" data-life-tool="place">Place resident</button>
      <button type="button" data-life-tool="relocate">Relocate</button>
    </div>
    <div class="compose-line">
      <button type="button" data-life-tool="home">Set home</button>
      <button type="button" data-life-tool="preferred">Set preferred area</button>
    </div>
    <div class="compose-line"><button type="button" id="compose-life-inspect">Inspect</button>
      <button type="button" id="compose-life-follow">Follow</button>
      <button type="button" id="compose-life-remove">Remove</button></div>
  </section>
  <p id="compose-message" class="compose-message" role="status"></p>
`;

export class WorldComposer {
  readonly history: WorldHistory;
  private active = false;
  private tab: Tab = 'objects';
  private view: 'Perspective' | 'Plan' = 'Perspective';
  private navigation = false;
  private toolsHidden = false;
  private object?: string;
  private place?: string;
  private resident?: string;
  private draft?: WorldObject;
  private pendingPlace?: PlaceRole;
  private residentTool?: ResidentTool;
  private drag?: Drag;
  private dragAt = -Infinity;

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
    this.options('compose-kind', objectKinds.map(kind => [kind, objectTitle(kind)]));
    this.options('compose-finish', finishes.map(value => [value, value]));
    for (const name of ['compose-new-role', 'compose-zone-role']) this.options(name, placeRoles.map(role => [role, role]));
    this.optionsValue('compose-new-role', 'Curiosity');
    this.wire();
    this.sync();
  }

  get document() { return this.history.value; }
  get editing() { return this.active; }

  open(active: boolean) {
    if (active === this.active) return;
    this.active = active;
    this.panel.hidden = !active;
    if (!active) { this.stopPlacement(); this.toolsHidden = false; }
    else if (!this.resident) this.resident = this.current().genome.seed;
    this.garden.setArrange(active ? this.view : undefined, this.navigation);
    this.sync();
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
  private refresh() {
    this.garden.applyWorld(this.document);
    this.garden.arrangeDrag();
    this.onChange();
    this.sync();
  }

  private moveHistory(back: boolean) {
    this.stopPlacement();
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
    this.draft = undefined; this.pendingPlace = undefined; this.residentTool = undefined; this.drag = undefined;
    this.garden.arrangeDraft(); this.garden.arrangeDrag();
  }

  private beginObject(seed: string) {
    const kind = this.select('compose-kind').value as ObjectKind;
    const base = newObject(kind, seed, this.draft?.id);
    const selected = this.objectItem;
    const point = this.draft ?? { x: clamp((selected?.x ?? -4) + 4, -28, 28), z: clamp(selected?.z ?? 5, -28, 28) };
    if (this.navigation) { this.navigation = false; this.garden.setArrange(this.view); }
    this.draft = transformObject(base, { x: point.x, z: point.z });
    this.garden.arrangeDraft(this.draft);
    this.sync();
    this.message('Click or tap the ground to place the preview.');
  }

  private wire() {
    this.click('compose-tools', () => { this.toolsHidden = !this.toolsHidden; this.sync(); });
    this.change('compose-view', () => {
      this.view = this.select('compose-view').value as typeof this.view;
      if (this.view === 'Plan') this.navigation = false;
      this.garden.setArrange(this.view, this.navigation);
      this.sync();
    });
    this.click('compose-navigation', () => {
      this.navigation = !this.navigation;
      this.garden.setArrange(this.view, this.navigation);
      this.sync();
    });
    for (const control of this.panel.querySelectorAll<HTMLButtonElement>('[data-compose-tab]')) {
      control.addEventListener('click', () => { this.stopPlacement(); this.tab = control.dataset.composeTab as Tab; this.sync(); });
    }
    this.click('compose-undo', () => this.moveHistory(true));
    this.click('compose-redo', () => this.moveHistory(false));
    this.click('compose-add', () => this.beginObject(freshSeed()));
    this.change('compose-kind', () => { if (this.draft) this.beginObject(this.draft.seed); });
    this.click('compose-randomize', () => this.beginObject(freshSeed()));
    this.change('compose-seed', () => this.beginObject(this.field('compose-seed').value.trim() || freshSeed()));
    this.click('compose-cancel', () => { this.stopPlacement(); this.sync(); });
    this.change('compose-objects', () => { this.stopPlacement(); this.object = this.select('compose-objects').value; this.sync(); });
    this.change('compose-finish', () => this.updateObject({ finish: this.select('compose-finish').value as WorldObject['finish'] }));
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
        this.garden.arrangeDrag(transformObject(item, copy(value)));
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
      this.pendingPlace = this.select('compose-new-role').value as PlaceRole;
      if (this.navigation) { this.navigation = false; this.garden.setArrange(this.view); this.sync(); }
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
        this.residentTool = button.dataset.lifeTool as ResidentTool;
        if (this.navigation) { this.navigation = false; this.garden.setArrange(this.view); this.sync(); }
        this.message('Click or tap a free point on the ground.');
      });
    }
    this.click('compose-life-inspect', () => this.onInspect(this.specimen, false));
    this.click('compose-life-follow', () => this.onInspect(this.specimen, true));
    this.click('compose-life-remove', () => this.toggleResident(this.specimen));
    document.addEventListener('keydown', event => {
      if (!this.active || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z'
        || (event.target instanceof Element && event.target.closest('input,select,textarea,[contenteditable=true]'))) return;
      event.preventDefault();
      this.moveHistory(!event.shiftKey);
    });
    this.wireCanvas();
  }

  private wireCanvas() {
    const canvas = this.garden.canvas;
    canvas.addEventListener('pointerdown', event => {
      if (!this.active || this.navigation || !event.isPrimary || event.button !== 0) return;
      const hit = this.garden.arrangeHit(event.clientX, event.clientY, this.tab !== 'residents');
      if (!hit.ground) return;
      let object: WorldObject | undefined;
      let place: Place | undefined;
      if (this.tab === 'objects' && !this.draft) {
        this.object = hit.object;
        object = this.objectItem;
        this.sync();
      } else if (this.tab === 'places' && !this.pendingPlace) {
        const point = hit.ground;
        const matching = [...this.document.places].reverse().find(item => {
          if (item.linkedObjectId && item.linkedObjectId === hit.object) return true;
          const center = placeCenter(item, this.document.objects);
          return Math.hypot(center[0] - point[0], center[1] - point[1]) < item.radius;
        });
        this.place = matching?.id;
        place = matching?.linkedObjectId ? undefined : matching;
        this.sync();
      }
      this.drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, point: hit.ground, object, place };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (!this.active || this.navigation || event.timeStamp - this.dragAt < 40) return;
      this.dragAt = event.timeStamp;
      const drag = this.drag;
      if (!this.draft && !drag?.object && !drag?.place) return;
      if (drag && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5 && !drag.moved) return;
      const { ground } = this.garden.arrangeHit(event.clientX, event.clientY, false);
      if (!ground) return;
      if (this.draft && this.onLand(ground)) {
        this.draft = transformObject(this.draft, { x: ground[0], z: ground[1] });
        this.garden.arrangeDraft(this.draft);
        this.markers();
      } else if (drag) {
        drag.moved = true;
        this.previewDrag(drag, ground);
      }
    });
    canvas.addEventListener('pointerup', event => {
      if (this.drag?.pointer !== event.pointerId) return;
      const drag = this.drag;
      this.drag = undefined;
      const hit = this.garden.arrangeHit(event.clientX, event.clientY, Boolean(this.pendingPlace));
      const point = hit.ground;
      if (point && (this.draft || this.pendingPlace || this.residentTool)) {
        if (!this.onLand(point)) { this.message('Choose a point inside the activity area.'); return; }
        this.finishPlacement(point, hit.object);
      } else if (point && drag.moved && (drag.object || drag.place)) {
        const delta = this.dragDelta(drag, point);
        if (drag.object) this.updateObject(delta);
        else this.updatePlace({ x: clamp(delta.x, -30, 30), z: clamp(delta.z, -30, 30) });
        this.garden.arrangeDrag();
        this.markers();
      } else this.garden.arrangeDrag();
    });
    canvas.addEventListener('pointercancel', () => { this.drag = undefined; this.garden.arrangeDrag(); this.markers(); });
    canvas.addEventListener('contextmenu', event => { if (this.active) event.preventDefault(); });
  }

  private onLand(point: GroundPoint) { return Math.abs(point[0]) <= worldBounds.x && Math.abs(point[1]) <= worldBounds.z; }
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
    if (this.draft) {
      const item = transformObject(this.draft, { x: point[0], z: point[1] });
      this.object = item.id;
      this.stopPlacement();
      if (this.commit({ ...this.document, objects: [...this.document.objects, item] })) this.message(objectTitle(item.kind) + ' placed.');
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
    this.node(id + '-value').textContent = id === 'compose-angle' ? Math.round(value) + '°' : value.toFixed(2);
  }

  private sync() {
    const { objects, places, residents } = this.document;
    this.panel.classList.toggle('tools-collapsed', this.toolsHidden);
    this.node('compose-tools').textContent = this.toolsHidden ? 'Show tools' : 'Hide tools';
    this.node('compose-tools').setAttribute('aria-pressed', String(this.toolsHidden));
    this.node('compose-dirty').hidden = !this.history.changed;
    this.node<HTMLButtonElement>('compose-undo').disabled = !this.history.canUndo;
    this.node<HTMLButtonElement>('compose-redo').disabled = !this.history.canRedo;
    this.node<HTMLButtonElement>('compose-navigation').disabled = this.view === 'Plan';
    this.node('compose-navigation').setAttribute('aria-pressed', String(this.navigation));
    this.node('compose-navigation').textContent = this.navigation ? 'Edit placement' : 'Navigate';
    for (const tab of this.panel.querySelectorAll<HTMLButtonElement>('[data-compose-tab]')) tab.setAttribute('aria-pressed', String(tab.dataset.composeTab === this.tab));
    for (const panel of this.panel.querySelectorAll<HTMLElement>('[data-compose-panel]')) panel.hidden = panel.dataset.composePanel !== this.tab;
    this.node<HTMLButtonElement>('compose-add').disabled = objects.length >= objectLimit;
    this.node<HTMLButtonElement>('compose-copy').disabled = objects.length >= objectLimit;
    this.node<HTMLButtonElement>('compose-zone-add').disabled = places.length >= placeLimit;
    this.node('compose-object-count').textContent = objects.length + ' / ' + objectLimit;
    this.node('compose-place-count').textContent = places.length + ' / ' + placeLimit;
    const object = this.objectItem, zone = this.zone;
    const label = (item: WorldObject, index: number): [string, string] => [item.id, objectTitle(item.kind) + ' ' + (index + 1)];
    this.options('compose-objects', [['', 'Choose or click an object'], ...objects.map(label)], object?.id ?? '');
    this.options('compose-zones', [['', 'Choose or click a place'], ...places.map(place => [place.id, place.name] as [string, string])], zone?.id ?? '');
    this.node('compose-draft').hidden = !this.draft;
    if (this.draft) this.field('compose-seed').value = this.draft.seed;
    this.node('compose-object-edit').hidden = !object;
    if (object) {
      this.optionsValue('compose-finish', object.finish);
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
    if (this.active && !this.draft && !this.pendingPlace && !this.residentTool) this.message(this.tab === 'objects'
      ? 'Choose a form to preview or drag an object on the ground.'
      : this.tab === 'places' ? 'Select a role and mark a region or link a structure.'
      : 'Place a resident or mark its home and preferred area.');
  }

  private markers(moving?: WorldObject, movedPlace?: Place) {
    if (!this.active) return;
    const markers: Marker[] = [];
    const active = this.draft ?? moving ?? this.objectItem;
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
