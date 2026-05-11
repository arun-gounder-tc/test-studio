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
    // Ignore if already nullable; warn on anything else
    if (!/is not a not-null constraint|does not exist/i.test(err.message)) {
      console.warn('[migration] chat_attachments.message_id alter:', err.message);
    }
  });

  console.log('✅ Database schema synced.');
}
