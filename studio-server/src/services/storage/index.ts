import { MinioStorage } from './minio.storage.js';
import { LocalFsStorage } from './local-fs.storage.js';
import { type Storage } from './storage.interface.js';

export const storageDriver = (process.env.STORAGE_DRIVER || 'minio').toLowerCase();
export const isLocalStorage = storageDriver === 'local';

export const storage: Storage = isLocalStorage
  ? new LocalFsStorage()
  : new MinioStorage();

export { LocalFsStorage, MinioStorage };
export type { Storage } from './storage.interface.js';
