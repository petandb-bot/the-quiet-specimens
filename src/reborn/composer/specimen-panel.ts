import { freshSeed } from '../../core/random';
import { gardenMaterials, gardenPlans, gardenReferences } from '../genome';
import type { GardenSpecimen } from '../genome';
import { mutateSpecimen, personalSpecimen, temperaments, validSpecimenSeed } from '../specimens/generator';
import type { SpecimenRecipe } from '../specimens/generator';
import { sizes } from '../specimens/profiles';

const options = (values: readonly string[]) => values.map(value => `<option value="${value}">${value[0] + value.slice(1).toLowerCase()}</option>`).join('');

export const specimenMarkup = `
  <section data-compose-panel="discover" hidden>
    <label>Reference specimen<select id="life-reference">${gardenReferences.map((item, index) =>
      `<option value="${index}">${item.name}</option>`).join('')}</select></label>
    <div class="compose-line"><button type="button" id="life-reference-inspect">Inspect</button>
      <button type="button" id="life-reference-add">Add to world</button></div>
  </section>
  <section data-compose-panel="specimens" hidden>
    <div class="specimen-layout">
      <img id="specimen-preview" width="112" height="82" alt="" hidden>
      <div class="specimen-controls">
        <label>Body<select id="specimen-body">${options(['Any', ...gardenPlans])}</select></label>
        <label>Material<select id="specimen-material">${options(['Any', ...gardenMaterials])}</select></label>
        <label>Scale<select id="specimen-size">${options(sizes)}</select></label>
        <label>Temperament<select id="specimen-temperament">${options(temperaments)}</select></label>
      </div>
    </div>
    <div class="compose-line specimen-actions">
      <button type="button" id="specimen-roll">Randomize</button><button type="button" id="specimen-show">Preview</button>
      <button type="button" id="specimen-add" disabled>Add to world</button>
    </div>
    <details><summary>Mutate</summary>
      <span id="specimen-source"></span>
      <div class="compose-line"><button type="button" id="specimen-form">Preview form</button>
        <button type="button" id="specimen-finish">Preview material</button>
        <button type="button" id="specimen-replace" disabled>Replace selected</button></div>
    </details>
    <details><summary>Advanced</summary>
      <label>Specimen seed<input id="specimen-seed" maxlength="24" spellcheck="false" autocomplete="off"></label>
      <output id="specimen-replay" aria-label="Replay seed"></output>
    </details>
  </section>`;

export class SpecimenPanel {
  private candidate?: GardenSpecimen;
  private source?: string;

  constructor(private panel: HTMLElement, private portrait: (item: GardenSpecimen) => string,
    private selected: () => GardenSpecimen | undefined, private present: (item: GardenSpecimen) => boolean,
    private add: (item: GardenSpecimen, replace?: string) => void, inspect: (item: GardenSpecimen) => void,
    private tell: (message: string) => void) {
    this.seed.value = freshSeed();
    this.control('size').value = 'Medium';
    this.control('temperament').value = 'Curious';
    const reference = () => gardenReferences[Number(panel.querySelector<HTMLSelectElement>('#life-reference')!.value)];
    panel.querySelector('#life-reference')!.addEventListener('change', () => this.sync());
    panel.querySelector('#life-reference-inspect')!.addEventListener('click', () => inspect(reference()));
    panel.querySelector('#life-reference-add')!.addEventListener('click', () => this.add(reference()));
    this.node('roll').addEventListener('click', () => { this.seed.value = freshSeed(); this.generate(); });
    this.node('show').addEventListener('click', () => this.generate());
    this.node('form').addEventListener('click', () => this.mutate('Form'));
    this.node('finish').addEventListener('click', () => this.mutate('Material'));
    this.node('add').addEventListener('click', () => { if (this.candidate) this.add(this.candidate); });
    this.node('replace').addEventListener('click', () => { if (this.candidate && this.source) this.add(this.candidate, this.source); });
    for (const id of ['body', 'material', 'size', 'temperament', 'seed']) {
      this.node(id).addEventListener('change', () => { if (this.candidate) this.generate(); });
    }
  }

  private node<T extends HTMLElement = HTMLElement>(id: string) { return this.panel.querySelector<T>('#specimen-' + id)!; }
  private control(id: string) { return this.node<HTMLSelectElement>(id); }
  private get seed() { return this.node<HTMLInputElement>('seed'); }

  private generate() {
    const seed = this.seed.value.trim();
    if (!validSpecimenSeed(seed)) { this.tell('Use up to 24 letters, numbers, dots, underscores, or hyphens for the seed.'); return; }
    const recipe = { seed, body: this.control('body').value, material: this.control('material').value,
      size: this.control('size').value, temperament: this.control('temperament').value } as SpecimenRecipe;
    this.show(personalSpecimen(recipe));
  }

  private mutate(aspect: 'Form' | 'Material') {
    const selected = this.selected();
    const template = selected ?? this.candidate;
    if (!template) return;
    this.seed.value = freshSeed();
    this.show(mutateSpecimen(template, aspect, this.seed.value), selected?.genome.seed);
  }

  private show(candidate: GardenSpecimen, source?: string) {
    this.candidate = candidate;
    this.source = source;
    const img = this.node<HTMLImageElement>('preview');
    const label = [candidate.name, candidate.size ?? 'Medium', candidate.genome.plan, candidate.genome.material].join(' · ');
    img.alt = img.title = label;
    const url = this.portrait(candidate);
    if (url) img.src = url;
    img.hidden = !url;
    this.node('replay').textContent = candidate.genome.seed;
    this.sync();
    this.tell(label);
  }

  sync() {
    const selected = this.selected();
    const reference = this.panel.querySelector<HTMLSelectElement>('#life-reference')!;
    this.panel.querySelector<HTMLButtonElement>('#life-reference-add')!.disabled = this.present(gardenReferences[Number(reference.value)]);
    const canAdd = Boolean(this.candidate && !this.present(this.candidate));
    this.node<HTMLButtonElement>('add').disabled = !canAdd;
    this.node<HTMLButtonElement>('replace').disabled = !canAdd || !this.source || this.source !== selected?.genome.seed;
    this.node<HTMLButtonElement>('form').disabled = !selected && !this.candidate;
    this.node<HTMLButtonElement>('finish').disabled = !selected && !this.candidate;
    this.node('source').textContent = selected?.name ?? (this.candidate ? 'Current preview' : 'Preview a specimen first.');
  }
}
