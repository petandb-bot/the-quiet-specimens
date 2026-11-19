import { actions, actionLabels, discoveryOptions, fishFormLabels, generatorVersion, legacyGeneratorVersion, mutationModes } from '../core/model';
import type { Generator, Specimen } from '../core/model';
import { icon } from './icons';
const mark = import.meta.env.BASE_URL + 'mark.svg';

export function layout(featured: readonly Specimen[]) {
  return `
    <a class="skip" href="#laboratory">Skip to the laboratory</a>
    <header class="site-header">
      <div class="header-wrap">
        <a class="wordmark" href="#laboratory" aria-label="The Quiet Specimens home">
          <img src="${mark}" alt="" width="38" height="38">
          <span>The Quiet<br>Specimens</span>
        </a>
        <nav aria-label="Primary">
          <a class="nav-link is-active" href="#laboratory" id="lab-nav">${icon('chamber')} Laboratory</a>
          <a class="nav-link" href="#archive" id="archive-nav">${icon('grid')} Archive</a>
        </nav>
      </div>
    </header>
    <main class="page">
      <section class="intro" id="laboratory" aria-labelledby="title">
        <div class="intro-copy"><div class="intro-line"><span></span> PHASE 01 <span class="intro-divider"></span> SPECIMEN LAB</div>
        <h1 id="title">Specimen Laboratory</h1>
        <p>Discover, observe, and listen to life from imagined waters.</p></div>
        <button class="button small new-button" type="button" id="new-specimen">${icon('plus')} New specimen</button>
      </section>
      <div class="workspace">
        <section class="observation" aria-label="Observation chamber">
          <div class="form-strip" id="form-strip" role="group" aria-labelledby="form-label">
            <span id="form-label">Reference forms</span>
            <div class="form-buttons">${featured.map(specimen => {
              const form = specimen.genome.morphology.fishForm!;
              return `<button type="button" data-reference="${specimen.id}" aria-pressed="false" title="${escapeHtml(specimen.name)}">${fishFormLabels[form]}</button>`;
            }).join('')}</div>
          </div>
          <div class="stage" id="stage">
            <div class="bathysphere" aria-hidden="true"></div>
            <div class="water-grain" aria-hidden="true"></div>
            <div class="canvas-host" id="canvas-host"></div>
            <div class="stage-header">
              <div class="stage-live"><i></i> <span>LIVE OBSERVATION</span></div>
              <button type="button" id="view-mode" class="stage-button" title="Hide the interface" aria-label="Enter viewing mode">${icon('expand')} <span>View</span></button>
            </div>
            <div class="chamber-frame" aria-hidden="true"><b></b><b></b><b></b><b></b></div>
            <p id="graphics-error" class="graphics-error" hidden></p>
            <div class="zoom" id="zoom" hidden>
              <button class="stage-button" type="button" id="zoom-out" aria-label="Zoom out">${icon('minus')}</button>
              <button class="stage-button" type="button" id="zoom-in" aria-label="Zoom in">${icon('plus')}</button>
              <button class="stage-button" type="button" id="reset-view" aria-label="Reset view" title="Reset view">${icon('refresh')}</button>
            </div>
            <div class="stage-footer">
              <span id="stage-id">QS</span>
              <span class="stage-action"><i></i><span id="swim-state">Cruise</span></span>
            </div>
            <button class="stage-button exit-view" id="exit-view" type="button">${icon('close')} Exit view</button>
          </div>
          <div class="mode-bar">
            <div class="mode-group" aria-label="Observation mode">
              <button type="button" class="selected" data-mode="observe" aria-pressed="true">${icon('chamber')} Observe</button>
              <button type="button" data-mode="inspect" aria-pressed="false">${icon('focus')} Inspect</button>
              <button type="button" data-mode="action" aria-pressed="false">${icon('action')} Action</button>
            </div>
            <span id="mode-hint" class="mode-hint">Tap the specimen to interact</span>
          </div>
          <div class="action-bar" hidden id="action-bar">
            <label for="action-choice">Action</label>
            <select id="action-choice">${actions.map(action => `<option value="${action}">${actionLabels[action]}</option>`).join('')}</select>
            <button type="button" class="button small" id="trigger-action">${icon('play')} Play</button>
          </div>
        </section>
        <aside class="record" aria-label="Specimen record">
          <div class="record-top">
            <span class="eyebrow">SPECIMEN RECORD</span>
            <button class="icon-button detail-button" type="button" id="details" title="Genome details" aria-label="Genome details">${icon('info')}</button>
          </div>
          <div class="name-line">
            <h2 id="specimen-name"></h2>
            <button class="icon-button edit-button" type="button" id="rename" title="Rename specimen" aria-label="Rename specimen">${icon('edit')}</button>
          </div>
          <div class="record-id mono" id="record-id"></div>
          <dl class="traits">
            <div><dt>Body plan</dt><dd id="body-plan"></dd></div>
            <div><dt>Material</dt><dd id="material"></dd></div>
            <div><dt>Generation</dt><dd id="generation"></dd></div>
            <div><dt>Origin</dt><dd id="origin"></dd></div>
            <div><dt>Seed</dt><dd id="seed" class="mono"></dd></div>
          </dl>
          <div class="sonotype">
            <div class="sound-title"><div>
              <p class="eyebrow">SONOTYPE</p>
              <h3 id="sound-name"></h3>
            </div><div class="sound-wave" aria-hidden="true">${[4, 8, 14, 10, 24, 17, 28, 12, 18, 8, 4].map((v, i) => `<i style="--bar:${v}px;--delay:${i * -84}ms"></i>`).join('')}</div></div>
            <div class="sound-controls">
              <button id="toggle-sound" type="button" class="button small sound-toggle" aria-pressed="false">${icon('mute')} Sound off</button>
              <button id="audition" type="button" class="button small audition-button" aria-pressed="false">${icon('play')} Audition</button>
            </div>
            <label class="volume"><span>Volume</span><input type="range" id="volume" min="0" max="100" value="60"><output for="volume" id="volume-label">60%</output></label>
          </div>
          <button type="button" class="button primary save-button" id="save">${icon('save')} Save specimen</button>
        </aside>
      </div>
      <div class="result-bar" id="result-bar" hidden>
        <span id="result-text"></span>
        <div class="result-buttons"><button type="button" class="button small" id="retry">${icon('refresh')} Retry</button><button type="button" class="button small" id="revert">Cancel result</button></div>
      </div>
      <section class="discovery" aria-labelledby="discovery-title">
        <div class="section-head">
          <h2 id="discovery-title">Discovery tools</h2>
        </div>
        <div class="tool-grid">
          <button type="button" class="tool-card" id="extract"><span class="tool-icon">${icon('image')}</span><span><strong>Extract</strong><span>Generate a specimen from a photo.</span></span></button>
          <button type="button" class="tool-card" id="discover"><span class="tool-icon">${icon('compass')}</span><span><strong>Discover</strong><span>Follow a trace through imagined waters.</span></span></button>
          <button type="button" class="tool-card" id="mutate"><span class="tool-icon">${icon('mutate')}</span><span><strong>Mutate</strong><span>Find a variation of the current specimen.</span></span></button>
        </div>
      </section>
      <section class="archive" id="archive" aria-labelledby="archive-title">
        <div class="section-head archive-head">
          <div><p class="eyebrow">COLLECTION</p><h2 id="archive-title">Specimen Archive</h2></div>
          <div class="archive-actions">
            <button type="button" id="import" class="button small">${icon('upload')} Import JSON</button>
            <button type="button" id="export" class="button small">${icon('download')} Export current</button>
          </div>
        </div>
        <div class="archive-filter" aria-label="Archive filters">
          <button type="button" class="archive-tab selected" data-archive="reference" aria-pressed="true">Reference <span id="reference-count"></span></button>
          <button type="button" class="archive-tab" data-archive="collection" aria-pressed="false">My collection <span id="collection-count">0</span></button>
          <button type="button" class="archive-tab" data-archive="favorites" aria-pressed="false">Favorites <span id="favorites-count">0</span></button>
        </div>
        <div class="archive-grid" id="archive-grid"></div>
      </section>
    </main>
    <footer class="site-footer"><span>The Quiet Specimens</span><span class="mono">SPECIMEN LAB / V${generatorVersion}</span></footer>
    <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
    <input type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.avif" id="image-file" hidden>
    <input type="file" accept=".json,application/json" id="json-file" hidden>
    <dialog id="dialog" aria-labelledby="dialog-title"><div class="dialog-inner">
      <div class="dialog-head"><h2 id="dialog-title"></h2><button type="button" class="icon-button" data-close title="Close" aria-label="Close">${icon('close')}</button></div>
      <div id="dialog-content"></div>
    </div></dialog>
  `;
}

