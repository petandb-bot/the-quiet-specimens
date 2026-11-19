import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { anchors, buildGarden, gardenObstacles, inspectionPlinth } from './garden';
import type { GardenSpecimen } from './genome';
import { GardenMotion, limitFrame, stepSeconds } from './motion';
import type { Gesture, GroundPoint } from './motion';
import { bodyPlans, buildSpecimen } from './morphology';

export type GardenMode = 'Observe' | 'Inspect' | 'Action';
export const worldLimit = anchors.length;
type Resident = { specimen: GardenSpecimen; rig: ReturnType<typeof buildSpecimen>; movement: GardenMotion; slot: number };

export class GardenView {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private worldCamera = new T.OrthographicCamera(-8, 8, 5, -5, .1, 85);
  private detailCamera = new T.PerspectiveCamera(33, 1, .08, 50);
  private orbit: OrbitControls;
  private site = new T.Group();
  private garden;
  private plinth = inspectionPlinth();
  private beings = new Map<string, Resident>();
  private study?: Resident;
  private mode: GardenMode = 'Observe';
  private paused = false;
  private available = true;
  private lastTime = 0;
  private carry = 0;
  private clock = 0;
  private press?: { x: number; y: number; id: number };
  private ray = new T.Raycaster();
  private cursor = new T.Vector2();
  private environment: T.WebGLRenderTarget;
  private observer: ResizeObserver;

