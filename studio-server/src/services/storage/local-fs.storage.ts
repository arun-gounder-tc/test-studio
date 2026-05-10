import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { paths } from '../../utils/paths.js';
import {
  type Storage,
  type PutObjectInput,
  type PutObjectResult,
  type PresignedUrlOptions,
  DEFAULT_PRESIGN_TTL_SEC,
} from './storage.interface.js';

export class LocalFsStorage implements Storage {
  private root: string;
  private serverBaseUrl: string;

  constructor() {
    this.root = path.join(paths.studioDataDir, 'storage');
    this.serverBaseUrl = process.env.SERVER_BASE_URL || 'http://localhost:3001';
  }

  async ensureBucket(): Promise<void> {
    await fs.promises.mkdir(this.root, { recursive: true });
  }

  private resolveSafe(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep) && full !== this.root) {
      throw new Error(`Unsafe storage key: ${key}`);
    }
    return full;
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const target = this.resolveSafe(input.key);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    if (input.body instanceof Buffer) {
      await fs.promises.writeFile(target, input.body);
    } else {
      await pipeline(input.body as Readable, fs.createWriteStream(target));
    }
    const stat = await fs.promises.stat(target);
    return { key: input.key, sizeBytes: stat.size };
  }

  async getPresignedUrl(key: string, _options?: PresignedUrlOptions): Promise<string> {
    void _options;
    return `${this.serverBaseUrl}/api/test-studio/storage/${encodeURI(key)}`;
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await fs.promises.access(this.resolveSafe(key), fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const target = this.resolveSafe(key);
    await fs.promises.unlink(target).catch(() => {});
  }

  async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
    return fs.createReadStream(this.resolveSafe(key));
  }

  /** Path resolver used by the storage proxy route (LocalFs only). */
  resolvePath(key: string): string {
    return this.resolveSafe(key);
  }
}
