import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { sentimentAnalysisService } from '../services/sentiment-analysis.js';
import { tenantAuthMiddleware } from '../services/auth-middleware.js';

const batchSentimentSchema = z.object({
  topics: z.array(z.string()).min(1),
});

const impactAnalysisSchema = z.object({
  event: z.string().min(1),
  context: z.string().optional(),
});

const sentimentRoutes = new Hono();

// Apply tenant auth to all routes - requires valid JWT + X-Tenant-Id + tenant membership
sentimentRoutes.use('/*', tenantAuthMiddleware());

sentimentRoutes.get('/:topic', async (c) => {
  return c.json(await sentimentAnalysisService.getSentimentSnapshot(decodeURIComponent(c.req.param('topic'))));
});

sentimentRoutes.post('/batch', zValidator('json', batchSentimentSchema), async (c) => {
  const { topics } = c.req.valid('json');
  const snapshots = await sentimentAnalysisService.getMultiTopicSentiment(topics);
  return c.json({ snapshots, count: snapshots.length });
});

sentimentRoutes.get('/:topic/history', async (c) => {
  const history = await sentimentAnalysisService.getSentimentHistory(decodeURIComponent(c.req.param('topic')), parseInt(c.req.query('days') ?? '30'));
  return c.json({ topic: c.req.param('topic'), history, count: history.length });
});

sentimentRoutes.post('/impact', zValidator('json', impactAnalysisSchema), async (c) => {
  const { event, context } = c.req.valid('json');
  return c.json(await sentimentAnalysisService.analyzeMarketImpact(event, context || ''));
});

export default sentimentRoutes;
