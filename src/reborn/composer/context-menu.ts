import { clamp } from '../../core/random';
import type { Cursor } from './input';

export function positionContext(panel: HTMLElement, dock: HTMLElement, point: Cursor | undefined) {
  if (!point || panel.hidden || window.innerWidth < 760) {
    for (const property of ['left', 'top', 'right', 'max-height']) panel.style.removeProperty(property);
    return;
  }
  const { width } = panel.getBoundingClientRect();
  const dockBounds = dock.getBoundingClientRect();
  const horizontal = point.x + 26 + width < window.innerWidth ? point.x + 26 : point.x - 26 - width;
  const left = clamp(horizontal, 12, window.innerWidth - width - 12);
  const crossesDock = left < dockBounds.right && left + width > dockBounds.left;
  const bottom = crossesDock ? dockBounds.top : window.innerHeight;
  panel.style.maxHeight = Math.max(130, Math.min(window.innerHeight * .54, bottom - 68)) + 'px';
  const { height } = panel.getBoundingClientRect();
  panel.style.left = Math.round(left) + 'px';
  panel.style.right = 'auto';
  panel.style.top = Math.round(clamp(point.y - 46, 58, Math.max(58, bottom - height - 10))) + 'px';
}
