import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface NewStepDef {
  pattern: string;
  implementation: string;
  file: string;
}

export interface FixtureFile {
  path: string;
  content: string;
}

export interface Generation {
  featureContent: string;
  newStepDefinitions: NewStepDef[];
  fixturesNeeded: FixtureFile[];
  explanation: string;
  tokensUsed?: { input: number; output: number };
  modelUsed?: string;
  providerUsed?: 'anthropic' | 'openai';
}

export interface Validation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  scenarioCount: number;
  hasFeature: boolean;
  hasTags: boolean;
}

export interface ConversationStart {
  id: string;
  startedAt: string;
  aiConfigured: boolean;
  messages: ChatMessage[];
}

export interface MessageResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  generation: Generation | null;
  validation: Validation | null;
  error?: string;
}

export interface SaveResponse {
  success: boolean;
  testId: string;
  featurePath: string;
  filesWritten: string[];
  updatedExisting?: boolean;
  validation: Validation;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3001/api/test-studio';

  startConversation(projectId?: string): Observable<ConversationStart> {
    return this.http.post<ConversationStart>(`${this.baseUrl}/conversations`, projectId ? { projectId } : {});
  }

  fetchConversation(id: string): Observable<ConversationStart & { messages: ChatMessage[] }> {
    return this.http.get<ConversationStart & { messages: ChatMessage[] }>(
      `${this.baseUrl}/conversations/${id}`
    );
  }

  sendMessage(
    conversationId: string,
    content: string,
    model?: string
  ): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.baseUrl}/conversations/${conversationId}/messages`,
      model ? { content, model } : { content }
    );
  }

  saveTest(conversationId: string, featureName?: string): Observable<SaveResponse> {
    return this.http.post<SaveResponse>(`${this.baseUrl}/tests/save`, {
      conversationId,
      featureName,
    });
  }
}
