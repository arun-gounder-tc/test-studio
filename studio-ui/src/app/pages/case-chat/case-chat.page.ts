import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideAngularModule,
  RefreshCw,
  ArrowLeft,
  Send,
  User,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ListChecks,
  Tag,
  Plus,
  Folder,
  FileText,
  Save,
  RefreshCcw,
  MessageCircleQuestion,
} from 'lucide-angular';
import {
  ChatMessage,
  ChatService,
  Generation,
  Validation,
} from '../../services/chat.service';
import { ModelEntry, ModelsService } from '../../services/models.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ProjectsService } from '../../services/projects.service';

interface DisplayMessage extends ChatMessage {
  generation?: Generation;
  validation?: Validation | null;
}

@Component({
  selector: 'studio-case-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="mx-auto flex h-[calc(100vh-3.5rem)] max-w-7xl flex-col px-6 py-6">
      <!-- Header -->
      <header class="mb-4 flex items-end justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-semibold tracking-tight text-zinc-900">
              {{ isRefining() ? 'Refine Test' : 'New Test' }}
            </h1>
            @if (isRefining()) {
              <span class="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                refining existing
              </span>
            }
          </div>
          <p class="mt-1 text-sm text-zinc-500">
            @if (isRefining()) {
              Tell the AI what to change — saving will <span class="font-medium text-zinc-700">overwrite</span> the original file.
            } @else {
              Chat in Hindi / English / Hinglish — pick a model and draft a Gherkin test.
            }
          </p>
        </div>
        <div class="flex items-center gap-2">
          @if (models().length > 0) {
            <label class="flex items-center gap-2">
              <span class="text-xs font-medium text-zinc-500">Model</span>
              <select
                [value]="selectedModel()"
                (change)="onModelChange($any($event.target).value)"
                [disabled]="sending() || saving()"
                class="rounded-md border border-zinc-200 bg-white py-1.5 pl-2.5 pr-8 text-sm text-zinc-900 focus-ring disabled:opacity-50"
              >
                @for (m of models(); track m.id) {
                  <option [value]="m.id" [disabled]="!m.available">
                    {{ m.label }} ({{ m.provider === 'openai' ? 'OpenAI' : 'Anthropic' }}){{ m.available ? '' : ' — key missing' }}
                  </option>
                }
              </select>
            </label>
          }
          @if (isRefining()) {
            <button
              type="button"
              (click)="backToEdit()"
              [disabled]="sending() || saving()"
              class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 focus-ring"
            >
              <i-lucide [img]="ArrowLeft" class="h-3.5 w-3.5"></i-lucide>
              Back to Edit
            </button>
          } @else {
            <button
              type="button"
              (click)="startNew()"
              [disabled]="sending() || saving()"
              class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 focus-ring"
            >
              <i-lucide [img]="RefreshCw" class="h-3.5 w-3.5"></i-lucide>
              Start over
            </button>
          }
        </div>
      </header>

      @if (!aiConfigured()) {
        <div class="mb-3 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <i-lucide [img]="AlertCircle" class="mt-0.5 h-4 w-4 text-amber-600"></i-lucide>
          <div class="text-sm">
            <p class="font-medium text-amber-900">AI offline</p>
            <p class="mt-0.5 text-amber-700">
              Set <code class="rounded bg-amber-100 px-1 font-mono text-xs">ANTHROPIC_API_KEY</code> and/or <code class="rounded bg-amber-100 px-1 font-mono text-xs">OPENAI_API_KEY</code> in <code class="rounded bg-amber-100 px-1 font-mono text-xs">studio-server/.env</code> and restart.
            </p>
          </div>
        </div>
      }

      @if (error(); as err) {
        <div class="mb-3 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <i-lucide [img]="AlertCircle" class="mt-0.5 h-4 w-4 text-red-600"></i-lucide>
          <p class="text-sm text-red-800">{{ err }}</p>
        </div>
      }

      <!-- Layout: chat left, preview right -->
      <div class="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <!-- Chat thread -->
        <section class="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div class="flex-1 space-y-3 overflow-y-auto p-4">
            @if (messages().length === 0) {
              <div class="flex h-full flex-col items-center justify-center text-center">
                <i-lucide [img]="Sparkles" class="h-8 w-8 text-zinc-300"></i-lucide>
                <h3 class="mt-3 text-sm font-medium text-zinc-900">Apna pehla test describe karein</h3>
                <ul class="mt-3 space-y-1 text-xs text-zinc-500">
                  <li>"Login test banao admin role ke liye"</li>
                  <li>"Dashboard pe 5 metric cards verify karo"</li>
                  <li>"Forgot password flow with email validation"</li>
                </ul>
              </div>
            }
            @for (m of messages(); track m.id) {
              <div
                class="flex gap-3 rounded-lg p-3 text-sm"
                [class.bg-indigo-50]="m.role === 'user'"
                [class.bg-zinc-50]="m.role === 'assistant'"
              >
                <span
                  class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  [class.bg-indigo-600]="m.role === 'user'"
                  [class.text-white]="m.role === 'user'"
                  [class.bg-zinc-200]="m.role === 'assistant'"
                  [class.text-zinc-700]="m.role === 'assistant'"
                >
                  <i-lucide [img]="m.role === 'user' ? User : Sparkles" class="h-3 w-3"></i-lucide>
                </span>
                <div class="min-w-0 flex-1">
                  <div class="mb-1 flex items-center gap-2 text-[11px] text-zinc-500">
                    <span class="font-medium text-zinc-700">{{ m.role === 'user' ? 'You' : assistantLabel(m) }}</span>
                    @if (m.generation?.modelUsed) {
                      <span class="rounded bg-zinc-200/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">{{ m.generation?.modelUsed }}</span>
                    }
                    <span>·</span>
                    <span>{{ formatTime(m.createdAt) }}</span>
                  </div>
                  <p class="whitespace-pre-wrap text-zinc-800">{{ m.content }}</p>
                </div>
              </div>
            }
            @if (sending()) {
              <div class="flex items-center gap-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-500">
                <span class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-600"></span>
                <span>{{ selectedModelEntry()?.label ?? 'Model' }} is thinking…</span>
              </div>
            }
          </div>

          <!-- Composer -->
          <div class="border-t border-zinc-200 bg-zinc-50/50 p-3">
            <div class="flex gap-2">
              <textarea
                rows="2"
                [ngModel]="draft()"
                (ngModelChange)="draft.set($event)"
                (keydown)="onComposerKey($event)"
                [disabled]="sending() || !conversationId()"
                placeholder="Type your request…"
                class="min-h-0 flex-1 resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-ring disabled:bg-zinc-50 disabled:opacity-60"
              ></textarea>
              <button
                type="button"
                (click)="send()"
                [disabled]="!draft().trim() || sending() || !conversationId()"
                class="inline-flex h-fit items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 focus-ring"
              >
                <i-lucide [img]="Send" class="h-3.5 w-3.5"></i-lucide>
                Send
              </button>
            </div>
          </div>
        </section>

        <!-- Preview panel -->
        <aside class="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <header class="flex items-center gap-2 border-b border-zinc-200 px-4 py-3">
            <i-lucide [img]="FileText" class="h-3.5 w-3.5 text-zinc-500"></i-lucide>
            <h3 class="text-sm font-semibold text-zinc-900">Preview</h3>
          </header>

          <div class="flex-1 overflow-y-auto p-4">
            @if (latestGeneration(); as gen) {
              @if (gen.featureContent) {
                <!-- Validation chips -->
                <div class="mb-3 flex flex-wrap gap-1.5">
                  @if (latestValidation(); as val) {
                    <span
                      class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
                      [class.bg-emerald-50]="val.ok"
                      [class.text-emerald-700]="val.ok"
                      [class.ring-emerald-200]="val.ok"
                      [class.bg-red-50]="!val.ok"
                      [class.text-red-700]="!val.ok"
                      [class.ring-red-200]="!val.ok"
                      class="ring-1 ring-inset"
                    >
                      <i-lucide [img]="val.ok ? CheckCircle2 : XCircle" class="h-3 w-3"></i-lucide>
                      {{ val.ok ? 'Syntax OK' : 'Syntax errors' }}
                    </span>
                    <span class="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
                      <i-lucide [img]="ListChecks" class="h-3 w-3"></i-lucide>
                      {{ val.scenarioCount }} scenario{{ val.scenarioCount === 1 ? '' : 's' }}
                    </span>
                    @if (val.hasTags) {
                      <span class="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
                        <i-lucide [img]="Tag" class="h-3 w-3"></i-lucide>
                        Tagged
                      </span>
                    }
                  }
                  @if (gen.newStepDefinitions.length) {
                    <span class="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200" title="Will create new step definitions">
                      <i-lucide [img]="Plus" class="h-3 w-3"></i-lucide>
                      {{ gen.newStepDefinitions.length }} new step{{ gen.newStepDefinitions.length === 1 ? '' : 's' }}
                    </span>
                  }
                  @if (gen.fixturesNeeded.length) {
                    <span class="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
                      <i-lucide [img]="Folder" class="h-3 w-3"></i-lucide>
                      {{ gen.fixturesNeeded.length }} fixture(s)
                    </span>
                  }
                </div>

                <!-- Code -->
                <pre class="overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-800"><code>{{ gen.featureContent }}</code></pre>

                @if (gen.newStepDefinitions.length) {
                  <details class="mt-3 rounded-md border border-zinc-200 bg-white">
                    <summary class="cursor-pointer select-none px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                      New step definitions ({{ gen.newStepDefinitions.length }})
                    </summary>
                    <div class="space-y-3 border-t border-zinc-200 p-3">
                      @for (s of gen.newStepDefinitions; track s.pattern) {
                        <div>
                          <code class="block rounded bg-indigo-50 px-2 py-1 font-mono text-[11px] text-indigo-700">{{ s.pattern }}</code>
                          <pre class="mt-1 overflow-x-auto rounded bg-zinc-50 p-2 font-mono text-[11px] text-zinc-700">{{ s.implementation }}</pre>
                          <small class="text-[11px] text-zinc-500">→ {{ s.file }}</small>
                        </div>
                      }
                    </div>
                  </details>
                }
              } @else {
                <div class="flex h-full flex-col items-center justify-center text-center">
                  <i-lucide [img]="MessageCircleQuestion" class="h-8 w-8 text-zinc-300"></i-lucide>
                  <p class="mt-3 text-sm text-zinc-500">Claude is asking for clarification — see the chat.</p>
                </div>
              }
            } @else {
              <div class="flex h-full flex-col items-center justify-center text-center">
                <i-lucide [img]="Sparkles" class="h-8 w-8 text-zinc-300"></i-lucide>
                <p class="mt-3 text-sm text-zinc-500">Generated test will appear here.</p>
              </div>
            }
          </div>

          <!-- Save bar -->
          @if (latestGeneration()?.featureContent) {
            <footer class="flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/50 px-4 py-3">
              <small class="text-[11px] text-zinc-500">
                @if (!latestValidation()?.ok) { Fix syntax issues first }
                @else if (isRefining()) { Will <span class="font-medium text-zinc-700">overwrite</span> the original .feature file }
                @else { Will write to <code class="rounded bg-zinc-100 px-1 font-mono">cypress/e2e/features/</code> }
              </small>
              <button
                type="button"
                (click)="save()"
                [disabled]="!canSave()"
                class="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 focus-ring"
              >
                @if (saving()) {
                  <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                  Saving…
                } @else {
                  <i-lucide [img]="isRefining() ? RefreshCcw : Save" class="h-3.5 w-3.5"></i-lucide>
                  {{ isRefining() ? 'Confirm & Update' : 'Confirm & Save' }}
                }
              </button>
            </footer>
          }
        </aside>
      </div>
    </div>
  `,
})
export class CaseChatPage implements OnInit {
  private readonly chat = inject(ChatService);
  private readonly modelsApi = inject(ModelsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly projectsService = inject(ProjectsService);

  readonly RefreshCw = RefreshCw;
  readonly ArrowLeft = ArrowLeft;
  readonly Send = Send;
  readonly User = User;
  readonly Sparkles = Sparkles;
  readonly AlertCircle = AlertCircle;
  readonly CheckCircle2 = CheckCircle2;
  readonly XCircle = XCircle;
  readonly ListChecks = ListChecks;
  readonly Tag = Tag;
  readonly Plus = Plus;
  readonly Folder = Folder;
  readonly FileText = FileText;
  readonly Save = Save;
  readonly RefreshCcw = RefreshCcw;
  readonly MessageCircleQuestion = MessageCircleQuestion;

  readonly conversationId = signal<string | null>(null);
  readonly refineTestId = signal<string | null>(null);
  readonly aiConfigured = signal(true);
  readonly messages = signal<DisplayMessage[]>([]);
  readonly draft = signal('');
  readonly sending = signal(false);
  readonly saving = signal(false);
  readonly latestGeneration = signal<Generation | null>(null);
  readonly latestValidation = signal<Validation | null>(null);
  readonly error = signal<string | null>(null);

  readonly models = signal<ModelEntry[]>([]);
  readonly selectedModel = signal<string>('');

  readonly isRefining = computed(() => !!this.refineTestId());

  readonly selectedModelEntry = computed(() =>
    this.models().find((m) => m.id === this.selectedModel())
  );

  readonly canSave = computed(() => {
    const gen = this.latestGeneration();
    const val = this.latestValidation();
    return !!gen && !!gen.featureContent.trim() && val?.ok === true && !this.saving();
  });

  ngOnInit(): void {
    this.loadModels();
    const params = this.route.snapshot.queryParamMap;
    const seededId = params.get('conversationId');
    const refineId = params.get('refineTestId');
    if (refineId) this.refineTestId.set(refineId);
    if (seededId) this.loadExisting(seededId);
    else this.startNew();
  }

  private loadModels(): void {
    this.modelsApi.list().subscribe({
      next: (res) => {
        this.models.set(res.models);
        const saved = this.modelsApi.loadSavedSelection();
        const preferred =
          (saved && res.models.some((m) => m.id === saved && m.available) && saved) ||
          res.models.find((m) => m.id === res.defaultModel && m.available)?.id ||
          res.models.find((m) => m.available)?.id ||
          res.models[0]?.id ||
          '';
        this.selectedModel.set(preferred);
      },
      error: () => { /* models endpoint optional */ },
    });
  }

  onModelChange(modelId: string): void {
    this.selectedModel.set(modelId);
    this.modelsApi.saveSelection(modelId);
  }

  private loadExisting(id: string): void {
    this.error.set(null);
    this.messages.set([]);
    this.chat.fetchConversation(id).subscribe({
      next: (conv) => {
        this.conversationId.set(conv.id);
        this.aiConfigured.set(true);
        this.messages.set((conv.messages ?? []).map((m) => ({ ...m })));
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? err?.message ?? 'Could not load conversation');
        this.startNew();
      },
    });
  }

  startNew(): void {
    this.error.set(null);
    this.latestGeneration.set(null);
    this.latestValidation.set(null);
    this.messages.set([]);
    this.refineTestId.set(null);
    this.chat.startConversation(this.projectsService.activeProjectId() ?? undefined).subscribe({
      next: (res) => {
        this.conversationId.set(res.id);
        this.aiConfigured.set(res.aiConfigured);
        if (!res.aiConfigured) {
          this.error.set(
            'AI offline — set ANTHROPIC_API_KEY and/or OPENAI_API_KEY in studio-server/.env and restart.'
          );
        }
      },
      error: (err) => this.error.set(err?.message ?? 'Could not start conversation'),
    });
  }

  send(): void {
    const text = this.draft().trim();
    const cid = this.conversationId();
    if (!text || !cid || this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    const optimistic: DisplayMessage = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    this.messages.update((m) => [...m, optimistic]);
    this.draft.set('');

    this.chat.sendMessage(cid, text, this.selectedModel() || undefined).subscribe({
      next: (res) => {
        this.messages.update((m) => {
          const filtered = m.filter((x) => x.id !== optimistic.id);
          const assistant: DisplayMessage = {
            ...res.assistantMessage,
            generation: res.generation ?? undefined,
            validation: res.validation,
          };
          return [...filtered, res.userMessage, assistant];
        });
        if (res.generation) this.latestGeneration.set(res.generation);
        if (res.validation) this.latestValidation.set(res.validation);
        this.sending.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? err?.message ?? 'Message failed');
        this.sending.set(false);
      },
    });
  }

  save(): void {
    const cid = this.conversationId();
    if (!cid || !this.canSave()) return;
    this.saving.set(true);
    this.chat.saveTest(cid).subscribe({
      next: (res) => {
        this.saving.set(false);
        const verb = res.updatedExisting ? 'Updated' : 'Saved';
        const ref = this.toast.success(`${verb} → ${res.featurePath}`, {
          action: 'View Library',
          duration: 6000,
        });
        ref.onAction().subscribe(() => this.router.navigate(['/library']));
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error ?? err?.message ?? 'Save failed');
      },
    });
  }

  backToEdit(): void {
    const id = this.refineTestId();
    if (!id) return;
    this.router.navigate(['/edit', id]);
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  assistantLabel(m: DisplayMessage): string {
    const provider = m.generation?.providerUsed;
    if (provider === 'openai') return 'GPT';
    if (provider === 'anthropic') return 'Claude';
    return 'Assistant';
  }

  onComposerKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }
}
