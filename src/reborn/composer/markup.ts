import { finishes, objectKinds, objectTitle } from '../world/document';
import { swatches } from './palette';

export const editorMarkup = `
  <aside class="make-help" id="compose-help-panel" aria-label="Make quick start" hidden>
    <div class="make-heading"><strong>Make it yours</strong><button type="button" id="compose-help-close" aria-label="Dismiss help">×</button></div>
    <ol><li>Choose a shape from the palette.</li><li>Click or tap the ground to place it. Keep going.</li><li>Use Move to drag a shape, or Camera to look around.</li></ol>
    <details><summary>Shortcuts and local draft</summary>
      <p>Space + drag to orbit, right-drag to pan, and scroll to zoom. On touch, use two fingers to pan and pinch to zoom. Esc returns to Select.</p>
      <p>One draft in this browser. Terrain, objects, places, resident settings and a loaded photo are restored. Camera, live activity and Undo history reset when you reload. Clearing site data removes the draft. Reload to pick up a newer draft made in another tab.</p>
    </details>
  </aside>
  <div class="make-dock">
    <div class="make-tools">
      <div class="make-group" role="group" aria-label="Canvas tool">
        <button type="button" data-tool="select" title="Select a shape to edit"><span aria-hidden="true">↖</span>Select</button>
        <button type="button" data-tool="move" title="Drag a shape to move it"><span aria-hidden="true">✥</span>Move</button>
        <button type="button" data-tool="place" title="Place the current shape"><span aria-hidden="true">+</span>Place</button>
        <button type="button" data-tool="camera" title="Drag to move the camera"><span aria-hidden="true">↻</span>Camera</button>
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
    <div class="make-palette">
      <nav class="compose-tabs" aria-label="Make workspace">
        <button type="button" data-compose-tab="objects">Objects</button>
        <button type="button" data-compose-tab="places">Places</button>
        <button type="button" data-compose-tab="residents">Residents</button>
        <button type="button" id="world-settings" aria-controls="land-panel" aria-expanded="false">Terrain</button>
        <button type="button" id="image-settings" aria-controls="image-panel" aria-expanded="false">Photo</button>
        <span class="make-count" id="compose-object-count"></span>
      </nav>
      <section data-compose-panel="objects" aria-label="Object palette">
        <div class="make-shapes">${objectKinds.map(kind => `<button type="button" class="make-shape" data-kind="${kind}"
           aria-pressed="false"><span class="shape-preview" aria-hidden="true"></span><span>${objectTitle(kind)}</span></button>`).join('')}</div>
      </section>
      <section class="make-brush" id="compose-brush" aria-label="Placement brush" hidden>
        <button type="button" id="compose-randomize">↻ <span>Randomize</span></button>
        <details id="compose-brush-advanced"><summary>Seed</summary><label class="visually-hidden" for="compose-seed">Placement seed</label>
          <input id="compose-seed" maxlength="48" autocomplete="off" spellcheck="false"></details>
      </section>
      ${placeAndResidentMarkup()}
    </div>
    <div class="make-status"><p id="compose-message" role="status"></p><span id="compose-recovery" role="status">Draft loading…</span></div>
  </div>
  <aside id="compose-object-edit" class="make-inspector" aria-label="Selected object" hidden>
    <div class="make-heading"><h2 id="compose-object-name"></h2><button type="button" id="compose-deselect" aria-label="Deselect object">×</button></div>
    <label>Rotate <output id="compose-angle-value"></output><input type="range" id="compose-angle" min="-180" max="180" step="1"></label>
    <label>Scale <output id="compose-size-value"></output><input type="range" id="compose-size" min=".25" max="4" step=".01"></label>
    <div class="make-finish" role="group" aria-label="Color and finish">Finish
      <div>${finishes.map(finish => `<button type="button" data-finish="${finish}" aria-label="${finish}" title="${finish}" style="--swatch:${swatches[finish]}"></button>`).join('')}</div>
    </div>
    <div class="make-inspector-actions"><button type="button" id="compose-object-move">Move</button>
      <button type="button" id="compose-copy">Duplicate</button><button type="button" id="compose-delete">Delete</button></div>
    <details id="compose-object-advanced"><summary>Advanced</summary>
      <div class="compose-line"><label>X<input type="number" id="compose-object-x" step=".25" min="-112" max="112"></label>
        <label>Z<input type="number" id="compose-object-z" step=".25" min="-112" max="112"></label></div>
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
