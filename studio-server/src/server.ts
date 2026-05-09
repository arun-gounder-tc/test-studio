import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { libraryRouter } from './routes/library.routes.js';
import { conversationsRouter } from './routes/conversations.routes.js';
import { testsRouter } from './routes/tests.routes.js';
import { runsRouter } from './routes/runs.routes.js';
import { modelsRouter } from './routes/models.routes.js';
import { aiService } from './services/ai.service.js';

const PORT = Number(process.env.PORT) || 3001;
const STUDIO_UI_ORIGIN = process.env.STUDIO_UI_ORIGIN || 'http://localhost:4300';

const app = express();

app.use(cors({ origin: STUDIO_UI_ORIGIN, credentials: true }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/test-studio/health', (_req, res) => {
  res.json({
    ok: true,
    version: '0.1.0',
    aiConfigured: aiService.isConfigured(),
    defaultModel: aiService.getDefaultModel(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/test-studio/library', libraryRouter);
app.use('/api/test-studio/conversations', conversationsRouter);
app.use('/api/test-studio/tests', testsRouter);
app.use('/api/test-studio/runs', runsRouter);
app.use('/api/test-studio/models', modelsRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`✅ studio-server listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`   CORS allowed origin: ${STUDIO_UI_ORIGIN}`);
});
