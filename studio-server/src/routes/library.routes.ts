import { Router } from 'express';
import { filesystemService } from '../services/filesystem.service.js';

export const libraryRouter = Router();

libraryRouter.get('/', (_req, res) => {
  try {
    const tests = filesystemService.listFeatureFiles();
    res.json({
      total: tests.length,
      tests: tests.map((t) => ({
        id: t.id,
        name: t.name,
        relativePath: t.relativePath,
        description: t.description,
        tags: t.tags,
        scenarioCount: t.scenarioCount,
        scenarios: t.scenarios,
        source: 'manual',
        status: 'ready',
        lastRun: null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        sizeBytes: t.sizeBytes,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

libraryRouter.get('/:id/content', (req, res) => {
  try {
    const tests = filesystemService.listFeatureFiles();
    const test = tests.find((t) => t.id === req.params.id);
    if (!test) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }
    const content = filesystemService.readFeatureContent(test.relativePath);
    res.json({ id: test.id, name: test.name, relativePath: test.relativePath, content });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
