import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  baseUrl: string | null;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectsListResponse {
  projects: Project[];
}

const STORAGE_KEY = 'studio.activeProjectId';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/projects`;

  readonly activeProjectId = signal<string | null>(localStorage.getItem(STORAGE_KEY));

  setActiveProject(id: string): void {
    localStorage.setItem(STORAGE_KEY, id);
    this.activeProjectId.set(id);
  }

  list(): Observable<ProjectsListResponse> {
    return this.http.get<ProjectsListResponse>(this.baseUrl);
  }

  get(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.baseUrl}/${id}`);
  }

  create(data: { name: string; description?: string; baseUrl?: string }): Observable<Project> {
    return this.http.post<Project>(this.baseUrl, data).pipe(
      tap((p) => this.setActiveProject(p.id))
    );
  }

  update(id: string, data: { name?: string; description?: string; baseUrl?: string }): Observable<Project> {
    return this.http.put<Project>(`${this.baseUrl}/${id}`, data);
  }

  archive(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/${id}`);
  }
}
