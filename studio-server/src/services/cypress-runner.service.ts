import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../utils/paths.js';

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

export interface RunRecord {
  id: string;
  testId: string | null;
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
  private runs = new Map<string, RunRecord>();
  private processes = new Map<string, ChildProcess>();

  list(): RunRecord[] {
    return Array.from(this.runs.values()).sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt)
    );
  }

  get(id: string): RunRecord | undefined {
    return this.runs.get(id);
  }

  start(opts: { testId?: string; specRelativePath: string; headed?: boolean }): RunRecord {
    const runId = randomUUID();
    const fullSpec = path.join(paths.projectRoot, opts.specRelativePath);
    if (!fs.existsSync(fullSpec)) {
      throw new Error(`Spec not found: ${opts.specRelativePath}`);
    }
    const headed = !!opts.headed;

    const record: RunRecord = {
      id: runId,
      testId: opts.testId ?? null,
      specPaths: [opts.specRelativePath],
      startedAt: new Date().toISOString(),
      finishedAt: null,
      status: 'running',
      exitCode: null,
      scenarios: [],
      events: [],
      videoPath: null,
      screenshotsDir: null,
      headed,
    };
    this.runs.set(runId, record);

    this.appendEvent(record, 'start', {
      spec: opts.specRelativePath,
      headed,
      message: `Starting Cypress run for ${opts.specRelativePath}${headed ? ' (headed — browser will pop up)' : ' (headless)'}`,
    });

    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      FORCE_COLOR: '0',
    };
    // Only enable baseUrl when the spec actually uses relative URLs.
    // Otherwise Cypress pre-verifies an unused baseUrl and fails.
    if (this.specNeedsBaseUrl(fullSpec)) {
      env.CY_USE_BASE_URL = '1';
    } else {
      delete env.CY_USE_BASE_URL;
    }

    const args = [
      'cypress',
      'run',
      '--spec',
      opts.specRelativePath,
      '--reporter',
      'spec',
    ];
    if (headed) args.push('--headed');

    const child = spawn('npx', args, {
      cwd: paths.projectRoot,
      env,
    });
    this.processes.set(runId, child);

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

    child.on('close', (code) => {
      if (stdoutBuffer.trim()) {
        this.processLine(record, stdoutBuffer, 'stdout');
        stdoutBuffer = '';
      }
      const exit = code ?? 0;
      record.exitCode = exit;
      record.finishedAt = new Date().toISOString();

      // Replace stdout-derived scenarios with accurate data from cucumber JSON report
      const reportScenarios = this.readCucumberReport();
      if (reportScenarios) {
        record.scenarios = reportScenarios;
      }

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
      if (fs.existsSync(screenshotsCandidate)) {
        record.screenshotsDir = screenshotsCandidate;
      }

      this.appendEvent(record, 'finish', {
        exitCode: exit,
        status: record.status,
        scenarios: record.scenarios,
        videoPath: record.videoPath,
        screenshotsDir: record.screenshotsDir,
      });
      this.processes.delete(runId);
    });

    child.on('error', (err) => {
      record.status = 'errored';
      record.finishedAt = new Date().toISOString();
      this.appendEvent(record, 'error', { message: err.message });
      this.processes.delete(runId);
    });

    return record;
  }

  private processLine(record: RunRecord, rawLine: string, stream: 'stdout' | 'stderr'): void {
    const line = rawLine.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
    if (!line.trim()) return;

    this.appendEvent(record, 'log', { stream, line });

    // Live updates only for passing scenarios — failures come from the JSON report at end
    const passMatch = line.match(SCENARIO_PASS_RE);
    if (passMatch) {
      const name = passMatch[1].trim();
      const ms = passMatch[2] ? parseInt(passMatch[2], 10) : undefined;
      record.scenarios.push({ name, status: 'pass', durationMs: ms });
      this.appendEvent(record, 'scenario', { name, status: 'pass', durationMs: ms });
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

  private specNeedsBaseUrl(absSpecPath: string): boolean {
    try {
      const content = fs.readFileSync(absSpecPath, 'utf-8');
      // Match relative paths in:
      //  - cy.visit('/foo')   cy.visit("/foo")   cy.visit(`/foo`)
      //  - "I navigate to '/foo'"  "When I am on '/foo'"
      // Excludes absolute URLs (http://, https://) and Windows paths.
      return /(?:cy\.visit\s*\(\s*['"`]\/|(?:navigate to|am on|go to)\s+['"`]\/)/i.test(content);
    } catch {
      return false;
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

  subscribe(runId: string, listener: (event: RunEvent) => void): () => void {
    const channel = `run:${runId}`;
    this.on(channel, listener);
    return () => this.off(channel, listener);
  }
}

export const runnerService = new RunnerService();
