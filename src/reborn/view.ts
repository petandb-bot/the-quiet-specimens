import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { landscapeFrame, wanderFrame, followFrame, keptAboveLand } from './camera';
import type { CameraMode } from './camera';
import { PhotoEnvironment, defaultImage } from './photo';
import type { ImageSettings } from './photo';
import { inspectionPlinth } from './garden';
import { buildLandscape } from './landscape';
import { defaultLand, worldBounds } from './terrain';
import type { LandSettings } from './terrain';
import type { GardenSpecimen } from './genome';
import { GardenMotion, limitFrame, stepSeconds } from './motion';
import type { Gesture, GroundPoint } from './motion';
import { bodyPlans, buildSpecimen } from './morphology';
import type { RigGround } from './morphology';
import { GardenRelations } from './relations';

export type GardenMode = 'Observe' | 'Inspect' | 'Action';
export const worldLimit = 9;
export type { CameraMode } from './camera';
type Resident = { specimen: GardenSpecimen; rig: ReturnType<typeof buildSpecimen>; movement: GardenMotion; slot: number; ground: RigGround; terrainY: number; renderedAt: number };

export class GardenView {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private worldCamera = new T.PerspectiveCamera(40, 1, .15, 170);
  private cameraMode: CameraMode = 'Landscape';
  private focusSeed = '';
  private cameraTarget = new T.Vector3(0,1, -4);
  private photo: PhotoEnvironment;
  private imageSettings = { ...defaultImage };
  private stillCamera = false;
  private cameraClock = 0;
  private followHeading = 0;
  private worldOrbit: OrbitControls;
  private groundColor = new T.Color('#ffffff');
  private studioBackground = new T.Color('#e7e3d6');
  private clearSky = new T.Color('#ccd2c6');
  private sunColor = new T.Color('#fff0ce');
  private skyLamp: T.HemisphereLight;
  private tint = new T.Color('#c6cfc4');
  private sky = new T.Color('#c6cfc4');
  private groundNormal = new T.Vector3();
  private groundAlign = new T.Quaternion();
  private yawAlign = new T.Quaternion();
  private up = new T.Vector3(0,1,0);
  private cameraPos = new T.Vector3();
  private nextTarget = new T.Vector3();
  private key!: T.DirectionalLight;
  private worldClock = 0;
  private detailCamera = new T.PerspectiveCamera(33, 1, .08, 50);
  private orbit: OrbitControls;
  private site = new T.Group();
  private garden;
  private plinth = inspectionPlinth();
  private beings = new Map<string, Resident>();
  private motions: GardenMotion[] = [];
  private relations = new GardenRelations(defaultLand.seed);
  private study?: Resident;
  private mode: GardenMode = 'Observe';
  private paused = false;
  private available = true;
  private lastTime = 0;
  private carry = 0;
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

