import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  action?: string;
  duration: number;
  actionSubject: Subject<void>;
}

export interface ToastRef {
  id: number;
  dismiss(): void;
  /** Emits when the user clicks the action button (if provided). */
  onAction(): import('rxjs').Observable<void>;
}

export interface ToastOptions {
  variant?: ToastVariant;
  action?: string;
  duration?: number; // ms; 0 = sticky
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  open(message: string, opts: ToastOptions = {}): ToastRef {
    const id = this.nextId++;
    const toast: Toast = {
      id,
      message,
      variant: opts.variant ?? 'info',
      action: opts.action,
      duration: opts.duration ?? 5000,
      actionSubject: new Subject<void>(),
    };
    this.toasts.update((arr) => [...arr, toast]);
    if (toast.duration > 0) {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), toast.duration)
      );
    }
    return {
      id,
      dismiss: () => this.dismiss(id),
      onAction: () => toast.actionSubject.asObservable(),
    };
  }

  success(message: string, opts: Omit<ToastOptions, 'variant'> = {}): ToastRef {
    return this.open(message, { ...opts, variant: 'success' });
  }
  error(message: string, opts: Omit<ToastOptions, 'variant'> = {}): ToastRef {
    return this.open(message, { ...opts, variant: 'error' });
  }
  info(message: string, opts: Omit<ToastOptions, 'variant'> = {}): ToastRef {
    return this.open(message, { ...opts, variant: 'info' });
  }

  dismiss(id: number): void {
    const t = this.toasts().find((x) => x.id === id);
    if (!t) return;
    this.toasts.update((arr) => arr.filter((x) => x.id !== id));
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    t.actionSubject.complete();
  }

  triggerAction(id: number): void {
    const t = this.toasts().find((x) => x.id === id);
    if (!t) return;
    t.actionSubject.next();
    this.dismiss(id);
  }
}
