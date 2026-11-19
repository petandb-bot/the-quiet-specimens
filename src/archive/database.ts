import type { Specimen } from '../core/model';
import { validateRecord } from './records';

const table = 'specimens';

export class Archive {
  private connection?: Promise<IDBDatabase>;

  private open() {
    this.connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('quiet-specimens', 1);
      request.onupgradeneeded = () => request.result.createObjectStore(table, { keyPath: 'id' });
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          this.connection = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => { this.connection = undefined; reject(request.error); };
      request.onblocked = () => { this.connection = undefined; reject(new Error('Close other Lab tabs and try again.')); };
    });
    return this.connection;
  }

  async load() {
    const database = await this.open();
    const raw = await new Promise<unknown[]>((resolve, reject) => {
      const req = database.transaction(table, 'readonly').objectStore(table).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const items = new Map<string, Specimen>();
    let skipped = 0;
    for (const entry of raw) {
      try { const record = validateRecord(entry); items.set(record.id, record); }
      catch { skipped++; }
    }
    return { items, skipped };
  }

  private async write(edit: (store: IDBObjectStore) => IDBRequest) {
    const database = await this.open();
    return new Promise<void>((resolve, reject) => {
      const tx = database.transaction(table, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('The archive update was cancelled.'));
      edit(tx.objectStore(table));
    });
  }

  save(record: Specimen) { return this.write(store => store.put(validateRecord(record))); }
  delete(id: string) { return this.write(store => store.delete(id)); }
}
