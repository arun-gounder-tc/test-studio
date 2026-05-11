export type ProviderId = 'anthropic' | 'openai';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
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

export interface GenerationResult {
  featureContent: string;
  newStepDefinitions: NewStepDef[];
  fixturesNeeded: FixtureFile[];
  explanation: string;
  tokensUsed?: { input: number; output: number };
  modelUsed: string;
  providerUsed: ProviderId;
}

export interface UserImage {
  url: string;       // Public/presigned URL the AI provider can fetch directly
  mediaType: string; // e.g. 'image/png'
}

export interface GenerateOpts {
  model: string;
  history: ChatTurn[];
  userMessage: string;
  userImages?: UserImage[];
  systemPrompt: string;
  projectContext: string;
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly available: boolean;
  generate(opts: GenerateOpts): Promise<GenerationResult>;
}

export const TOOL_NAME = 'generateTest';

export const TOOL_PARAMETERS = {
  type: 'object' as const,
  properties: {
    featureContent: {
      type: 'string',
      description:
        'The complete .feature file content in English Gherkin. Empty string if you need to ask a clarifying question first.',
    },
    newStepDefinitions: {
      type: 'array',
      description:
        'Step definitions that DO NOT exist yet in the project. Empty array if all steps were reused.',
      items: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Cucumber pattern, e.g. "I should see {int} cards"' },
          implementation: {
            type: 'string',
            description: 'TypeScript Cypress code body for this step.',
          },
          file: {
            type: 'string',
            description:
              'Target file relative to cypress/support/step_definitions/, e.g. "verification.steps.ts"',
          },
        },
        required: ['pattern', 'implementation', 'file'],
      },
    },
    fixturesNeeded: {
      type: 'array',
      description: 'Fixture files this test needs. Empty if none.',
      items: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path relative to cypress/fixtures/, e.g. "users/admin.json"',
          },
          content: { type: 'string', description: 'Full file content (JSON usually).' },
        },
        required: ['path', 'content'],
      },
    },
    explanation: {
      type: 'string',
      description:
        'A 1-3 sentence Hindi/Hinglish/English summary for the tester. If the request is ambiguous and featureContent is empty, ask a clarifying question here instead.',
    },
  },
  required: ['featureContent', 'explanation'],
};

export const TOOL_DESCRIPTION =
  'Produce a complete Gherkin .feature file (and any new step definitions / fixtures needed) based on the tester request and conversation history.';

export interface ToolPayload {
  featureContent?: string;
  newStepDefinitions?: NewStepDef[];
  fixturesNeeded?: FixtureFile[];
  explanation?: string;
}

export function normalizePayload(
  payload: ToolPayload,
  model: string,
  providerId: ProviderId,
  tokens?: { input: number; output: number }
): GenerationResult {
  return {
    featureContent: payload.featureContent ?? '',
    newStepDefinitions: payload.newStepDefinitions ?? [],
    fixturesNeeded: payload.fixturesNeeded ?? [],
    explanation: payload.explanation ?? '',
    tokensUsed: tokens,
    modelUsed: model,
    providerUsed: providerId,
  };
}
