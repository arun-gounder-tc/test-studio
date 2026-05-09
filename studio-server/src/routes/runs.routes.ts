import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { runnerService } from '../services/cypress-runner.service.js';
import { TestsRepo } from '../db/repositories/tests.repo.js';
import { RunsRepo } from '../db/repositories/runs.repo.js';
import { ProjectsRepo } from '../db/repositories/projects.repo.js';
import { workspaceMaterializer } from '../services/workspace-materializer.service.js';
import { paths } from '../utils/paths.js';
import { parseOrFail, UuidParam, StartRunBody, ListRunsQuery, RunLogsQuery } from '../utils/zod.js';

export const runsRouter = Router();

runsRouter.post('/', async (req, res) => {
  const body = parseOrFail(res, StartRunBody, req.body ?? {});
  if (!body) return;
  try {
    const { testId, headed } = body;
    let spec: string | undefined = body.specRelativePath;
    let projectId: string | undefined = body.projectId;

    if (testId) {
      const result = await TestsRepo.getWithLatestVersion(testId);
      if (!result) {
        res.status(404).json({ error: `Test ${testId} not found` });
        return;
      }
      projectId = projectId ?? result.test.projectId;
      spec = spec ?? await workspaceMaterializer.getSpecRelativePath(projectId, result.test.slug);
    }

    if (!projectId) {
      const def = await ProjectsRepo.getBySlug('default');
      projectId = def?.id;
    }
    if (!projectId) {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }

    const record = await runnerService.start({ testId, projectId, specRelativePath: spec!, headed: !!headed });
    res.json({
      runId: record.id,
      status: record.status,
      startedAt: record.startedAt,
      specPaths: record.specPaths,
      headed: record.headed,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to start run' });
  }
});

runsRouter.get('/', async (req, res) => {
  const query = parseOrFail(res, ListRunsQuery, req.query);
  if (!query) return;
  try {
    if (query.projectId) {
      const runs = await RunsRepo.listByProject(query.projectId);
      res.json({ runs });
    } else {
      const runs = await RunsRepo.listAll();
      res.json({ runs });
    }
  } catch {
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
  }
});

runsRouter.get('/:id', async (req, res) => {
  const params = parseOrFail(res, UuidParam, req.params);
  if (!params) return;
  let record = runnerService.get(params.id);
  if (!record) record = (await runnerService.loadFromDB(params.id)) ?? undefined;
  if (!record) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  res.json(record);
});

runsRouter.get('/:id/stream', async (req, res) => {
  const params = parseOrFail(res, UuidParam, req.params);
  if (!params) return;
  let record = runnerService.get(params.id);
  if (!record) record = (await runnerService.loadFromDB(params.id)) ?? undefined;
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
      res.write(`event: end\ndata: {"status":"${runnerService.get(record!.id)?.status}"}\n\n`);
      res.end();
    }
  });

  req.on('close', () => unsubscribe());
});

runsRouter.get('/:id/video', (req, res) => {
  const record = runnerService.get(req.params['id']);
  if (!record?.videoPath || !fs.existsSync(record.videoPath)) {
    res.status(404).json({ error: 'Video not available' });
    return;
  }
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
  const record = runnerService.get(req.params['id']);
  if (!record?.screenshotsDir || !fs.existsSync(record.screenshotsDir)) {
    res.json({ files: [] });
    return;
  }
  const files = fs.readdirSync(record.screenshotsDir).filter((f) => /\.(png|jpg|jpeg)$/i.test(f));
  const origin = `${req.protocol}://${req.get('host')}`;
  res.json({
    files: files.map((f) => ({
      name: f,
      url: `${origin}/api/test-studio/runs/${record!.id}/screenshots/${encodeURIComponent(f)}`,
    })),
  });
});

runsRouter.get('/:id/screenshots/:filename', (req, res) => {
  const record = runnerService.get(req.params['id']);
  if (!record?.screenshotsDir) { res.status(404).end(); return; }
  const safe = path.basename(req.params['filename']);
  const full = path.join(record.screenshotsDir, safe);
  if (!fs.existsSync(full)) { res.status(404).end(); return; }
  res.sendFile(path.resolve(full), { dotfiles: 'allow' });
});

/** GET /runs/:id/logs?after=-1&limit=500 */
runsRouter.get('/:id/logs', async (req, res) => {
  const params = parseOrFail(res, UuidParam, req.params);
  if (!params) return;
  const query = parseOrFail(res, RunLogsQuery, req.query);
  if (!query) return;
  try {
    const { RunLogsRepo } = await import('../db/repositories/run-logs.repo.js');
    const logs = await RunLogsRepo.listByRun(params.id, query.after, query.limit);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch logs' });
  }
});

void paths;


