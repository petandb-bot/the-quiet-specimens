import { specimenMarkup } from './specimen-panel';
import { colonyPatterns } from '../objects/colonies';
import { landMarkup } from './land-tool';
import { finishes, objectKinds, objectTitle } from '../world/document';
import { finishColors } from '../objects/appearance';
import { objectSizes } from './palette';
import { generatorMarkup } from './generator-panel';

function sizeButtons(scope: 'brush' | 'object') {
  return `<div class="make-size-options" role="group" aria-label="${scope === 'brush' ? 'Placement size' : 'Object size'}">
    ${Object.entries(objectSizes).map(([label, scale]) =>
      `<button type="button" data-${scope}-size="${scale}" aria-pressed="false">${label}</button>`).join('')}
  </div>`;
}

export const editorMarkup = `
  <aside class="make-help" id="compose-help-panel" aria-label="Make quick start" hidden>
    <div class="make-heading"><strong>Make it yours</strong><button type="button" id="compose-help-close" aria-label="Dismiss help">×</button></div>
    <ol><li>Choose a shape from the palette.</li><li>Click or tap the ground to place it. Keep going.</li><li>Pick a size before placing, or use Edit last to adjust a placed shape.</li></ol>
    <details><summary>Shortcuts and local draft</summary>
      <p>Space + drag to orbit, right-drag to pan, and scroll to zoom. On touch, use two fingers to pan and pinch to zoom. Escape or Done ends placement. Drag a selected object to move it.</p>
      <p>One draft in this browser. Terrain, objects, places, resident settings and a loaded photo are restored. Camera, live activity and Undo history reset when you reload. Clearing site data removes the draft. Reload to pick up a newer draft made in another tab.</p>
    </details>
  </aside>
  <div class="make-dock">
    <div class="make-tools">
      <button type="button" id="compose-fold" aria-expanded="true" aria-controls="compose-workspace">Hide tools</button>
      <div class="make-group" role="group" aria-label="Canvas tool">
        <button type="button" data-tool="select" title="Select a shape to edit"><span aria-hidden="true" class="make-select-mark"></span>Select</button>
        <button type="button" data-tool="camera" title="Drag to move the camera"><span aria-hidden="true">↻</span>Camera</button>
      </div>
      <div class="make-group make-activity">
        <label class="visually-hidden" for="compose-activity">Resident activity in Make</label>
        <select id="compose-activity" title="Resident activity in Make"><option>Paused</option><option selected>Slow</option><option>Live</option></select>
      </div>
      <div class="make-group make-history" role="group" aria-label="History">
        <button type="button" id="compose-undo" aria-label="Undo" title="Undo · Ctrl/⌘ Z">↶</button>
        <button type="button" id="compose-redo" aria-label="Redo" title="Redo · Ctrl/⌘ Shift Z">↷</button>
      </div>
      <div class="make-group make-view">
        <label class="visually-hidden" for="compose-view">Make camera view</label>
        <select id="compose-view"><option>Perspective</option><option>Plan</option></select>
        <button type="button" id="compose-reset" aria-label="Reset Make camera" title="Reset Make camera">⌂</button>
        <button type="button" id="compose-help" aria-label="Make help" aria-controls="compose-help-panel" aria-expanded="false">?</button>
      </div>
    </div>
    <div class="make-palette" id="compose-workspace">
      <nav class="compose-tabs" aria-label="Make workspace">
        <button type="button" data-compose-tab="land">Land</button>
        <button type="button" data-compose-tab="objects">Objects</button>
        <button type="button" data-compose-tab="residents">Life</button>
        <button type="button" id="image-settings" aria-controls="image-panel" aria-expanded="false">Atmosphere</button>
        <button type="button" data-compose-tab="generate">Generate</button>
        <span class="make-count" id="compose-object-count"></span>
      </nav>
      <div class="make-life-nav" id="compose-life-nav" hidden>
        <div class="make-group" role="group" aria-label="Life tools">
          <button type="button" data-life-tab="residents">Residents</button>
          <button type="button" data-life-tab="discover">Discover</button>
          <button type="button" data-life-tab="specimens">Generate</button>
          <button type="button" data-life-tab="places">Places</button>
        </div>
      </div>
      <section data-compose-panel="objects" aria-label="Object palette">
        <div class="make-shapes">${objectKinds.map(kind => `<button type="button" class="make-shape" data-kind="${kind}"
           aria-pressed="false"><span class="shape-preview" aria-hidden="true"></span><span>${objectTitle(kind)}</span></button>`).join('')}</div>
      </section>
      <section class="make-brush" id="compose-brush" aria-label="Placement brush" hidden>
        <div class="make-brush-options">
          <label class="placement-mode"><span class="visually-hidden">Placement mode</span>
            <select id="placement-mode"><option>Stamp</option><option>Scatter</option><option>Colony</option></select></label>
          ${sizeButtons('brush')}
          <label class="make-brush-finish"><span class="visually-hidden">Placement finish</span>
            <i id="compose-brush-color" aria-hidden="true"></i>
            <select id="compose-brush-finish">${finishes.map(finish =>
              `<option value="${finish}">${finish === 'Original' ? 'Seed color' : finish}</option>`).join('')}</select>
          </label>
        </div>
        <div class="make-brush-actions">
          <button type="button" id="compose-randomize">↻ Randomize</button>
          <details id="compose-brush-advanced"><summary>Seed</summary><label class="visually-hidden" for="compose-seed">Placement seed</label>
            <input id="compose-seed" maxlength="48" autocomplete="off" spellcheck="false"></details>
          <button type="button" id="compose-edit-last" aria-controls="compose-object-edit" hidden>Edit last</button>
          <button type="button" id="compose-done">Done</button>
        </div>
        <div class="colony-fields" id="colony-fields" hidden>
          <label id="colony-pattern-label">Pattern<select id="colony-pattern">${colonyPatterns.map(name=>`<option>${name}</option>`).join('')}</select></label>
          <label>Area<input id="colony-area" type="range" min="3" max="18" step=".5" value="11"></label>
          <details><summary>Advanced spacing</summary><label>Density<input id="colony-density" type="range" min="0" max="1" step=".05" value=".55"></label>
            <label>Variation<input id="colony-variation" type="range" min="0" max="1" step=".05" value=".8"></label></details>
        </div>
      </section>
      ${placeAndResidentMarkup()}
      ${specimenMarkup}
      ${landMarkup}
      ${generatorMarkup}
    </div>
    <div class="make-status"><p id="compose-message" role="status"></p><span id="compose-recovery" role="status">Draft loading…</span></div>
  </div>
  <aside id="compose-object-edit" class="make-inspector" aria-label="Selected object" hidden>
    <div class="make-heading"><h2 id="compose-object-name"></h2><button type="button" id="compose-deselect" aria-label="Deselect object">×</button></div>
    <div class="make-inspector-size">
      <strong>Size</strong>
      ${sizeButtons('object')}
      <label>Fine size <output id="compose-size-value"></output><input type="range" id="compose-size" min=".25" max="4" step=".01"></label>
    </div>
    <div class="make-finish" role="group" aria-label="Color and finish">Finish
      <div>${finishes.map(finish => {
        const label = finish === 'Original' ? 'Seed color' : finish;
        const color = finish === 'Original' ? '#d3c4a4' : finishColors[finish];
        return `<button type="button" data-finish="${finish}" aria-label="${label}" title="${label}" style="--swatch:${color}"></button>`;
      }).join('')}</div>
    </div>
    <div class="make-inspector-actions"><button type="button" id="compose-object-move">Move</button>
      <button type="button" id="compose-rotate">Rotate</button><button type="button" id="compose-copy">Duplicate</button>
      <button type="button" id="compose-object-randomize">Mutate</button><button type="button" id="compose-delete">Delete</button></div>
    <details id="compose-object-advanced"><summary>Advanced</summary>
      <div class="compose-line"><label>X<input type="number" id="compose-object-x" step=".25" min="-112" max="112"></label>
        <label>Z<input type="number" id="compose-object-z" step=".25" min="-112" max="112"></label></div>
      <label>Fine rotation <output id="compose-angle-value"></output><input type="range" id="compose-angle" min="-180" max="180" step="1"></label>
      <label>Seed<input id="compose-object-seed" maxlength="48" autocomplete="off" spellcheck="false"></label>
      <label>Height <output id="compose-height-value"></output><input type="range" id="compose-height" min="0" max="9" step=".05"></label>
    </details>
  </aside>
`;

function placeAndResidentMarkup() { return `
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
`; }
