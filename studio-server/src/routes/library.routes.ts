import { Router } from 'express';
import { TestsRepo } from '../db/repositories/tests.repo.js';
import { ProjectsRepo } from '../db/repositories/projects.repo.js';
import { parseOrFail, UuidParam, LibraryQuery } from '../utils/zod.js';

export const libraryRouter = Router();

/** Resolve projectId from query or fallback to default slug */
async function resolveProjectId(id?: string): Promise<string | null> {
  if (id) return id;
  const def = await ProjectsRepo.getBySlug('default');
  return def?.id ?? null;
}

libraryRouter.get('/', async (req, res) => {
  const query = parseOrFail(res, LibraryQuery, req.query);
  if (!query) return;
  try {
    const projectId = await resolveProjectId(query.projectId);
    if (!projectId) {
      res.status(400).json({ error: 'projectId is required (or create a project first)' });
      return;
    }
    const tests = await TestsRepo.listByProject(projectId);
    res.json({
      total: tests.length,
      projectId,
      tests: tests.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        tags: t.tags,
        source: t.source,
        status: t.status,
        currentVersion: t.currentVersion,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        relativePath: `cypress/e2e/features/${t.slug}.feature`,
        scenarioCount: 0,
        scenarios: [],
        lastRun: null,
        sizeBytes: null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

libraryRouter.get('/:id/content', async (req, res) => {
  const params = parseOrFail(res, UuidParam, req.params);
  if (!params) return;
  try {
    const result = await TestsRepo.getWithLatestVersion(params.id);
    if (!result) {
      res.status(404).json({ error: 'Test not found' });
      return;
    }
    const { test, version } = result;
    res.json({
      id: test.id,
      name: test.name,
      slug: test.slug,
      relativePath: `cypress/e2e/features/${test.slug}.feature`,
      content: version.featureContent,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
