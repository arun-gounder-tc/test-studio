import { Project } from '../models/project.model.js';
import { ProjectConfig } from '../models/project-config.model.js';

export interface CreateProjectInput {
  slug: string;
  name: string;
  description?: string;
  baseUrl?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  baseUrl?: string;
}

export interface UpdateProjectConfigInput {
  routes?: object;
  selectors?: object;
  authAdapter?: object;
  defaultModel?: string;
}

export const ProjectsRepo = {
  async list(includeArchived = false): Promise<Project[]> {
    const where: Record<string, unknown> = {};
    if (!includeArchived) where['archivedAt'] = null;
    return Project.findAll({
      where,
      include: [{ model: ProjectConfig, as: 'config' }],
      order: [['createdAt', 'ASC']],
    });
  },

  async get(id: string): Promise<Project | null> {
    return Project.findByPk(id, {
      include: [{ model: ProjectConfig, as: 'config' }],
    });
  },

  async getBySlug(slug: string): Promise<Project | null> {
    return Project.findOne({
      where: { slug },
      include: [{ model: ProjectConfig, as: 'config' }],
    });
  },

  async create(input: CreateProjectInput): Promise<Project> {
    const project = await Project.create({
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      baseUrl: input.baseUrl ?? null,
    });
    // seed empty config row
    await ProjectConfig.create({ projectId: project.id });
    return this.get(project.id) as Promise<Project>;
  },

  async update(id: string, input: UpdateProjectInput): Promise<Project | null> {
    await Project.update(input, { where: { id } });
    return this.get(id);
  },

  async updateConfig(projectId: string, input: UpdateProjectConfigInput): Promise<ProjectConfig> {
    const [config, created] = await ProjectConfig.findOrCreate({
      where: { projectId },
      defaults: { projectId },
    });
    await config.update({
      ...(input.routes !== undefined && { routes: input.routes }),
      ...(input.selectors !== undefined && { selectors: input.selectors }),
      ...(input.authAdapter !== undefined && { authAdapter: input.authAdapter }),
      ...(input.defaultModel !== undefined && { defaultModel: input.defaultModel }),
      updatedAt: new Date(),
    });
    return config;
  },

  async archive(id: string): Promise<void> {
    await Project.update({ archivedAt: new Date() }, { where: { id } });
  },
};
