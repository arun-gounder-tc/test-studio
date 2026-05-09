import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../utils/paths.js';

export interface FeatureFileInfo {
  id: string;
  filePath: string;
  relativePath: string;
  name: string;
  description: string | null;
  tags: string[];
  scenarios: { name: string; tags: string[] }[];
  scenarioCount: number;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

const FEATURE_LINE = /^\s*Feature:\s*(.+)$/i;
const SCENARIO_LINE = /^\s*Scenario(?:\s*Outline)?:\s*(.+)$/i;
const TAG_LINE = /^\s*(@\S+(?:\s+@\S+)*)\s*$/;

function parseFeatureFile(absPath: string): Omit<FeatureFileInfo, 'id' | 'filePath' | 'relativePath' | 'sizeBytes' | 'createdAt' | 'updatedAt'> {
  const content = fs.readFileSync(absPath, 'utf-8');
  const lines = content.split(/\r?\n/);

  let name = path.basename(absPath, '.feature');
  const featureTags: string[] = [];
  const scenarios: { name: string; tags: string[] }[] = [];
  const descLines: string[] = [];
  let pendingTags: string[] = [];
  let inFeatureDesc = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const tagMatch = line.match(TAG_LINE);
    if (tagMatch) {
      pendingTags.push(...tagMatch[1].split(/\s+/));
      continue;
    }

    const featureMatch = line.match(FEATURE_LINE);
    if (featureMatch) {
      name = featureMatch[1].trim();
      featureTags.push(...pendingTags);
      pendingTags = [];
      inFeatureDesc = true;
      continue;
    }

    const scenarioMatch = line.match(SCENARIO_LINE);
    if (scenarioMatch) {
      scenarios.push({ name: scenarioMatch[1].trim(), tags: [...pendingTags] });
      pendingTags = [];
      inFeatureDesc = false;
      continue;
    }

    if (inFeatureDesc && !/^(Background|Scenario|Rule|Example|Given|When|Then|And|But)/i.test(line)) {
      descLines.push(line);
    } else {
      inFeatureDesc = false;
    }
  }

  return {
    name,
    description: descLines.length ? descLines.join(' ').slice(0, 280) : null,
    tags: featureTags,
    scenarios,
    scenarioCount: scenarios.length,
  };
}

function safeId(relativePath: string): string {
  return relativePath.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
}

export class FilesystemService {
  listFeatureFiles(): FeatureFileInfo[] {
    const dir = paths.featuresDir;
    if (!fs.existsSync(dir)) {
      return [];
    }

    const result: FeatureFileInfo[] = [];

    function walk(currentDir: string): void {
      for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        const full = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && entry.name.endsWith('.feature')) {
          const relativePath = path.relative(paths.projectRoot, full);
          const stats = fs.statSync(full);
          const parsed = parseFeatureFile(full);
          result.push({
            id: safeId(relativePath),
            filePath: full,
            relativePath,
            ...parsed,
            sizeBytes: stats.size,
            createdAt: stats.birthtime.toISOString(),
            updatedAt: stats.mtime.toISOString(),
          });
        }
      }
    }

    walk(dir);
    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  readFeatureContent(relativePath: string): string {
    const safe = path.normalize(relativePath);
    if (safe.startsWith('..') || path.isAbsolute(safe)) {
      throw new Error('Invalid path');
    }
    const full = path.join(paths.projectRoot, safe);
    if (!full.startsWith(paths.featuresDir)) {
      throw new Error('Path is outside features directory');
    }
    return fs.readFileSync(full, 'utf-8');
  }
}

export const filesystemService = new FilesystemService();
