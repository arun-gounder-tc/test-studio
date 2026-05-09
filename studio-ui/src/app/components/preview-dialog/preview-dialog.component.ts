import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { LucideAngularModule, X, Copy, Check, FileText, AlertCircle } from 'lucide-angular';
import { LibraryService } from '../../services/library.service';

export interface PreviewDialogData {
  testId: string;
  name: string;
  relativePath: string;
}

@Component({
  selector: 'studio-preview-dialog',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="flex w-[min(900px,94vw)] max-w-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl">
      <header class="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
        <div class="min-w-0">
          <h2 class="flex items-center gap-2 text-base font-semibold text-zinc-900">
            <i-lucide [img]="FileText" class="h-4 w-4 text-zinc-500"></i-lucide>
            <span class="truncate">{{ data.name }}</span>
          </h2>
          <code class="mt-1 block truncate font-mono text-[11px] text-zinc-500">{{ data.relativePath }}</code>
        </div>
        <button
          type="button"
          aria-label="Close"
          (click)="ref.close()"
          class="-m-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus-ring"
        >
          <i-lucide [img]="X" class="h-4 w-4"></i-lucide>
        </button>
      </header>

      <div class="max-h-[70vh] min-h-[260px] overflow-auto p-5">
        @if (loading()) {
          <div class="flex items-center justify-center gap-3 py-12 text-sm text-zinc-500">
            <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600"></span>
            Loading…
          </div>
        } @else if (error()) {
          <div class="flex items-center justify-center gap-2 py-12 text-sm text-red-600">
            <i-lucide [img]="AlertCircle" class="h-4 w-4"></i-lucide>
            {{ error() }}
          </div>
        } @else {
          <pre class="m-0 overflow-x-auto rounded-md bg-zinc-950 p-4 font-mono text-[12.5px] leading-6 text-zinc-100"><code [innerHTML]="highlighted()"></code></pre>
        }
      </div>

      <footer class="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50/50 px-5 py-3">
        <button
          type="button"
          (click)="copy()"
          [disabled]="!content()"
          class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 focus-ring"
        >
          <i-lucide [img]="copied() ? Check : Copy" class="h-3.5 w-3.5"></i-lucide>
          {{ copied() ? 'Copied' : 'Copy' }}
        </button>
        <button
          type="button"
          (click)="ref.close()"
          class="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 focus-ring"
        >
          Close
        </button>
      </footer>
    </div>
  `,
  styles: [`
    code .gh-keyword { color: #c4b5fd; font-weight: 600; }
    code .gh-tag     { color: #fbbf24; }
    code .gh-string  { color: #86efac; }
    code .gh-comment { color: #64748b; font-style: italic; }
  `],
})
export class PreviewDialogComponent implements OnInit {
  private readonly library = inject(LibraryService);
  readonly ref = inject(DialogRef<unknown, PreviewDialogComponent>);
  readonly data = inject<PreviewDialogData>(DIALOG_DATA);

  readonly X = X;
  readonly Copy = Copy;
  readonly Check = Check;
  readonly FileText = FileText;
  readonly AlertCircle = AlertCircle;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly content = signal<string>('');
  readonly copied = signal(false);

  ngOnInit(): void {
    this.library.content(this.data.testId).subscribe({
      next: (res) => {
        this.content.set(res.content);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Could not load file');
        this.loading.set(false);
      },
    });
  }

  highlighted(): string {
    const c = this.content();
    if (!c) return '';
    return c
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/(^|\n)(\s*)(Feature|Background|Rule|Scenario Outline|Scenario|Examples|Given|When|Then|And|But)(:?\s)/g,
        '$1$2<span class="gh-keyword">$3</span>$4')
      .replace(/(@[\w-]+)/g, '<span class="gh-tag">$1</span>')
      .replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;|"[^"]*"|'[^']*')/g, '<span class="gh-string">$1</span>')
      .replace(/(^|\n)(\s*#.*?)(?=\n|$)/g, '$1<span class="gh-comment">$2</span>');
  }

  copy(): void {
    if (!this.content()) return;
    navigator.clipboard?.writeText(this.content()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
