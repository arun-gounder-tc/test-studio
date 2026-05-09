import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../utils/paths.js';

export interface ProjectContext {
  projectName: string;
  targetAppBaseUrl: string;
  routes: Record<string, string>;
  selectorsByPage: Record<string, Record<string, string>>;
  availableStepPatterns: string[];
}

const STEP_PATTERN_REGEX = /(?:Given|When|Then|And|But)\s*\(\s*['"`]([^'"`]+)['"`]/g;

function readJsonSafe<T>(p: string): T | null {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function listStepPatterns(): string[] {
  const dir = paths.stepDefinitionsDir;
  if (!fs.existsSync(dir)) return [];
  const patterns = new Set<string>();

  function walk(d: string): void {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /\.(ts|js)$/.test(entry.name)) {
        const content = fs.readFileSync(full, 'utf-8');
        let m: RegExpExecArray | null;
        while ((m = STEP_PATTERN_REGEX.exec(content)) !== null) {
          patterns.add(m[1]);
        }
      }
    }
  }
  walk(dir);
  return Array.from(patterns).sort();
}

export class ProjectContextService {
  load(): ProjectContext {
    const studioConfig = readJsonSafe<any>(path.join(paths.configDir, 'studio.config.json'));
    const routes = readJsonSafe<any>(path.join(paths.configDir, 'routes.json'));
    const selectors = readJsonSafe<any>(path.join(paths.configDir, 'selectors.json'));

    return {
      projectName: studioConfig?.project?.displayName ?? studioConfig?.project?.name ?? 'Unknown project',
      targetAppBaseUrl: studioConfig?.targetApp?.baseUrl ?? 'http://localhost:4200',
      routes: routes?.routes ?? {},
      selectorsByPage: selectors?.pages ?? {},
      availableStepPatterns: listStepPatterns(),
    };
  }
}

export const projectContextService = new ProjectContextService();
