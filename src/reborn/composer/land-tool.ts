import { clamp } from '../../core/random';
import { BrushPath, emptyLand, paintSurface, sculpt, surfaceFamilies, waterLimit } from '../environment/land-edits';
import type { PersonalLand, Sculpt, SurfaceFamily, WaterRegion } from '../environment/land-edits';
import type { GroundPoint } from '../motion';
import type { GardenView } from '../view';
import type { Cursor } from './input';

type Mode = 'Shape' | 'Sculpt' | 'Paint' | 'Water';
const modes: Mode[] = ['Shape', 'Sculpt', 'Paint', 'Water'];
export const landMarkup = `
<section data-compose-panel="land" class="personal-land" aria-label="Land tools" hidden>
  <div class="land-modes" role="group" aria-label="Land mode">
    ${modes.map(mode => `<button type="button" data-land-mode="${mode}" aria-pressed="false">${mode}</button>`).join('')}
  </div>
  <div data-land-fields="Shape"><button type="button" id="world-settings" aria-controls="land-panel" aria-expanded="false">Base terrain settings</button>
    <button type="button" id="base-reroll">Regenerate base terrain</button></div>
  <div data-land-fields="Sculpt" hidden><label>Brush<select id="sculpt-kind"><option>Raise</option><option>Lower</option><option>Smooth</option><option>Flatten</option></select></label>
    <label>Strength<input id="sculpt-strength" type="range" min=".15" max="1" step=".05" value=".65"></label>
    <button type="button" id="relief-clear">Clear local relief</button></div>
  <div data-land-fields="Paint" hidden><label>Finish<select id="paint-kind">
    ${Object.keys(surfaceFamilies).map(name=>`<option>${name}</option>`).join('')}<option>Erase</option></select></label>
    <button type="button" id="paint-clear">Clear local paint</button></div>
  <div data-land-fields="Water" hidden><label>Pool<select id="water-select"></select></label>
    <button type="button" id="water-create" aria-pressed="false">Create water</button>
    <label><span id="water-level-label">Level above ground</span><input id="water-level" type="range" min="-12" max="12" step=".1" value=".5"></label>
    <label>Size<input id="water-radius" type="range" min="2" max="16" step=".5" value="8"></label>
    <label>Color<input id="water-color" type="color" value="#729895"></label>
    <label>Clarity<input id="water-clarity" type="range" min="0" max="1" step=".05" value=".55"></label>
    <button type="button" id="water-delete">Delete water</button>
  </div>
  <div class="land-brush-actions" id="land-brush-actions" hidden>
    <label id="land-size-label">Brush size<input id="land-size" type="range" min="2" max="12" step=".5" value="6"></label>
    <button type="button" id="land-done">Done</button>
  </div>
</section>`;

export class LandTool {
  private mode: Mode = 'Shape';
  private creating = false;
  private selected?: string;
  private draft?: PersonalLand;
  private stroke?: BrushPath;
  private frame = 0;
  private cursor?: Cursor;

