import { isWorldDocument } from './validation';
import type { WorldDocument } from './document';

const historyLimit = 48;

export class WorldHistory {
  private past: WorldDocument[] = [];
  private future: WorldDocument[] = [];

  private initial: WorldDocument;
  constructor(private present: WorldDocument) { this.initial = present; }

  get value() { return this.present; }
  get canUndo() { return Boolean(this.past.length); }
  get canRedo() { return Boolean(this.future.length); }
  get changed() { return this.present !== this.initial; }

  commit(next: WorldDocument) {
    if (next === this.present || !isWorldDocument(next)) return false;
    this.past.push(this.present);
    if (this.past.length > historyLimit) this.past.shift();
    this.future.length = 0;
    this.present = { ...next, updatedAt: new Date().toISOString() };
    return true;
  }

  undo() {
    const previous = this.past.pop();
    if (!previous) return false;
    this.future.push(this.present);
    this.present = previous;
    return true;
  }

  redo() {
    const next = this.future.pop();
    if (!next) return false;
    this.past.push(this.present);
    this.present = next;
    return true;
  }
}
