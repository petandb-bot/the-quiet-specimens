import type { Environment } from '../environment/settings';

type Appearance = 'surface' | 'atmosphere' | 'lighting';
type Field = readonly [key: string, label: string, limits?: readonly [min: number, max: number, step: number]];
const controls: Record<Appearance, readonly Field[]> = {
  atmosphere: [
    ['sky', 'Sky'], ['fog', 'Fog color'],
    ['distance', 'Clear distance', [8, 100, 1]], ['depth', 'Fog spread', [24, 155, 1]],
  ],
  lighting: [
    ['key', 'Light color'], ['ambient', 'Ambient color'], ['bounce', 'Ground bounce'],
    ['intensity', 'Light strength', [.5, 4, .05]], ['fill', 'Ambient strength', [.5, 3, .05]],
    ['bearing', 'Light direction', [-180, 180, 1]], ['elevation', 'Light height', [10, 58, 1]],
  ],
  surface: [
    ['low', 'Low ground'], ['high', 'High ground'], ['accent', 'Accent'],
    ['roughness', 'Roughness', [0, 1, .01]], ['metalness', 'Reflectivity', [0, .6, .01]],
  ],
};

const titles = { atmosphere: 'Sky and fog', lighting: 'Lighting', surface: 'Surface' };

export const appearanceMarkup = (Object.keys(controls) as Appearance[]).map(section => `
  <details data-appearance="${section}">
    <summary>${titles[section]}</summary>
    <div class="appearance-fields">
      ${controls[section].map(([key, label, limits]) => `<label>${label}<input data-setting="${key}"
        ${limits ? `type="range" min="${limits[0]}" max="${limits[1]}" step="${limits[2]}"` : 'type="color"'}></label>`).join('')}
    </div>
  </details>`).join('');

export class AppearanceControls {
  constructor(private root: Element, apply: <K extends Appearance>(key: K, settings: Environment[K]) => void) {
    for (const group of root.querySelectorAll<HTMLElement>('[data-appearance]')) {
      group.addEventListener('change', event => {
        if (!(event.target instanceof HTMLInputElement)) return;
        const section = group.dataset.appearance as Appearance;
        const inputs = group.querySelectorAll<HTMLInputElement>('[data-setting]');
        const settings = Object.fromEntries(Array.from(inputs, input =>
          [input.dataset.setting, input.type === 'color' ? input.value : input.valueAsNumber]));
        apply(section, settings as Environment[typeof section]);
      });
    }
  }

  sync(environment: Environment) {
    for (const group of this.root.querySelectorAll<HTMLElement>('[data-appearance]')) {
      const settings = environment[group.dataset.appearance as Appearance] as Record<string, string | number>;
      for (const input of group.querySelectorAll<HTMLInputElement>('[data-setting]')) {
        input.value = String(settings[input.dataset.setting!]);
      }
    }
  }
}