  constructor(private root: HTMLElement, private garden: GardenView, private get: () => PersonalLand | undefined,
    private commit: (edits: PersonalLand) => void, private resetInput: () => void, reroll: () => void, private onToolChange: () => void) {
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-land-mode]')) {
      button.addEventListener('click', () => this.switch(button.dataset.landMode as Mode));
    }
    this.element('land-done').addEventListener('click', () => this.switch('Shape'));
    this.element('base-reroll').addEventListener('click', reroll);
    this.element('relief-clear').addEventListener('click', () => this.clear('relief'));
    this.element('paint-clear').addEventListener('click', () => this.clear('paint'));
    this.element('water-create').addEventListener('click', () => {
      this.resetInput();
      this.selected = undefined;
      this.creating = !this.creating;
      this.onToolChange();
    });
    this.element('water-select').addEventListener('change', () => {
      this.resetInput();
      this.selected = this.select('water-select').value;
      this.creating = false;
      this.onToolChange();
    });
    this.element('water-delete').addEventListener('click', () => {
      this.commit({ ...this.value, water: this.value.water.filter(region => region.id !== this.selected) });
    });
    for (const field of ['level', 'radius', 'color', 'clarity'] as const) {
      this.element('water-' + field).addEventListener('change', () => {
        if (!this.region) return;
        const input = this.input('water-' + field);
        const value = field === 'color' ? input.value : input.valueAsNumber;
        this.commit({ ...this.value, water: this.value.water.map(region =>
          region.id === this.selected ? { ...region, [field]: value } : region) });
      });
    }
    this.sync();
  }
  get armed() { return this.mode === 'Sculpt' || this.mode === 'Paint' || this.mode === 'Water' && this.creating; }
  get instruction() {
    if (this.mode === 'Sculpt') return 'Drag the ground to sculpt.';
    if (this.mode === 'Paint') return 'Drag the ground to paint.';
    if (this.creating) return 'Click or tap the ground to create a pool.';
    return '';
  }
  private get value() { return this.get() ?? emptyLand; }
  private get region() { return this.value.water.find(region => region.id === this.selected); }
  private get radius() { return this.input(this.mode === 'Water' ? 'water-radius' : 'land-size').valueAsNumber; }
  private element<T extends HTMLElement = HTMLElement>(id: string) { return this.root.querySelector<T>('#' + id)!; }
  private select(id: string) { return this.element<HTMLSelectElement>(id); }
  private input(id: string) { return this.element<HTMLInputElement>(id); }
  private clear(layer: 'paint' | 'relief') {
    this.resetInput();
    this.commit({ ...this.value, [layer]: {} });
  }
  switch(mode: Mode) {
    this.resetInput();
    this.creating = false;
    this.mode = mode;
    this.onToolChange();
  }
  sync() {
    for (const button of this.root.querySelectorAll('[data-land-mode]')) button.setAttribute('aria-pressed', String(this.mode === (button as HTMLElement).dataset.landMode));
    for (const fields of this.root.querySelectorAll<HTMLElement>('[data-land-fields]')) fields.hidden = fields.dataset.landFields !== this.mode;
    this.element('land-brush-actions').hidden = this.mode === 'Shape';
    this.element('land-size-label').hidden = this.mode === 'Water';
    this.element<HTMLButtonElement>('water-create').disabled = this.value.water.length >= waterLimit;
    this.element('water-create').setAttribute('aria-pressed', String(this.creating));
    this.element('water-level-label').textContent = this.region ? 'Water level' : 'Level above ground';
    this.element<HTMLButtonElement>('water-delete').disabled = !this.region;
    this.element<HTMLButtonElement>('relief-clear').disabled = !Object.keys(this.value.relief).length;
    this.element<HTMLButtonElement>('paint-clear').disabled = !Object.keys(this.value.paint).length;
    const selector = this.select('water-select');
    selector.replaceChildren(new Option('Choose a pool', ''), ...this.value.water.map((region, i) => new Option('Pool ' + (i + 1), region.id)));
    selector.value = this.region?.id ?? '';
    if (this.region) {
      for (const field of ['level', 'radius', 'color', 'clarity'] as const) this.input('water-' + field).value = String(this.region[field]);
    } else this.input('water-level').value = '.5';
  }

  private hit(point: Cursor) {
    const ground = this.garden.arrangeHit(point.x, point.y, false).ground;
    return ground && Math.max(Math.abs(ground[0]), Math.abs(ground[1])) <= 30 ? ground : undefined;
  }
  hover(point: Cursor) {
    this.cursor = point;
    const ground = this.armed && this.hit(point);
    this.garden.arrangeMarkers(ground ? [{ center: ground, radius: this.radius, color: '#556f62', selected: true }] : []);
  }
  begin(point: Cursor) {
    const ground = this.hit(point);
    if (!ground || this.mode === 'Water') return;
    this.draft = this.value;
    const flatten = this.garden.terrain.height(...ground), radius = this.radius;
    const base = this.garden.terrain.baseHeight, mode = this.select('sculpt-kind').value as Sculpt;
    const strength = this.input('sculpt-strength').valueAsNumber;
    const family = this.select('paint-kind').value as SurfaceFamily | 'Erase';
    this.stroke = new BrushPath(Math.max(.45, radius * .23), center => {
      const draft = this.draft!;
      this.draft = this.mode === 'Sculpt' ? { ...draft, relief: sculpt(draft.relief, center, mode, radius, strength, base, flatten) }
        : { ...draft, paint: paintSurface(draft.paint, center, family === 'Erase' ? undefined : family, radius) };
      if (!this.frame) this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        if (this.draft) { this.garden.previewLand(this.draft); if (this.cursor) this.hover(this.cursor); }
      });
    });
    this.garden.previewLand(this.draft);
    this.stroke.add(ground);
    this.hover(point);
  }
  move(point: Cursor) {
    const ground = this.hit(point);
    if (ground) this.stroke?.add(ground);
    this.hover(point);
  }
  end(point: Cursor) {
    const ground = this.hit(point);
    if (this.mode === 'Water' && this.creating && ground && this.value.water.length < waterLimit) {
      const region: WaterRegion = { id: crypto.randomUUID(), x: ground[0], z: ground[1], radius: this.radius,
        level: clamp(this.garden.terrain.height(...ground) + this.input('water-level').valueAsNumber, -12, 12),
        color: this.input('water-color').value, clarity: this.input('water-clarity').valueAsNumber };
      this.creating = false;
      this.selected = region.id;
      this.commit({ ...this.value, water: [...this.value.water, region] });
    } else if (this.stroke && this.draft) {
      if (ground) this.stroke.add(ground);
      const next = this.draft;
      if (next.relief === this.value.relief && next.paint === this.value.paint) this.cancel();
      else {
        this.cancel(false);
        this.commit(next);
      }
    }
    this.hover(point);
  }
  cancel(restore = true) {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (this.draft && restore) this.garden.previewLand(undefined);
    this.stroke = undefined;
    this.draft = undefined;
    this.cursor = undefined;
  }
}