  constructor(
    private host: HTMLElement,
    private onSelect: (item: GardenSpecimen) => void,
    private onFrame: () => void,
    private onError: (error: string) => void,
  ) {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('This study needs a browser with WebGL 2.');
    this.renderer = new T.WebGLRenderer({ canvas, context: gl, alpha: false, antialias: true });
    this.renderer.setClearColor('#e7e3d6');
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.10;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    canvas.setAttribute('aria-label', 'Interactive three-dimensional artificial life garden');
    this.host.append(canvas);
    this.environment = this.reflections();
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = .50;

    const skylight = new T.HemisphereLight('#fff7e7', '#ad9a79', 1.46);
    const key = new T.DirectionalLight('#fff0ce', 2.55);
    key.position.set(-4.8, 9.3, 4.7);
    key.castShadow = true;
    const shadowSize = matchMedia('(max-width: 720px)').matches ? 1024 : 2048;
    key.shadow.mapSize.set(shadowSize, shadowSize);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 9;
    key.shadow.camera.bottom = -8;
    key.shadow.camera.far = 26;
    key.shadow.bias = -.00020;
    key.shadow.normalBias = .021;
    const bounce = new T.DirectionalLight('#d2e5ee', .5);
    bounce.position.set(6, 4, -7);
    this.scene.add(skylight, key, bounce, this.site, this.plinth);
    this.garden = buildGarden(this.scene);
    this.garden.root.add(this.site);
    this.worldCamera.position.set(8.9, 8.6, 11.7);
    this.worldCamera.lookAt(.02, .38, .13);
    this.detailCamera.position.set(3.8, 2.7, 5.1);
    this.orbit = new OrbitControls(this.detailCamera, canvas);
    this.orbit.target.set(0, .98, 0);
    this.orbit.enablePan = false;
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = .09;
    this.orbit.minDistance = 2.65;
    this.orbit.maxDistance = 13;
    this.orbit.maxPolarAngle = Math.PI * .53;
    this.orbit.enabled = false;
    this.orbit.update();
    canvas.style.touchAction = 'manipulation';

    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.available = false;
      this.onError('The graphics context paused. Waiting for the garden to reconnect…');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.environment.dispose();
      this.environment = this.reflections();
      this.scene.environment = this.environment.texture;
      this.available = true;
      this.onError('');
    });
    canvas.addEventListener('pointerdown', event => {
      this.press = event.isPrimary && event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : undefined;
    });
    canvas.addEventListener('pointermove', event => {
      if (this.press?.id === event.pointerId && Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y) > 10) this.press = undefined;
    });
    canvas.addEventListener('pointercancel', () => { this.press = undefined; });
    canvas.addEventListener('pointerup', event => {
      const start = this.press;
      this.press = undefined;
      if (!start || event.pointerId !== start.id || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
      const rect = canvas.getBoundingClientRect();
      this.cursor.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
      const residents = this.mode === 'Observe' ? [...this.beings.values()] : this.study ? [this.study] : [];
      this.ray.setFromCamera(this.cursor, this.mode === 'Observe' ? this.worldCamera : this.detailCamera);
      const hit = this.ray.intersectObjects(residents.map(item => item.rig.root))[0];
      let object = hit?.object ?? null;
      while (object?.parent && !object.userData.seed) object = object.parent;
      const resident = residents.find(item => item.specimen.genome.seed === object?.userData.seed);
      if (resident) {
        resident.movement.react();
        this.onSelect(resident.specimen);
      }
    });

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.renderer.setAnimationLoop(this.frame);
  }

  private reflections() {
    const pmrem = new T.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const result = pmrem.fromScene(room, .10);
    pmrem.dispose();
    room.dispose();
    return result;
  }

  private resident(specimen: GardenSpecimen, anchor: GroundPoint, slot: number, solo = false): Resident {
    const rig = buildSpecimen(specimen.genome);
    const radius = bodyPlans[specimen.genome.plan].radius(specimen.genome);
    const movement = new GardenMotion(specimen.genome, anchor, solo ? [] : gardenObstacles, radius);
    const resident = { specimen, rig, slot, movement };
    rig.root.userData.seed = specimen.genome.seed;
    this.pose(resident, solo);
    return resident;
  }

  private pose(resident: Resident, solo = false) {
    const pose = resident.movement.pose;
    const root = resident.rig.root;
    root.position.set(solo ? pose.x * .30 : pose.x, .020, solo ? pose.z * .30 : pose.z);
    root.rotation.y = pose.yaw;
    resident.rig.animate(pose);
  }

  add(specimen: GardenSpecimen) {
    const key = specimen.genome.seed;
    if (this.has(key) || this.beings.size >= worldLimit) return false;
    const used = new Set([...this.beings.values()].map(value => value.slot));
    const slot = anchors.findIndex((_, i) => !used.has(i));
    const item = this.resident(specimen, anchors[slot], slot);
    this.site.add(item.rig.root);
    this.beings.set(key, item);
    return true;
  }

  has(seed: string) { return this.beings.has(seed); }
  get count() { return this.beings.size; }

  remove(seed: string) {
    const item = this.beings.get(seed);
    if (!item) return false;
    item.rig.dispose();
    this.beings.delete(seed);
    return true;
  }

  setMode(mode: GardenMode, specimen: GardenSpecimen) {
    this.mode = mode;
    const observe = mode === 'Observe';
    this.garden.root.visible = observe;
    this.plinth.visible = !observe;
    this.orbit.enabled = !observe;
    this.renderer.domElement.style.touchAction = observe ? 'manipulation' : 'none';
    if (!observe && this.study?.specimen.genome.seed !== specimen.genome.seed) {
      this.study?.rig.dispose();
      const item = this.resident(specimen, [0, 0], -1, true);
      this.plinth.add(item.rig.root);
      this.study = item;
      this.detailCamera.position.set(3.26, 2.38, 4.8);
      this.orbit.target.set(0, .93, 0);
      this.orbit.update();
    }
    if (observe && this.study) {
      this.study.rig.dispose();
      this.study = undefined;
    }
  }

  setPaused(paused: boolean) { this.paused = paused; }
  perform(action: Gesture) { this.study?.movement.perform(action); }
  getPose(seed: string) { return this.mode === 'Observe' ? this.beings.get(seed)?.movement.pose : this.study?.movement.pose; }

  private resize() {
    const { clientWidth, clientHeight } = this.host;
    const width = Math.max(1, clientWidth), height = Math.max(1, clientHeight);
    const aspect = width / height;
    const portrait = aspect < 1;
    const fullHeight = Math.max(12.55, (portrait ? 12.65 : 15.15) / aspect);
    const frameRise = -fullHeight * .037;
    const world = this.worldCamera;
    world.left = -fullHeight * aspect / 2;
    world.right = -world.left;
    world.top = fullHeight / 2 + frameRise;
    world.bottom = -fullHeight / 2 + frameRise;
    world.updateProjectionMatrix();
    this.detailCamera.aspect = aspect;
    this.detailCamera.fov = portrait ? Math.min(61, 34 / aspect) : 33;
    this.detailCamera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, portrait ? 1.5 : 1.75));
    this.renderer.setSize(width, height, false);
  }

  private frame = (ms: number) => {
    const delta = this.lastTime ? (ms - this.lastTime) / 1000 : 0;
    this.lastTime = ms;
    if (!this.available || document.hidden) return;
    const { steps, remainder } = limitFrame(delta, this.carry);
    this.carry = remainder;
    const observe = this.mode === 'Observe';
    if (!this.paused && steps) {
      const active = observe ? this.beings.values() : this.study ? [this.study] : [];
      this.clock += steps * stepSeconds;
      for (const item of active) {
        for (let i = 0; i < steps; i++) item.movement.step();
        this.pose(item, !observe);
      }
      if (observe) this.garden.animate(this.clock);
    }
    if (!observe) this.orbit.update();
    this.onFrame();
    this.renderer.render(this.scene, observe ? this.worldCamera : this.detailCamera);
  };
}
