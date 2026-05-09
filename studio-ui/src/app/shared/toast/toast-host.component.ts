import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { LucideAngularModule, Check, X, AlertTriangle, Info } from 'lucide-angular';
import { ToastService } from './toast.service';

@Component({
  selector: 'studio-toast-host',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div
      aria-live="polite"
      aria-atomic="true"
      class="pointer-events-none fixed bottom-4 right-4 z-[1100] flex w-full max-w-sm flex-col gap-2"
    >
      @for (t of toast.toasts(); track t.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 rounded-lg border bg-white px-4 py-3 shadow-lg shadow-zinc-900/5 ring-1 ring-zinc-900/5 animate-[toast-in_180ms_ease-out]"
          [class.border-emerald-200]="t.variant === 'success'"
          [class.border-red-200]="t.variant === 'error'"
          [class.border-zinc-200]="t.variant === 'info'"
        >
          <span
            class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            [class.bg-emerald-100]="t.variant === 'success'"
            [class.text-emerald-600]="t.variant === 'success'"
            [class.bg-red-100]="t.variant === 'error'"
            [class.text-red-600]="t.variant === 'error'"
            [class.bg-zinc-100]="t.variant === 'info'"
            [class.text-zinc-600]="t.variant === 'info'"
          >
            @switch (t.variant) {
              @case ('success') { <i-lucide [img]="Check" class="h-3.5 w-3.5"></i-lucide> }
              @case ('error')   { <i-lucide [img]="AlertTriangle" class="h-3.5 w-3.5"></i-lucide> }
              @default          { <i-lucide [img]="Info" class="h-3.5 w-3.5"></i-lucide> }
            }
          </span>
          <p class="flex-1 text-sm leading-5 text-zinc-900">{{ t.message }}</p>
          @if (t.action) {
            <button
              type="button"
              class="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 focus-ring"
              (click)="toast.triggerAction(t.id)"
            >
              {{ t.action }}
            </button>
          }
          <button
            type="button"
            aria-label="Dismiss"
            class="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus-ring"
            (click)="toast.dismiss(t.id)"
          >
            <i-lucide [img]="X" class="h-3.5 w-3.5"></i-lucide>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class ToastHostComponent {
  readonly toast = inject(ToastService);
  readonly Check = Check;
  readonly X = X;
  readonly AlertTriangle = AlertTriangle;
  readonly Info = Info;
}
