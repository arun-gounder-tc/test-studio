import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule, FlaskConical, BookOpen, Plus, FolderKanban, ChevronDown } from 'lucide-angular';
import { ToastHostComponent } from './shared/toast/toast-host.component';
import { ProjectsService, Project } from './services/projects.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule, ToastHostComponent],
  template: `
    <header class="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
        <a routerLink="/projects" class="flex items-center gap-2 font-semibold tracking-tight text-zinc-900 hover:text-indigo-600 transition-colors">
          <span class="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white">
            <i-lucide [img]="FlaskConical" class="h-4 w-4"></i-lucide>
          </span>
          Test Studio
        </a>

        <!-- Project switcher -->
        <div class="relative">
          <button
            (click)="dropdownOpen = !dropdownOpen"
            class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <i-lucide [img]="FolderKanban" class="h-3.5 w-3.5 text-zinc-400"></i-lucide>
            <span>{{ activeProjectName() }}</span>
            <i-lucide [img]="ChevronDown" class="h-3.5 w-3.5 text-zinc-400"></i-lucide>
          </button>
          @if (dropdownOpen) {
            <div
              class="absolute left-0 top-full mt-1 w-52 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg z-50"
              (mouseleave)="dropdownOpen = false"
            >
              @for (p of projects(); track p.id) {
                <button
                  (click)="switchProject(p)"
                  class="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                  [class.font-semibold]="projectsService.activeProjectId() === p.id"
                >
                  {{ p.name }}
                  @if (projectsService.activeProjectId() === p.id) {
                    <span class="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                  }
                </button>
              }
              <div class="my-1 border-t border-zinc-100"></div>
              <a
                routerLink="/projects"
                (click)="dropdownOpen = false"
                class="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50 transition-colors"
              >Manage projects…</a>
            </div>
          }
        </div>

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
export class AppComponent implements OnInit {
  readonly FlaskConical = FlaskConical;
  readonly BookOpen = BookOpen;
  readonly Plus = Plus;
  readonly FolderKanban = FolderKanban;
  readonly ChevronDown = ChevronDown;

  readonly projectsService = inject(ProjectsService);

  readonly projects = signal<Project[]>([]);
  dropdownOpen = false;

  ngOnInit(): void {
    this.projectsService.list().subscribe({
      next: (r) => {
        this.projects.set(r.projects);
        // Set default project if none active
        if (!this.projectsService.activeProjectId() && r.projects.length > 0) {
          this.projectsService.setActiveProject(r.projects[0].id);
        }
      },
    });
  }

  activeProjectName(): string {
    const id = this.projectsService.activeProjectId();
    return this.projects().find((p) => p.id === id)?.name ?? 'Select project';
  }

  switchProject(p: Project): void {
    this.projectsService.setActiveProject(p.id);
    this.dropdownOpen = false;
  }
}
