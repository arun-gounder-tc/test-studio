import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  ArrowLeft,
  Save,
  Play,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ListChecks,
  Tag,
  Monitor,
} from 'lucide-angular';
import { LibraryService } from '../../services/library.service';
import { ToastService } from '../../shared/toast/toast.service';

interface ValidationState {
  ok: boolean;
  errors: string[];
  warnings: string[];
  scenarioCount: number;
  hasTags: boolean;
}

@Component({
  selector: 'studio-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  template: `
    <div class="mx-auto flex h-[calc(100vh-3.5rem)] max-w-7xl flex-col px-4 py-4 sm:h-[calc(100vh-4rem)] sm:px-6 sm:py-6">
      <!-- Header -->
      <header class="mb-3 flex flex-wrap items-end justify-between gap-3 sm:mb-4 sm:gap-4">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <a
              routerLink="/library"
              class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-ring"
              title="Back to library"
            >
              <i-lucide [img]="ArrowLeft" class="h-4 w-4"></i-lucide>
            </a>
            <h1 class="min-w-0 truncate text-lg font-semibold tracking-tight text-zinc-900 sm:text-2xl">
              {{ testName() || 'Edit Test' }}
            </h1>
            @if (dirty()) {
              <span class="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Unsaved changes"></span>
            }
          </div>
          <code class="mt-1 block truncate font-mono text-[11px] text-zinc-500 sm:text-xs">{{ relativePath() }}</code>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            (click)="reset()"
            [disabled]="!dirty() || saving() || running()"
            class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 focus-ring sm:px-3"
            title="Reset"
          >
            <i-lucide [img]="RefreshCw" class="h-3.5 w-3.5"></i-lucide>
            <span class="hidden sm:inline">Reset</span>
          </button>
          <button
            type="button"
            (click)="refineWithAI()"
            [disabled]="refining() || saving() || running()"
            class="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 focus-ring sm:px-3"
            title="Refine with AI"
          >
            @if (refining()) {
              <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-600/30 border-t-indigo-600"></span>
            } @else {
              <i-lucide [img]="Sparkles" class="h-3.5 w-3.5"></i-lucide>
            }
            <span class="hidden sm:inline">Refine with AI</span>
          </button>
          <button
            type="button"
            (click)="save(true)"
            [disabled]="!dirty() || !validation().ok || saving() || running()"
            class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 focus-ring sm:px-3"
            title="Save"
          >
            @if (saving()) {
              <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-400/40 border-t-zinc-700"></span>
            } @else {
              <i-lucide [img]="Save" class="h-3.5 w-3.5"></i-lucide>
            }
            <span class="hidden sm:inline">Save</span>
          </button>
          <div class="flex items-center divide-x divide-indigo-500 overflow-hidden rounded-md bg-indigo-600 disabled:opacity-50">
            <button
              type="button"
              (click)="saveAndRun(false)"
              [disabled]="!validation().ok || saving() || running()"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus-ring sm:px-3"
              title="Save (if dirty) then run headless"
            >
              <i-lucide [img]="Play" class="h-3.5 w-3.5"></i-lucide>
              {{ dirty() ? 'Save & Run' : 'Run' }}
            </button>
            <button
              type="button"
              (click)="saveAndRun(true)"
              [disabled]="!validation().ok || saving() || running()"
              class="inline-flex items-center gap-1 px-2 py-1.5 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
              title="Save (if dirty) then run headed (browser visible)"
            >
              <i-lucide [img]="Monitor" class="h-3.5 w-3.5"></i-lucide>
            </button>
          </div>
        </div>
      </header>

      <!-- Validation strip -->
      <div class="mb-3 flex flex-wrap gap-1.5">
        @if (validation(); as v) {
          <span
            class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset"
            [class.bg-emerald-50]="v.ok"
            [class.text-emerald-700]="v.ok"
            [class.ring-emerald-200]="v.ok"
            [class.bg-red-50]="!v.ok"
            [class.text-red-700]="!v.ok"
            [class.ring-red-200]="!v.ok"
          >
            <i-lucide [img]="v.ok ? CheckCircle2 : XCircle" class="h-3 w-3"></i-lucide>
            {{ v.ok ? 'Syntax OK' : 'Has errors' }}
          </span>
          <span class="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
            <i-lucide [img]="ListChecks" class="h-3 w-3"></i-lucide>
            {{ v.scenarioCount }} scenario{{ v.scenarioCount === 1 ? '' : 's' }}
          </span>
          @if (v.hasTags) {
            <span class="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
              <i-lucide [img]="Tag" class="h-3 w-3"></i-lucide>
              Tagged
            </span>
          }
          @for (e of v.errors; track e) {
            <span class="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] text-red-700 ring-1 ring-inset ring-red-200">
              <i-lucide [img]="AlertCircle" class="h-3 w-3"></i-lucide>
              {{ e }}
            </span>
          }
          @for (w of v.warnings; track w) {
            <span class="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700 ring-1 ring-inset ring-amber-200">
              {{ w }}
            </span>
          }
        }
      </div>

      @if (loading()) {
        <div class="h-1 w-full overflow-hidden rounded-full bg-zinc-100">
          <div class="h-full w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] bg-indigo-600"></div>
        </div>
      }

      @if (error(); as err) {
        <div class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <i-lucide [img]="AlertCircle" class="mt-0.5 h-4 w-4 text-red-600"></i-lucide>
          <p class="text-sm text-red-800">{{ err }}</p>
        </div>
      }

      <!-- Editor -->
      @if (!loading() && !error()) {
        <div class="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <pre
            class="m-0 select-none border-r border-zinc-200 bg-zinc-50 px-3 py-3 font-mono text-xs leading-6 text-zinc-400"
            aria-hidden="true"
          >{{ lineNumbersText() }}</pre>
          <textarea
            spellcheck="false"
            [ngModel]="content()"
            (ngModelChange)="content.set($event)"
            (keydown)="onTextareaKeydown($event)"
            class="flex-1 resize-none border-0 bg-white px-3 py-3 font-mono text-xs leading-6 text-zinc-900 focus:outline-none"
          ></textarea>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes indeterminate {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(400%); }
    }
  `],
})
export class EditPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly library = inject(LibraryService);
  private readonly toast = inject(ToastService);

  readonly ArrowLeft = ArrowLeft;
  readonly Save = Save;
  readonly Play = Play;
  readonly Sparkles = Sparkles;
  readonly RefreshCw = RefreshCw;
  readonly AlertCircle = AlertCircle;
  readonly CheckCircle2 = CheckCircle2;
  readonly XCircle = XCircle;
  readonly ListChecks = ListChecks;
  readonly Tag = Tag;
  readonly Monitor = Monitor;

  readonly testId = signal<string | null>(null);
  readonly testName = signal<string>('');
  readonly relativePath = signal<string>('');
  readonly originalContent = signal<string>('');
  readonly content = signal<string>('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly running = signal(false);
  readonly refining = signal(false);
  readonly error = signal<string | null>(null);

  readonly dirty = computed(() => this.content() !== this.originalContent());

  readonly validation = computed<ValidationState>(() => {
    const text = this.content();
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!text.trim()) errors.push('Empty file');
    const hasFeature = /^\s*Feature:\s*.+$/m.test(text);
    if (!hasFeature) errors.push('Missing "Feature:" line');
    const scenarios = (text.match(/^\s*Scenario(?:\s+Outline)?:\s*.+$/gm) ?? []).length;
    if (scenarios === 0) errors.push('No scenarios');
    const steps = (text.match(/^\s*(Given|When|Then|And|But)\s+\S+/gm) ?? []).length;
    if (steps === 0) errors.push('No steps');
    if (steps === 1) warnings.push('Only 1 step (usually need 2+)');
    const hasTags = /^\s*@\S+/m.test(text);
    if (!hasTags) warnings.push('No tags (e.g. @smoke, @regression)');
    return { ok: errors.length === 0, errors, warnings, scenarioCount: scenarios, hasTags };
  });

  readonly lineCount = computed(() => this.content().split('\n').length);
  readonly lineNumbersText = computed(() =>
    Array.from({ length: this.lineCount() }, (_, i) => String(i + 1)).join('\n')
  );

  ngOnInit(): void {
    const testId = this.route.snapshot.paramMap.get('testId');
    if (!testId) {
      this.error.set('Missing test id in URL');
      this.loading.set(false);
      return;
    }
    this.testId.set(testId);

    this.library.list().subscribe((res) => {
      const t = res.tests.find((x) => x.id === testId);
      if (t) {
        this.testName.set(t.name);
        this.relativePath.set(t.relativePath);
      }
    });

    this.library.content(testId).subscribe({
      next: (res) => {
        this.originalContent.set(res.content);
        this.content.set(res.content);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Could not load test');
        this.loading.set(false);
      },
    });
  }

  save(saveOnly: boolean = false): void {
    const id = this.testId();
    if (!id || !this.dirty() || !this.validation().ok) return;
    this.saving.set(true);
    this.library.update(id, this.content()).subscribe({
      next: () => {
        this.originalContent.set(this.content());
        this.saving.set(false);
        if (saveOnly) this.toast.success('Saved', { duration: 2500 });
      },
      error: (err) => {
        this.saving.set(false);
        const msg = err?.error?.error ?? err?.message ?? 'Save failed';
        this.toast.error(msg, { duration: 5000 });
      },
    });
  }

  saveAndRun(headed: boolean = false): void {
    if (!this.validation().ok) return;
    if (this.dirty()) {
      const id = this.testId();
      if (!id) return;
      this.running.set(true);
      this.library.update(id, this.content()).subscribe({
        next: () => {
          this.originalContent.set(this.content());
          this.runNow(headed);
        },
        error: (err) => {
          this.running.set(false);
          const msg = err?.error?.error ?? err?.message ?? 'Save failed';
          this.toast.error(msg, { duration: 5000 });
        },
      });
    } else {
      this.runNow(headed);
    }
  }

  private runNow(headed: boolean = false): void {
    const id = this.testId();
    if (!id) return;
    this.router.navigate(['/run', id], { queryParams: { headed: headed ? '1' : '0' } });
  }

  refineWithAI(): void {
    const id = this.testId();
    if (!id) return;
    this.refining.set(true);
    this.library.startRefineConversation(id).subscribe({
      next: (res) => {
        this.refining.set(false);
        this.router.navigate(['/new'], {
          queryParams: { conversationId: res.conversationId, refineTestId: id },
        });
      },
      error: (err) => {
        this.refining.set(false);
        const msg = err?.error?.error ?? err?.message ?? 'Could not open chat';
        this.toast.error(msg, { duration: 5000 });
      },
    });
  }

  reset(): void { this.content.set(this.originalContent()); }

  onTextareaKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      event.preventDefault();
      const ta = event.target as HTMLTextAreaElement;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = ta.value.substring(0, start);
      const after = ta.value.substring(end);
      this.content.set(before + '  ' + after);
      queueMicrotask(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }
}
