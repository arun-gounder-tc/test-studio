import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ScenarioInfo {
  name: string;
  tags: string[];
}

export interface TestSummary {
  id: string;
  name: string;
  relativePath: string;
  description: string | null;
  tags: string[];
  scenarioCount: number;
  scenarios: ScenarioInfo[];
  source: 'manual' | 'ai-generated' | 'uploaded';
  status: 'ready' | 'draft' | 'archived';
  lastRun: { status: string; finishedAt: string } | null;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
}

export interface LibraryResponse {
  total: number;
  tests: TestSummary[];
}

export interface TestContent {
  id: string;
  name: string;
  relativePath: string;
  content: string;
}

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3001/api/test-studio';

  list(): Observable<LibraryResponse> {
    return this.http.get<LibraryResponse>(`${this.baseUrl}/library`);
  }

  content(id: string): Observable<TestContent> {
    return this.http.get<TestContent>(`${this.baseUrl}/library/${id}/content`);
  }

  update(id: string, content: string): Observable<{ success: boolean; testId: string; featurePath: string; validation: any }> {
    return this.http.put<any>(`${this.baseUrl}/tests/${id}`, { content });
  }

  startRefineConversation(id: string): Observable<{
    conversationId: string;
    testId: string;
    testName: string;
    currentContent: string;
  }> {
    return this.http.post<any>(`${this.baseUrl}/tests/${id}/refine-conversation`, {});
  }
}
