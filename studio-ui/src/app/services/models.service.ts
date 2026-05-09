import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type ProviderId = 'anthropic' | 'openai';

export interface ModelEntry {
  id: string;
  label: string;
  provider: ProviderId;
  description: string;
  available: boolean;
}

export interface ModelsResponse {
  defaultModel: string;
  models: ModelEntry[];
}

@Injectable({ providedIn: 'root' })
export class ModelsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3001/api/test-studio';
  private readonly STORAGE_KEY = 'studio.selectedModel';

  list(): Observable<ModelsResponse> {
    return this.http.get<ModelsResponse>(`${this.baseUrl}/models`);
  }

  loadSavedSelection(): string | null {
    try {
      return localStorage.getItem(this.STORAGE_KEY);
    } catch {
      return null;
    }
  }

  saveSelection(modelId: string): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, modelId);
    } catch {
      /* localStorage unavailable — ignore */
    }
  }
}
