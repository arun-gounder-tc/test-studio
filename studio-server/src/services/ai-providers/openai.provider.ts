import OpenAI from 'openai';
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

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const;
  private client: OpenAI | null = null;

  constructor() {
    const key = process.env.OPENAI_API_KEY;
    if (key && key.trim().length > 0) {
      this.client = new OpenAI({ apiKey: key });
    }
  }

  get available(): boolean {
    return this.client !== null;
  }

  async generate(opts: GenerateOpts): Promise<GenerationResult> {
    if (!this.client) {
      throw new Error(
        'OPENAI_API_KEY is not set. Add it to studio-server/.env and restart, or pick a Claude model.'
      );
    }

    const userImageBlocks: OpenAI.Chat.Completions.ChatCompletionContentPartImage[] =
      (opts.userImages ?? []).map((img) => ({
        type: 'image_url',
        image_url: {
          url: `data:${img.mediaType};base64,${img.data.toString('base64')}`,
        },
      }));

    const userContent: OpenAI.Chat.Completions.ChatCompletionUserMessageParam['content'] =
      userImageBlocks.length
        ? [{ type: 'text', text: opts.userMessage }, ...userImageBlocks]
        : opts.userMessage;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `${opts.systemPrompt}\n\n${opts.projectContext}`,
      },
      ...opts.history.map((t) => ({
        role: t.role,
        content: t.content,
      })),
      { role: 'user', content: userContent },
    ];

    const response = await this.client.chat.completions.create({
      model: opts.model,
      max_tokens: 2048,
      messages,
      tools: [
        {
          type: 'function',
          function: {
            name: TOOL_NAME,
            description: TOOL_DESCRIPTION,
            parameters: TOOL_PARAMETERS,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: TOOL_NAME } },
    });

    const choice = response.choices[0];
    const toolCall = choice?.message.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function' || toolCall.function.name !== TOOL_NAME) {
      throw new Error('OpenAI did not return the expected tool call');
    }

    let payload: ToolPayload;
    try {
      payload = JSON.parse(toolCall.function.arguments) as ToolPayload;
    } catch {
      throw new Error('OpenAI returned malformed JSON in the tool call arguments');
    }

    return normalizePayload(payload, opts.model, this.id, {
      input: response.usage?.prompt_tokens ?? 0,
      output: response.usage?.completion_tokens ?? 0,
    });
  }
}
