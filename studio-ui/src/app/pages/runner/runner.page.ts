import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  ArrowLeft,
  Play,
  Monitor,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Loader2,
  Pencil,
  Eye,
  Image as ImageIcon,
  Video,
} from 'lucide-angular';
import {
  RunEvent,
  RunStatus,
  RunsService,
  ScenarioOutcome,
} from '../../services/runs.service';
import { LibraryService, TestSummary } from '../../services/library.service';
import { ProjectsService } from '../../services/projects.service';

interface LogLine {
  stream: 'stdout' | 'stderr' | 'system';
  text: string;
  ts: string;
}

@Component({
  selector: 'studio-runner',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  template: `
    <div class="mx-auto flex h-[calc(100vh-3.5rem)] max-w-7xl flex-col px-6 py-6">
      <!-- Header -->
      <header class="mb-4 flex items-end justify-between gap-4">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <a
              routerLink="/library"
              class="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-ring"
              title="Back to library"
            >
              <i-lucide [img]="ArrowLeft" class="h-4 w-4"></i-lucide>
            </a>
            <h1 class="truncate text-2xl font-semibold tracking-tight text-zinc-900">
              {{ testSummary()?.name ?? 'Test Run' }}
            </h1>
            <span
              class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset"
              [class.bg-indigo-50]="status() === 'running'"
              [class.text-indigo-700]="status() === 'running'"
              [class.ring-indigo-200]="status() === 'running'"
              [class.bg-emerald-50]="status() === 'passed'"
              [class.text-emerald-700]="status() === 'passed'"
              [class.ring-emerald-200]="status() === 'passed'"
              [class.bg-red-50]="status() === 'failed' || status() === 'errored'"
              [class.text-red-700]="status() === 'failed' || status() === 'errored'"
              [class.ring-red-200]="status() === 'failed' || status() === 'errored'"
            >
              @switch (status()) {
                @case ('running') { <i-lucide [img]="Loader2" class="h-3 w-3 animate-spin"></i-lucide> }
                @case ('passed')  { <i-lucide [img]="CheckCircle2" class="h-3 w-3"></i-lucide> }
                @default          { <i-lucide [img]="XCircle" class="h-3 w-3"></i-lucide> }
              }
              {{ statusLabel() }}
            </span>
          </div>
          <p class="mt-1 text-xs text-zinc-500">
            <code class="font-mono">{{ testSummary()?.relativePath ?? '…' }}</code>
            @if (durationLabel()) {
              · <i-lucide [img]="Clock" class="inline-block h-3 w-3 align-text-bottom"></i-lucide> {{ durationLabel() }}
            }
            · {{ headed() ? 'headed (browser visible)' : 'headless' }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          @if (testId(); as tid) {
            <a
              [routerLink]="['/edit', tid]"
              class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-ring"
            >
              <i-lucide [img]="Pencil" class="h-3.5 w-3.5"></i-lucide>
              Edit
            </a>
          }
          <div class="flex items-center divide-x divide-indigo-500 overflow-hidden rounded-md bg-indigo-600">
            <button
              type="button"
              (click)="rerunWithMode(false)"
              [disabled]="status() === 'running'"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 focus-ring"
            >
              <i-lucide [img]="RefreshCw" class="h-3.5 w-3.5"></i-lucide>
              Re-run
            </button>
            <button
              type="button"
              (click)="rerunWithMode(true)"
              [disabled]="status() === 'running'"
              class="inline-flex items-center gap-1 px-2 py-1.5 text-white hover:bg-indigo-700 disabled:opacity-50 focus-ring"
              title="Re-run with browser visible"
            >
              <i-lucide [img]="Monitor" class="h-3.5 w-3.5"></i-lucide>
            </button>
          </div>
        </div>
      </header>

      @if (errorMessage(); as err) {
        <div class="mb-3 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <i-lucide [img]="AlertCircle" class="mt-0.5 h-4 w-4 text-red-600"></i-lucide>
          <p class="text-sm text-red-800">{{ err }}</p>
        </div>
      }

      <div class="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <!-- Logs -->
        <section class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950">
          <header class="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-2">
            <span class="text-xs font-medium text-zinc-400">Live log</span>
            <label class="flex items-center gap-1.5 text-xs text-zinc-400">
              <input
                type="checkbox"
                [checked]="autoScroll()"
                (change)="toggleAutoScroll()"
                class="h-3 w-3 rounded border-zinc-600 bg-zinc-900 text-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              Auto-scroll
            </label>
          </header>
          <pre
            #logBox
            class="m-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-5 text-zinc-300"
          >@for (l of logs(); track l.ts + l.text) {<span
              [class.text-zinc-300]="l.stream === 'stdout'"
              [class.text-red-400]="l.stream === 'stderr'"
              [class.text-indigo-400]="l.stream === 'system'"
            >{{ l.text }}
</span>}@if (status() === 'running' && logs().length === 0) {<span class="text-zinc-500">Waiting for output…</span>}</pre>
        </section>

        <!-- Side: scenarios + artifacts -->
        <aside class="flex flex-col gap-4 overflow-y-auto">
          <!-- Counts -->
          <div class="grid grid-cols-2 gap-2">
            <div class="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div class="text-[11px] font-medium uppercase tracking-wide text-emerald-700">Passed</div>
              <div class="mt-1 text-2xl font-semibold text-emerald-700">{{ passCount() }}</div>
            </div>
            <div class="rounded-lg border border-red-200 bg-red-50 p-3">
              <div class="text-[11px] font-medium uppercase tracking-wide text-red-700">Failed</div>
              <div class="mt-1 text-2xl font-semibold text-red-700">{{ failCount() }}</div>
            </div>
          </div>

          <!-- Scenarios -->
          <div class="rounded-lg border border-zinc-200 bg-white">
            <header class="border-b border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500">Scenarios</header>
            <ul class="divide-y divide-zinc-100">
              @if (scenarios().length === 0) {
                <li class="px-3 py-3 text-xs text-zinc-400">No scenarios yet…</li>
              }
              @for (s of scenarios(); track s.name) {
                <li class="flex items-center gap-2 px-3 py-2 text-xs">
                  <i-lucide
                    [img]="s.status === 'pass' ? CheckCircle2 : XCircle"
                    class="h-3.5 w-3.5 shrink-0"
                    [class.text-emerald-600]="s.status === 'pass'"
                    [class.text-red-600]="s.status === 'fail'"
                  ></i-lucide>
                  <span class="flex-1 truncate text-zinc-800">{{ s.name }}</span>
                </li>
              }
            </ul>
          </div>

          <!-- Video -->
          @if (videoUrl(); as v) {
            <div class="rounded-lg border border-zinc-200 bg-white">
              <header class="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500">
                <i-lucide [img]="Video" class="h-3.5 w-3.5"></i-lucide>
                Recording
              </header>
              <video [src]="v" controls class="block w-full"></video>
            </div>
          }

          <!-- Screenshots -->
          @if (screenshots().length) {
            <div class="rounded-lg border border-zinc-200 bg-white">
              <header class="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500">
                <i-lucide [img]="ImageIcon" class="h-3.5 w-3.5"></i-lucide>
                Screenshots ({{ screenshots().length }})
              </header>
              <div class="grid grid-cols-2 gap-2 p-3">
                @for (s of screenshots(); track s.url) {
                  <a [href]="s.url" target="_blank" class="block overflow-hidden rounded border border-zinc-200 hover:border-indigo-300">
                    <img [src]="s.url" [alt]="s.name" class="aspect-video w-full object-cover" />
                  </a>
                }
              </div>
            </div>
          }
        </aside>
      </div>
    </div>
  `,
})
export class RunnerPage implements OnInit, OnDestroy, AfterViewChecked {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly runsService = inject(RunsService);
  private readonly library = inject(LibraryService);
  private readonly projectsService = inject(ProjectsService);

