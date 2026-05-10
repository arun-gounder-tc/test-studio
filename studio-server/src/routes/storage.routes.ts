import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { LocalFsStorage, isLocalStorage } from '../services/storage/index.js';

export const storageRouter = Router();

const localFs = isLocalStorage ? new LocalFsStorage() : null;

const CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.json': 'application/json',
};

storageRouter.use((req, res, next) => {
  if (req.method !== 'GET') {
    next();
    return;
  }
  if (!localFs) {
    res.status(404).json({ error: 'Storage proxy is local-mode only' });
    return;
  }

  const rawKey = req.path.replace(/^\//, '');
  if (!rawKey) {
    res.status(400).json({ error: 'Missing storage key' });
    return;
  }

  let absolute: string;
  try {
    absolute = localFs.resolvePath(decodeURIComponent(rawKey));
  } catch {
    res.status(400).json({ error: 'Invalid storage key' });
    return;
  }

  if (!fs.existsSync(absolute)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const ext = path.extname(absolute).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=300');

  if (contentType === 'video/mp4') {
    const stat = fs.statSync(absolute);
    const range = req.headers.range;
    res.setHeader('Accept-Ranges', 'bytes');
    if (range) {
      const m = range.match(/bytes=(\d+)-(\d*)/);
      const start = m ? parseInt(m[1], 10) : 0;
      const end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', end - start + 1);
      fs.createReadStream(absolute, { start, end }).pipe(res);
      return;
    }
    res.setHeader('Content-Length', stat.size);
  }
  fs.createReadStream(absolute).pipe(res);
});
