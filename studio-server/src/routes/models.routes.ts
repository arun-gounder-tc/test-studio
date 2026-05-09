import { Router } from 'express';
import { aiService } from '../services/ai.service.js';

export const modelsRouter = Router();

modelsRouter.get('/', (_req, res) => {
  res.json({
    defaultModel: aiService.getDefaultModel(),
    models: aiService.listModels(),
  });
});
