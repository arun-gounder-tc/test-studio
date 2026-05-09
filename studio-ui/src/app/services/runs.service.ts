import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type RunStatus = 'running' | 'passed' | 'failed' | 'errored';

export interface RunStartResponse {
  runId: string;
  status: RunStatus;
  startedAt: string;
  specPaths: string[];
}

export interface ScenarioOutcome {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  durationMs?: number;
}

export interface RunRecord {
  id: string;
  testId: string | null;
  specPaths: string[];
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  exitCode: number | null;
  scenarios: ScenarioOutcome[];
  videoPath: string | null;
  screenshotsDir: string | null;
}

export interface RunEvent {
  type: 'start' | 'log' | 'scenario' | 'finish' | 'error';
  ts: string;
  data: {
    line?: string;
    stream?: 'stdout' | 'stderr';
    name?: string;
    status?: string;
    durationMs?: number;
    message?: string;
    spec?: string;
    exitCode?: number;
    scenarios?: ScenarioOutcome[];
    videoPath?: string | null;
    screenshotsDir?: string | null;
  };
}

@Injectable({ providedIn: 'root' })
export class RunsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3001/api/test-studio/runs';

  start(testId: string, opts: { headed?: boolean; projectId?: string } = {}): Observable<RunStartResponse> {
    return this.http.post<RunStartResponse>(this.baseUrl, { testId, headed: !!opts.headed, projectId: opts.projectId });
  }

  get(runId: string): Observable<RunRecord> {
    return this.http.get<RunRecord>(`${this.baseUrl}/${runId}`);
  }

  stream(runId: string, handlers: {
    onEvent: (event: RunEvent) => void;
    onEnd: () => void;
    onError: (err: Event) => void;
  }): () => void {
    const url = `${this.baseUrl}/${runId}/stream`;
    const es = new EventSource(url);

    const onAnyEvent = (type: RunEvent['type']) => (msg: MessageEvent) => {
      try {
        const parsed = JSON.parse(msg.data);
        handlers.onEvent({ ...parsed, type });
      } catch {
        /* swallow malformed events */
      }
    };

    es.addEventListener('start', onAnyEvent('start'));
    es.addEventListener('log', onAnyEvent('log'));
    es.addEventListener('scenario', onAnyEvent('scenario'));
    es.addEventListener('finish', onAnyEvent('finish'));
    es.addEventListener('error', onAnyEvent('error'));
    es.addEventListener('end', () => {
      handlers.onEnd();
      es.close();
    });
    es.onerror = (err) => {
      handlers.onError(err);
    };

    return () => es.close();
  }

  videoUrl(runId: string): string {
    return `${this.baseUrl}/${runId}/video`;
  }

  screenshotsList(runId: string): Observable<{ files: { name: string; url: string }[] }> {
    return this.http.get<{ files: { name: string; url: string }[] }>(
      `${this.baseUrl}/${runId}/screenshots`
    );
  }
}
