import { Op } from 'sequelize';
import { Test } from '../models/test.model.js';
import { TestVersion } from '../models/test-version.model.js';

export interface CreateTestInput {
  projectId: string;
  slug: string;
  name: string;
  description?: string;
  tags?: string[];
  source: 'manual' | 'ai-generated' | 'uploaded' | 'imported';
  featureContent: string;
  stepDefinitions?: object[];
  fixtures?: object[];
}

export interface UpdateTestContentInput {
  featureContent: string;
  stepDefinitions?: object[];
  fixtures?: object[];
  changeSummary?: string;
}

export const TestsRepo = {
  async listByProject(projectId: string, includeArchived = false): Promise<Test[]> {
    const where: Record<string, unknown> = { projectId };
    if (!includeArchived) where['status'] = { [Op.ne]: 'archived' };
    return Test.findAll({
      where,
      order: [['updatedAt', 'DESC']],
    });
  },

  async get(id: string): Promise<Test | null> {
    return Test.findByPk(id);
  },

  async getWithLatestVersion(id: string): Promise<{ test: Test; version: TestVersion } | null> {
    const test = await Test.findByPk(id);
    if (!test) return null;
    const version = await TestVersion.findOne({
      where: { testId: id, version: test.currentVersion },
    });
    if (!version) return null;
    return { test, version };
  },

  async getBySlug(projectId: string, slug: string): Promise<Test | null> {
    return Test.findOne({ where: { projectId, slug } });
  },

  /** Creates a test + its first version atomically */
  async create(input: CreateTestInput): Promise<Test> {
    const test = await Test.create({
      projectId: input.projectId,
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      tags: input.tags ?? [],
      source: input.source,
      status: 'saved',
      currentVersion: 1,
    });
    await TestVersion.create({
      testId: test.id,
      version: 1,
      featureContent: input.featureContent,
      stepDefinitions: input.stepDefinitions ?? [],
      fixtures: input.fixtures ?? [],
    });
    return test;
  },

  /** Creates a new test version and bumps currentVersion */
  async updateContent(id: string, input: UpdateTestContentInput): Promise<TestVersion> {
    const test = await Test.findByPk(id);
    if (!test) throw new Error(`Test ${id} not found`);
    const nextVersion = test.currentVersion + 1;
    const version = await TestVersion.create({
      testId: id,
      version: nextVersion,
      featureContent: input.featureContent,
      stepDefinitions: input.stepDefinitions ?? [],
      fixtures: input.fixtures ?? [],
      changeSummary: input.changeSummary ?? null,
    });
    await test.update({ currentVersion: nextVersion });
    return version;
  },

  async archive(id: string): Promise<void> {
    await Test.update({ status: 'archived' }, { where: { id } });
  },

  async listVersions(testId: string): Promise<TestVersion[]> {
    return TestVersion.findAll({
      where: { testId },
      order: [['version', 'DESC']],
    });
  },
};
