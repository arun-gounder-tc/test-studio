import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { runnerService } from '../services/cypress-runner.service.js';
import { filesystemService } from '../services/filesystem.service.js';
import { paths } from '../utils/paths.js';

export const runsRouter = Router();

runsRouter.post('/', (req, res) => {
  try {
    const { testId, specRelativePath, headed } = req.body ?? {};

    let spec: string | undefined = specRelativePath;
    if (!spec && testId) {
      const tests = filesystemService.listFeatureFiles();
      const test = tests.find((t) => t.id === testId);
      if (!test) {
        res.status(404).json({ error: `Test ${testId} not found` });
        return;
      }
      spec = test.relativePath;
    }
    if (!spec) {
      res.status(400).json({ error: 'testId or specRelativePath is required' });
      return;
    }

    const record = runnerService.start({ testId, specRelativePath: spec, headed: !!headed });
    res.json({
      runId: record.id,
      status: record.status,
      startedAt: record.startedAt,
      specPaths: record.specPaths,
      headed: record.headed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to start run';
    res.status(500).json({ error: message });
  }
});

runsRouter.get('/', (_req, res) => {
  res.json({
    runs: runnerService.list().map((r) => ({
      id: r.id,
      testId: r.testId,
      status: r.status,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      scenarioCount: r.scenarios.length,
      passed: r.scenarios.filter((s) => s.status === 'pass').length,
      failed: r.scenarios.filter((s) => s.status === 'fail').length,
    })),
  });
});

runsRouter.get('/:id', (req, res) => {
  const record = runnerService.get(req.params.id);
  if (!record) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json(record);
});

runsRouter.get('/:id/stream', (req, res) => {
  const record = runnerService.get(req.params.id);
  if (!record) {
    res.status(404).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event: any) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  for (const evt of record.events) send(evt);

  if (record.status !== 'running') {
    res.write(`event: end\ndata: {"status":"${record.status}"}\n\n`);
    res.end();
    return;
  }

  const unsubscribe = runnerService.subscribe(record.id, (evt) => {
    send(evt);
    if (evt.type === 'finish' || evt.type === 'error') {
      res.write(`event: end\ndata: {"status":"${runnerService.get(record.id)?.status}"}\n\n`);
      res.end();
    }
  });

  req.on('close', () => unsubscribe());
});

runsRouter.get('/:id/video', (req, res) => {
  const record = runnerService.get(req.params.id);
  if (!record?.videoPath || !fs.existsSync(record.videoPath)) {
    res.status(404).json({ error: 'Video not available' });
    return;
  }
  // Stream with Range support for proper video playback (seeking, duration probe)
  const filePath = record.videoPath;
  const stat = fs.statSync(filePath);
  const total = stat.size;
  const range = req.headers.range;
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  if (range) {
    const m = range.match(/bytes=(\d+)-(\d*)/);
    const start = m ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : total - 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', end - start + 1);
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Length', total);
    fs.createReadStream(filePath).pipe(res);
  }
});

runsRouter.get('/:id/screenshots', (req, res) => {
  const record = runnerService.get(req.params.id);
  if (!record?.screenshotsDir || !fs.existsSync(record.screenshotsDir)) {
    res.json({ files: [] });
    return;
  }
  const files = fs
    .readdirSync(record.screenshotsDir)
    .filter((f) => /\.(png|jpg|jpeg)$/i.test(f));
  const origin = `${req.protocol}://${req.get('host')}`;
  res.json({
    files: files.map((f) => ({
      name: f,
      url: `${origin}/api/test-studio/runs/${record.id}/screenshots/${encodeURIComponent(f)}`,
    })),
  });
});

runsRouter.get('/:id/screenshots/:filename', (req, res) => {
  const record = runnerService.get(req.params.id);
  if (!record?.screenshotsDir) {
    res.status(404).end();
    return;
  }
  const safe = path.basename(req.params.filename);
  const full = path.join(record.screenshotsDir, safe);
  if (!fs.existsSync(full)) {
    res.status(404).end();
    return;
  }
  // dotfiles: 'allow' lets us serve files inside .test-studio/
  res.sendFile(path.resolve(full), { dotfiles: 'allow' });
});

void paths;
