import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { paths } from '../utils/paths.js';
import { RunsRepo } from '../db/repositories/runs.repo.js';
import { RunLogsRepo } from '../db/repositories/run-logs.repo.js';
import { Run } from '../db/models/run.model.js';
import { ProjectsRepo } from '../db/repositories/projects.repo.js';
import { storage } from './storage/index.js';

const gzipAsync = promisify(zlib.gzip);

export type RunEventType =
  | 'start'
  | 'log'
  | 'scenario'
  | 'finish'
  | 'error';

export interface RunEvent {
  type: RunEventType;
  ts: string;
  data: Record<string, unknown>;
}

/** In-memory shape kept for SSE streaming; DB is source of truth for status/counts */
export interface RunRecord {
  id: string;
  testId: string | null;
  projectId: string;
  specPaths: string[];
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'passed' | 'failed' | 'errored';
  exitCode: number | null;
  scenarios: { name: string; status: 'pass' | 'fail' | 'skip'; durationMs?: number }[];
  events: RunEvent[];
  videoPath: string | null;
  screenshotsDir: string | null;
  headed: boolean;
}

const SCENARIO_PASS_RE = /^\s*✓\s+(.+?)(?:\s+\((\d+)ms\))?\s*$/;

class RunnerService extends EventEmitter {
  /** In-memory cache for active/recent runs (SSE replay, video/screenshot serving) */
  private runs = new Map<string, RunRecord>();
  private processes = new Map<string, ChildProcess>();
  /** Per-run log buffer for batch DB inserts */
  private logBuffers = new Map<string, { lines: { stream: 'stdout' | 'stderr' | 'event'; line: string }[]; seq: number }>();

