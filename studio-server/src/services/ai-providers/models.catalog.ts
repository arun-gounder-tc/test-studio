import type { ProviderId } from './provider.interface.js';

export interface ModelEntry {
  id: string;
  label: string;
  provider: ProviderId;
  description: string;
}

/**
 * Catalog of models the UI can offer in the picker.
 * `provider` controls which API key + SDK is used.
 * Add or remove rows to expose more / fewer choices.
 */
export const MODEL_CATALOG: ModelEntry[] = [
  // OpenAI
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    provider: 'openai',
    description: 'Fast, cheap, good at structured output. Default OpenAI choice.',
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    description: 'Stronger reasoning. Use for tricky tests / debug.',
  },
  // Anthropic
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    description: 'Anthropic balanced model — fast and reliable.',
  },
  {
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    provider: 'anthropic',
    description: 'Anthropic top model — best at complex flows.',
  },
];

export function providerForModel(model: string): ProviderId {
  const entry = MODEL_CATALOG.find((m) => m.id === model);
  if (entry) return entry.provider;
  // Heuristic fallback for models added via env that aren't in the catalog
  if (/^claude/i.test(model)) return 'anthropic';
  if (/^(gpt|o\d)/i.test(model)) return 'openai';
  throw new Error(
    `Unknown model "${model}" — add it to MODEL_CATALOG or use a model whose name starts with "claude" or "gpt".`
  );
}
