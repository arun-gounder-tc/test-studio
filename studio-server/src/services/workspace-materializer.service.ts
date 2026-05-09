/**
 * workspace-materializer.service.ts
 *
 * Materializes DB content to disk so Cypress can find .feature files.
 * Strategy (from POSTGRES-MIGRATION-PLAN.md §8):
 *   - Lazy: workspace dir refreshed on first run POST after server start
 *   - Cache invalidated on test update or project config update
 *   - Per-project mutex during materialization
 */
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../utils/paths.js';
import { TestsRepo } from '../db/repositories/tests.repo.js';
import { ProjectsRepo } from '../db/repositories/projects.repo.js';

const WORKSPACE_DIR = path.join(paths.projectRoot, '.workspace');

/** Per-project mutex: projectId → Promise currently running */
const locks = new Map<string, Promise<void>>();
/** Invalidation set: projectIds whose workspace needs refresh */
const stale = new Set<string>();

export const workspaceMaterializer = {
  /** Mark a project's workspace as stale (called after test/config updates) */
  invalidate(projectId: string): void {
    stale.add(projectId);
  },

  /**
   * Ensures the workspace for a project is up-to-date.
   * Returns the absolute path to that project's workspace root.
   */
  async ensure(projectId: string): Promise<string> {
    const workspaceRoot = path.join(WORKSPACE_DIR, projectId);

    if (!stale.has(projectId) && fs.existsSync(path.join(workspaceRoot, 'cypress', 'e2e', 'features'))) {
      return workspaceRoot;
    }

    // Per-project lock — avoid concurrent materializations
    if (locks.has(projectId)) {
      await locks.get(projectId);
      return workspaceRoot;
    }

    const task = this._materialize(projectId, workspaceRoot);
    locks.set(projectId, task);
    try {
      await task;
      stale.delete(projectId);
    } finally {
      locks.delete(projectId);
    }
    return workspaceRoot;
  },

  async _materialize(projectId: string, workspaceRoot: string): Promise<void> {
    const project = await ProjectsRepo.get(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const tmpDir = `${workspaceRoot}.tmp`;
    // Clean tmp dir
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });

    const featuresDir = path.join(tmpDir, 'cypress', 'e2e', 'features');
    const stepDefsDir = path.join(tmpDir, 'cypress', 'support', 'step_definitions');
    const fixturesDir = path.join(tmpDir, 'cypress', 'fixtures');
    const configDir = path.join(tmpDir, 'config');

    fs.mkdirSync(featuresDir, { recursive: true });
    fs.mkdirSync(stepDefsDir, { recursive: true });
    fs.mkdirSync(fixturesDir, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });

    // Write all tests' feature content from DB
    const tests = await TestsRepo.listByProject(projectId);
    for (const test of tests) {
      const versionResult = await TestsRepo.getWithLatestVersion(test.id);
      if (!versionResult) continue;
      const { version } = versionResult;

      // Write .feature file
      const featurePath = path.join(featuresDir, `${test.slug}.feature`);
      fs.writeFileSync(featurePath, version.featureContent, 'utf-8');

      // Write step definitions if any
      const stepDefs = version.stepDefinitions as Array<{ pattern?: string; implementation?: string; file?: string }>;
      if (stepDefs.length > 0) {
        const targetFile = path.join(stepDefsDir, `${test.slug}.steps.ts`);
        const header = `import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';\n\n`;
        const body = stepDefs.map((s) => s.implementation ?? '').join('\n\n');
        fs.writeFileSync(targetFile, header + body, 'utf-8');
      }

      // Write fixtures
      const fixtures = version.fixtures as Array<{ path?: string; content?: string }>;
      for (const fixture of fixtures) {
        if (!fixture.path || !fixture.content) continue;
        const fixturePath = path.join(fixturesDir, path.basename(fixture.path));
        fs.writeFileSync(fixturePath, fixture.content, 'utf-8');
      }
    }

    // Write project config files from DB
    const config = project.config;
    if (config) {
      fs.writeFileSync(path.join(configDir, 'routes.json'), JSON.stringify(config.routes, null, 2), 'utf-8');
      fs.writeFileSync(path.join(configDir, 'selectors.json'), JSON.stringify(config.selectors, null, 2), 'utf-8');

      // Write a minimal studio.config.json for cypress.config.ts
      const studioConfig = {
        project: { name: project.slug, displayName: project.name },
        targetApp: { baseUrl: project.baseUrl ?? 'http://localhost:4200' },
        studio: { serverPort: 3001, uiPort: 4300 },
      };
      fs.writeFileSync(path.join(configDir, 'studio.config.json'), JSON.stringify(studioConfig, null, 2), 'utf-8');
    }

    // Atomic rename: tmp → workspace root
    if (fs.existsSync(workspaceRoot)) fs.rmSync(workspaceRoot, { recursive: true });
    fs.renameSync(tmpDir, workspaceRoot);
  },

  /**
   * Get the materialized .feature file path for a given test slug under a project.
   * Ensures workspace is fresh first.
   */
  async getFeaturePath(projectId: string, testSlug: string): Promise<string> {
    const workspaceRoot = await this.ensure(projectId);
    return path.join(workspaceRoot, 'cypress', 'e2e', 'features', `${testSlug}.feature`);
  },

  /** Get workspace-relative path (for passing to Cypress --spec) */
  async getSpecRelativePath(projectId: string, testSlug: string): Promise<string> {
    const absPath = await this.getFeaturePath(projectId, testSlug);
    return path.relative(paths.projectRoot, absPath);
  },
};
