import { Component, inject, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  LucideAngularModule,
  FlaskConical,
  BookOpen,
  Plus,
  FolderKanban,
  ChevronDown,
  History as HistoryIcon,
  Search,
  Bell,
  User,
  Menu,
  X,
} from 'lucide-angular';
import { ToastHostComponent } from './shared/toast/toast-host.component';
import { ProjectsService, Project } from './services/projects.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule, ToastHostComponent],
  template: `
    <div class="flex h-screen flex-col overflow-hidden bg-zinc-50">
      <!-- ============ TOP HEADER ============ -->
      <header class="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white/90 px-3 backdrop-blur supports-backdrop-filter:bg-white/75 sm:h-16 sm:gap-4 sm:px-6">
        <!-- Mobile menu toggle -->
        <button
          type="button"
          (click)="mobileMenuOpen = !mobileMenuOpen"
          class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 md:hidden"
          [attr.aria-label]="mobileMenuOpen ? 'Close menu' : 'Open menu'"
        >
          <i-lucide [img]="mobileMenuOpen ? X : Menu" class="h-5 w-5"></i-lucide>
        </button>

        <!-- Logo -->
        <a routerLink="/projects" class="flex items-center gap-2 sm:gap-2.5">
          <span class="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white sm:h-8 sm:w-8">
            <i-lucide [img]="FlaskConical" class="h-3.5 w-3.5 sm:h-4 sm:w-4"></i-lucide>
          </span>
          <span class="hidden text-base font-semibold tracking-tight text-zinc-900 sm:inline">Test Studio</span>
        </a>

        <!-- Center nav (desktop) -->
        <nav class="mx-auto hidden items-center gap-1 rounded-full bg-zinc-50 p-1 md:flex">
          <a
            routerLink="/projects"
            routerLinkActive
            #projectsLink="routerLinkActive"
            [class.bg-indigo-600]="projectsLink.isActive"
            [class.text-white]="projectsLink.isActive"
            [class.shadow-sm]="projectsLink.isActive"
            [class.text-zinc-600]="!projectsLink.isActive"
            class="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium hover:text-zinc-900 transition-colors"
          >
            Projects
          </a>
          <a
            routerLink="/library"
            routerLinkActive
            #libraryLink="routerLinkActive"
            [class.bg-indigo-600]="libraryLink.isActive"
            [class.text-white]="libraryLink.isActive"
            [class.shadow-sm]="libraryLink.isActive"
            [class.text-zinc-600]="!libraryLink.isActive"
            class="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium hover:text-zinc-900 transition-colors"
          >
            Library
          </a>
          <a
            routerLink="/new"
            routerLinkActive
            #newLink="routerLinkActive"
            [class.bg-indigo-600]="newLink.isActive"
            [class.text-white]="newLink.isActive"
            [class.shadow-sm]="newLink.isActive"
            [class.text-zinc-600]="!newLink.isActive"
            class="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium hover:text-zinc-900 transition-colors"
          >
            New Test
          </a>
          <a
            routerLink="/history"
            routerLinkActive
            #historyLink="routerLinkActive"
            [class.bg-indigo-600]="historyLink.isActive"
            [class.text-white]="historyLink.isActive"
            [class.shadow-sm]="historyLink.isActive"
            [class.text-zinc-600]="!historyLink.isActive"
            class="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium hover:text-zinc-900 transition-colors"
          >
            History
          </a>
        </nav>

        <!-- Right cluster -->
        <div class="ml-auto flex items-center gap-1 sm:gap-2">
          <!-- Project switcher -->
          <div class="relative hidden lg:block">
            <button
              type="button"
              (click)="dropdownOpen = !dropdownOpen"
              class="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              <i-lucide [img]="FolderKanban" class="h-3.5 w-3.5 text-zinc-400"></i-lucide>
              <span class="max-w-35 truncate">{{ activeProjectName() }}</span>
              <i-lucide [img]="ChevronDown" class="h-3.5 w-3.5 text-zinc-400"></i-lucide>
            </button>
            @if (dropdownOpen) {
              <div
                class="absolute right-0 top-full mt-2 w-56 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg z-50"
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

          <!-- Search -->
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            title="Search"
          >
            <i-lucide [img]="Search" class="h-4 w-4"></i-lucide>
          </button>

          <!-- Notifications -->
          <button
            type="button"
            class="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            title="Notifications"
          >
            <i-lucide [img]="Bell" class="h-4 w-4"></i-lucide>
            <span class="absolute right-2 top-2 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-white"></span>
          </button>

          <!-- Avatar -->
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-indigo-700 text-white shadow-sm ring-2 ring-white hover:ring-indigo-100 transition-all"
            title="Profile"
          >
            <i-lucide [img]="User" class="h-4 w-4"></i-lucide>
          </button>
        </div>
      </header>

      <!-- Mobile slide-down menu -->
      @if (mobileMenuOpen) {
        <div
          class="fixed inset-0 top-14 z-20 bg-zinc-900/20 backdrop-blur-sm md:hidden"
          (click)="mobileMenuOpen = false"
        ></div>
        <div class="fixed inset-x-0 top-14 z-20 border-b border-zinc-200 bg-white shadow-lg md:hidden">
          <nav class="flex flex-col p-3">
            <a
              routerLink="/projects"
              routerLinkActive
              #mProjects="routerLinkActive"
              [class.bg-indigo-50]="mProjects.isActive"
              [class.text-indigo-700]="mProjects.isActive"
              [class.text-zinc-700]="!mProjects.isActive"
              class="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-zinc-50"
            >
              <i-lucide [img]="FolderKanban" class="h-4 w-4"></i-lucide>
              Projects
            </a>
            <a
              routerLink="/library"
              routerLinkActive
              #mLibrary="routerLinkActive"
              [class.bg-indigo-50]="mLibrary.isActive"
              [class.text-indigo-700]="mLibrary.isActive"
              [class.text-zinc-700]="!mLibrary.isActive"
              class="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-zinc-50"
            >
              <i-lucide [img]="BookOpen" class="h-4 w-4"></i-lucide>
              Library
            </a>
            <a
              routerLink="/new"
              routerLinkActive
              #mNew="routerLinkActive"
              [class.bg-indigo-50]="mNew.isActive"
              [class.text-indigo-700]="mNew.isActive"
              [class.text-zinc-700]="!mNew.isActive"
              class="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-zinc-50"
            >
              <i-lucide [img]="Plus" class="h-4 w-4"></i-lucide>
              New Test
            </a>
            <a
              routerLink="/history"
              routerLinkActive
              #mHistory="routerLinkActive"
              [class.bg-indigo-50]="mHistory.isActive"
              [class.text-indigo-700]="mHistory.isActive"
              [class.text-zinc-700]="!mHistory.isActive"
              class="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-zinc-50"
            >
              <i-lucide [img]="HistoryIcon" class="h-4 w-4"></i-lucide>
              History
            </a>

            <!-- Project switcher on mobile -->
            @if (projects().length > 0) {
              <div class="mt-2 border-t border-zinc-100 pt-2">
                <p class="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Project</p>
                @for (p of projects(); track p.id) {
                  <button
                    type="button"
                    (click)="switchProject(p)"
                    class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                    [class.font-semibold]="projectsService.activeProjectId() === p.id"
                  >
                    <i-lucide [img]="FolderKanban" class="h-4 w-4 text-zinc-400"></i-lucide>
                    {{ p.name }}
                    @if (projectsService.activeProjectId() === p.id) {
                      <span class="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                    }
                  </button>
                }
              </div>
            }
          </nav>
        </div>
      }

      <!-- ============ CONTENT ============ -->
      <main class="flex-1 overflow-y-auto">
        <router-outlet></router-outlet>
      </main>
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
  readonly Search = Search;
  readonly Bell = Bell;
  readonly User = User;
  readonly Menu = Menu;
  readonly X = X;

  readonly projectsService = inject(ProjectsService);
  private readonly router = inject(Router);

  readonly projects = signal<Project[]>([]);
  dropdownOpen = false;
  mobileMenuOpen = false;

  ngOnInit(): void {
    this.projectsService.list().subscribe({
      next: (r) => {
        this.projects.set(r.projects);
        if (!this.projectsService.activeProjectId() && r.projects.length > 0) {
          this.projectsService.setActiveProject(r.projects[0].id);
        }
      },
    });

    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => (this.mobileMenuOpen = false));
  }

  activeProjectName(): string {
    const id = this.projectsService.activeProjectId();
    return this.projects().find((p) => p.id === id)?.name ?? 'Select project';
  }

  switchProject(p: Project): void {
    this.projectsService.setActiveProject(p.id);
    this.dropdownOpen = false;
    this.mobileMenuOpen = false;
  }
}
