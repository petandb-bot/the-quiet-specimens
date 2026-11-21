import * as T from 'three';
import { clamp } from '../../core/random';
import { boundLandscapePan, landscapeFrame } from '../camera';
import { worldBounds } from '../terrain';
import type { Terrain } from '../terrain';

export type MakeView = 'Perspective' | 'Plan';

export class MakeCamera {
  readonly perspective = new T.PerspectiveCamera(40, 1, .15, 170);
  readonly plan = new T.OrthographicCamera(-36, 36, 36, -36, .1, 160);
  private target = new T.Vector3();
  private offset = new T.Vector3();
  private spherical = new T.Spherical();
  private center = new T.Vector2();
  private px = new T.Vector3();
  private pz = new T.Vector3();

  get(view: MakeView) { return view === 'Plan' ? this.plan : this.perspective; }

  resize(aspect: number) {
    this.perspective.aspect = aspect;
    this.perspective.fov = aspect < 1 ? 53 : 40;
    this.perspective.updateProjectionMatrix();
    const w = 34.5 * Math.max(1, aspect), h = 34.5 / Math.min(1, aspect);
    this.plan.left = -w;
    this.plan.right = w;
    this.plan.top = h;
    this.plan.bottom = -h;
    this.plan.updateProjectionMatrix();
  }

  reset(terrain: Terrain) {
    landscapeFrame(terrain, this.perspective.aspect < 1, this.perspective.position, this.target);
    this.perspective.zoom = 1;
    this.perspective.updateProjectionMatrix();
    this.apply(terrain);
    this.plan.zoom = 1;
    this.plan.up.set(0, 0, -1);
    this.center.set(0, 0);
    this.applyPlan();
  }

  orbit(view: MakeView, x: number, y: number, height: number, terrain: Terrain) {
    if (view === 'Plan') { this.pan(view, x, y, height, terrain); return; }
    const camera = this.perspective;
    const angle = this.spherical.setFromVector3(this.offset.copy(camera.position).sub(this.target));
    angle.theta -= x / height * 2.25;
    angle.phi = clamp(angle.phi - y / height * 2.25, .38, Math.PI * .47);
    camera.position.copy(this.target).add(this.offset.setFromSpherical(angle));
    this.apply(terrain);
  }

  pan(view: MakeView, x: number, y: number, height: number, terrain: Terrain) {
    if (view === 'Plan') {
      const scale = (this.plan.top - this.plan.bottom) / (height * this.plan.zoom);
      this.center.set(clamp(this.center.x - x * scale, -30, 30), clamp(this.center.y - y * scale, -30, 30));
      this.applyPlan();
      return;
    }
    const camera = this.perspective;
    const scale = 2 * camera.position.distanceTo(this.target) * Math.tan(T.MathUtils.degToRad(camera.fov / 2)) / (height * camera.zoom);
    this.px.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    this.pz.setFromMatrixColumn(camera.matrixWorld, 2).setY(0).normalize();
    this.offset.copy(this.px).multiplyScalar(-x * scale).addScaledVector(this.pz, -y * scale);
    camera.position.add(this.offset);
    this.target.add(this.offset);
    this.apply(terrain);
  }

  zoom(view: MakeView, factor: number) {
    const camera = this.get(view);
    camera.zoom = clamp(camera.zoom * factor, .72, 3.8);
    camera.updateProjectionMatrix();
  }

  private apply(terrain: Terrain) {
    boundLandscapePan(this.perspective.position, this.target, terrain);
    this.perspective.lookAt(this.target);
    this.perspective.updateMatrixWorld();
  }

  private applyPlan() {
    this.plan.position.set(this.center.x, 78, this.center.y);
    this.plan.lookAt(this.center.x, 0, this.center.y);
    this.plan.updateProjectionMatrix();
    this.plan.updateMatrixWorld();
  }
}
