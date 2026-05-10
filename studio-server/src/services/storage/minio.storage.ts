import { Client } from 'minio';
import { Readable } from 'node:stream';
import {
  type Storage,
  type PutObjectInput,
  type PutObjectResult,
  type PresignedUrlOptions,
  DEFAULT_PRESIGN_TTL_SEC,
} from './storage.interface.js';

export class MinioStorage implements Storage {
  private client: Client;
  private bucket: string;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
    const url = new URL(endpoint);
    this.bucket = process.env.MINIO_BUCKET || 'test-studio';
    this.client = new Client({
      endPoint: url.hostname,
      port: url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80),
      useSSL: url.protocol === 'https:',
      accessKey: process.env.MINIO_ACCESS_KEY || 'studioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'studio-secret-change-me',
    });
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const body = input.body instanceof Buffer
      ? input.body
      : (input.body as Readable);
    const result = await this.client.putObject(
      this.bucket,
      input.key,
      body,
      input.sizeBytes,
      { 'Content-Type': input.contentType },
    );
    const stat = await this.client.statObject(this.bucket, input.key);
    return {
      key: input.key,
      sizeBytes: stat.size,
      etag: result.etag,
    };
  }

  async getPresignedUrl(key: string, options?: PresignedUrlOptions): Promise<string> {
    const ttl = options?.expiresInSec ?? DEFAULT_PRESIGN_TTL_SEC;
    return this.client.presignedGetObject(this.bucket, key, ttl);
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch (err: any) {
      if (err?.code === 'NotFound' || err?.code === 'NoSuchKey') return false;
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
    return this.client.getObject(this.bucket, key);
  }
}
