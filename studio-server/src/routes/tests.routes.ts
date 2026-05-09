import { Router } from 'express';
import { conversationStore } from '../services/conversation.store.js';
import { gherkinValidator } from '../services/gherkin-validator.service.js';
import { TestsRepo } from '../db/repositories/tests.repo.js';
import { ProjectsRepo } from '../db/repositories/projects.repo.js';
import { workspaceMaterializer } from '../services/workspace-materializer.service.js';
import { parseOrFail, UuidParam, SaveTestBody, EditTestBody } from '../utils/zod.js';

export const testsRouter = Router();

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Resolve projectId: from body > default slug */
async function resolveProjectId(body: Record<string, unknown>): Promise<string | null> {
  const id = body['projectId'] as string | undefined;
  if (id) return id;
  const def = await ProjectsRepo.getBySlug('default');
  return def?.id ?? null;
}

// POST /tests/save — save AI-generated test to DB (+ materializes .feature file on disk)
testsRouter.post('/save', async (req, res) => {
  const body = parseOrFail(res, SaveTestBody, req.body);
  if (!body) return;
  try {
    const {
      conversationId,
      featureName,
      featureContent,
      newStepDefinitions,
      fixturesNeeded,
    } = body;

    let content: string | undefined = featureContent;
    let name: string | undefined = featureName;
    let stepDefs = newStepDefinitions;
    let fixtures = fixturesNeeded;
    let originatingTestId: string | undefined;
    let projectId: string | null = body.projectId ?? null;

    if (conversationId) {
      const conv = await conversationStore.get(conversationId);
      if (conv?.originatingTestId) originatingTestId = conv.originatingTestId;
      if (!projectId) {
        // Conversations now belong to a project — get it from the conversation
        const { ConversationsRepo } = await import('../db/repositories/conversations.repo.js');
        const dbConv = await ConversationsRepo.get(conversationId);
        if (dbConv) projectId = dbConv.projectId;
      }
      if (!content) {
        const gen = conv?.latestGeneration;
        if (!gen) {
          res.status(400).json({ error: 'No generation available for this conversation yet' });
          return;
        }
        content = gen.featureContent;
        stepDefs = stepDefs ?? gen.newStepDefinitions;
        fixtures = fixtures ?? gen.fixturesNeeded;
      }
    }

    if (!projectId) projectId = await resolveProjectId(req.body ?? {});
    if (!projectId) {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }

    if (!content?.trim()) {
      res.status(400).json({ error: 'featureContent is empty' });
      return;
    }

    if (!name) {
      const m = content.match(/^\s*Feature:\s*(.+)$/m);
      name = m?.[1]?.trim() || 'untitled-test';
    }

    const validation = gherkinValidator.validate(content);
    if (!validation.ok) {
      res.status(422).json({ error: 'Gherkin validation failed', validation });
      return;
    }

    // Extract tags from feature content
    const tagMatches = content.match(/^@[\w-]+(?:\s+@[\w-]+)*$/m);
    const tags = tagMatches ? tagMatches[0].trim().split(/\s+/) : [];

    if (originatingTestId) {
      // Refine flow: create a new version of the existing test
      const version = await TestsRepo.updateContent(originatingTestId, {
        featureContent: content,
        stepDefinitions: (stepDefs ?? []) as object[],
        fixtures: (fixtures ?? []) as object[],
        changeSummary: `Updated via AI conversation ${conversationId}`,
      });
      workspaceMaterializer.invalidate(projectId);
      res.json({
        success: true,
        testId: originatingTestId,
        version: version.version,
        updatedExisting: true,
        validation,
      });
    } else {
      // New test
      const slug = slugify(name);
      const existing = await TestsRepo.getBySlug(projectId, slug);
      const finalSlug = existing ? `${slug}-${Date.now()}` : slug;
      const test = await TestsRepo.create({
        projectId,
        slug: finalSlug,
        name,
        tags,
        source: 'ai-generated',
        featureContent: content,
        stepDefinitions: (stepDefs ?? []) as object[],
        fixtures: (fixtures ?? []) as object[],
      });
      workspaceMaterializer.invalidate(projectId);
      res.json({
        success: true,
        testId: test.id,
        featurePath: `cypress/e2e/features/${finalSlug}.feature`,
        updatedExisting: false,
        validation,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Save failed' });
  }
});

// PUT /tests/:id — overwrite existing test content (edit page saves)
testsRouter.put('/:id', async (req, res) => {
  const params = parseOrFail(res, UuidParam, req.params);
  if (!params) return;
  const body = parseOrFail(res, EditTestBody, req.body);
  if (!body) return;
  try {
    const result = await TestsRepo.getWithLatestVersion(params.id);
    if (!result) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    const validation = gherkinValidator.validate(body.content);
    if (!validation.ok) {
      res.status(422).json({ error: 'Gherkin validation failed', validation });
      return;
    }

    const version = await TestsRepo.updateContent(params.id, {
      featureContent: body.content,
      changeSummary: 'Manual edit',
    });
    workspaceMaterializer.invalidate(result.test.projectId);

    res.json({
      success: true,
      testId: params.id,
      version: version.version,
      validation,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Edit failed' });
  }
});

// POST /tests/:id/refine-conversation
testsRouter.post('/:id/refine-conversation', async (req, res) => {
  const params = parseOrFail(res, UuidParam, req.params);
  if (!params) return;
  try {
    const result = await TestsRepo.getWithLatestVersion(params.id);
    if (!result) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }
    const { test, version } = result;
    const content = version.featureContent;

    const conv = await conversationStore.create(test.projectId);
    await conversationStore.setOriginatingTestId(conv.id, test.id);
    const seedMessage = `I want to refine an existing test. Here is the current .feature file:\n\n\`\`\`gherkin\n${content}\n\`\`\`\n\nPlease keep this as the starting point. I'll tell you what changes I want next.`;
    await conversationStore.appendUser(conv.id, seedMessage);
    await conversationStore.appendAssistant(
      conv.id,
      `Got it. Loaded "${test.name}" — tell me what you'd like to change.`
    );

    res.json({
      conversationId: conv.id,
      testId: test.id,
      testName: test.name,
      currentContent: content,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not start refine session' });
  }
});

