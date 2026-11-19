import * as T from 'three';
import { Aquarium } from '../aquarium/scene';
import type { AquariumPreset } from '../aquarium/motion';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Action, Specimen } from '../core/model';
import { random } from '../core/random';
import { buildCreature } from '../morphology/creature';
import { Swim } from '../behavior/swim';
import type { MotionState } from '../behavior/swim';

export type ViewMode = 'observe' | 'inspect' | 'action';

function particles() {
  const rng = random('bathypelagic suspended material');
  const points: number[] = [], colors: number[] = [];
  for (let i = 0; i < 175; i++) {
    points.push(rng.range(-15, 15), rng.range(-7, 7), rng.range(-9, 6));
    const alpha = rng.range(.05, .46);
    colors.push(alpha * .57, alpha * .9, alpha);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  return new T.Points(geometry, new T.PointsMaterial({
    size: .030, transparent: true, opacity: .58, vertexColors: true, depthWrite: false,
  }));
}

export class LabView {
  private renderer: T.WebGLRenderer;
  private aquarium?: Aquarium;
  private aquariumActive = false;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(35, 1, .1, 65);
  private controls: OrbitControls;
  private dock = new T.Group();
  private model?: ReturnType<typeof buildCreature>;
  private swim?: Swim;
  private suspended = particles();
  private referenceDistance = 9;
  private mode: ViewMode = 'observe';
  private previous = 0;
  private sceneTime = 0;
  private low = matchMedia('(max-width: 700px)').matches;
  private economy = this.low;
  private available = true;
  private current?: Specimen;
  private pointer?: { id: number; x: number; y: number };
  private tapPulse = 0;
  private reframing = false;
  private orbit = new T.Spherical();
  private homeOrbit = new T.Spherical();
  private homePosition = new T.Vector3();
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  private raycaster = new T.Raycaster();
  private visualTarget = new T.Vector3();
  private facing = new T.Vector3();
  private environment: T.WebGLRenderTarget;
  private width = 1;
  private height = 1;
  private slowFrames = 0;

  constructor(
    private host: HTMLElement,
    private onState: (state: MotionState) => void,
    private onError: (message: string) => void,
  ) {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { antialias: !this.low, alpha: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('A browser with WebGL 2 is required to see the live specimen.');
    this.renderer = new T.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: !this.low });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    canvas.setAttribute('aria-label', 'Interactive 3D specimen');
    this.raycaster.params.Line.threshold = .12;
    host.append(canvas);
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.available = false;
      this.onError('The 3D chamber paused. Waiting for graphics to reconnect…');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.environment.dispose();
      this.environment = this.environmentMap();
      this.scene.environment = this.environment.texture;
      if (this.aquarium) this.aquarium.scene.environment = this.environment.texture;
      if (this.current) this.load(this.current);
      this.available = true;
      this.onError('');
    });
    this.environment = this.environmentMap();
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = .74;
    this.scene.fog = new T.FogExp2(0x06242b, .044);
    this.scene.add(new T.HemisphereLight('#bdfff4', '#291523', 1.0));
    this.light('#ffdfaf', 3.5, [2.0, 4.7, 5.3]);
    this.light('#82e6fa', 2.65, [-3.2, 3.1, -4.6]);
    this.light('#e5765c', 1.36, [-3.0, -1.9, 2.6]);
    this.light('#a1fff0', .67, [4, .6, -3]);
    this.scene.add(this.dock, this.suspended);
    this.camera.position.set(.2, .56, this.referenceDistance);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .14;
    this.controls.enablePan = false;
    this.controls.enabled = false;
    this.controls.rotateSpeed = .61;
    this.controls.zoomSpeed = .75;
    canvas.style.touchAction = 'pan-y';
    this.controls.addEventListener('start', () => { this.reframing = false; });
    canvas.addEventListener('keydown', this.onViewKey);
    canvas.addEventListener('pointerdown', event => {
      if (!this.aquariumActive && this.mode !== 'inspect' && event.isPrimary && event.button === 0) {
        this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      } else {
        this.pointer = undefined;
      }
    });
    canvas.addEventListener('pointermove', event => {
      if (this.pointer?.id === event.pointerId && this.pointerTravel(event) > 12) {
        this.pointer = undefined;
      }
    });
    canvas.addEventListener('pointercancel', () => { this.pointer = undefined; });
    canvas.addEventListener('pointerleave', () => { this.pointer = undefined; });
    canvas.addEventListener('pointerup', event => {
      const isTap = !this.aquariumActive && this.mode !== 'inspect' && this.pointer?.id === event.pointerId && this.pointerTravel(event) <= 12;
      this.pointer = undefined;
      if (!isTap) return;
      const rect = canvas.getBoundingClientRect();
      this.raycaster.setFromCamera(new T.Vector2(
        (event.clientX - rect.left) / rect.width * 2 - 1,
        1 - (event.clientY - rect.top) / rect.height * 2,
      ), this.camera);
      if (this.swim && this.raycaster.intersectObject(this.dock, true).length && this.swim.tap()) {
        this.tapPulse = 1;
        this.onState(this.swim.state);
      }
    });
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.renderer.setAnimationLoop(this.frame);
  }

  private pointerTravel(event: PointerEvent) {
    return this.pointer ? Math.hypot(event.clientX - this.pointer.x, event.clientY - this.pointer.y) : Infinity;
  }

  private onViewKey = (event: KeyboardEvent) => {
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-.13, 0], ArrowRight: [.13, 0], ArrowUp: [0, -.13], ArrowDown: [0, .13],
    };
    if (this.mode !== 'inspect' || event.ctrlKey || event.metaKey || event.altKey) return;
    const delta = deltas[event.key];
    if (delta) {
      this.reframing = false;
      this.orbit.setFromVector3(this.camera.position);
      this.orbit.theta += delta[0];
      this.orbit.phi = T.MathUtils.clamp(this.orbit.phi + delta[1], .22, Math.PI - .22);
      this.camera.position.setFromSpherical(this.orbit);
      this.controls.update();
    } else if (event.key === '+' || event.key === '=') this.zoom(.84);
    else if (event.key === '-') this.zoom(1.19);
    else if (event.key === '0') this.resetView();
    else return;
    event.preventDefault();
  };

  private environmentMap() {
    const pmrem = new T.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, .11);
    room.dispose();
    pmrem.dispose();
    return environment;
  }

  private light(color: string, intensity: number, position: [number, number, number]) {
    const light = new T.DirectionalLight(color, intensity);
    light.position.set(...position);
    this.scene.add(light);
  }

  load(specimen: Specimen) {
    this.current = specimen;
    if (this.model) {
      this.dock.remove(this.model.group);
      this.model.dispose();
    }
    this.model = buildCreature(specimen, this.low);
    const box = new T.Box3().setFromObject(this.model.group);
    const size = box.getSize(new T.Vector3());
    const center = box.getCenter(new T.Vector3());
    const scale = Math.min(6.0 / Math.max(size.x, size.z), 3.9 / size.y);
    this.model.group.scale.setScalar(scale);
    this.model.group.position.copy(center.multiplyScalar(-scale));
    this.dock.add(this.model.group);
    this.dock.position.set(0, 0, 0);
    this.dock.rotation.set(0, 0, 0);
    this.swim = new Swim(specimen.genome.behavior, specimen.genome.morphology.plan, specimen.genome.seed);
    this.sceneTime = 0;
    this.tapPulse = 0;
    this.onState(this.swim.state);
  }

  showAquarium(active: boolean) {
    if (this.aquariumActive === active) return;
    this.aquariumActive = active;
    this.pointer = undefined;
    const canvas = this.renderer.domElement;
    canvas.setAttribute('aria-label', active ? 'Live 3D aquarium with fish at several depths' : 'Interactive 3D specimen');
    if (active) {
      this.aquarium ??= new Aquarium(this.environment.texture);
      canvas.tabIndex = -1;
    }
    this.resize();
  }

  selectAquariumPreset(preset: AquariumPreset) { this.aquarium?.setPreset(preset); }

  setAquariumPaused(paused: boolean) {
    if (this.aquarium) this.aquarium.paused = paused;
  }

  setMode(mode: ViewMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    const inspect = mode === 'inspect';
    this.controls.enabled = inspect;
    this.pointer = undefined;
    const canvas = this.renderer.domElement;
    canvas.style.touchAction = inspect ? 'none' : 'pan-y';
    canvas.tabIndex = inspect ? 0 : -1;
    if (inspect) {
      canvas.setAttribute('aria-description', 'Use arrow keys to orbit, plus or minus to zoom, and zero to reset.');
      this.reframing = false;
    } else {
      canvas.removeAttribute('aria-description');
      this.resetView();
    }
  }

  resetView() {
    // Clear any residual drag motion before recentering.
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, 0);
    this.reframing = !this.reducedMotion.matches;
    if (!this.reframing) {
      this.camera.position.copy(this.homePosition);
      this.camera.lookAt(this.controls.target);
    }
  }

  zoom(factor: number) {
    this.reframing = false;
    const distance = this.camera.position.distanceTo(this.controls.target);
    const target = T.MathUtils.clamp(distance * factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.sub(this.controls.target).multiplyScalar(target / distance).add(this.controls.target);
    this.controls.update();
  }

  private reframe(dt: number) {
    this.orbit.setFromVector3(this.camera.position);
    const theta = this.homeOrbit.theta - this.orbit.theta;
    const turn = Math.atan2(Math.sin(theta), Math.cos(theta));
    const phi = this.homeOrbit.phi - this.orbit.phi;
    const distance = this.homeOrbit.radius - this.orbit.radius;
    if (Math.abs(turn) + Math.abs(phi) + Math.abs(distance) < .007) {
      this.camera.position.copy(this.homePosition);
      this.reframing = false;
    } else {
      const follow = 1 - Math.exp(-dt * 11);
      this.orbit.set(this.orbit.radius + distance * follow, this.orbit.phi + phi * follow, this.orbit.theta + turn * follow);
      this.camera.position.setFromSpherical(this.orbit);
    }
    this.camera.lookAt(this.controls.target);
  }

  trigger(action: Action) {
    if (!this.swim) return;
    this.swim.trigger(action);
    this.onState(this.swim.state);
  }

  private resize() {
    const oldDistance = this.referenceDistance;
    this.width = Math.max(1, this.host.clientWidth);
    this.height = Math.max(1, this.host.clientHeight);
    const aspect = this.width / this.height;
    this.referenceDistance = Math.max(8.9, 12.1 / aspect);
    this.homePosition.set(.10, .50, this.referenceDistance);
    this.homeOrbit.setFromVector3(this.homePosition);
    this.aquarium?.resize(aspect);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.economy ? 1.35 : 1.8));
    this.renderer.setSize(this.width, this.height, false);
    this.controls.minDistance = this.referenceDistance * .45;
    this.controls.maxDistance = this.referenceDistance * 2.05;
    if (this.mode === 'inspect') this.camera.position.multiplyScalar(this.referenceDistance / oldDistance);
    else if (!this.reframing) this.camera.position.copy(this.homePosition);
    this.camera.lookAt(this.controls.target);
  }

  private frame = (milliseconds: number) => {
    const dt = this.previous ? (milliseconds - this.previous) / 1000 : 0;
    this.previous = milliseconds;
    if (!this.available || document.hidden) return;
    if (!this.economy) {
      this.slowFrames = dt > .035 && dt < .25 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
      if (this.slowFrames > 45) { this.economy = true; this.resize(); }
    }
    const frame = Math.min(dt, .045);
    if (this.aquariumActive && this.aquarium) {
      if (!this.aquarium.paused) this.aquarium.update(frame);
      this.renderer.render(this.aquarium.scene, this.aquarium.camera);
      return;
    }
    this.sceneTime += frame;
    this.tapPulse *= Math.exp(-frame * 7.8);
    if (this.swim && this.model && this.current) {
      const active = this.swim.step(frame);
      const plan = this.current.genome.morphology.plan;
      const inspect = this.mode === 'inspect';
      const overhead = plan === 'RAY' ? .53 : plan === 'JELLY' ? .03 : -.035;
      const centered = inspect ? 0 : this.mode === 'action' ? .40 : 1;
      this.visualTarget.set(...active.position).multiplyScalar(centered);
      this.dock.position.lerp(this.visualTarget, 1 - Math.exp(-frame * 3));
      this.facing.set(overhead + (inspect ? 0 : active.roll * .63),
        inspect ? -.24 : active.yaw * (plan === 'JELLY' ? .30 : .91) - .14,
        inspect ? .03 : active.pitch * .69 + (plan === 'FISH' ? -.055 : .035));
      const turn = 1 - Math.exp(-frame * 5);
      this.dock.rotation.x += (this.facing.x - this.dock.rotation.x) * turn;
      this.dock.rotation.y += Math.atan2(Math.sin(this.facing.y - this.dock.rotation.y), Math.cos(this.facing.y - this.dock.rotation.y)) * turn;
      this.dock.rotation.z += (this.facing.z - this.dock.rotation.z) * turn;
      this.model.motion.time.value = this.sceneTime;
      this.model.motion.effort.value = active.effort;
      this.model.motion.display.value = Math.max(active.display, this.tapPulse * .64);
      this.onState(active);
    }
    if (this.reframing) this.reframe(frame);
    else if (this.controls.enabled) this.controls.update();
    this.suspended.rotation.y = Math.sin(this.sceneTime * .071) * .095;
    this.suspended.position.y = Math.sin(this.sceneTime * .18) * .14;
    this.renderer.render(this.scene, this.camera);
  };

  thumbnail(specimen: Specimen): string | undefined {
    if (!this.available || this.aquariumActive) return;
    const model = buildCreature(specimen, true);
    const box = new T.Box3().setFromObject(model.group);
    const size = box.getSize(new T.Vector3());
    const center = box.getCenter(new T.Vector3());
    const scale = Math.min(5.8 / Math.max(size.x, size.z), 3.4 / size.y);
    model.group.scale.setScalar(scale);
    model.group.position.copy(center.multiplyScalar(-scale));
    const subject = new T.Group();
    subject.add(model.group);
    subject.rotation.set(specimen.genome.morphology.plan === 'RAY' ? .64 : .04, -.19, -.09);
    this.scene.add(subject);
    this.dock.visible = false;
    this.suspended.visible = false;
    const camera = new T.PerspectiveCamera(32, this.width / this.height, .1, 65);
    camera.position.set(0, .30, Math.max(8.2, 10.8 / camera.aspect));
    camera.lookAt(0, 0, 0);
    try {
      this.renderer.render(this.scene, camera);
      const copy = document.createElement('canvas');
      copy.width = 320;
      copy.height = 200;
      const ctx = copy.getContext('2d');
      if (!ctx) return;
      const canvas = this.renderer.domElement;
      const cropWidth = Math.min(canvas.width, canvas.height * 1.6);
      const cropHeight = Math.min(canvas.height, canvas.width / 1.6);
      const ratio = Math.min(copy.width / cropWidth, copy.height / cropHeight);
      const gradient = ctx.createRadialGradient(165, 90, 15, 165, 90, 187);
      gradient.addColorStop(0, '#0d333b'); gradient.addColorStop(1, '#04171c');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, copy.width, copy.height);
      ctx.drawImage(canvas, (canvas.width - cropWidth) / 2, (canvas.height - cropHeight) / 2, cropWidth, cropHeight,
        (copy.width - cropWidth * ratio) / 2, (copy.height - cropHeight * ratio) / 2, cropWidth * ratio, cropHeight * ratio);
      return copy.toDataURL('image/jpeg', .80);
    } catch {
      return undefined;
    } finally {
      this.dock.visible = true;
      this.suspended.visible = true;
      this.scene.remove(subject);
      model.dispose();
      this.renderer.render(this.scene, this.camera);
    }
  }
}
