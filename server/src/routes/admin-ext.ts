import { Hono } from 'hono';
import path from 'path';
import fs from 'fs';
import { ragService } from '../services/rag.js';

const adminExtRoutes = new Hono();

// POST /api/admin/ingest-knowledge — Ingest markdown docs into Cognee
adminExtRoutes.post('/admin/ingest-knowledge', async (c) => {
  try {
    const { datasetName } = await c.req.json();
    const targetDataset = datasetName || 'production_handbooks';

    const knowledgeDir = path.resolve(process.cwd(), 'knowledge');

    if (!fs.existsSync(knowledgeDir)) {
      return c.json({ error: 'Knowledge directory not found' }, 404);
    }

    const files = fs.readdirSync(knowledgeDir);
    const documents: string[] = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(knowledgeDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        documents.push(`Source: ${file}\nContent:\n${content}`);
      }
    }

    if (documents.length === 0) {
      return c.json({ message: 'No markdown files found to ingest' });
    }

    const result = await ragService.addDocuments(documents, targetDataset);
    return c.json(result);
  } catch (err) {
    console.error('Ingestion failed:', err);
    return c.json({ error: 'Ingestion failed' }, 500);
  }
});

export default adminExtRoutes;
