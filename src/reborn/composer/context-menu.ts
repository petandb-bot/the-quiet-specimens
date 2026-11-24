import { clamp } from '../../core/random';
import type { Cursor } from './input';

export function positionContext(panel: HTMLElement, dock: HTMLElement, point: Cursor | undefined) {
  if (!point || panel.hidden) {
    for (const property of ['left', 'top', 'right', 'max-height']) panel.style.removeProperty(property);
    return;
  }
  const dockBounds = dock.getBoundingClientRect();
  if (window.innerWidth < 760) {
    const top = 60;
    const bottom = dockBounds.top - 8;
    const gap = 25;
    const above = point.y - gap - top;
    const below = bottom - Math.max(top, point.y + gap);
    const fitsAbove = above >= below;
    panel.style.removeProperty('left');
    panel.style.removeProperty('right');
    panel.style.top = Math.round(fitsAbove ? top : Math.max(top, point.y + gap)) + 'px';
    panel.style.maxHeight = Math.max(68, Math.min(window.innerHeight * .57, fitsAbove ? above : below)) + 'px';
    return;
  }
  const { width } = panel.getBoundingClientRect();
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
