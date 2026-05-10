export interface PutObjectInput {
  key: string;
  body: Buffer | NodeJS.ReadableStream;
  contentType: string;
  sizeBytes?: number;
}

export interface PutObjectResult {
  key: string;
  sizeBytes: number;
  etag?: string;
}

export interface PresignedUrlOptions {
  expiresInSec?: number;
}

export interface Storage {
  ensureBucket(): Promise<void>;
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  getPresignedUrl(key: string, options?: PresignedUrlOptions): Promise<string>;
  objectExists(key: string): Promise<boolean>;
  deleteObject(key: string): Promise<void>;
  getObjectStream(key: string): Promise<NodeJS.ReadableStream>;
}

export const DEFAULT_PRESIGN_TTL_SEC = 900;
