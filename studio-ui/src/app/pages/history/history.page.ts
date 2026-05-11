import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  History as HistoryIcon,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Clock,
  Monitor,
  Video,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
  Play,
  FileText,
  Terminal,
} from 'lucide-angular';
import { RunsService, RunSummary, RunArtifact } from '../../services/runs.service';

interface LogLine {
  sequence: number;
  stream: 'stdout' | 'stderr' | 'event';
  line: string;
}
import { LibraryService, TestSummary } from '../../services/library.service';
import { ProjectsService } from '../../services/projects.service';

interface ExpandedArtifacts {
  loading: boolean;
  video: RunArtifact | null;
  screenshots: RunArtifact[];
  report: RunArtifact | null;
  error: string | null;
}

interface ExpandedLogs {
  loading: boolean;
  lines: LogLine[];
  source: 'log-bundle' | 'run_logs' | null;
  error: string | null;
}

@Component({
  selector: 'studio-history',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  template: `
    <div class="mx-auto max-w-7xl px-6 py-8">
      <header class="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900">
            <i-lucide [img]="History" class="h-6 w-6 text-indigo-600"></i-lucide>
            Run History
          </h1>
          <p class="mt-1 text-sm text-zinc-500">
            @if (!loading()) {
              {{ runs().length }} run{{ runs().length === 1 ? '' : 's' }} for this project
            } @else {
              Loading…
            }
          </p>
        </div>
        <button
          type="button"
          (click)="refresh()"
          [disabled]="loading()"
          class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 focus-ring"
        >
          <i-lucide [img]="RefreshCw" class="h-3.5 w-3.5" [class.animate-spin]="loading()"></i-lucide>
          Refresh
        </button>
      </header>

      @if (loading()) {
        <div class="h-1 w-full overflow-hidden rounded-full bg-zinc-100">
          <div class="h-full w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] bg-indigo-600"></div>
        </div>
      }

      @if (error(); as err) {
        <div class="mt-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <i-lucide [img]="AlertCircle" class="mt-0.5 h-4 w-4 text-red-600"></i-lucide>
          <div class="text-sm">
            <p class="font-medium text-red-900">Could not load history</p>
            <p class="mt-0.5 text-red-700">{{ err }}</p>
          </div>
        </div>
      }

      @if (!loading() && !error() && runs().length === 0) {
        <div class="mt-12 flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white py-16 text-center">
          <i-lucide [img]="History" class="h-8 w-8 text-zinc-400"></i-lucide>
          <h3 class="mt-3 text-sm font-medium text-zinc-900">No runs yet</h3>
          <p class="mt-1 text-sm text-zinc-500">Run a test from the Library to see it here.</p>
        </div>
      }

      @if (runs().length > 0) {
        <div class="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table class="min-w-full divide-y divide-zinc-200 text-sm">
            <thead class="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th class="w-8 px-2 py-2.5"></th>
                <th class="px-3 py-2.5 text-left">Status</th>
                <th class="px-3 py-2.5 text-left">Test</th>
                <th class="px-3 py-2.5 text-right">Scenarios</th>
                <th class="px-3 py-2.5 text-right">Duration</th>
                <th class="px-3 py-2.5 text-left">Started</th>
                <th class="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-100">
              @for (run of runs(); track run.id) {
                <tr
                  (click)="toggleExpand(run.id)"
                  class="cursor-pointer transition-colors hover:bg-zinc-50"
                  [class.bg-zinc-50]="expandedId() === run.id"
                >
                  <td class="px-2 py-2.5 text-zinc-400">
                    <i-lucide
                      [img]="expandedId() === run.id ? ChevronDown : ChevronRight"
                      class="h-3.5 w-3.5"
                    ></i-lucide>
                  </td>
                  <td class="px-3 py-2.5">
                    <span
                      class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset"
                      [class.bg-indigo-50]="run.status === 'running'"
                      [class.text-indigo-700]="run.status === 'running'"
                      [class.ring-indigo-200]="run.status === 'running'"
                      [class.bg-emerald-50]="run.status === 'passed'"
                      [class.text-emerald-700]="run.status === 'passed'"
                      [class.ring-emerald-200]="run.status === 'passed'"
                      [class.bg-red-50]="run.status === 'failed' || run.status === 'errored'"
                      [class.text-red-700]="run.status === 'failed' || run.status === 'errored'"
                      [class.ring-red-200]="run.status === 'failed' || run.status === 'errored'"
                      [class.bg-zinc-100]="run.status === 'queued' || run.status === 'cancelled'"
                      [class.text-zinc-600]="run.status === 'queued' || run.status === 'cancelled'"
                      [class.ring-zinc-200]="run.status === 'queued' || run.status === 'cancelled'"
                    >
                      @switch (run.status) {
                        @case ('running') { <i-lucide [img]="Loader2" class="h-3 w-3 animate-spin"></i-lucide> }
                        @case ('passed')  { <i-lucide [img]="CheckCircle2" class="h-3 w-3"></i-lucide> }
                        @case ('failed')  { <i-lucide [img]="XCircle" class="h-3 w-3"></i-lucide> }
                        @case ('errored') { <i-lucide [img]="AlertCircle" class="h-3 w-3"></i-lucide> }
                        @default          { <i-lucide [img]="Clock" class="h-3 w-3"></i-lucide> }
                      }
                      {{ run.status }}
                    </span>
                  </td>
                  <td class="max-w-xs truncate px-3 py-2.5 text-zinc-800">
                    {{ testName(run.testId) }}
                    @if (run.headed) {
                      <span class="ml-1 inline-flex items-center gap-0.5 text-[10px] text-zinc-500">
                        <i-lucide [img]="Monitor" class="h-2.5 w-2.5"></i-lucide>headed
                      </span>
                    }
                  </td>
                  <td class="px-3 py-2.5 text-right tabular-nums text-zinc-700">
                    @if (run.scenariosTotal != null && run.scenariosTotal > 0) {
                      <span class="text-emerald-600">{{ run.scenariosPassed ?? 0 }}</span>
                      <span class="text-zinc-400"> / </span>
                      <span class="text-red-600">{{ run.scenariosFailed ?? 0 }}</span>
                      <span class="text-zinc-400"> of {{ run.scenariosTotal }}</span>
                    } @else {
                      <span class="text-zinc-400">—</span>
                    }
                  </td>
                  <td class="px-3 py-2.5 text-right tabular-nums text-zinc-600">
                    {{ durationLabel(run.durationMs) }}
                  </td>
                  <td class="px-3 py-2.5 text-zinc-600" [title]="run.startedAt">
                    {{ relativeTime(run.startedAt) }}
                  </td>
                  <td class="px-3 py-2.5 text-right">
                    @if (run.testId) {
                      <a
                        [routerLink]="['/run', run.testId]"
                        (click)="$event.stopPropagation()"
                        class="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus-ring"
                        title="Re-run this test"
                      >
                        <i-lucide [img]="Play" class="h-3 w-3"></i-lucide>
                        Re-run
                      </a>
                    }
                  </td>
                </tr>

                @if (expandedId() === run.id) {
                  <tr class="bg-zinc-50">
                    <td colspan="7" class="px-6 py-4">
                      @if (artifactsState().loading) {
                        <p class="text-xs text-zinc-500">Loading artifacts…</p>
                      } @else if (artifactsState().error) {
                        <p class="text-xs text-red-600">{{ artifactsState().error }}</p>
                      } @else {
                        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                          <!-- Video -->
                          <div class="rounded-lg border border-zinc-200 bg-white">
                            <header class="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500">
                              <i-lucide [img]="Video" class="h-3.5 w-3.5"></i-lucide>
                              Recording
                            </header>
                            @if (artifactsState().video; as v) {
                              <video [src]="v.url" controls class="block w-full"></video>
                            } @else {
                              <div class="p-6 text-center text-xs text-zinc-400">No video available</div>
                            }
                          </div>

                          <!-- Screenshots -->
                          <div class="rounded-lg border border-zinc-200 bg-white">
                            <header class="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500">
                              <i-lucide [img]="ImageIcon" class="h-3.5 w-3.5"></i-lucide>
                              Screenshots ({{ artifactsState().screenshots.length }})
                              @if (artifactsState().report; as r) {
                                <a
                                  [href]="r.url"
                                  target="_blank"
                                  class="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                                >
                                  <i-lucide [img]="FileText" class="h-3 w-3"></i-lucide>
                                  Report
                                </a>
                              }
                            </header>
                            @if (artifactsState().screenshots.length === 0) {
                              <div class="p-6 text-center text-xs text-zinc-400">No screenshots</div>
                            } @else {
                              <div class="grid grid-cols-2 gap-2 p-3">
                                @for (s of artifactsState().screenshots; track s.id) {
                                  <a [href]="s.url" target="_blank" class="block overflow-hidden rounded border border-zinc-200 hover:border-indigo-300" [title]="s.scenarioName ?? ''">
                                    <img [src]="s.url" [alt]="s.scenarioName ?? 'screenshot'" class="aspect-video w-full object-cover" />
                                  </a>
                                }
                              </div>
                            }
                          </div>
                        </div>

                        <!-- Logs (full width) -->
                        <div class="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950">
                          <header class="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-400">
                            <i-lucide [img]="Terminal" class="h-3.5 w-3.5"></i-lucide>
                            Run log
                            @if (logsState().source; as src) {
                              <span class="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">{{ src === 'log-bundle' ? 'archived' : 'live' }}</span>
                            }
                            @if (logsState().lines.length > 0) {
                              <span class="ml-auto text-[10px] text-zinc-500">{{ logsState().lines.length }} lines</span>
                            }
                          </header>
                          @if (logsState().loading) {
                            <p class="p-3 text-xs text-zinc-500">Loading logs…</p>
                          } @else if (logsState().error) {
                            <p class="p-3 text-xs text-red-400">{{ logsState().error }}</p>
                          } @else if (logsState().lines.length === 0) {
                            <p class="p-3 text-xs text-zinc-500">No logs captured.</p>
                          } @else {
                            <pre class="m-0 max-h-96 overflow-auto p-3 font-mono text-[11px] leading-5 text-zinc-300">@for (l of logsState().lines; track l.sequence) {<span
                                [class.text-zinc-300]="l.stream === 'stdout'"
                                [class.text-red-400]="l.stream === 'stderr'"
                                [class.text-indigo-400]="l.stream === 'event'"
                              >{{ l.line }}
</span>}</pre>
                          }
                        </div>
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class HistoryPage implements OnInit {
  private readonly runsService = inject(RunsService);
  private readonly library = inject(LibraryService);
  private readonly projectsService = inject(ProjectsService);

  readonly History = HistoryIcon;
  readonly RefreshCw = RefreshCw;
  readonly CheckCircle2 = CheckCircle2;
  readonly XCircle = XCircle;
  readonly AlertCircle = AlertCircle;
  readonly Loader2 = Loader2;
  readonly Clock = Clock;
  readonly Monitor = Monitor;
  readonly Video = Video;
  readonly ImageIcon = ImageIcon;
  readonly ChevronDown = ChevronDown;
  readonly ChevronRight = ChevronRight;
  readonly Play = Play;
  readonly FileText = FileText;
  readonly Terminal = Terminal;

  readonly runs = signal<RunSummary[]>([]);
  readonly testsById = signal<Map<string, TestSummary>>(new Map());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly expandedId = signal<string | null>(null);
  readonly artifactsState = signal<ExpandedArtifacts>({
    loading: false, video: null, screenshots: [], report: null, error: null,
  });
  readonly logsState = signal<ExpandedLogs>({
    loading: false, lines: [], source: null, error: null,
  });

  readonly activeProject = computed(() => this.projectsService.activeProjectId());

  constructor() {
    effect(() => {
      this.activeProject();
      this.refresh();
    });
  }

  ngOnInit(): void {
    // initial load handled by effect()
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    const projectId = this.activeProject() ?? undefined;

    this.runsService.list(projectId).subscribe({
      next: (res) => {
        this.runs.set(res.runs);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? err?.message ?? 'Failed to load runs');
        this.loading.set(false);
      },
    });

    this.library.list(projectId).subscribe({
      next: (res) => {
        const map = new Map<string, TestSummary>();
        for (const t of res.tests) map.set(t.id, t);
        this.testsById.set(map);
      },
      error: () => { /* non-fatal: rows fall back to "Unknown test" */ },
    });
  }

  toggleExpand(runId: string): void {
    if (this.expandedId() === runId) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(runId);
    this.artifactsState.set({ loading: true, video: null, screenshots: [], report: null, error: null });
    this.logsState.set({ loading: true, lines: [], source: null, error: null });

    this.runsService.artifacts(runId).subscribe({
      next: (res) => {
        const video = res.artifacts.find((a) => a.kind === 'video') ?? null;
        const screenshots = res.artifacts.filter((a) => a.kind === 'screenshot');
        const report = res.artifacts.find((a) => a.kind === 'report') ?? null;
        this.artifactsState.set({ loading: false, video, screenshots, report, error: null });
      },
      error: (err) => {
        this.artifactsState.set({
          loading: false, video: null, screenshots: [], report: null,
          error: err?.error?.error ?? err?.message ?? 'Failed to load artifacts',
        });
      },
    });

    this.runsService.logs(runId, -1, 5000).subscribe({
      next: (res) => {
        this.logsState.set({
          loading: false,
          lines: res.logs as LogLine[],
          source: res.source,
          error: null,
        });
      },
      error: (err) => {
        this.logsState.set({
          loading: false, lines: [], source: null,
          error: err?.error?.error ?? err?.message ?? 'Failed to load logs',
        });
      },
    });
  }

  testName(testId: string | null): string {
    if (!testId) return 'Ad-hoc spec';
    return this.testsById().get(testId)?.name ?? 'Unknown test';
  }

  durationLabel(ms: number | null): string {
    if (ms == null) return '—';
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.round(ms / 100) / 10;
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }

  relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    return new Date(iso).toLocaleDateString();
  }
}
