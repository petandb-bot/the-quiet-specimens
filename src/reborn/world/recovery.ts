import type { WorldDocument } from './document';
import { isWorldDocument } from './validation';
import { photoByteLimit } from './image-settings';

const databaseName = 'the-quiet-specimens-working-draft';
const storeName = 'drafts';
const draftKey = 'elsewhere';

export type WorkingDraft = { version: 1; world: WorldDocument; photo?: Blob };
type StoredDraft = WorkingDraft & { revision: string };

export class WorkingDraftChanged extends Error {}

export function isWorkingDraft(data: unknown): data is WorkingDraft {
  if (typeof data !== 'object' || data === null) return false;
  const { version, world, photo } = data as Partial<WorkingDraft>;
  return version === 1 && isWorldDocument(world)
    && (photo === undefined || (photo instanceof Blob && photo.size > 0 && photo.size <= photoByteLimit
      && photo.type !== 'image/svg+xml'));
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Draft storage request failed'));
  });
}

export class WorkingDraftStore {
  private database?: Promise<IDBDatabase>;
  private revision?: string;

  constructor(private factory: IDBFactory = indexedDB) {}

  private connect() {
    if (this.database) return this.database;
    const connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory.open(databaseName, 1);
      let blocked = false;
      request.onupgradeneeded = () => { request.result.createObjectStore(storeName); };
      request.onerror = () => reject(request.error ?? new Error('Draft storage unavailable'));
      request.onblocked = () => {
        blocked = true;
        reject(new Error('Draft storage is busy'));
      };
      request.onsuccess = () => {
        const database = request.result;
        if (blocked) { database.close(); return; }
        database.onversionchange = () => {
          database.close();
          this.database = undefined;
        };
        resolve(database);
      };
    }).catch(error => {
      this.database = undefined;
      throw error;
    });
    this.database = connection;
    return connection;
  }

  async load() {
    const database = await this.connect();
    const stored: unknown = await requestResult(database.transaction(storeName).objectStore(storeName).get(draftKey));
    if (stored === undefined) return undefined;
    if (!isWorkingDraft(stored)) throw new Error('The local draft could not be read');
    this.revision = (stored as Partial<StoredDraft>).revision;
    return stored;
  }

  async save(draft: WorkingDraft) {
    if (!isWorkingDraft(draft)) throw new Error('Invalid working draft');
    const database = await this.connect();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const drafts = transaction.objectStore(storeName);
      const revision = crypto.randomUUID();
      const check = drafts.get(draftKey);
      let stale = false;
      check.onsuccess = () => {
        const stored = check.result as Partial<StoredDraft> | undefined;
        stale = stored?.revision !== this.revision;
        if (stale) transaction.abort();
        else drafts.put({ ...draft, revision } satisfies StoredDraft, draftKey);
      };
      transaction.oncomplete = () => { this.revision = revision; resolve(); };
      transaction.onabort = () => reject(stale
        ? new WorkingDraftChanged('Draft changed in another tab')
        : transaction.error ?? new Error('The local draft was not saved'));
    });
  }
}