    this.photo = new PhotoEnvironment(this.scene);
    const skylight = new T.HemisphereLight('#fff7e7', '#ad9a79', 1.46);
    this.skyLamp = skylight;
    const key = new T.DirectionalLight('#fff0ce', 2.55);
    key.position.set(-19, 32, 19);
    this.key = key;
    key.castShadow = true;
    const shadowSize = matchMedia('(max-width: 720px)').matches ? 1024 : 2048;
    key.shadow.mapSize.set(shadowSize, shadowSize);
    key.shadow.camera.left = -33;
    key.shadow.camera.right = 33;
    key.shadow.camera.top = 33;
    key.shadow.camera.bottom = -33;
    key.shadow.camera.far = 105;
    key.shadow.bias = -.00020;
    key.shadow.normalBias = .021;
    const bounce = new T.DirectionalLight('#d2e5ee', .5);
    bounce.position.set(6, 4, -7);
    this.scene.add(skylight, key, bounce, this.site, this.plinth);
    this.garden = buildLandscape(this.scene,defaultLand);
    this.scene.background = this.sky;
    this.scene.fog = new T.Fog(this.tint, 39, 115);
    this.worldOrbit = new OrbitControls(this.worldCamera, canvas);
    this.worldOrbit.target.copy(this.cameraTarget);
    this.worldOrbit.enableDamping = true;
    this.worldOrbit.minDistance = 7;
    this.worldOrbit.maxDistance = 80;
    this.worldOrbit.maxPolarAngle = Math.PI * .485;
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
    canvas.style.touchAction = 'none';

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
    this.resetCamera();
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
    const terrain = this.garden.terrain;
    const movement = new GardenMotion(specimen.genome, anchor, solo ? [] : terrain.landmarks, radius, solo ? undefined : { bounds: worldBounds, height: terrain.height, slope: terrain.slope, points: terrain.points });
    const resident = { specimen, rig, slot, movement, ground: { height: terrain.height, floor: 0 }, terrainY: terrain.height(movement.pose.x, movement.pose.z), renderedAt: 0 };
    rig.root.userData.seed = specimen.genome.seed;
    this.pose(resident, solo);
    return resident;
  }

  private pose(resident: Resident, solo = false) {
    const pose = resident.movement.pose;
    const root = resident.rig.root;
    const plan = resident.specimen.genome.plan;
    const height = resident.ground.height;
    const floor = solo ? 0 : height(pose.x, pose.z);
    const dt = Math.max(0, pose.time - resident.renderedAt);
    resident.renderedAt = pose.time;
    resident.terrainY += (floor - resident.terrainY) * (1 - Math.exp(-dt * 4.6));
    const altitude = plan === 'VESSEL' ? Math.max(floor - .21, resident.terrainY) : floor;
    root.position.set(solo ? pose.x * .30 : pose.x, solo ? .020 : altitude + .035, solo ? pose.z * .30 : pose.z);
    if (solo || plan !== 'HINGE') root.rotation.set(0, pose.yaw, 0);
    else {
      const dx = height(pose.x + .65, pose.z) - height(pose.x - .65, pose.z);
      const dz = height(pose.x, pose.z + .65) - height(pose.x, pose.z - .65);
      this.groundNormal.set(-dx / 1.3, 1, -dz / 1.3);
      const horizontal = Math.hypot(this.groundNormal.x, this.groundNormal.z);
      if (horizontal > .48) { this.groundNormal.x *= .48 / horizontal; this.groundNormal.z *= .48 / horizontal; }
      this.groundNormal.normalize();
      this.groundAlign.setFromUnitVectors(this.up, this.groundNormal);
      this.yawAlign.setFromAxisAngle(this.up, pose.yaw);
      root.quaternion.copy(this.groundAlign).multiply(this.yawAlign);
    }
    resident.ground.floor = floor;
    resident.rig.animate(pose, solo ? undefined : resident.ground);
  }

  add(specimen: GardenSpecimen) {
    const key = specimen.genome.seed;
    if (this.has(key) || this.beings.size >= worldLimit) return false;
    const used = new Set([...this.beings.values()].map(value => value.slot));
    const anchors = this.garden.terrain.anchors;
    const slot = anchors.findIndex((_, i) => !used.has(i));
    if(slot < 0) return false;
    const item = this.resident(specimen, anchors[slot], slot);
    this.site.add(item.rig.root);
    this.beings.set(key, item);
    this.motions.push(item.movement);
    return true;
  }

  has(seed: string) { return this.beings.has(seed); }
  get count() { return this.beings.size; }
  get residents() { return Array.from(this.beings.values(), item => item.specimen); }

  remove(seed: string) {
    const item = this.beings.get(seed);
    if (!item) return false;
    item.rig.dispose();
    this.beings.delete(seed);
    this.motions = this.motions.filter(motion => motion !== item.movement);
    this.relations.remove(item.movement, this.motions);
    if (this.cameraMode === 'Follow' && this.focusSeed === seed) this.setCamera('Landscape');
    return true;
  }

  setMode(mode: GardenMode, specimen: GardenSpecimen) {
    this.mode = mode;
    this.focusSeed = specimen.genome.seed;
    const observe = mode === 'Observe';
    this.site.visible = observe;
    this.scene.background = observe ? this.sky : this.studioBackground;
    this.scene.fog = observe ? new T.Fog(this.tint, 39, 145) : null;
    this.applyImage();
    if(observe)this.key.position.set(-19,32,19);else this.key.position.set(-4.8,9.3,4.7);
    const size = observe ? 33 : 10;
    const shadow = this.key.shadow.camera;
    shadow.left=-size;shadow.right=size;shadow.top=size;shadow.bottom=-size;shadow.updateProjectionMatrix();
    this.garden.root.visible = observe;
    this.plinth.visible = !observe;
    this.orbit.enabled = !observe;
    this.worldOrbit.enabled = observe && this.cameraMode === 'Landscape';
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
      for (const item of this.beings.values()) this.pose(item);
      this.garden.animate(this.worldClock);
    }
  }

  setCamera(mode: CameraMode) {
    this.cameraMode = mode === 'Follow' && !this.beings.has(this.focusSeed) ? 'Landscape' : mode;
    this.worldOrbit.enabled = this.mode === 'Observe' && this.cameraMode === 'Landscape';
    if (this.cameraMode === 'Landscape') {
      this.worldOrbit.target.copy(this.cameraTarget);
      this.worldOrbit.update();
    }
  }

  get camera() { return this.cameraMode; }

  resetCamera() {
    this.cameraClock = 0;
    this.setCamera('Landscape');
    landscapeFrame(this.garden.terrain, this.worldCamera.aspect < 1, this.worldCamera.position, this.cameraTarget);
    this.worldCamera.zoom = 1;
    this.worldCamera.updateProjectionMatrix();
    this.worldOrbit.target.copy(this.cameraTarget);
    this.worldOrbit.update();
  }

  zoom(factor: number) {
    const lens = this.mode === 'Observe' ? this.worldCamera : this.detailCamera;
    lens.zoom = Math.min(1.9, Math.max(.66, lens.zoom * factor));
    lens.updateProjectionMatrix();
  }

  setStillCamera(still: boolean) {
    this.stillCamera = still;
    this.worldOrbit.enableDamping = !still;
    this.orbit.enableDamping = !still;
  }

  setLand(settings: LandSettings) {
    const next = buildLandscape(this.scene, settings);
    this.garden.dispose();
    this.garden = next;
    next.root.visible = this.mode === 'Observe';
    this.applyImage();
    for (const item of this.beings.values()) {
      const t = next.terrain, radius = bodyPlans[item.specimen.genome.plan].radius(item.specimen.genome);
      item.movement = new GardenMotion(item.specimen.genome, t.anchors[item.slot], t.landmarks, radius, { bounds: worldBounds, height: t.height, slope: t.slope, points: t.points });
      item.ground.height = t.height;
      item.terrainY = t.height(item.movement.pose.x, item.movement.pose.z);
      item.renderedAt = 0;
      this.pose(item);
    }
    this.motions = Array.from(this.beings.values(), item => item.movement);
    this.relations = new GardenRelations(next.terrain.settings.seed);
    this.resetCamera();
  }

  async setPhoto(file: File) {
    const loaded = await this.photo.load(file);
    if (loaded) this.applyImage();
    return loaded;
  }

  clearPhoto() {
    this.photo.clear();
    this.applyImage();
  }

  setImage(settings: ImageSettings) {
    this.imageSettings = settings;
    this.applyImage();
  }

  private applyImage() {
    const s = this.imageSettings, visible = this.mode === 'Observe';
    const strength = this.photo.loaded ? s.color : 0;
    this.sky.copy(this.clearSky).lerp(this.photo.tint, strength * .75);
    this.tint.copy(this.sky).lerp(this.photo.tint, strength * .29);
    const fog = this.scene.fog;
    if (fog instanceof T.Fog) fog.color.copy(this.tint);
    this.garden.groundMat.color.copy(this.groundColor).lerp(this.photo.tint, visible ? strength * .38 : 0);
    this.skyLamp.color.set('#fff7e7').lerp(this.photo.tint, visible ? strength * .28 : 0);
    this.key.color.copy(this.sunColor).lerp(this.photo.tint, visible ? strength * .14 : 0);
    this.garden.setBackdrop(visible && this.photo.loaded && s.mode === 'Backdrop' ? s.ground : 0);
    this.photo.apply(this.worldCamera.aspect, s, visible);
  }

  private moveCamera(dt: number) {
    const terrain = this.garden.terrain;
    if (this.cameraMode === 'Follow' && !this.beings.has(this.focusSeed)) this.setCamera('Landscape');
    if (this.cameraMode === 'Landscape') {
      const orbit = this.worldOrbit;
      orbit.update();
      orbit.target.x = Math.min(worldBounds.x, Math.max(-worldBounds.x, orbit.target.x));
      orbit.target.z = Math.min(worldBounds.z, Math.max(-worldBounds.z, orbit.target.z));
      orbit.target.y = Math.max(terrain.height(orbit.target.x, orbit.target.z) + .42, orbit.target.y);
      this.worldCamera.position.y = keptAboveLand(this.worldCamera.position, terrain);
      this.cameraTarget.copy(orbit.target);
      this.worldCamera.lookAt(this.cameraTarget);
      return;
    }
    if (this.stillCamera && this.cameraMode === 'Wander') return;
    const elapsed = Math.min(dt, .1);
    this.cameraClock += elapsed;
    const pos = this.cameraPos, target = this.nextTarget;
    const resident = this.beings.get(this.focusSeed);
    if (resident && this.cameraMode === 'Follow') {
      const p = resident.movement.pose, delta = p.yaw - this.followHeading;
      this.followHeading += Math.atan2(Math.sin(delta), Math.cos(delta)) * (1 - Math.exp(-elapsed * .58));
      followFrame(p, this.followHeading, terrain, pos, target);
    } else wanderFrame(this.cameraClock, terrain, pos, target);
    pos.y = keptAboveLand(pos, terrain, target);
    const k = 1 - Math.exp(-elapsed * (this.stillCamera ? .64 : 1.35));
    this.worldCamera.position.lerp(pos, k);
    this.worldCamera.position.y = keptAboveLand(this.worldCamera.position, terrain);
    this.cameraTarget.lerp(target, k);
    this.worldCamera.lookAt(this.cameraTarget);
  }
  setPaused(paused: boolean) { this.paused = paused; }
  perform(action: Gesture) { this.study?.movement.perform(action); }
  getPose(seed: string) { return this.mode === 'Observe' ? this.beings.get(seed)?.movement.pose : this.study?.movement.pose; }

  private resize() {
    const { clientWidth, clientHeight } = this.host;
    const width = Math.max(1, clientWidth), height = Math.max(1, clientHeight);
    const aspect = width / height;
    const portrait = aspect < 1;
    const world = this.worldCamera;
    world.aspect=aspect;world.fov=portrait?53:40;world.updateProjectionMatrix();
    this.photo.apply(aspect, this.imageSettings, this.mode === 'Observe');
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
      for (let i = 0; i < steps; i++) {
        for (const motion of this.motions) motion.step(stepSeconds, this.motions);
        this.relations.step(stepSeconds, this.motions);
        this.study?.movement.step();
      }
      this.worldClock += steps * stepSeconds;
      if (observe) {
        for (const item of this.beings.values()) this.pose(item);
        this.garden.animate(this.worldClock);
      } else if (this.study) this.pose(this.study, true);
    }
    if (!observe) this.orbit.update();
    else this.moveCamera(delta);
    this.onFrame();
    this.renderer.render(this.scene, observe ? this.worldCamera : this.detailCamera);
  };
}
