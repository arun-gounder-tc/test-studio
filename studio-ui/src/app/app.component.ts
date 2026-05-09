import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule, FlaskConical, BookOpen, Plus } from 'lucide-angular';
import { ToastHostComponent } from './shared/toast/toast-host.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule, ToastHostComponent],
  template: `
    <header class="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
        <a routerLink="/library" class="flex items-center gap-2 font-semibold tracking-tight text-zinc-900 hover:text-indigo-600 transition-colors">
          <span class="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white">
            <i-lucide [img]="FlaskConical" class="h-4 w-4"></i-lucide>
          </span>
          Test Studio
        </a>
        <nav class="flex items-center gap-1 text-sm">
          <a
            routerLink="/library"
            routerLinkActive="bg-zinc-100 text-zinc-900"
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          >
            <i-lucide [img]="BookOpen" class="h-4 w-4"></i-lucide>
            Library
          </a>
          <a
            routerLink="/new"
            routerLinkActive="bg-zinc-100 text-zinc-900"
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          >
            <i-lucide [img]="Plus" class="h-4 w-4"></i-lucide>
            New Test
          </a>
        </nav>
      </div>
    </header>
    <main class="min-h-[calc(100vh-3.5rem)] bg-zinc-50">
      <router-outlet></router-outlet>
    </main>
    <studio-toast-host />
  `,
})
export class AppComponent {
  readonly FlaskConical = FlaskConical;
  readonly BookOpen = BookOpen;
  readonly Plus = Plus;
}
