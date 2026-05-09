import { Router } from 'express';
import { ProjectsRepo } from '../db/repositories/projects.repo.js';
import {
  parseOrFail,
  UuidParam,
  ProjectsListQuery,
  CreateProjectBody,
  UpdateProjectBody,
  UpdateProjectConfigBody,
} from '../utils/zod.js';

export const projectsRouter = Router();

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** GET /api/test-studio/projects */
projectsRouter.get('/', async (req, res) => {
  const query = parseOrFail(res, ProjectsListQuery, req.query);
  if (!query) return;
  try {
    const projects = await ProjectsRepo.list(query.archived === '1');
    res.json({ projects });
  } catch (err) {
    console.error('GET /projects error:', err);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

/** GET /api/test-studio/projects/:id */
projectsRouter.get('/:id', async (req, res) => {
  const params = parseOrFail(res, UuidParam, req.params);
  if (!params) return;
  try {
    const project = await ProjectsRepo.get(params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ project });
  } catch (err) {
    console.error('GET /projects/:id error:', err);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

/** POST /api/test-studio/projects */
projectsRouter.post('/', async (req, res) => {
  const body = parseOrFail(res, CreateProjectBody, req.body);
  if (!body) return;
  try {
    let slug = slugify(body.name);
    const existing = await ProjectsRepo.getBySlug(slug);
    if (existing) slug = `${slug}-${Date.now()}`;
    const project = await ProjectsRepo.create({ slug, name: body.name, description: body.description, baseUrl: body.baseUrl });
    res.status(201).json({ project });
  } catch (err: any) {
    if (err?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'A project with this slug already exists' });
    }
    console.error('POST /projects error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/** PUT /api/test-studio/projects/:id */
projectsRouter.put('/:id', async (req, res) => {
  const params = parseOrFail(res, UuidParam, req.params);
  if (!params) return;
  const body = parseOrFail(res, UpdateProjectBody, req.body);
  if (!body) return;
  try {
    const project = await ProjectsRepo.update(params.id, body);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ project });
  } catch (err) {
    console.error('PUT /projects/:id error:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/** PUT /api/test-studio/projects/:id/config */
projectsRouter.put('/:id/config', async (req, res) => {
  const params = parseOrFail(res, UuidParam, req.params);
  if (!params) return;
  const body = parseOrFail(res, UpdateProjectConfigBody, req.body);
  if (!body) return;
  try {
    const config = await ProjectsRepo.updateConfig(params.id, body);
    res.json({ config });
  } catch (err) {
    console.error('PUT /projects/:id/config error:', err);
    res.status(500).json({ error: 'Failed to update project config' });
  }
});

/** DELETE /api/test-studio/projects/:id  (soft archive) */
projectsRouter.delete('/:id', async (req, res) => {
  const params = parseOrFail(res, UuidParam, req.params);
  if (!params) return;
  try {
    await ProjectsRepo.archive(params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /projects/:id error:', err);
    res.status(500).json({ error: 'Failed to archive project' });
  }
});

/** GET /api/test-studio/projects/:id/runs */
projectsRouter.get('/:id/runs', async (req, res) => {
  const params = parseOrFail(res, UuidParam, req.params);
  if (!params) return;
  try {
    const { RunsRepo } = await import('../db/repositories/runs.repo.js');
    const runs = await RunsRepo.listByProject(params.id);
    res.json({ runs });
  } catch (err) {
    console.error('GET /projects/:id/runs error:', err);
    res.status(500).json({ error: 'Failed to list runs' });
  }
});
