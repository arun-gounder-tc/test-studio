/**
 * One-time import script: reads existing .feature files from cypress/e2e/features/
 * and seeds them into the Postgres DB under a "default" project.
 *
 * Usage:  npx tsx src/scripts/import-existing-tests.ts
 * Safe:   idempotent — skips slugs that already exist.
 */
import 'reflect-metadata';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDB } from '../db/sequelize.js';
import { ProjectsRepo } from '../db/repositories/projects.repo.js';
import { TestsRepo } from '../db/repositories/tests.repo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PROJECT_ROOT = test-studio/ (3 levels up from src/scripts/)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const FEATURES_DIR = path.join(PROJECT_ROOT, 'cypress', 'e2e', 'features');
const CONFIG_DIR = path.join(PROJECT_ROOT, 'config');

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseFeatureFile(content: string): { name: string; tags: string[] } {
  const lines = content.split('\n');
  let name = 'Untitled';
  const tags: string[] = [];
  for (const line of lines) {
    const tagLine = line.trim().match(/^(@[\w-]+(\s+@[\w-]+)*)/);
    if (tagLine) {
      tags.push(...tagLine[1].split(/\s+/));
    }
    const featureLine = line.trim().match(/^Feature:\s*(.+)/);
    if (featureLine) {
      name = featureLine[1].trim();
      break;
    }
  }
  return { name, tags };
}

async function main() {
  await initDB();
  console.log('\n📦 Starting import of existing .feature files...\n');

  // Load config for the default project
  let baseUrl = 'http://localhost:4200';
  let routes: object = {};
  let selectors: object = {};

  const configPath = path.join(CONFIG_DIR, 'studio.config.json');
  if (fs.existsSync(configPath)) {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    baseUrl = cfg?.targetApp?.baseUrl ?? baseUrl;
  }
  const routesPath = path.join(CONFIG_DIR, 'routes.json');
  if (fs.existsSync(routesPath)) {
    routes = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));
  }
  const selectorsPath = path.join(CONFIG_DIR, 'selectors.json');
  if (fs.existsSync(selectorsPath)) {
    selectors = JSON.parse(fs.readFileSync(selectorsPath, 'utf-8'));
  }

  // Get or create the default project
  let project = await ProjectsRepo.getBySlug('default');
  if (!project) {
    project = await ProjectsRepo.create({
      slug: 'default',
      name: 'Default Project',
      description: 'Auto-created from existing test-studio config',
      baseUrl,
    });
    await ProjectsRepo.updateConfig(project.id, { routes, selectors });
    console.log(`✅ Created project: ${project.name} (id: ${project.id})`);
  } else {
    console.log(`ℹ️  Using existing project: ${project.name} (id: ${project.id})`);
  }

  // Import .feature files
  if (!fs.existsSync(FEATURES_DIR)) {
    console.log(`⚠️  Features directory not found: ${FEATURES_DIR}`);
    process.exit(0);
  }

  const featureFiles = fs
    .readdirSync(FEATURES_DIR)
    .filter((f) => f.endsWith('.feature'));

  let imported = 0;
  let skipped = 0;

  for (const filename of featureFiles) {
    const content = fs.readFileSync(path.join(FEATURES_DIR, filename), 'utf-8');
    const { name, tags } = parseFeatureFile(content);
    const slug = slugify(name) || slugify(filename.replace('.feature', ''));

    const existing = await TestsRepo.getBySlug(project!.id, slug);
    if (existing) {
      console.log(`  ⏭  Skipped (already exists): ${slug}`);
      skipped++;
      continue;
    }

    await TestsRepo.create({
      projectId: project!.id,
      slug,
      name,
      tags,
      source: 'imported',
      featureContent: content,
    });
    console.log(`  ✅ Imported: ${filename} → "${name}" [${tags.join(', ')}]`);
    imported++;
  }

  console.log(`\n🎉 Done! Imported: ${imported}, Skipped: ${skipped}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Import failed:', err);
  process.exit(1);
});
