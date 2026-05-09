import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { conversationStore } from '../services/conversation.store.js';
import { filesystemService } from '../services/filesystem.service.js';
import { gherkinValidator } from '../services/gherkin-validator.service.js';
import { testWriter } from '../services/test-writer.service.js';
import { paths } from '../utils/paths.js';

export const testsRouter = Router();

testsRouter.post('/save', (req, res) => {
  try {
    const {
      conversationId,
      featureName,
      featureContent,
      newStepDefinitions,
      fixturesNeeded,
    } = req.body ?? {};

    let content: string | undefined = featureContent;
    let name: string | undefined = featureName;
    let stepDefs = newStepDefinitions;
    let fixtures = fixturesNeeded;
    let originatingTestId: string | undefined;

    if (conversationId) {
      const conv = conversationStore.get(conversationId);
      if (conv?.originatingTestId) originatingTestId = conv.originatingTestId;
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

    let overwriteFilePath: string | undefined;
    if (originatingTestId) {
      const existing = filesystemService.listFeatureFiles().find((t) => t.id === originatingTestId);
      if (!existing) {
        res
          .status(404)
          .json({ error: `Originating test ${originatingTestId} no longer exists on disk` });
        return;
      }
      overwriteFilePath = existing.filePath;
    }

    const result = testWriter.save({
      featureName: name,
      featureContent: content,
      newStepDefinitions: stepDefs,
      fixturesNeeded: fixtures,
      conversationId,
      overwriteFilePath,
    });

    res.json({
      success: true,
      testId: result.testId,
      featurePath: path.relative(paths.projectRoot, result.featurePath),
      filesWritten: result.filesWritten.map((f) => path.relative(paths.projectRoot, f)),
      updatedExisting: result.updatedExisting,
      validation,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed';
    res.status(500).json({ error: message });
  }
});

// PUT /tests/:id — overwrite an existing .feature file with edited content
testsRouter.put('/:id', (req, res) => {
  try {
    const { content } = req.body ?? {};
    if (typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const tests = filesystemService.listFeatureFiles();
    const test = tests.find((t) => t.id === req.params.id);
    if (!test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }

    const validation = gherkinValidator.validate(content);
    if (!validation.ok) {
      res.status(422).json({ error: 'Gherkin validation failed', validation });
      return;
    }

    fs.writeFileSync(test.filePath, content, 'utf-8');

    res.json({
      success: true,
      testId: test.id,
      featurePath: path.relative(paths.projectRoot, test.filePath),
      validation,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Edit failed';
    res.status(500).json({ error: message });
  }
});

// POST /tests/:id/refine-conversation — start a chat seeded with the test's current code
testsRouter.post('/:id/refine-conversation', (req, res) => {
  try {
    const tests = filesystemService.listFeatureFiles();
    const test = tests.find((t) => t.id === req.params.id);
    if (!test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }
    const content = filesystemService.readFeatureContent(test.relativePath);

    const conv = conversationStore.create();
    conversationStore.setOriginatingTestId(conv.id, test.id);
    const seedMessage = `I want to refine an existing test. Here is the current .feature file:\n\n\`\`\`gherkin\n${content}\n\`\`\`\n\nPlease keep this as the starting point. I'll tell you what changes I want next.`;
    conversationStore.appendUser(conv.id, seedMessage);
    conversationStore.appendAssistant(
      conv.id,
      `Got it. Loaded "${test.name}" — ${test.scenarioCount} scenario${test.scenarioCount === 1 ? '' : 's'}, ${test.tags.length} feature tag${test.tags.length === 1 ? '' : 's'}. Tell me what you'd like to change.`
    );

    res.json({
      conversationId: conv.id,
      testId: test.id,
      testName: test.name,
      currentContent: content,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start refine session';
    res.status(500).json({ error: message });
  }
});