  @ViewChild('logBox') logBox?: ElementRef<HTMLPreElement>;

  readonly ArrowLeft = ArrowLeft;
  readonly Play = Play;
  readonly Monitor = Monitor;
  readonly RefreshCw = RefreshCw;
  readonly CheckCircle2 = CheckCircle2;
  readonly XCircle = XCircle;
  readonly AlertCircle = AlertCircle;
  readonly Clock = Clock;
  readonly Loader2 = Loader2;
  readonly Pencil = Pencil;
  readonly Eye = Eye;
  readonly ImageIcon = ImageIcon;
  readonly Video = Video;

  readonly testId = signal<string | null>(null);
  readonly testSummary = signal<TestSummary | null>(null);
  readonly runId = signal<string | null>(null);
  readonly status = signal<RunStatus>('running');
  readonly headed = signal(false);
  readonly logs = signal<LogLine[]>([]);
  readonly scenarios = signal<ScenarioOutcome[]>([]);
  readonly startedAt = signal<string | null>(null);
  readonly finishedAt = signal<string | null>(null);
  readonly videoAvailable = signal(false);
  readonly screenshots = signal<{ name: string; url: string }[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly autoScroll = signal(true);

  readonly passCount = computed(() => this.scenarios().filter((s) => s.status === 'pass').length);
  readonly failCount = computed(() => this.scenarios().filter((s) => s.status === 'fail').length);
  readonly durationLabel = computed(() => {
    const start = this.startedAt();
    const end = this.finishedAt();
    if (!start) return '';
    const endMs = end ? new Date(end).getTime() : Date.now();
    const seconds = Math.max(0, Math.floor((endMs - new Date(start).getTime()) / 1000));
    return `${seconds}s`;
  });

  private unsubscribe?: () => void;
  private shouldAutoscroll = true;

  ngOnInit(): void {
    const testId = this.route.snapshot.paramMap.get('testId');
    if (!testId) {
      this.errorMessage.set('Missing test id in URL');
      return;
    }
    this.testId.set(testId);
    this.headed.set(this.route.snapshot.queryParamMap.get('headed') === '1');

    this.library.list().subscribe((res) => {
      const t = res.tests.find((x) => x.id === testId);
      if (t) this.testSummary.set(t);
    });

    this.startRun();
  }

  ngAfterViewChecked(): void {
    if (this.shouldAutoscroll && this.autoScroll() && this.logBox?.nativeElement) {
      const el = this.logBox.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
    this.shouldAutoscroll = false;
  }

  ngOnDestroy(): void { this.unsubscribe?.(); }

  startRun(): void {
    const testId = this.testId();
    if (!testId) return;

    this.unsubscribe?.();
    this.logs.set([]);
    this.scenarios.set([]);
    this.status.set('running');
    this.errorMessage.set(null);
    this.videoAvailable.set(false);
    this.screenshots.set([]);
    this.finishedAt.set(null);

    this.runsService.start(testId, { headed: this.headed(), projectId: this.projectsService.activeProjectId() ?? undefined }).subscribe({
      next: (res) => {
        this.runId.set(res.runId);
        this.startedAt.set(res.startedAt);
        this.attachStream(res.runId);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error ?? err?.message ?? 'Failed to start run');
        this.status.set('errored');
      },
    });
  }

  rerunWithMode(headed: boolean): void {
    this.headed.set(headed);
    this.startRun();
  }

  private attachStream(runId: string): void {
    this.unsubscribe = this.runsService.stream(runId, {
      onEvent: (event) => this.handleEvent(event),
      onEnd: () => this.handleEnd(runId),
      onError: () => {
        if (this.status() === 'running') {
          this.errorMessage.set('Lost connection to live log stream');
        }
      },
    });
  }

  private handleEvent(event: RunEvent): void {
    this.shouldAutoscroll = true;
    if (event.type === 'log' && event.data.line) {
      this.appendLog({
        stream: (event.data.stream as 'stdout' | 'stderr') ?? 'stdout',
        text: event.data.line,
        ts: event.ts,
      });
    } else if (event.type === 'start') {
      this.appendLog({ stream: 'system', text: event.data.message ?? 'Started', ts: event.ts });
    } else if (event.type === 'scenario') {
      this.scenarios.update((list) => [
        ...list,
        {
          name: String(event.data.name ?? 'Scenario'),
          status: (event.data.status as 'pass' | 'fail' | 'skip') ?? 'pass',
          durationMs: event.data.durationMs,
        },
      ]);
    } else if (event.type === 'finish') {
      const exitCode = event.data.exitCode ?? 0;
      const failed = (event.data.scenarios ?? []).some((s: any) => s.status === 'fail');
      this.status.set(exitCode === 0 && !failed ? 'passed' : exitCode === 0 ? 'failed' : 'errored');
      this.finishedAt.set(event.ts);
      this.videoAvailable.set(!!event.data.videoPath);
    } else if (event.type === 'error') {
      this.errorMessage.set(String(event.data.message ?? 'Run errored'));
      this.status.set('errored');
      this.finishedAt.set(event.ts);
    }
  }

  private handleEnd(runId: string): void {
    this.runsService.screenshotsList(runId).subscribe({
      next: (res) => this.screenshots.set(res.files),
      error: () => { /* ignore */ },
    });
  }

  private appendLog(line: LogLine): void {
    this.logs.update((list) => [...list, line]);
  }

  videoUrl(): string | null {
    const id = this.runId();
    return id && this.videoAvailable() ? this.runsService.videoUrl(id) : null;
  }

  statusLabel(): string {
    switch (this.status()) {
      case 'running': return 'Running';
      case 'passed':  return 'Passed';
      case 'failed':  return 'Failed';
      case 'errored': return 'Errored';
    }
  }

  toggleAutoScroll(): void { this.autoScroll.update((v) => !v); }
}
