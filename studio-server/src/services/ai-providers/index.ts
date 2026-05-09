import { AnthropicProvider } from './anthropic.provider.js';
import { OpenAIProvider } from './openai.provider.js';
import { MODEL_CATALOG, ModelEntry, providerForModel } from './models.catalog.js';
import type { AIProvider, ProviderId } from './provider.interface.js';

export * from './provider.interface.js';
export { MODEL_CATALOG, providerForModel } from './models.catalog.js';
export type { ModelEntry } from './models.catalog.js';

const PROVIDERS: Record<ProviderId, AIProvider> = {
  anthropic: new AnthropicProvider(),
  openai: new OpenAIProvider(),
};

export function getProviderForModel(model: string): AIProvider {
  return PROVIDERS[providerForModel(model)];
}

export function isProviderAvailable(provider: ProviderId): boolean {
  return PROVIDERS[provider].available;
}

export interface ModelEntryWithStatus extends ModelEntry {
  available: boolean;
}

export function listModels(): ModelEntryWithStatus[] {
  return MODEL_CATALOG.map((m) => ({ ...m, available: PROVIDERS[m.provider].available }));
}

export function anyProviderConfigured(): boolean {
  return PROVIDERS.anthropic.available || PROVIDERS.openai.available;
}
