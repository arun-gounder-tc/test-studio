import { Router } from 'express';
import { conversationStore } from '../services/conversation.store.js';
import { aiService } from '../services/ai.service.js';
import { gherkinValidator } from '../services/gherkin-validator.service.js';

export const conversationsRouter = Router();

conversationsRouter.post('/', (_req, res) => {
  const conv = conversationStore.create();
  res.json({
    id: conv.id,
    startedAt: conv.startedAt,
    aiConfigured: aiService.isConfigured(),
    messages: [],
  });
});

conversationsRouter.get('/:id', (req, res) => {
  const conv = conversationStore.get(req.params.id);
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  res.json(conv);
});

conversationsRouter.post('/:id/messages', async (req, res) => {
  const conv = conversationStore.get(req.params.id);
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  const userText = String(req.body?.content ?? '').trim();
  if (!userText) {
    res.status(400).json({ error: 'Message content is required' });
    return;
  }
  const modelOverride =
    typeof req.body?.model === 'string' && req.body.model.trim().length > 0
      ? req.body.model.trim()
      : undefined;

  const userMessage = conversationStore.appendUser(conv.id, userText);

  if (!aiService.isConfigured()) {
    const stub =
      'AI offline — neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is set in studio-server/.env. Add at least one key and restart the server to enable test generation.';
    const assistantMessage = conversationStore.appendAssistant(conv.id, stub);
    res.json({
      userMessage,
      assistantMessage,
      generation: null,
      validation: null,
    });
    return;
  }

  try {
    const history = conversationStore
      .toChatTurns(conv.id)
      .filter((t) => t.content !== userText);
    const generation = await aiService.generate(history, userText, modelOverride);
    const validation = generation.featureContent
      ? gherkinValidator.validate(generation.featureContent)
      : null;
    const assistantMessage = conversationStore.appendAssistant(
      conv.id,
      generation.explanation,
      generation
    );
    res.json({ userMessage, assistantMessage, generation, validation });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI request failed';
    const assistantMessage = conversationStore.appendAssistant(
      conv.id,
      `⚠ AI error: ${message}`
    );
    res.status(502).json({ userMessage, assistantMessage, error: message });
  }
});
