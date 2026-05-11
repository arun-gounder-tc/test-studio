import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';
import { Project } from './models/project.model.js';
import { ProjectConfig } from './models/project-config.model.js';
import { Test } from './models/test.model.js';
import { TestVersion } from './models/test-version.model.js';
import { Run } from './models/run.model.js';
import { RunLog } from './models/run-log.model.js';
import { RunArtifact } from './models/run-artifact.model.js';
import { Conversation } from './models/conversation.model.js';
import { Message } from './models/message.model.js';
import { ChatAttachment } from './models/chat-attachment.model.js';
import { User } from './models/user.model.js';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://studio:studio@localhost:5432/studio';

export const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  models: [
    Project,
    ProjectConfig,
    Test,
    TestVersion,
    Run,
    RunLog,
    RunArtifact,
    Conversation,
    Message,
    ChatAttachment,
    User,
  ],
  logging: process.env.NODE_ENV === 'development' ? (sql) => console.debug('[SQL]', sql) : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export async function initDB(): Promise<void> {
  await sequelize.authenticate();
  console.log('✅ Postgres connection established.');
  // alter: { drop: false } adds missing columns/tables but never tries to drop
  // constraints — avoids SequelizeUnknownConstraintError on schema drift
  await sequelize.sync({ alter: { drop: false } });

  // One-off constraint adjustments (idempotent) — sync() can't drop NOT NULL.
  // Phase C: chat_attachments.message_id must be nullable so attachments can be
  // uploaded before the user message is created (then linked on send-message).
  await sequelize.query(
    `ALTER TABLE chat_attachments ALTER COLUMN message_id DROP NOT NULL;`
  ).catch((err: Error) => {
    if (!/is not a not-null constraint|does not exist/i.test(err.message)) {
      console.warn('[migration] chat_attachments.message_id alter:', err.message);
    }
  });

  // Phase D: indexes for hot queries (history list, log replay).
  // Sequelize sync() doesn't always create non-unique compound indexes reliably,
  // so we ensure them explicitly. IF NOT EXISTS makes this idempotent.
  const indexStatements = [
    `CREATE INDEX IF NOT EXISTS idx_runs_project_started ON runs (project_id, started_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_runs_test_started ON runs (test_id, started_at DESC) WHERE test_id IS NOT NULL;`,
    `CREATE INDEX IF NOT EXISTS idx_run_logs_run_sequence ON run_logs (run_id, sequence);`,
    `CREATE INDEX IF NOT EXISTS idx_run_artifacts_run_kind ON run_artifacts (run_id, kind);`,
    `CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages (conversation_id, created_at);`,
    `CREATE INDEX IF NOT EXISTS idx_chat_attachments_conversation ON chat_attachments (conversation_id);`,
  ];
  for (const stmt of indexStatements) {
    try {
      await sequelize.query(stmt);
    } catch (err) {
      console.warn('[migration] index create:', (err as Error).message);
    }
  }

  console.log('✅ Database schema synced.');
}
