import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { boundLandscapePan, captureView, landscapeFrame, residentFrame, showView, SoftFollow } from './camera';
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
import { ArrangeScene } from './composer/scene';
import { MakeCamera } from './composer/camera';
import type { MakeView } from './composer/camera';
import type { Marker } from './composer/scene';
import type { WorldDocument, WorldResident } from './world/document';
import { safePosition, worldField } from './world/runtime';
import { placeCenter } from './world/document';
import type { WorldObject } from './world/document';
import { Observatory, observationStations } from './observation/tour';
import { artifactThumbnail, thumbnail } from './observation/thumbnail';
import { RecentMoments } from './observation/moments';
import type { WorldMoment } from './observation/moments';

export type GardenMode = 'Observe' | 'Inspect' | 'Action';
export const worldLimit = 9;
export type { CameraMode } from './camera';
type Resident = { specimen: GardenSpecimen; rig: ReturnType<typeof buildSpecimen>; movement: GardenMotion; slot: number; ground: RigGround; terrainY: number; renderedAt: number };

export class GardenView {
  private renderer: T.WebGLRenderer;
  private arranger: ArrangeScene;
  private arranging?: MakeView;
  private makeCamera = new MakeCamera();
  private editCameraReady = false;
  private activeWorld?: WorldDocument;
  private field?: ReturnType<typeof worldField>;
  private scene = new T.Scene();
  private worldCamera = new T.PerspectiveCamera(40, 1, .15, 170);
  private cameraMode: CameraMode = 'Fixed';
  private focusSeed = '';
  private cameraTarget = new T.Vector3(0,1, -4);
  private photo: PhotoEnvironment;
  private imageSettings = { ...defaultImage };
  private stillCamera = true;
  private followSeed = '';
  private follow = new SoftFollow();
  private subject = new T.Vector3();
  private observatory = new Observatory();
  private stationName = '';
  private marked?: { seed: string; until: number };
  private markersAt = -Infinity;
  private thumbnails = new Map<string, string>();
  private moments = new RecentMoments();
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
    this.arranger = new ArrangeScene(canvas, this.scene);
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
    this.worldOrbit.enableDamping = false;
    this.worldOrbit.enabled = false;
    this.worldOrbit.dampingFactor = .27;
    this.worldOrbit.zoomSpeed = .47;
    this.worldOrbit.rotateSpeed = .62;
    this.worldOrbit.minDistance = 7;
    this.worldOrbit.maxDistance = 80;
    this.worldOrbit.maxPolarAngle = Math.PI * .485;
    this.detailCamera.position.set(3.8, 2.7, 5.1);
    this.orbit = new OrbitControls(this.detailCamera, canvas);
    this.orbit.target.set(0, .98, 0);
    this.orbit.enablePan = false;
    this.orbit.enableDamping = false;
    this.orbit.dampingFactor = .27;
    this.orbit.zoomSpeed = .48;
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
      this.thumbnails.clear();
      this.onError('');
    });
    canvas.addEventListener('pointerdown', event => {
      if (this.arranging) return;
      this.press = event.isPrimary && event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : undefined;
    });
    canvas.addEventListener('pointermove', event => {
      if (this.press?.id === event.pointerId && Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y) > 10) this.press = undefined;
    });
    canvas.addEventListener('pointercancel', () => { this.press = undefined; });
    canvas.addEventListener('pointerup', event => {
      if (this.arranging) return;
      const start = this.press;
      this.press = undefined;
      if (!start || event.pointerId !== start.id || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
      if (this.cameraMode === 'Atlas' && this.mode === 'Observe') {
        const hit = this.arranger.hit(event.clientX, event.clientY, this.arranger.plan, this.garden.ground, []);
        if (hit.ground) {
          const [x, z] = hit.ground;
          let best = 2.45;
          let chosen: Resident | undefined;
          for (const resident of this.beings.values()) {
            const pose = resident.movement.pose;
            const distance = Math.hypot(pose.x - x, pose.z - z);
            if (distance < best) { chosen = resident; best = distance; }
          }
          if (chosen) { this.locate(chosen.specimen.genome.seed); this.onSelect(chosen.specimen); }
        }
        return;
      }
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
    const movement = new GardenMotion(specimen.genome, anchor, solo ? [] : this.field?.obstacles ?? terrain.landmarks, radius,
      solo ? undefined : this.field?.field ?? { bounds: worldBounds, height: terrain.height, slope: terrain.slope, points: terrain.points });
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

  add(specimen: GardenSpecimen, arrangement?: WorldResident) {
    const key = specimen.genome.seed;
    if (this.has(key) || this.beings.size >= worldLimit) return false;
    const anchors = this.garden.terrain.anchors;
    const slot = this.freeSlot();
    if(slot < 0) return false;
    const point = arrangement?.start ?? arrangement?.home ?? anchors[slot];
    const safe = this.activeWorld ? safePosition(point, specimen, this.garden.terrain, this.activeWorld) : point;
    if (!safe) return false;
    const item = this.resident(specimen, safe, slot);
    if (arrangement?.home || arrangement?.preferred) this.updateResident(item, arrangement, false);
    this.site.add(item.rig.root);
    this.beings.set(key, item);
    this.motions.push(item.movement);
    return true;
  }

  get terrain() { return this.garden.terrain; }
  get canvas() { return this.renderer.domElement; }
  get canPlaceResidents() { return this.beings.size < worldLimit; }
  canJoin(specimen: GardenSpecimen) {
    const slot = this.freeSlot();
    return slot >= 0 && Boolean(this.canPlace(this.garden.terrain.anchors[slot], specimen));
  }
  private freeSlot() {
    const used = new Set(Array.from(this.beings.values(), item => item.slot));
    return this.garden.terrain.anchors.findIndex((_, index) => !used.has(index));
  }
  canPlace(point: GroundPoint, specimen: GardenSpecimen) {
    return this.activeWorld && safePosition(point, specimen, this.garden.terrain, this.activeWorld);
  }

  applyWorld(world: WorldDocument) {
    const previous = this.activeWorld;
    const terrainChanged = previous && previous.land !== world.land;
    this.activeWorld = world;
    if (terrainChanged) this.setLand(world.land);
    if (!previous || terrainChanged || previous.objects !== world.objects || previous.places !== world.places) {
      const terrain = this.garden.terrain;
      this.field = worldField(world, terrain);
      terrain.landmarks = [...world.objects];
      terrain.points = this.field.points;
      this.garden.objects.update(world.objects);
      for (const item of this.beings.values()) item.movement.updateEnvironment(this.field.obstacles, this.field.field);
    }
    if (!previous || terrainChanged || previous.residents !== world.residents) {
      const seeds = new Set(world.residents.map(item => item.specimen.genome.seed));
      for (const key of this.beings.keys()) if (!seeds.has(key)) this.remove(key);
      for (const resident of world.residents) {
        const key = resident.specimen.genome.seed;
        const current = this.beings.get(key);
        const last = previous?.residents.find(item => item.specimen.genome.seed === key);
        if (!current) this.add(resident.specimen, resident);
        else if (terrainChanged || resident !== last) this.updateResident(current, resident, Boolean(terrainChanged || resident.start !== last?.start));
      }
    }
    if (!previous || previous.image !== world.image) this.setImage(world.image);
  }

  private updateResident(item: Resident, arrangement: WorldResident, move: boolean) {
    const { start, home, preferred } = arrangement;
    const anchor = this.garden.terrain.anchors[item.slot];
    const homePosition = this.canPlace(home ?? start ?? anchor, item.specimen);
    const preference = preferred && this.canPlace(preferred, item.specimen);
    const destination = move ? this.canPlace(start ?? home ?? anchor, item.specimen) : undefined;
    item.movement.updateHabitat(homePosition, preference, destination);
    if (destination) item.terrainY = this.garden.terrain.height(...destination);
    this.pose(item);
  }

  setArrange(mode?: MakeView) {
    this.arranging = mode;
    if (mode && !this.editCameraReady) this.resetMakeCamera();
    this.syncOrbit();
    if (this.mode === 'Observe') this.scene.fog = this.isPlanView ? null : new T.Fog(this.tint, 39, 145);
    this.arrangeMarkers([]);
    if (!mode) {
      this.garden.objects.draft();
      this.garden.objects.drag();
      this.updateMarkers(0);
    }
    this.applyImage();
  }

  resetMakeCamera() {
    this.editCameraReady = true;
    this.makeCamera.reset(this.garden.terrain);
  }

  navigateMake(action: 'orbit' | 'pan' | 'zoom', x: number, y = 0) {
    if (!this.arranging) return;
    if (action === 'zoom') this.makeCamera.zoom(this.arranging, x);
    else this.makeCamera[action](this.arranging, x, y, Math.max(1, this.canvas.clientHeight), this.garden.terrain);
  }

  objectThumbnail(object: WorldObject) {
    if (!this.available) return '';
    try { return artifactThumbnail(this.renderer, object, this.environment.texture); }
    catch { return ''; }
  }

  arrangeMarkers(markers: readonly Marker[]) {
    const area: Marker = { center: [0, 0], radius: worldBounds.x, color: '#6a7867', square: true };
    this.arranger.update(this.arranging === 'Plan' ? [area, ...markers] : markers, this.garden.terrain.height, Boolean(this.arranging));
  }
  arrangeDraft(item?: WorldObject) { this.garden.objects.draft(item); }
  hideArrangeDraft() { this.garden.objects.hideDraft(); }
  arrangeDrag(item?: WorldObject) { this.garden.objects.drag(item); }
  arrangeHit(x: number, y: number, objects: boolean) {
    return this.arranger.hit(x, y, this.arranging ? this.makeCamera.get(this.arranging) : this.worldCamera,
      this.garden.ground, objects ? this.garden.objects.groups() : []);
  }

  has(seed: string) { return this.beings.has(seed); }
  get count() { return this.beings.size; }
  get residents() { return Array.from(this.beings.values(), item => item.specimen); }

  remove(seed: string) {
    const item = this.beings.get(seed);
    if (!item) return false;
    item.rig.dispose();
    this.beings.delete(seed);
    this.thumbnails.delete(seed);
    this.motions = this.motions.filter(motion => motion !== item.movement);
    this.relations.remove(item.movement, this.motions);
    if (this.cameraMode === 'Soft Follow' && this.followSeed === seed) this.setCamera('Fixed');
    return true;
  }

  setMode(mode: GardenMode, specimen: GardenSpecimen) {
    this.mode = mode;
    this.focusSeed = specimen.genome.seed;
    const observe = mode === 'Observe';
    this.site.visible = observe;
    this.scene.background = observe ? this.sky : this.studioBackground;
    this.scene.fog = observe && !this.isPlanView ? new T.Fog(this.tint, 39, 145) : null;
    this.applyImage();
    if(observe)this.key.position.set(-19,32,19);else this.key.position.set(-4.8,9.3,4.7);
    const size = observe ? 33 : 10;
    const shadow = this.key.shadow.camera;
    shadow.left=-size;shadow.right=size;shadow.top=size;shadow.bottom=-size;shadow.updateProjectionMatrix();
    this.garden.root.visible = observe;
    this.plinth.visible = !observe;
    if (!observe) this.arranger.update([], this.garden.terrain.height, false);
    else if (!this.arranging) this.updateMarkers(0);
    this.orbit.enabled = !observe;
    this.syncOrbit();
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

  setCamera(mode: CameraMode, seed = this.focusSeed) {
    if (mode === 'Soft Follow') {
      const resident = this.beings.get(seed);
      if (resident) {
        const p = resident.movement.pose;
        residentFrame(this.garden.terrain, [p.x, p.z], this.worldCamera, this.cameraTarget);
        this.followSeed = seed;
        this.follow.reset();
      } else mode = 'Fixed';
    }
    this.cameraMode = mode;
    if (mode === 'Observatory') {
      const homes = Array.from(this.beings.values(), item => item.movement.territory?.home ?? [0, 0] as GroundPoint);
      this.observatory.load(observationStations(this.garden.terrain, this.worldCamera.aspect < 1, homes));
      this.showStation(this.observatory.station);
    }
    this.marked = undefined;
    if (!this.arranging) this.updateMarkers(0);
    if (this.mode === 'Observe') this.scene.fog = this.isPlanView ? null : new T.Fog(this.tint, 39, 145);
    this.applyImage();
    this.syncOrbit();
  }

  private get isPlanView() { return this.arranging === 'Plan' || (!this.arranging && this.cameraMode === 'Atlas'); }
  get observationStation() { return this.cameraMode === 'Observatory' ? this.stationName : ''; }
  setObservationAuto(value: boolean) { this.observatory.auto = value; }
  nextStation(direction: number) { if (this.cameraMode === 'Observatory') this.showStation(this.observatory.step(direction)); }

  private showStation(station: Observatory['station']) {
    if (!station) return;
    showView(this.worldCamera, this.cameraTarget, {
      ...station, zoom: this.worldCamera.zoom, fov: this.worldCamera.fov,
    });
    this.stationName = station.name;
  }

  residentPose(seed: string) { return this.beings.get(seed)?.movement.pose; }

  residentThumbnail(item: GardenSpecimen) {
    const seed = item.genome.seed;
    if (!this.thumbnails.has(seed) && this.available) {
      try { this.thumbnails.set(seed, thumbnail(this.renderer, item, this.environment.texture)); }
      catch { return ''; }
    }
    return this.thumbnails.get(seed) ?? '';
  }

  locate(seed: string) {
    const pose = this.residentPose(seed);
    if (!pose) return false;
    if (this.cameraMode !== 'Atlas') {
      this.setCamera('Fixed');
      const terrain = this.garden.terrain;
      const position = this.subject.set(pose.x, terrain.height(pose.x, pose.z) + 1, pose.z).project(this.worldCamera);
      if (Math.abs(position.x) > .77 || Math.abs(position.y) > .72 || Math.abs(position.z) > 1) {
        residentFrame(terrain, [pose.x, pose.z], this.worldCamera, this.cameraTarget);
      }
    }
    this.marked = { seed, until: performance.now() + 5200 };
    this.updateMarkers(performance.now());
    return true;
  }

  clearLocate() {
    this.marked = undefined;
    if (this.cameraMode === 'Atlas') this.setCamera('Fixed');
    else if (!this.arranging) this.updateMarkers(0);
  }

  private updateMarkers(ms: number) {
    const atlas = this.cameraMode === 'Atlas';
    const now = performance.now();
    if (this.marked && now > this.marked.until) this.marked = undefined;
    const markers: Marker[] = [];
    if (atlas) {
      markers.push({ center: [0, 0], radius: worldBounds.x, color: '#6a7867', square: true });
      markers.push({ center: [this.cameraTarget.x, this.cameraTarget.z], radius: 2.4, color: '#2a5478', selected: true, square: true });
      for (const zone of this.activeWorld?.places ?? []) if (zone.enabled) markers.push({
        center: placeCenter(zone, this.activeWorld!.objects), radius: zone.radius, color: '#6b5170',
      });
      for (const item of this.garden.terrain.landmarks) if (!item.distant && item.scale > 1.35) {
        markers.push({ center: [item.x, item.z], radius: item.radius + .2, color: '#635747' });
      }
    }
    if (atlas || this.marked) {
      for (const [seed, item] of this.beings) {
        const selected = this.marked?.seed === seed;
        if (!atlas && !selected) continue;
        const p = item.movement.pose;
        markers.push({ center: [p.x, p.z], radius: selected ? 1.7 : 1.0,
          color: selected ? '#b13721' : '#3d5c50', selected });
      }
    }
    this.markersAt = ms;
    this.arranger.update(markers, this.garden.terrain.height, markers.length > 0);
  }

  private syncOrbit() {
    const controls = this.worldOrbit;
    const enabled = this.mode === 'Observe' && this.cameraMode === 'Landscape' && !this.arranging;
    if (enabled && !controls.enabled) {
      const frame = captureView(this.worldCamera, this.cameraTarget);
      controls.enableDamping = false;
      controls.update();
      showView(this.worldCamera, this.cameraTarget, frame);
      controls.target.copy(this.cameraTarget);
      controls.enableDamping = !this.stillCamera;
      controls.update();
    }
    controls.enabled = enabled;
  }

  get camera() { return this.cameraMode; }

  resetCamera() {
    this.follow.reset();
    if (!this.arranging) this.setCamera('Fixed');
    landscapeFrame(this.garden.terrain, this.worldCamera.aspect < 1, this.worldCamera.position, this.cameraTarget);
    boundLandscapePan(this.worldCamera.position, this.cameraTarget, this.garden.terrain);
    this.worldCamera.zoom = 1;
    this.worldCamera.fov = this.worldCamera.aspect < 1 ? 53 : 40;
    this.worldCamera.updateProjectionMatrix();
    this.worldCamera.lookAt(this.cameraTarget);
    this.worldCamera.updateMatrixWorld();
    this.worldOrbit.target.copy(this.cameraTarget);
  }

  zoom(factor: number) {
    if (this.mode === 'Observe' && this.isPlanView) return;
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
    this.field = this.activeWorld ? worldField(this.activeWorld, next.terrain) : undefined;
    this.garden.dispose();
    this.garden = next;
    next.root.visible = this.mode === 'Observe';
    this.applyImage();
    for (const item of this.beings.values()) {
      const t = next.terrain, radius = bodyPlans[item.specimen.genome.plan].radius(item.specimen.genome);
      item.movement = new GardenMotion(item.specimen.genome, t.anchors[item.slot], this.field?.obstacles ?? t.landmarks, radius, this.field?.field ?? { bounds: worldBounds, height: t.height, slope: t.slope, points: t.points });
      item.ground.height = t.height;
      item.terrainY = t.height(item.movement.pose.x, item.movement.pose.z);
      item.renderedAt = 0;
      this.pose(item);
    }
    this.motions = Array.from(this.beings.values(), item => item.movement);
    this.relations = new GardenRelations(next.terrain.settings.seed);
    this.moments.clear();
    if (this.arranging) this.resetMakeCamera();
    else this.resetCamera();
  }

  async setPhoto(file: Blob) {
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
    const backdrop = visible && !this.isPlanView;
    this.sky.copy(this.clearSky).lerp(this.photo.tint, strength * .75);
    this.tint.copy(this.sky).lerp(this.photo.tint, strength * .29);
    const fog = this.scene.fog;
    if (fog instanceof T.Fog) fog.color.copy(this.tint);
    this.garden.groundMat.color.copy(this.groundColor).lerp(this.photo.tint, visible ? strength * .38 : 0);
    this.skyLamp.color.set('#fff7e7').lerp(this.photo.tint, visible ? strength * .28 : 0);
    this.key.color.copy(this.sunColor).lerp(this.photo.tint, visible ? strength * .14 : 0);
    this.garden.setBackdrop(backdrop && this.photo.loaded && s.mode === 'Backdrop' ? s.ground : 0);
    this.photo.apply(this.worldCamera.aspect, s, backdrop);
  }

  private moveCamera(dt: number) {
    const terrain = this.garden.terrain;
    if (this.cameraMode === 'Landscape' && this.worldOrbit.enabled) {
      const orbit = this.worldOrbit;
      orbit.update();
      boundLandscapePan(this.worldCamera.position, orbit.target, terrain);
      this.cameraTarget.copy(orbit.target);
      return;
    }
    if (this.cameraMode === 'Observatory') this.showStation(this.observatory.advance(dt));
    if (this.cameraMode !== 'Soft Follow') return;
    const pose = this.beings.get(this.followSeed)?.movement.pose;
    if (!pose) { this.setCamera('Fixed'); return; }
    this.subject.set(pose.x, terrain.height(pose.x, pose.z) + 1, pose.z);
    this.follow.advance(dt, this.worldCamera, this.cameraTarget, this.subject, terrain, this.stillCamera);
  }
  soundPresence(seed: string) {
    const pose = this.beings.get(seed)?.movement.pose;
    return { x: pose?.x ?? 0, z: pose?.z ?? 0, resting: pose?.phase === 'Rest' || this.paused,
      gathering: pose?.intent === 'Gather' };
  }

  soundPoints() { return this.garden.terrain.points; }
  soundEvents() { return this.relations.events.filter(event => this.relations.time - event.at < 2.6); }

  recentMoments(): readonly WorldMoment[] {
    return [...this.moments.recent(this.worldClock), ...this.relations.events
      .filter(event => event.kind !== 'Follow')
      .map(event => ({ ...event, kind: event.kind === 'Imitation' ? 'Imitation' as const : 'Encounter' as const,
        at: this.worldClock - this.relations.time + event.at }))]
      .sort((a, b) => b.at - a.at).slice(0, 8);
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
    world.aspect = aspect; world.updateProjectionMatrix();
    this.arranger.resize(aspect);
    this.makeCamera.resize(aspect);
    this.applyImage();
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
    if (!this.paused && !this.arranging && steps) {
      for (let i = 0; i < steps; i++) {
        for (const motion of this.motions) motion.step(stepSeconds, this.motions);
        this.relations.step(stepSeconds, this.motions);
        for (const motion of this.motions) {
          const seen = motion.takeMoment();
          if (seen) this.moments.add({ ...seen, actor: motion.seed, at: this.worldClock + (i + 1) * stepSeconds });
        }
        this.study?.movement.step();
      }
      this.worldClock += steps * stepSeconds;
      if (observe) {
        for (const item of this.beings.values()) this.pose(item);
        this.garden.animate(this.worldClock);
      } else if (this.study) this.pose(this.study, true);
    }
    if (!observe) this.orbit.update();
    else if (!this.arranging && !this.isPlanView) this.moveCamera(delta);
    if (observe && !this.arranging && (this.cameraMode === 'Atlas' || this.marked) && ms - this.markersAt > 130) this.updateMarkers(ms);
    this.onFrame();
    const camera = this.arranging ? this.makeCamera.get(this.arranging) : this.isPlanView ? this.arranger.plan : this.worldCamera;
    this.renderer.render(this.scene, observe ? camera : this.detailCamera);
  };
}
