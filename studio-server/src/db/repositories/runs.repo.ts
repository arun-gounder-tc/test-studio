import { Run } from '../models/run.model.js';
import { RunArtifact } from '../models/run-artifact.model.js';

export interface CreateRunInput {
  projectId: string;
  testId?: string;
  testVersion?: number;
  headed: boolean;
}

export interface UpdateRunStatusInput {
  status: Run['status'];
  exitCode?: number;
  scenariosTotal?: number;
  scenariosPassed?: number;
  scenariosFailed?: number;
  durationMs?: number;
  finishedAt?: Date;
}

export interface CreateArtifactInput {
  runId: string;
  kind: RunArtifact['kind'];
  minioKey: string;
  contentType: string;
  sizeBytes: number;
  scenarioName?: string;
}

export const RunsRepo = {
  async create(input: CreateRunInput): Promise<Run> {
    return Run.create({
      projectId: input.projectId,
      testId: input.testId ?? null,
      testVersion: input.testVersion ?? null,
      headed: input.headed,
      status: 'running',
      startedAt: new Date(),
    });
  },

  async get(id: string): Promise<Run | null> {
    return Run.findByPk(id);
  },

  async updateStatus(id: string, input: UpdateRunStatusInput): Promise<void> {
    await Run.update(
      {
        status: input.status,
        ...(input.exitCode !== undefined && { exitCode: input.exitCode }),
        ...(input.scenariosTotal !== undefined && { scenariosTotal: input.scenariosTotal }),
        ...(input.scenariosPassed !== undefined && { scenariosPassed: input.scenariosPassed }),
        ...(input.scenariosFailed !== undefined && { scenariosFailed: input.scenariosFailed }),
        ...(input.durationMs !== undefined && { durationMs: input.durationMs }),
        ...(input.finishedAt !== undefined && { finishedAt: input.finishedAt }),
      },
      { where: { id } }
    );
  },

  async listByProject(projectId: string, limit = 50): Promise<Run[]> {
    return Run.findAll({
      where: { projectId },
      order: [['startedAt', 'DESC']],
      limit,
    });
  },

  async listByTest(testId: string, limit = 20): Promise<Run[]> {
    return Run.findAll({
      where: { testId },
      order: [['startedAt', 'DESC']],
      limit,
    });
  },

  async listAll(limit = 100): Promise<Run[]> {
    return Run.findAll({
      order: [['startedAt', 'DESC']],
      limit,
    });
  },

  async attachArtifact(input: CreateArtifactInput): Promise<RunArtifact> {
    return RunArtifact.create({
      runId: input.runId,
      kind: input.kind,
      minioKey: input.minioKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      scenarioName: input.scenarioName ?? null,
    });
  },

  async listArtifacts(runId: string): Promise<RunArtifact[]> {
    return RunArtifact.findAll({ where: { runId } });
  },
};
