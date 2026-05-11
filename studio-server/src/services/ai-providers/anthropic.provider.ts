import Anthropic from '@anthropic-ai/sdk';
import {
  AIProvider,
  GenerateOpts,
  GenerationResult,
  TOOL_DESCRIPTION,
  TOOL_NAME,
  TOOL_PARAMETERS,
  ToolPayload,
  normalizePayload,
} from './provider.interface.js';

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic' as const;
  private client: Anthropic | null = null;

  constructor() {
    const key = process.env.ANTHROPIC_API_KEY;
    if (key && key.trim().length > 0) {
      this.client = new Anthropic({ apiKey: key });
    }
  }

  get available(): boolean {
    return this.client !== null;
  }

  async generate(opts: GenerateOpts): Promise<GenerationResult> {
    if (!this.client) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Add it to studio-server/.env and restart, or pick an OpenAI model.'
      );
    }

    const imageBlocks: Anthropic.Messages.ImageBlockParam[] = (opts.userImages ?? []).map((img) => ({
      type: 'image',
      source: { type: 'url', url: img.url },
    }));

    const userContent: Anthropic.Messages.ContentBlockParam[] = imageBlocks.length
      ? [...imageBlocks, { type: 'text', text: opts.userMessage }]
      : [{ type: 'text', text: opts.userMessage }];

    const messages: Anthropic.Messages.MessageParam[] = [
      ...opts.history.map((t) => ({ role: t.role, content: t.content })),
      { role: 'user', content: userContent },
    ];

    const response = await this.client.messages.create({
      model: opts.model,
      max_tokens: 2048,
      system: [
        { type: 'text', text: opts.systemPrompt, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: opts.projectContext, cache_control: { type: 'ephemeral' } },
      ],
      tools: [
        {
          name: TOOL_NAME,
          description: TOOL_DESCRIPTION,
          input_schema: TOOL_PARAMETERS,
        },
      ],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages,
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
    );
    if (!toolUse || toolUse.name !== TOOL_NAME) {
      throw new Error('Claude did not return the expected tool call');
    }

    return normalizePayload(toolUse.input as ToolPayload, opts.model, this.id, {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    });
  }
}
