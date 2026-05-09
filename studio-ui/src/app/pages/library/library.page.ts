import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import {
  LucideAngularModule,
  Plus,
  RefreshCw,
  CheckCircle2,
  FileText,
  Play,
  Eye,
  Pencil,
  Tag,
  Clock,
  ListChecks,
  AlertCircle,
  Monitor,
} from 'lucide-angular';
import { LibraryService, TestSummary } from '../../services/library.service';
import { PreviewDialogComponent } from '../../components/preview-dialog/preview-dialog.component';

@Component({
  selector: 'studio-library',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="mx-auto max-w-7xl px-6 py-8">
      <header class="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-zinc-900">Test Library</h1>
          <p class="mt-1 text-sm text-zinc-500">
            @if (!loading()) {
              {{ total() }} test{{ total() === 1 ? '' : 's' }} in this project
            } @else {
              Loading…
            }
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="refresh()"
            [disabled]="loading()"
            class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 focus-ring"
          >
            <i-lucide [img]="RefreshCw" class="h-3.5 w-3.5" [class.animate-spin]="loading()"></i-lucide>
            Refresh
          </button>
          <button
            type="button"
            (click)="goToUpload()"
            class="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-ring"
          >
            <i-lucide [img]="Plus" class="h-3.5 w-3.5"></i-lucide>
            New Test
          </button>
        </div>
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
            <p class="font-medium text-red-900">Could not load library</p>
            <p class="mt-0.5 text-red-700">{{ err }}</p>
            <p class="mt-1 text-xs text-red-600/70">Is studio-server running on port 3001?</p>
          </div>
        </div>
      }

      @if (!loading() && !error() && tests().length === 0) {
        <div class="mt-12 flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white py-16 text-center">
          <i-lucide [img]="FileText" class="h-8 w-8 text-zinc-400"></i-lucide>
          <h3 class="mt-3 text-sm font-medium text-zinc-900">No tests yet</h3>
          <p class="mt-1 text-sm text-zinc-500">Click "New Test" to author your first one.</p>
        </div>
      }

      <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        @for (test of tests(); track test.id) {
          <article class="group flex flex-col rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 hover:shadow-sm">
            <header class="flex items-start gap-3">
              <span
                class="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full"
                [class.bg-emerald-100]="test.status === 'ready'"
                [class.text-emerald-600]="test.status === 'ready'"
                [class.bg-amber-100]="test.status === 'draft'"
                [class.text-amber-600]="test.status === 'draft'"
                [class.bg-zinc-100]="test.status !== 'ready' && test.status !== 'draft'"
                [class.text-zinc-500]="test.status !== 'ready' && test.status !== 'draft'"
              >
                <i-lucide [img]="CheckCircle2" class="h-3 w-3"></i-lucide>
              </span>
              <div class="min-w-0 flex-1">
                <h3 class="truncate text-sm font-semibold text-zinc-900">{{ test.name }}</h3>
                <code class="mt-0.5 block truncate font-mono text-[11px] text-zinc-500">{{ test.relativePath }}</code>
              </div>
            </header>

            @if (test.description) {
              <p class="mt-3 line-clamp-2 text-sm text-zinc-600">{{ test.description }}</p>
            }

            <div class="mt-3 flex items-center gap-4 text-xs text-zinc-500">
              <span class="inline-flex items-center gap-1">
                <i-lucide [img]="ListChecks" class="h-3 w-3"></i-lucide>
                {{ test.scenarioCount }} scenario{{ test.scenarioCount === 1 ? '' : 's' }}
              </span>
              <span class="inline-flex items-center gap-1" [title]="'Updated ' + formatDate(test.updatedAt)">
                <i-lucide [img]="Clock" class="h-3 w-3"></i-lucide>
                {{ formatDate(test.updatedAt) }}
              </span>
            </div>

            @if (test.tags.length || allScenarioTags(test).length) {
              <div class="mt-3 flex flex-wrap gap-1.5">
                @for (tag of test.tags; track tag) {
                  <span class="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
                    <i-lucide [img]="Tag" class="h-2.5 w-2.5"></i-lucide>
                    {{ tag }}
                  </span>
                }
                @for (tag of allScenarioTags(test); track tag) {
                  <span class="inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                    {{ tag }}
                  </span>
                }
              </div>
            }

            @if (test.scenarios.length) {
              <ul class="mt-3 space-y-1 text-xs text-zinc-500">
                @for (s of test.scenarios.slice(0, 3); track s.name) {
                  <li class="truncate">· {{ s.name }}</li>
                }
                @if (test.scenarios.length > 3) {
                  <li class="text-zinc-400">+ {{ test.scenarios.length - 3 }} more…</li>
                }
              </ul>
            }

            <footer class="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  (click)="run(test, false)"
                  class="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 focus-ring"
                  title="Run headless (fast)"
                >
                  <i-lucide [img]="Play" class="h-3 w-3"></i-lucide>
                  Run
                </button>
                <button
                  type="button"
                  (click)="run(test, true)"
                  class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-ring"
                  title="Run with browser visible"
                >
                  <i-lucide [img]="Monitor" class="h-3 w-3"></i-lucide>
                  Live
                </button>
              </div>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  (click)="edit(test)"
                  class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-ring"
                  title="Edit (with optional AI refine)"
                >
                  <i-lucide [img]="Pencil" class="h-3 w-3"></i-lucide>
                  Edit
                </button>
                <button
                  type="button"
                  (click)="preview(test)"
                  class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-ring"
                  title="Preview .feature source"
                >
                  <i-lucide [img]="Eye" class="h-3 w-3"></i-lucide>
                  Preview
                </button>
              </div>
            </footer>
          </article>
        }
      </div>
    </div>
  `,
  styles: [`
    @keyframes indeterminate {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(400%); }
    }
  `],
})
export class LibraryPage implements OnInit {
  private readonly libraryService = inject(LibraryService);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);

  readonly Plus = Plus;
  readonly RefreshCw = RefreshCw;
  readonly CheckCircle2 = CheckCircle2;
  readonly FileText = FileText;
  readonly Play = Play;
  readonly Eye = Eye;
  readonly Pencil = Pencil;
  readonly Tag = Tag;
  readonly Clock = Clock;
  readonly ListChecks = ListChecks;
  readonly AlertCircle = AlertCircle;
  readonly Monitor = Monitor;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly tests = signal<TestSummary[]>([]);
  readonly total = signal(0);

  ngOnInit(): void { this.refresh(); }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    this.libraryService.list().subscribe({
      next: (res) => {
        this.tests.set(res.tests);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load library');
        this.loading.set(false);
      },
    });
  }

  goToUpload(): void { this.router.navigate(['/new']); }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  preview(test: TestSummary): void {
    this.dialog.open(PreviewDialogComponent, {
      data: { testId: test.id, name: test.name, relativePath: test.relativePath },
      hasBackdrop: true,
      panelClass: 'studio-dialog-panel',
    });
  }

  run(test: TestSummary, headed: boolean = false): void {
    this.router.navigate(['/run', test.id], { queryParams: { headed: headed ? '1' : '0' } });
  }

  edit(test: TestSummary): void { this.router.navigate(['/edit', test.id]); }

  allScenarioTags(test: TestSummary): string[] {
    const set = new Set<string>();
    for (const s of test.scenarios) {
      for (const t of s.tags) {
        if (!test.tags.includes(t)) set.add(t);
      }
    }
    return Array.from(set);
  }
}
