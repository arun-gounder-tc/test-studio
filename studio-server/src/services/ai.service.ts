import { STUDIO_SYSTEM_PROMPT, buildProjectContextBlock } from '../prompts/system.prompt.js';
import { projectContextService } from './project-context.service.js';
import {
  anyProviderConfigured,
  getProviderForModel,
  listModels,
  type ModelEntryWithStatus,
} from './ai-providers/index.js';
import type {
  ChatTurn,
  GenerationResult,
  NewStepDef,
  FixtureFile,
} from './ai-providers/provider.interface.js';

export type { ChatTurn, GenerationResult, NewStepDef, FixtureFile };

export class AIService {
  private readonly defaultModel: string;

  constructor() {
    this.defaultModel = process.env.DEFAULT_MODEL || 'gpt-4o-mini';
  }

  isConfigured(): boolean {
    return anyProviderConfigured();
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  listModels(): ModelEntryWithStatus[] {
    return listModels();
  }

  async generate(
    history: ChatTurn[],
    userMessage: string,
    modelOverride?: string
  ): Promise<GenerationResult> {
    const model = modelOverride?.trim() || this.defaultModel;
    const provider = getProviderForModel(model);

    const ctx = projectContextService.load();
    const projectBlock = buildProjectContextBlock(ctx);

    return provider.generate({
      model,
      history,
      userMessage,
      systemPrompt: STUDIO_SYSTEM_PROMPT,
      projectContext: projectBlock,
    });
  }
}

export const aiService = new AIService();
