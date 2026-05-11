import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolves to studio-server/ in both dev (src/utils/) and prod (dist/utils/)
const PROJECT_ROOT = path.resolve(__dirname, '../..');

export const paths = {
  projectRoot: PROJECT_ROOT,
  cypressDir: path.join(PROJECT_ROOT, 'cypress'),
  featuresDir: path.join(PROJECT_ROOT, 'cypress/e2e/features'),
  stepDefinitionsDir: path.join(PROJECT_ROOT, 'cypress/support/step_definitions'),
  pagesDir: path.join(PROJECT_ROOT, 'cypress/support/pages'),
  fixturesDir: path.join(PROJECT_ROOT, 'cypress/fixtures'),
  configDir: path.join(PROJECT_ROOT, 'config'),
  studioDataDir: path.join(PROJECT_ROOT, '.test-studio'),
  runsDir: path.join(PROJECT_ROOT, '.test-studio/runs'),
  uploadsDir: path.join(PROJECT_ROOT, '.test-studio/uploads'),
};
