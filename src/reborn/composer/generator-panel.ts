import { freshSeed } from '../../core/random';
import { environmentOf, generateWorld, lockLayer, randomizeLayer, setStructureDensity } from '../environment/generator';
import { layerNames, worldStyles } from '../environment/settings';
import type { Layer, WorldStyle } from '../environment/settings';
import { defaultLand } from '../terrain';
import type { WorldDocument } from '../world/document';

const labels: Record<Layer, string> = {
  terrain: 'Terrain', surface: 'Surface', structures: 'Structures',
  atmosphere: 'Atmosphere', lighting: 'Lighting', residents: 'Residents',
};

export function styleSlug(style: WorldStyle) {
  return style.toLowerCase().replaceAll(' ', '-');
}

export const generatorMarkup = `
  <section class="make-generate" data-compose-panel="generate" aria-label="World generator" hidden>
    <div class="world-style-line">
      <img id="world-style-preview" width="120" height="75" alt="">
      <div>
        <label>World style<select id="world-style">${worldStyles.map(style => `<option>${style}</option>`).join('')}</select></label>
        <div class="world-generator-actions"><button id="world-randomize" type="button">Randomize world</button>
          <button id="world-reset" type="button">Reset to style</button></div>
      </div>
    </div>
    <p id="world-lock-summary" hidden></p>
    <details class="world-layer-details">
      <summary>Layers</summary>
      <div class="world-layers">
        ${layerNames.map(layer => `<div class="world-layer">
          <span>${labels[layer]}</span><button type="button" data-random-layer="${layer}" aria-label="Randomize ${labels[layer]}">Randomize</button>
          <label><input type="checkbox" data-lock-layer="${layer}" aria-label="Lock ${labels[layer]}"> Lock</label>
        </div>`).join('')}
      </div>
    </details>
    <details class="world-seed-details"><summary>Advanced</summary>
      <label>Structure density<input id="world-structure-density" type="range" min="0" max="1" step=".025"></label>
      <form id="world-seed-form" class="compose-line"><label>World seed<input id="world-seed" maxlength="48" required spellcheck="false"></label>
        <button type="submit">Generate</button></form>
    </details>
  </section>`;

export class GeneratorPanel {
  private readonly style: HTMLSelectElement;
  private readonly seed: HTMLInputElement;
  private readonly preview: HTMLImageElement;

  constructor(private panel: HTMLElement, private world: () => WorldDocument, private commit: (world: WorldDocument) => void) {
    this.style = panel.querySelector<HTMLSelectElement>('#world-style')!;
    this.seed = panel.querySelector<HTMLInputElement>('#world-seed')!;
    this.preview = panel.querySelector<HTMLImageElement>('#world-style-preview')!;
    this.style.addEventListener('change', () => this.generate(environmentOf(this.world()).seed));
    panel.querySelector('#world-randomize')!.addEventListener('click', () => this.generate(freshSeed()));
    panel.querySelector('#world-reset')!.addEventListener('click', () => this.generate(defaultLand.seed, true));
    panel.querySelector<HTMLInputElement>('#world-structure-density')!.addEventListener('change', event => {
      this.commit(setStructureDensity(this.world(), (event.target as HTMLInputElement).valueAsNumber));
    });
    panel.querySelector('#world-seed-form')!.addEventListener('submit', event => {
      event.preventDefault();
      this.generate(this.seed.value.trim() || defaultLand.seed);
    });
    for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-random-layer]')) {
      button.addEventListener('click', () => this.commit(randomizeLayer(this.world(), button.dataset.randomLayer as Layer, freshSeed())));
    }
    for (const toggle of panel.querySelectorAll<HTMLInputElement>('[data-lock-layer]')) {
      toggle.addEventListener('change', () => this.commit(lockLayer(this.world(), toggle.dataset.lockLayer as Layer, toggle.checked)));
    }
  }

  private generate(seed: string, reset = false) {
    this.commit(generateWorld(this.world(), this.style.value as WorldStyle, seed, reset));
  }

  sync() {
    const environment = environmentOf(this.world());
    this.style.value = environment.style;
    this.seed.value = environment.seed;
    if (!this.preview.closest('[hidden]') && this.preview.dataset.style !== environment.style) {
      this.preview.dataset.style = environment.style;
      this.preview.src = './world-styles/' + styleSlug(environment.style) + '.jpg';
    }
    const pending = layerNames.filter(layer => environment.layers[layer].locked).length;
    const summary = this.panel.querySelector<HTMLElement>('#world-lock-summary')!;
    summary.hidden = pending === 0;
    summary.textContent = pending === 1 ? '1 layer locked' : pending + ' layers locked';
    const density = this.panel.querySelector<HTMLInputElement>('#world-structure-density')!;
    density.value = String(environment.structureDensity ?? .5);
    density.disabled = environment.layers.structures.locked;
    for (const toggle of this.panel.querySelectorAll<HTMLInputElement>('[data-lock-layer]')) {
      toggle.checked = environment.layers[toggle.dataset.lockLayer as Layer].locked;
    }
    for (const button of this.panel.querySelectorAll<HTMLButtonElement>('[data-random-layer]')) {
      button.disabled = environment.layers[button.dataset.randomLayer as Layer].locked;
    }
  }
}
