/**
 * Central Zod schemas + a helper that parses and returns 400 on failure.
 */
import { z } from 'zod';
import type { Request, Response } from 'express';

// ─── Helper ────────────────────────────────────────────────────────────────

/**
 * Parse `data` against `schema`. On failure writes a 400 JSON response and
 * returns `null`; on success returns the typed output.
 */
export function parseOrFail<T extends z.ZodTypeAny>(
  res: Response,
  schema: T,
  data: unknown,
): z.infer<T> | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    res.status(400).json({
      error: 'Validation failed',
      issues: result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    return null;
  }
  return result.data;
}

// ─── Shared primitives ──────────────────────────────────────────────────────

export const UuidParam = z.object({ id: z.string().uuid('id must be a valid UUID') });

const optionalUrl = z
  .string()
  .url('baseUrl must be a valid URL')
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' ? undefined : v));

// ─── Projects ───────────────────────────────────────────────────────────────

export const CreateProjectBody = z.object({
  name: z.string().min(1, 'name is required').max(120),
  description: z.string().max(500).optional(),
  baseUrl: optionalUrl,
});

export const UpdateProjectBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  baseUrl: optionalUrl,
});

export const UpdateProjectConfigBody = z.object({
  routes: z.record(z.string(), z.unknown()).optional(),
  selectors: z.record(z.string(), z.unknown()).optional(),
  authAdapter: z.record(z.string(), z.unknown()).optional(),
  defaultModel: z.string().optional(),
});

export const ProjectsListQuery = z.object({
  archived: z.enum(['0', '1']).optional(),
});

// ─── Tests ──────────────────────────────────────────────────────────────────

export const SaveTestBody = z.object({
  conversationId: z.string().uuid().optional(),
  featureName: z.string().max(200).optional(),
  featureContent: z.string().optional(),
  newStepDefinitions: z.array(z.unknown()).optional(),
  fixturesNeeded: z.array(z.unknown()).optional(),
  projectId: z.string().uuid().optional(),
});

export const EditTestBody = z.object({
  content: z.string().min(1, 'content is required'),
});

// ─── Conversations ───────────────────────────────────────────────────────────

export const CreateConversationBody = z.object({
  projectId: z.string().uuid().optional(),
});

export const CreateConversationQuery = z.object({
  projectId: z.string().uuid().optional(),
});

export const SendMessageBody = z.object({
  content: z.string().min(1, 'message content is required'),
  model: z.string().optional(),
});

// ─── Runs ────────────────────────────────────────────────────────────────────

export const StartRunBody = z.object({
  testId: z.string().uuid().optional(),
  specRelativePath: z.string().optional(),
  headed: z.boolean().optional(),
  projectId: z.string().uuid().optional(),
}).refine(
  (d) => d.testId ?? d.specRelativePath,
  { message: 'Either testId or specRelativePath is required' },
);

export const ListRunsQuery = z.object({
  projectId: z.string().uuid().optional(),
});

export const RunLogsQuery = z.object({
  after: z.coerce.number().int().default(-1),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

// ─── Library ─────────────────────────────────────────────────────────────────

export const LibraryQuery = z.object({
  projectId: z.string().uuid().optional(),
});

void ((_req: Request) => {}); // keep Request import used
