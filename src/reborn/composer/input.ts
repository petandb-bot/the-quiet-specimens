export type Cursor = { x: number; y: number };
type Navigation = 'orbit' | 'pan' | 'zoom';

type InputHandlers = {
  active: () => boolean;
  camera: () => boolean;
  begin: (point: Cursor) => void;
  hover: (point: Cursor) => void;
  drag: (point: Cursor) => void;
  end: (point: Cursor, moved: boolean) => void;
  cancel: () => void;
  navigate: (action: Navigation, x: number, y?: number) => void;
};

const cursor = (event: PointerEvent): Cursor => ({ x: event.clientX, y: event.clientY });
const distance = (a: Cursor, b: Cursor) => Math.hypot(a.x - b.x, a.y - b.y);

export class MakeInput {
  private gesture?: { id: number; origin: Cursor; last: Cursor; moved: boolean; mode: 'edit' | 'orbit' | 'pan' };
  private touches = new Map<number, Cursor>();
  private pinching = false;
  private space = false;
  private usedSpace = false;

  constructor(private canvas: HTMLCanvasElement, private handlers: InputHandlers) {
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', event => this.release(event, false));
    canvas.addEventListener('pointercancel', event => this.release(event, true));
    canvas.addEventListener('lostpointercapture', event => this.release(event, true));
    canvas.addEventListener('pointerleave', () => { if (!this.gesture) handlers.cancel(); });
    canvas.addEventListener('contextmenu', event => { if (handlers.active()) event.preventDefault(); });
    canvas.addEventListener('wheel', event => {
      if (!handlers.active()) return;
      event.preventDefault();
      handlers.cancel();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
      handlers.navigate('zoom', Math.exp(-Math.max(-300, Math.min(300, pixels)) * .0025));
    }, { passive: false });
    window.addEventListener('keydown', event => {
      if (!handlers.active() || event.code !== 'Space' || (event.target instanceof Element
        && event.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
      this.space = true;
      if (this.gesture?.mode === 'edit' && this.touches.size === 0) {
        handlers.cancel();
        this.gesture.mode = 'orbit';
        this.usedSpace = true;
      }
      if (this.usedSpace || !this.isButton(event.target)) event.preventDefault();
    });
    window.addEventListener('keyup', event => {
      if (event.code !== 'Space') return;
      if (this.usedSpace) event.preventDefault();
      this.space = false;
      this.usedSpace = false;
    });
    window.addEventListener('blur', () => this.reset());
  }

  reset() {
    this.handlers.cancel();
    const pointers = new Set(this.touches.keys());
    if (this.gesture) pointers.add(this.gesture.id);
    this.gesture = undefined;
    this.touches.clear();
    this.pinching = this.space = this.usedSpace = false;
    for (const id of pointers) if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
  }

  private isButton(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest('button, summary, a'));
  }

  private down = (event: PointerEvent) => {
    if (!this.handlers.active() || (event.button !== 0 && event.button !== 2)) return;
    const point = cursor(event);
    if (event.pointerType === 'touch') {
      this.touches.set(event.pointerId, point);
      if (this.touches.size > 1 || this.pinching) {
        this.gesture = undefined;
        this.pinching = true;
        this.handlers.cancel();
        this.canvas.setPointerCapture(event.pointerId);
        return;
      }
    }
    if (this.gesture) return;
    const mode = event.button === 2 ? 'pan' : this.handlers.camera() || (this.space && event.pointerType !== 'touch') ? 'orbit' : 'edit';
    if (mode !== 'edit') {
      if (this.space) this.usedSpace = true;
      this.handlers.cancel();
    } else this.handlers.begin(point);
    this.gesture = { id: event.pointerId, origin: point, last: point, moved: false, mode };
    this.canvas.setPointerCapture(event.pointerId);
  };

  private move = (event: PointerEvent) => {
    if (!this.handlers.active()) return;
    const point = cursor(event);
    if (event.pointerType === 'touch' && this.touches.has(event.pointerId)) {
      const before = [...this.touches.values()].slice(0, 2);
      this.touches.set(event.pointerId, point);
      if (this.pinching) {
        const after = [...this.touches.values()].slice(0, 2);
        if (after.length === 2) {
          this.handlers.navigate('pan', (after[0].x + after[1].x - before[0].x - before[1].x) / 2,
            (after[0].y + after[1].y - before[0].y - before[1].y) / 2);
          const spread = distance(before[0], before[1]);
          if (spread > 4) this.handlers.navigate('zoom', distance(after[0], after[1]) / spread);
        }
        return;
      }
    }
    const gesture = this.gesture;
    if (gesture?.id === event.pointerId) {
      if (gesture.mode !== 'edit') {
        this.handlers.navigate(gesture.mode, point.x - gesture.last.x, point.y - gesture.last.y);
      } else {
        gesture.moved ||= distance(gesture.origin, point) > 6;
        if (gesture.moved) this.handlers.drag(point);
      }
      gesture.last = point;
    } else if (!gesture && event.pointerType !== 'touch') {
      if (this.space) this.handlers.cancel();
      else this.handlers.hover(point);
    }
  };

  private release(event: PointerEvent, cancelled: boolean) {
    this.touches.delete(event.pointerId);
    if (this.pinching) {
      if (!this.touches.size) this.pinching = false;
      return;
    }
    const gesture = this.gesture;
    if (gesture?.id !== event.pointerId) return;
    this.gesture = undefined;
    if (cancelled || !this.handlers.active() || gesture.mode !== 'edit') this.handlers.cancel();
    else {
      const point = cursor(event);
      this.handlers.end(point, gesture.moved || distance(gesture.origin, point) > 6);
    }
  }
}