  list(): RunRecord[] {
    return Array.from(this.runs.values()).sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt)
    );
  }

  get(id: string): RunRecord | undefined {
    return this.runs.get(id);
  }

  /** Load run from DB into memory (for SSE replay of past runs) */
  async loadFromDB(id: string): Promise<RunRecord | null> {
    const dbRun = await RunsRepo.get(id);
    if (!dbRun) return null;
    const record: RunRecord = {
      id: dbRun.id,
      testId: dbRun.testId,
      projectId: dbRun.projectId,
      specPaths: [],
      startedAt: dbRun.startedAt.toISOString(),
      finishedAt: dbRun.finishedAt?.toISOString() ?? null,
      status: dbRun.status as RunRecord['status'],
      exitCode: dbRun.exitCode,
      scenarios: [],
      events: [],
      videoPath: null,
      screenshotsDir: null,
      headed: dbRun.headed,
    };
    this.runs.set(id, record);
    return record;
  }

  async start(opts: { testId?: string; projectId: string; specRelativePath: string; headed?: boolean }): Promise<RunRecord> {
    const fullSpec = path.join(paths.projectRoot, opts.specRelativePath);
    if (!fs.existsSync(fullSpec)) {
      throw new Error(`Spec not found: ${opts.specRelativePath}`);
    }
    const headed = !!opts.headed;

    // Persist to DB first
    const dbRun = await RunsRepo.create({
      projectId: opts.projectId,
      testId: opts.testId,
      headed,
    });

    const record: RunRecord = {
      id: dbRun.id,
      testId: opts.testId ?? null,
      projectId: opts.projectId,
      specPaths: [opts.specRelativePath],
      startedAt: dbRun.startedAt.toISOString(),
      finishedAt: null,
      status: 'running',
      exitCode: null,
      scenarios: [],
      events: [],
      videoPath: null,
      screenshotsDir: null,
      headed,
    };
    this.runs.set(dbRun.id, record);
    this.logBuffers.set(dbRun.id, { lines: [], seq: 0 });

    this.appendEvent(record, 'start', {
      spec: opts.specRelativePath,
      headed,
      message: `Starting Cypress run for ${opts.specRelativePath}${headed ? ' (headed — browser will pop up)' : ' (headless)'}`,
    });

    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      FORCE_COLOR: '0',
    };

    // Resolve the project's target-app baseUrl from DB and pass it via the
    // Cypress-native CYPRESS_BASE_URL env var. Cypress automatically applies
    // any CYPRESS_* env var to its config (CYPRESS_BASE_URL → config.baseUrl).
    // This means cy.visit('/') and cy.visit('/sign-in') resolve against the
    // project's target app — no studio.config.json round-trip needed.
    const project = await ProjectsRepo.get(opts.projectId);
    if (project?.baseUrl) {
      env.CYPRESS_BASE_URL = project.baseUrl;
      env.CY_USE_BASE_URL = '1'; // legacy fallback for cypress.config.ts conditional
    }

    const cypressArgs = [
      'cypress',
      'run',
      '--spec',
      opts.specRelativePath,
      '--reporter',
      'spec',
    ];
    if (headed) cypressArgs.push('--headed');

    // In a container we need a virtual display for headed runs. xvfb-run
    // is installed in our Dockerfile; locally it's only used if present.
    // For headless runs Cypress launches Electron without a display.
    const useXvfb = headed && process.env.NODE_ENV === 'production';
    const execName = useXvfb ? 'xvfb-run' : 'npx';
    const execArgs = useXvfb
      ? ['--auto-servernum', '--server-args=-screen 0 1440x900x24', 'npx', ...cypressArgs]
      : cypressArgs;

    const child = spawn(execName, execArgs, {
      cwd: paths.projectRoot,
      env,
    });
    this.processes.set(dbRun.id, child);

    let stdoutBuffer = '';
    const onStream = (chunk: Buffer | string, stream: 'stdout' | 'stderr') => {
      const text = chunk.toString();
      stdoutBuffer += text;
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        this.processLine(record, line, stream);
      }
    };

    child.stdout.on('data', (c) => onStream(c, 'stdout'));
    child.stderr.on('data', (c) => onStream(c, 'stderr'));

    child.on('close', async (code) => {
      if (stdoutBuffer.trim()) {
        this.processLine(record, stdoutBuffer, 'stdout');
        stdoutBuffer = '';
      }
      // Flush remaining log buffer
      await this.flushLogs(record.id);

      const exit = code ?? 0;
      record.exitCode = exit;
      record.finishedAt = new Date().toISOString();

      const reportScenarios = this.readCucumberReport();
      if (reportScenarios) record.scenarios = reportScenarios;

      const hasFailures = record.scenarios.some((s) => s.status === 'fail');
      record.status = exit === 0 && !hasFailures ? 'passed' : exit === 0 ? 'failed' : 'errored';

      const videoCandidate = path.join(
        paths.projectRoot,
        '.test-studio/runs/videos',
        `${path.basename(opts.specRelativePath)}.mp4`
      );
      if (fs.existsSync(videoCandidate)) record.videoPath = videoCandidate;

      const screenshotsCandidate = path.join(
        paths.projectRoot,
        '.test-studio/runs/screenshots',
        path.basename(opts.specRelativePath)
      );
      if (fs.existsSync(screenshotsCandidate)) record.screenshotsDir = screenshotsCandidate;

      // Persist final status to DB
      const startMs = new Date(record.startedAt).getTime();
      await RunsRepo.updateStatus(record.id, {
        status: record.status as Run['status'],
        exitCode: exit,
        scenariosTotal: record.scenarios.length,
        scenariosPassed: record.scenarios.filter((s) => s.status === 'pass').length,
        scenariosFailed: record.scenarios.filter((s) => s.status === 'fail').length,
        durationMs: Date.now() - startMs,
        finishedAt: new Date(),
      });

      this.appendEvent(record, 'finish', {
        exitCode: exit,
        status: record.status,
        scenarios: record.scenarios,
        videoPath: record.videoPath,
        screenshotsDir: record.screenshotsDir,
      });
      this.processes.delete(dbRun.id);

      // Upload artifacts in background (best-effort) so SSE 'finish' fires immediately
      setImmediate(() => {
        this.uploadArtifacts(record).catch((err) => {
          console.warn(`[run ${record.id}] uploadArtifacts failed:`, err instanceof Error ? err.message : err);
        });
      });
    });

    child.on('error', async (err) => {
      record.status = 'errored';
      record.finishedAt = new Date().toISOString();
      this.appendEvent(record, 'error', { message: err.message });
      await this.flushLogs(record.id);
      await RunsRepo.updateStatus(record.id, { status: 'errored', finishedAt: new Date() });
      this.processes.delete(dbRun.id);
    });

    return record;
  }

  private processLine(record: RunRecord, rawLine: string, stream: 'stdout' | 'stderr'): void {
    const line = rawLine.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
    if (!line.trim()) return;

    this.appendEvent(record, 'log', { stream, line });

    // Buffer for DB batch insert
    const buf = this.logBuffers.get(record.id);
    if (buf) {
      buf.lines.push({ stream, line });
      if (buf.lines.length >= 50) {
        this.flushLogs(record.id).catch(() => {});
      }
    }

    const passMatch = line.match(SCENARIO_PASS_RE);
    if (passMatch) {
      const name = passMatch[1].trim();
      const ms = passMatch[2] ? parseInt(passMatch[2], 10) : undefined;
      record.scenarios.push({ name, status: 'pass', durationMs: ms });
      this.appendEvent(record, 'scenario', { name, status: 'pass', durationMs: ms });
    }
  }

  private async flushLogs(runId: string): Promise<void> {
    const buf = this.logBuffers.get(runId);
    if (!buf || buf.lines.length === 0) return;
    const toInsert = buf.lines.splice(0);
    const startSeq = buf.seq;
    buf.seq += toInsert.length;
    try {
      await RunLogsRepo.batchInsert(runId, toInsert, startSeq);
    } catch {
      // Non-fatal — logs may not persist but run continues
    }
  }

  private readCucumberReport(): { name: string; status: 'pass' | 'fail' | 'skip'; durationMs?: number }[] | null {
    const reportPath = path.join(paths.projectRoot, '.test-studio/last-run.json');
    if (!fs.existsSync(reportPath)) return null;

    try {
      const raw = fs.readFileSync(reportPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const features = Array.isArray(parsed) ? parsed : [parsed];
      const scenarios: { name: string; status: 'pass' | 'fail' | 'skip'; durationMs?: number }[] = [];

      for (const feature of features) {
        if (!feature?.elements) continue;
        for (const el of feature.elements) {
          if (el.type !== 'scenario' && el.type !== 'scenario_outline') continue;
          const steps = el.steps ?? [];
          let nanoTotal = 0;
          let hasFail = false;
          let hasPending = false;
          for (const step of steps) {
            const r = step.result ?? {};
            if (r.duration) nanoTotal += r.duration;
            if (r.status === 'failed') hasFail = true;
            if (r.status === 'pending' || r.status === 'skipped') hasPending = true;
          }
          const status: 'pass' | 'fail' | 'skip' = hasFail
            ? 'fail'
            : hasPending && steps.every((s: any) => s.result?.status !== 'passed')
              ? 'skip'
              : 'pass';
          scenarios.push({
            name: el.name ?? 'Unnamed scenario',
            status,
            durationMs: nanoTotal ? Math.round(nanoTotal / 1_000_000) : undefined,
          });
        }
      }

      return scenarios.length ? scenarios : null;
    } catch (err) {
      // Don't crash the run on bad reports — fall back to stdout-derived scenarios
      return null;
    }
  }

  private appendEvent(record: RunRecord, type: RunEventType, data: Record<string, unknown>): void {
    const event: RunEvent = {
      type,
      ts: new Date().toISOString(),
      data,
    };
    record.events.push(event);
    this.emit(`run:${record.id}`, event);
    this.emit('any', { runId: record.id, event });
  }

  /**
   * Upload run artifacts (video, screenshots, cucumber report) to object storage,
   * write run_artifacts rows, and (by default) delete the local copies.
   * Best-effort: failures are logged but don't fail the run.
   */
  private async uploadArtifacts(record: RunRecord): Promise<void> {
    const keepLocal = process.env.KEEP_LOCAL_ARTIFACTS === 'true';
    const tasks: Promise<void>[] = [];

    if (record.videoPath && fs.existsSync(record.videoPath)) {
      const videoPath = record.videoPath;
      tasks.push((async () => {
        try {
          const stat = fs.statSync(videoPath);
          const key = `run-artifacts/${record.id}/video.mp4`;
          await storage.putObject({
            key,
            body: fs.createReadStream(videoPath),
            contentType: 'video/mp4',
            sizeBytes: stat.size,
          });
          await RunsRepo.attachArtifact({
            runId: record.id,
            kind: 'video',
            minioKey: key,
            contentType: 'video/mp4',
            sizeBytes: stat.size,
          });
          if (!keepLocal) {
            fs.unlinkSync(videoPath);
            record.videoPath = null;
          }
        } catch (err) {
          console.warn(`[run ${record.id}] video upload failed:`, err instanceof Error ? err.message : err);
        }
      })());
    }

    if (record.screenshotsDir && fs.existsSync(record.screenshotsDir)) {
      const dir = record.screenshotsDir;
      const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f));
      for (const filename of files) {
        tasks.push((async () => {
          try {
            const filePath = path.join(dir, filename);
            const stat = fs.statSync(filePath);
            const ext = path.extname(filename).toLowerCase();
            const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
            const key = `run-artifacts/${record.id}/screenshots/${filename}`;
            // 'Login -- failure (1).png' -> 'Login'
            const scenarioName = filename
              .replace(/\s*\(\d+\)/, '')
              .replace(/\s*--.*$/, '')
              .replace(/\.[a-z]+$/i, '')
              .trim() || undefined;
            await storage.putObject({
              key,
              body: fs.createReadStream(filePath),
              contentType,
              sizeBytes: stat.size,
            });
            await RunsRepo.attachArtifact({
              runId: record.id,
              kind: 'screenshot',
              minioKey: key,
              contentType,
              sizeBytes: stat.size,
              scenarioName,
            });
            if (!keepLocal) fs.unlinkSync(filePath);
          } catch (err) {
            console.warn(`[run ${record.id}] screenshot upload failed (${filename}):`, err instanceof Error ? err.message : err);
          }
        })());
      }
    }

    const reportPath = path.join(paths.projectRoot, '.test-studio/last-run.json');
    if (fs.existsSync(reportPath)) {
      tasks.push((async () => {
        try {
          const stat = fs.statSync(reportPath);
          const key = `run-artifacts/${record.id}/cucumber-report.json`;
          await storage.putObject({
            key,
            body: fs.createReadStream(reportPath),
            contentType: 'application/json',
            sizeBytes: stat.size,
          });
          await RunsRepo.attachArtifact({
            runId: record.id,
            kind: 'report',
            minioKey: key,
            contentType: 'application/json',
            sizeBytes: stat.size,
          });
        } catch (err) {
          console.warn(`[run ${record.id}] report upload failed:`, err instanceof Error ? err.message : err);
        }
      })());
    }

    await Promise.all(tasks);

    // Log-bundle compaction: gather per-line rows, gzip, upload to MinIO,
    // then delete the per-line rows. Keeps run_logs table small while
    // preserving full log history (replayable via /runs/:id/logs).
    try {
      const rows = await RunLogsRepo.listAllByRun(record.id);
      if (rows.length > 0) {
        const payload = rows.map((r) => ({
          sequence: r.sequence,
          stream: r.stream,
          line: r.line,
          ts: r.ts?.toISOString?.() ?? null,
        }));
        const gz = await gzipAsync(Buffer.from(JSON.stringify(payload), 'utf-8'));
        const key = `run-artifacts/${record.id}/logs.json.gz`;
        await storage.putObject({
          key,
          body: gz,
          contentType: 'application/gzip',
          sizeBytes: gz.length,
        });
        await RunsRepo.attachArtifact({
          runId: record.id,
          kind: 'log-bundle',
          minioKey: key,
          contentType: 'application/gzip',
          sizeBytes: gz.length,
        });
        await RunLogsRepo.deleteByRun(record.id);
      }
    } catch (err) {
      console.warn(`[run ${record.id}] log-bundle compaction failed:`, err instanceof Error ? err.message : err);
    }

    if (!keepLocal && record.screenshotsDir && fs.existsSync(record.screenshotsDir)) {
      try {
        const remaining = fs.readdirSync(record.screenshotsDir);
        if (remaining.length === 0) {
          fs.rmdirSync(record.screenshotsDir);
          record.screenshotsDir = null;
        }
      } catch {
        // non-fatal
      }
    }
  }

  subscribe(runId: string, listener: (event: RunEvent) => void): () => void {
    const channel = `run:${runId}`;
    this.on(channel, listener);
    return () => this.off(channel, listener);
  }
}

export const runnerService = new RunnerService();
