import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import cors, { type CorsOptions } from 'cors';
import { libraryRouter } from './routes/library.routes.js';
import { conversationsRouter } from './routes/conversations.routes.js';
import { testsRouter } from './routes/tests.routes.js';
import { runsRouter } from './routes/runs.routes.js';
import { modelsRouter } from './routes/models.routes.js';
import { projectsRouter } from './routes/projects.routes.js';
import { storageRouter } from './routes/storage.routes.js';
import { aiService } from './services/ai.service.js';
import { initDB } from './db/sequelize.js';
import { storage, storageDriver } from './services/storage/index.js';

const PORT = Number(process.env.PORT) || 3001;
const STUDIO_UI_ORIGIN = process.env.STUDIO_UI_ORIGIN || 'http://localhost:4300';
const ALLOWED_ORIGINS = new Set([STUDIO_UI_ORIGIN, 'http://localhost:4200', 'http://localhost:4300']);

const app = express();

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman) or any allowed origin
    if (!origin || ALLOWED_ORIGINS.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
};

// Must be registered BEFORE routes so preflight OPTIONS requests are handled
app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));

app.get('/api/test-studio/health', (_req, res) => {
  res.json({
    ok: true,
    version: '0.2.0',
    aiConfigured: aiService.isConfigured(),
    defaultModel: aiService.getDefaultModel(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/test-studio/projects', projectsRouter);
app.use('/api/test-studio/library', libraryRouter);
app.use('/api/test-studio/conversations', conversationsRouter);
app.use('/api/test-studio/tests', testsRouter);
app.use('/api/test-studio/runs', runsRouter);
app.use('/api/test-studio/models', modelsRouter);
app.use('/api/test-studio/storage', storageRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

async function bootstrap() {
  try {
    await initDB();
  } catch (err) {
    console.error('❌ Database init failed:', err);
    console.warn('⚠️  Continuing without DB — in-memory fallback active.');
  }

  try {
    await storage.ensureBucket();
    const bucket = process.env.MINIO_BUCKET || 'test-studio';
    console.log(`✅ Storage ready (driver=${storageDriver}, bucket=${bucket})`);
  } catch (err) {
    console.warn(`⚠️  Storage init failed (driver=${storageDriver}):`, err instanceof Error ? err.message : err);
    console.warn('   Run artifacts will not upload until storage is reachable.');
  }

  app.listen(PORT, () => {
    console.log(`✅ studio-server listening on http://localhost:${PORT}`);
    console.log(`   CORS allowed origin: ${STUDIO_UI_ORIGIN}`);
  });
}

bootstrap();
