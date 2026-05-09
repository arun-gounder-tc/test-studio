import { Op } from 'sequelize';
import { RunLog } from '../models/run-log.model.js';

export const RunLogsRepo = {
  /** Batch-insert log lines for a run. Call every ~50 lines or 500ms. */
  async batchInsert(runId: string, lines: Array<{ stream: RunLog['stream']; line: string }>, startSequence: number): Promise<void> {
    if (lines.length === 0) return;
    const rows = lines.map((l, i) => ({
      runId,
      sequence: startSequence + i,
      stream: l.stream,
      line: l.line,
    }));
    await RunLog.bulkCreate(rows);
  },

  /** Paginated read for log replay */
  async listByRun(runId: string, afterSequence = -1, limit = 500): Promise<RunLog[]> {
    return RunLog.findAll({
      where: { runId, sequence: { [Op.gt]: afterSequence } },
      order: [['sequence', 'ASC']],
      limit,
    });
  },
};