export function discoverForm(choices: readonly string[], version: Generator = generatorVersion) {
  return `<form id="discover-form">
    <p>Choose where and when to look, and what you find there.</p>
    <div class="discovery-fields">
      ${discoveryOptions.map((options, i) => `<label>${['Where?', 'When?', 'Trace?'][i]}<select name="choice${i}">${options.map(option => `<option${option === choices[i] ? ' selected' : ''}>${option}</option>`).join('')}</select></label>`).join('')}
    </div>
    <label class="seed-field">Seed <span>Optional</span><input name="seed" class="mono" maxlength="32" autocomplete="off" spellcheck="false" placeholder="Leave blank for a new seed"></label>
    <details class="generator-options"${version === legacyGeneratorVersion ? ' open' : ''}>
      <summary>Generator version</summary>
      <label><span class="skip-label">Generator version</span><select name="generator">
        <option value="${generatorVersion}">${generatorVersion} · Expanded fish forms</option>
        <option value="${legacyGeneratorVersion}"${version === legacyGeneratorVersion ? ' selected' : ''}>${legacyGeneratorVersion} · Original specimens</option>
      </select></label>
    </details>
    <p class="field-note">Use the same choices, seed, and generator version to recreate a specimen.</p>
    <div class="dialog-actions"><button type="button" class="button" data-close>Cancel</button><button class="button primary" type="submit">${icon('compass')} Discover specimen</button></div>
  </form>`;
}

export function mutationForm() {
  const descriptions = ['Preserve most of the parent’s traits.', 'Let one part of the genome change considerably.', 'Allow pronounced asymmetry and unusual forms.'];
  return `<form id="mutate-form"><p>Make a descendant of the specimen in the chamber.</p>
    <fieldset class="mutation-options"><legend class="skip-label">Mutation intensity</legend>
      ${mutationModes.map((mode, i) => `<label><input type="radio" name="mutation" value="${mode}"${i === 0 ? ' checked' : ''}><span><strong>${mode}</strong><small>${descriptions[i]}</small></span></label>`).join('')}
    </fieldset>
    <div class="dialog-actions"><button type="button" class="button" data-close>Cancel</button><button type="submit" class="button primary">${icon('mutate')} Generate variation</button></div>
  </form>`;
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
