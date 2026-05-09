import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../utils/paths.js';
import type { NewStepDef, FixtureFile } from './ai.service.js';

export interface SaveRequest {
  featureName: string;
  featureContent: string;
  newStepDefinitions?: NewStepDef[];
  fixturesNeeded?: FixtureFile[];
  conversationId?: string;
  /** Absolute path to overwrite. When set, slug + unique-path logic is skipped. Used by refine flow. */
  overwriteFilePath?: string;
}

export interface SaveResult {
  filesWritten: string[];
  featurePath: string;
  testId: string;
  updatedExisting: boolean;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'test';
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function uniquePath(targetPath: string): string {
  if (!fs.existsSync(targetPath)) return targetPath;
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  let i = 2;
  while (true) {
    const candidate = path.join(dir, `${base}-${i}${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
    i += 1;
  }
}

function assertSafeRelative(relPath: string, allowedRoot: string): string {
  const normalized = path.normalize(relPath).replace(/^[/\\]+/, '');
  if (normalized.includes('..')) {
    throw new Error(`Unsafe path: ${relPath}`);
  }
  const full = path.join(allowedRoot, normalized);
  if (!full.startsWith(path.resolve(allowedRoot) + path.sep) && full !== path.resolve(allowedRoot)) {
    throw new Error(`Path escapes allowed root: ${relPath}`);
  }
  return full;
}

export class TestWriterService {
  save(request: SaveRequest): SaveResult {
    if (!request.featureContent?.trim()) {
      throw new Error('featureContent is empty');
    }

    ensureDir(paths.featuresDir);

    let featurePath: string;
    let updatedExisting = false;
    if (request.overwriteFilePath) {
      const resolved = path.resolve(request.overwriteFilePath);
      const featuresRoot = path.resolve(paths.featuresDir);
      if (!resolved.startsWith(featuresRoot + path.sep) && resolved !== featuresRoot) {
        throw new Error(`overwriteFilePath escapes features directory: ${request.overwriteFilePath}`);
      }
      if (!fs.existsSync(resolved)) {
        throw new Error(`overwriteFilePath does not exist: ${request.overwriteFilePath}`);
      }
      featurePath = resolved;
      updatedExisting = true;
    } else {
      const slug = slugify(request.featureName || 'test');
      const desiredPath = path.join(paths.featuresDir, `${slug}.feature`);
      featurePath = uniquePath(desiredPath);
    }
    const filesWritten: string[] = [];

    fs.writeFileSync(featurePath, request.featureContent, 'utf-8');
    filesWritten.push(featurePath);

    if (request.newStepDefinitions?.length) {
      ensureDir(paths.stepDefinitionsDir);
      const grouped = new Map<string, NewStepDef[]>();
      for (const def of request.newStepDefinitions) {
        const safeFile = def.file && /^[\w./-]+\.(ts|js)$/.test(def.file)
          ? def.file
          : 'ai-generated.steps.ts';
        const list = grouped.get(safeFile) ?? [];
        list.push(def);
        grouped.set(safeFile, list);
      }
      for (const [file, defs] of grouped.entries()) {
        const target = assertSafeRelative(file, paths.stepDefinitionsDir);
        const append = this.formatStepDefBlock(defs, fs.existsSync(target));
        if (fs.existsSync(target)) {
          fs.appendFileSync(target, '\n\n' + append, 'utf-8');
        } else {
          fs.writeFileSync(target, this.formatStepDefImports() + append, 'utf-8');
        }
        filesWritten.push(target);
      }
    }

    if (request.fixturesNeeded?.length) {
      for (const fx of request.fixturesNeeded) {
        const target = assertSafeRelative(fx.path, paths.fixturesDir);
        ensureDir(path.dirname(target));
        fs.writeFileSync(target, fx.content, 'utf-8');
        filesWritten.push(target);
      }
    }

    const testId = path
      .relative(paths.projectRoot, featurePath)
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return { filesWritten, featurePath, testId, updatedExisting };
  }

  private formatStepDefImports(): string {
    return `import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';\n`;
  }

  private formatStepDefBlock(defs: NewStepDef[], _isAppend: boolean): string {
    return defs
      .map((d) => {
        const keyword = this.guessKeyword(d.pattern);
        const body = d.implementation.trim();
        const isWrapped = /^\s*\(/.test(body) || /=>\s*\{/.test(body);
        const handler = isWrapped ? body : `() => {\n  ${body.replace(/\n/g, '\n  ')}\n}`;
        return `${keyword}('${d.pattern.replace(/'/g, "\\'")}', ${handler});`;
      })
      .join('\n\n');
  }

  private guessKeyword(pattern: string): 'Given' | 'When' | 'Then' {
    const lower = pattern.toLowerCase();
    if (/^(i am|i have|the|there is|there are)/.test(lower)) return 'Given';
    if (/^(i should|i should not|the .+ should|there should)/.test(lower)) return 'Then';
    return 'When';
  }
}

export const testWriter = new TestWriterService();
