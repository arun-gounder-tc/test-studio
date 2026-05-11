import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideAngularModule,
  FlaskConical,
  BookOpen,
  Plus,
  FolderKanban,
  ChevronDown,
  History as HistoryIcon,
  LayoutDashboard,
  Settings,
  Search,
  Bell,
  User,
} from 'lucide-angular';
import { ToastHostComponent } from './shared/toast/toast-host.component';
import { ProjectsService, Project } from './services/projects.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule, ToastHostComponent],
  template: `
    <div class="flex h-screen overflow-hidden bg-zinc-50">
      <!-- ============ SIDEBAR ============ -->
      <aside class="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <!-- Logo -->
        <a routerLink="/projects" class="flex h-16 items-center gap-2.5 px-6 border-b border-zinc-100">
          <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <i-lucide [img]="FlaskConical" class="h-4 w-4"></i-lucide>
          </span>
          <span class="text-base font-semibold tracking-tight text-zinc-900">Test Studio</span>
        </a>

        <!-- Nav -->
        <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <a
            routerLink="/projects"
            routerLinkActive
            #projectsLink="routerLinkActive"
            [class.bg-indigo-50]="projectsLink.isActive"
            [class.text-indigo-700]="projectsLink.isActive"
            [class.font-medium]="projectsLink.isActive"
            class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          >
            <i-lucide
              [img]="FolderKanban"
              class="h-4 w-4"
              [class.text-indigo-600]="projectsLink.isActive"
              [class.text-zinc-400]="!projectsLink.isActive"
            ></i-lucide>
            Projects
          </a>
          <a
            routerLink="/library"
            routerLinkActive
            #libraryLink="routerLinkActive"
            [class.bg-indigo-50]="libraryLink.isActive"
            [class.text-indigo-700]="libraryLink.isActive"
            [class.font-medium]="libraryLink.isActive"
            class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          >
            <i-lucide
              [img]="BookOpen"
              class="h-4 w-4"
              [class.text-indigo-600]="libraryLink.isActive"
              [class.text-zinc-400]="!libraryLink.isActive"
            ></i-lucide>
            Library
          </a>
          <a
            routerLink="/new"
            routerLinkActive
            #newLink="routerLinkActive"
            [class.bg-indigo-50]="newLink.isActive"
            [class.text-indigo-700]="newLink.isActive"
            [class.font-medium]="newLink.isActive"
            class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          >
            <i-lucide
              [img]="Plus"
              class="h-4 w-4"
              [class.text-indigo-600]="newLink.isActive"
              [class.text-zinc-400]="!newLink.isActive"
            ></i-lucide>
            New Test
          </a>
          <a
            routerLink="/history"
            routerLinkActive
            #historyLink="routerLinkActive"
            [class.bg-indigo-50]="historyLink.isActive"
            [class.text-indigo-700]="historyLink.isActive"
            [class.font-medium]="historyLink.isActive"
            class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          >
            <i-lucide
              [img]="HistoryIcon"
              class="h-4 w-4"
              [class.text-indigo-600]="historyLink.isActive"
              [class.text-zinc-400]="!historyLink.isActive"
            ></i-lucide>
            History
          </a>
        </nav>

        <!-- Settings (bottom) -->
        <div class="border-t border-zinc-100 px-3 py-3">
          <button
            type="button"
            class="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            title="Settings (coming soon)"
          >
            <i-lucide [img]="Settings" class="h-4 w-4 text-zinc-400"></i-lucide>
            Settings
          </button>
        </div>
      </aside>

      <!-- ============ MAIN ============ -->
      <div class="flex min-w-0 flex-1 flex-col">
        <!-- Top bar -->
        <header class="flex h-16 shrink-0 items-center gap-4 border-b border-zinc-200 bg-white px-6">
          <!-- Project switcher -->
          <div class="relative">
            <button
              type="button"
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
                    type="button"
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
                  >Manage projects…</a
                >
              </div>
            }
          </div>

          <div class="flex-1"></div>

          <!-- Search (placeholder) -->
          <div class="relative hidden md:block">
            <i-lucide
              [img]="Search"
              class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
            ></i-lucide>
            <input
              type="text"
              placeholder="Search…"
              class="h-9 w-64 rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-700 placeholder-zinc-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <!-- Notifications -->
          <button
            type="button"
            class="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            title="Notifications"
          >
            <i-lucide [img]="Bell" class="h-4 w-4"></i-lucide>
          </button>

          <!-- Avatar -->
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
            title="Profile"
          >
            <i-lucide [img]="User" class="h-4 w-4"></i-lucide>
          </button>
        </header>

        <!-- Content -->
        <main class="flex-1 overflow-y-auto">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
    <studio-toast-host />
  `,
})
export class AppComponent implements OnInit {
  readonly FlaskConical = FlaskConical;
  readonly BookOpen = BookOpen;
  readonly Plus = Plus;
  readonly FolderKanban = FolderKanban;
  readonly ChevronDown = ChevronDown;
  readonly HistoryIcon = HistoryIcon;
  readonly LayoutDashboard = LayoutDashboard;
  readonly Settings = Settings;
  readonly Search = Search;
  readonly Bell = Bell;
  readonly User = User;

  readonly projectsService = inject(ProjectsService);

  readonly projects = signal<Project[]>([]);
  dropdownOpen = false;

  ngOnInit(): void {
    this.projectsService.list().subscribe({
      next: (r) => {
        this.projects.set(r.projects);
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
