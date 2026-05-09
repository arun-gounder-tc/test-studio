import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Plus, Archive, ExternalLink, Loader2, FolderOpen } from 'lucide-angular';
import { ProjectsService, Project } from '../../services/projects.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="mx-auto max-w-5xl px-6 py-10">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-zinc-900">Projects</h1>
          <p class="mt-1 text-sm text-zinc-500">Select a project to test, or create a new one.</p>
        </div>
        <button
          (click)="showCreate = true"
          class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <i-lucide [img]="Plus" class="h-4 w-4"></i-lucide>
          New Project
        </button>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="flex items-center justify-center py-20 text-zinc-400">
          <i-lucide [img]="Loader2" class="h-6 w-6 animate-spin"></i-lucide>
        </div>
      }

      <!-- Empty state -->
      @if (!loading() && projects().length === 0) {
        <div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 py-20 text-zinc-500">
          <i-lucide [img]="FolderOpen" class="h-10 w-10 mb-3 text-zinc-300"></i-lucide>
          <p class="text-sm font-medium">No projects yet</p>
          <p class="text-xs mt-1">Create a project to get started.</p>
        </div>
      }

      <!-- Project grid -->
      @if (!loading() && projects().length > 0) {
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (project of projects(); track project.id) {
            <div
              class="group relative flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
              [class.ring-2]="projectsService.activeProjectId() === project.id"
              [class.ring-indigo-500]="projectsService.activeProjectId() === project.id"
              (click)="selectProject(project)"
            >
              <div class="flex items-start justify-between">
                <h2 class="text-sm font-semibold text-zinc-900">{{ project.name }}</h2>
                @if (projectsService.activeProjectId() === project.id) {
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Active</span>
                }
              </div>
              @if (project.description) {
                <p class="mt-1 text-xs text-zinc-500 line-clamp-2">{{ project.description }}</p>
              }
              @if (project.baseUrl) {
                <p class="mt-2 flex items-center gap-1 text-xs text-zinc-400">
                  <i-lucide [img]="ExternalLink" class="h-3 w-3"></i-lucide>
                  {{ project.baseUrl }}
                </p>
              }
              <div class="mt-4 flex items-center gap-2">
                <button
                  (click)="$event.stopPropagation(); openProject(project)"
                  class="flex-1 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >Open</button>
                <button
                  (click)="$event.stopPropagation(); archiveProject(project)"
                  class="rounded-md border border-zinc-200 p-1.5 text-zinc-400 hover:text-red-500 hover:border-red-200 transition-colors"
                >
                  <i-lucide [img]="Archive" class="h-3.5 w-3.5"></i-lucide>
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Create dialog -->
    @if (showCreate) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <h2 class="text-lg font-semibold text-zinc-900 mb-4">New Project</h2>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-zinc-700 mb-1">Name *</label>
              <input
                [(ngModel)]="newName"
                placeholder="e.g. My App E2E"
                class="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-zinc-700 mb-1">Description</label>
              <input
                [(ngModel)]="newDescription"
                placeholder="Optional"
                class="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-zinc-700 mb-1">Base URL</label>
              <input
                [(ngModel)]="newBaseUrl"
                placeholder="e.g. http://localhost:4200"
                class="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button
              (click)="showCreate = false"
              class="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
            >Cancel</button>
            <button
              (click)="createProject()"
              [disabled]="!newName.trim() || creating()"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              @if (creating()) { Creating… } @else { Create }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ProjectsPage implements OnInit {
  readonly Plus = Plus;
  readonly Archive = Archive;
  readonly ExternalLink = ExternalLink;
  readonly Loader2 = Loader2;
  readonly FolderOpen = FolderOpen;

  readonly projectsService = inject(ProjectsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly projects = signal<Project[]>([]);
  readonly loading = signal(true);
  readonly creating = signal(false);

  showCreate = false;
  newName = '';
  newDescription = '';
  newBaseUrl = '';

  ngOnInit(): void {
    this.projectsService.list().subscribe({
      next: (r) => {
        this.projects.set(r.projects);
        // Auto-select first project if none active
        if (!this.projectsService.activeProjectId() && r.projects.length > 0) {
          this.projectsService.setActiveProject(r.projects[0].id);
        }
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load projects');
        this.loading.set(false);
      },
    });
  }

  selectProject(project: Project): void {
    this.projectsService.setActiveProject(project.id);
  }

  openProject(project: Project): void {
    this.projectsService.setActiveProject(project.id);
    this.router.navigate(['/library']);
  }

  createProject(): void {
    if (!this.newName.trim()) return;
    this.creating.set(true);
    this.projectsService
      .create({
        name: this.newName.trim(),
        description: this.newDescription.trim() || undefined,
        baseUrl: this.newBaseUrl.trim() || undefined,
      })
      .subscribe({
        next: (p) => {
          this.projects.update((list) => [...list, p]);
          this.showCreate = false;
          this.newName = '';
          this.newDescription = '';
          this.newBaseUrl = '';
          this.creating.set(false);
        this.toast.success(`Project "${p.name}" created`);
          this.router.navigate(['/library']);
        },
        error: () => {
          this.toast.error('Failed to create project');
          this.creating.set(false);
        },
      });
  }

  archiveProject(project: Project): void {
    if (!confirm(`Archive "${project.name}"?`)) return;
    this.projectsService.archive(project.id).subscribe({
      next: () => {
        this.projects.update((list) => list.filter((p) => p.id !== project.id));
        if (this.projectsService.activeProjectId() === project.id) {
          const remaining = this.projects();
          this.projectsService.setActiveProject(remaining[0]?.id ?? '');
        }
        this.toast.success(`"${project.name}" archived`);
      },
      error: () => this.toast.error('Failed to archive project'),
    });
  }
}
