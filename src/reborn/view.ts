import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { inspectionPlinth } from './garden';
import { buildLandscape } from './landscape';
import { defaultLand, worldBounds } from './terrain';
import type { LandSettings } from './terrain';
import type { GardenSpecimen } from './genome';
import { GardenMotion, limitFrame, stepSeconds } from './motion';
import type { Gesture, GroundPoint } from './motion';
import { bodyPlans, buildSpecimen } from './morphology';

export type GardenMode = 'Observe' | 'Inspect' | 'Action';
export const worldLimit = 9;
export type CameraMode = 'Landscape' | 'Wander' | 'Follow';
type Resident = { specimen: GardenSpecimen; rig: ReturnType<typeof buildSpecimen>; movement: GardenMotion; slot: number };

export class GardenView {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private worldCamera = new T.PerspectiveCamera(40, 1, .15, 170);
  private cameraMode: CameraMode = 'Landscape';
  private focusSeed = '';
  private cameraTarget = new T.Vector3(0,1, -4);
  private photo?: T.CanvasTexture;
  private photoAspect = 1;
  private photoRequest = 0;
  private tint = new T.Color('#c6cfc4');
  private sky = new T.Color('#ced8d3');
  private key!: T.DirectionalLight;
  private worldClock = 0;
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
    this.worldCamera.position.set(17, 13, 36);
    this.worldCamera.lookAt(this.cameraTarget);
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
    const terrain = this.garden.terrain;
    const movement = new GardenMotion(specimen.genome, anchor, solo ? [] : terrain.landmarks, radius, solo ? undefined : { bounds:worldBounds, height:terrain.height, slope:terrain.slope });
    const resident = { specimen, rig, slot, movement };
    rig.root.userData.seed = specimen.genome.seed;
    this.pose(resident, solo);
    return resident;
  }

  private pose(resident: Resident, solo = false) {
    const pose = resident.movement.pose;
    const root = resident.rig.root;
    root.position.set(solo ? pose.x * .30 : pose.x, solo ? .020 : this.garden.terrain.height(pose.x,pose.z) + .035, solo ? pose.z * .30 : pose.z);
    root.rotation.y = pose.yaw;
    resident.rig.animate(pose);
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
    this.focusSeed = specimen.genome.seed;
    const observe = mode === 'Observe';
    this.site.visible = observe;
    this.scene.background = observe ? this.photo ?? this.sky : new T.Color('#e7e3d6');
    this.scene.fog = observe ? new T.Fog(this.tint,39,115) : null;
    if(observe)this.key.position.set(-19,32,19);else this.key.position.set(-4.8,9.3,4.7);
    const size = observe ? 33 : 10;
    const shadow = this.key.shadow.camera;
    shadow.left=-size;shadow.right=size;shadow.top=size;shadow.bottom=-size;shadow.updateProjectionMatrix();
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

  setCamera(mode: CameraMode) { this.cameraMode = mode; }
  setLand(settings: LandSettings) {
    const next = buildLandscape(this.scene,settings);
    const old = this.garden;
    this.garden = next;
    old.dispose();
    next.root.visible = this.mode === 'Observe';
    next.groundMat.color.copy(this.photo ? this.tint.clone().lerp(new T.Color('#ffffff'),.67) : new T.Color('#ffffff'));
    for(const item of this.beings.values()){
      const t=next.terrain, radius=bodyPlans[item.specimen.genome.plan].radius(item.specimen.genome);
      item.movement=new GardenMotion(item.specimen.genome,t.anchors[item.slot],t.landmarks,radius,{bounds:worldBounds,height:t.height,slope:t.slope});
      this.pose(item);
    }
    this.worldCamera.position.set(17,13,36);this.cameraTarget.set(0,1,-4);this.worldClock=0;
    this.worldCamera.lookAt(this.cameraTarget);
  }
  async setPhoto(file: File) {
    const request=++this.photoRequest;
    if(file.size>20*1024*1024) throw new Error('Choose an image smaller than 20 MB.');
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();
      await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('This image could not be decoded.'));image.src=url;});
      if(request!==this.photoRequest)return;
      if(!image.naturalWidth || !image.naturalHeight)throw new Error('Empty image.');
      const s=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*s));canvas.height=Math.max(1,Math.round(image.naturalHeight*s));
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image canvas unavailable.');
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const pixels=ctx.getImageData(0,Math.floor(canvas.height*.65),canvas.width,Math.max(1,Math.floor(canvas.height*.16))).data;
      let r=0,g=0,b=0,n=0;for(let i=0;i<pixels.length;i+=16){r+=pixels[i];g+=pixels[i+1];b+=pixels[i+2];n++;}
      this.tint.setRGB(r/n/255,g/n/255,b/n/255,T.SRGBColorSpace);
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
      this.photo?.dispose();this.photo=texture;this.photoAspect=canvas.width/canvas.height;
      this.garden.groundMat.color.copy(this.tint.clone().lerp(new T.Color('#ffffff'),.67));
      if(this.mode==='Observe'){this.scene.background=texture;this.scene.fog=new T.Fog(this.tint,39,115);}
      this.fitPhoto();
    }finally{URL.revokeObjectURL(url);}
  }
  clearPhoto(){
    ++this.photoRequest;
    this.photo?.dispose();this.photo=undefined;this.tint.set('#c6cfc4');
    this.garden.groundMat.color.set('#ffffff');
    if(this.mode==='Observe'){this.scene.background=this.sky;this.scene.fog=new T.Fog(this.tint,39,115);}
  }
  private fitPhoto(){
    if(!this.photo)return;
    const aspect=this.worldCamera.aspect,ratio=aspect/this.photoAspect;
    this.photo.repeat.set(Math.min(1,ratio),Math.min(1,1/ratio));
    this.photo.offset.set((1-this.photo.repeat.x)/2,(1-this.photo.repeat.y)/2);
    this.photo.updateMatrix();
  }
  private moveCamera(dt:number){
    const pos=new T.Vector3(), target=new T.Vector3();
    const resident=this.beings.get(this.focusSeed);
    if(this.cameraMode==='Follow' && resident){
      const p=resident.movement.pose, h=this.garden.terrain.height(p.x,p.z);
      target.set(p.x,h+1.1,p.z);
      pos.set(p.x+6,h+4.7,p.z+9);
    }else if(this.cameraMode==='Wander'){
      const t=this.worldClock*.027;
      target.set(Math.sin(t)*13,1.3,Math.cos(t*.71)*10-5);
      pos.copy(target).add(new T.Vector3(17+Math.sin(t*.6)*4,12+Math.cos(t*.8)*2,30));
    }else{
      const portrait=this.worldCamera.aspect<1;
      pos.set(portrait?12:17,portrait?12:13,portrait?41:36);target.set(0,1,-4);
    }
    pos.y=Math.max(pos.y,this.garden.terrain.height(pos.x,pos.z)+3);
    const k=1-Math.exp(-Math.min(dt,.1)*1.35);
    this.worldCamera.position.lerp(pos,k);
    this.cameraTarget.lerp(target,k);this.worldCamera.lookAt(this.cameraTarget);
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
    this.fitPhoto();
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
      if (observe) { this.worldClock += steps * stepSeconds; this.garden.animate(this.worldClock); }
    }
    if (!observe) this.orbit.update();
    else if(!this.paused) this.moveCamera(delta);
    this.onFrame();
    this.renderer.render(this.scene, observe ? this.worldCamera : this.detailCamera);
  };
}
