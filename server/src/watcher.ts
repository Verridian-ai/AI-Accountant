import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db, statements } from './db.js';
import { eq } from 'drizzle-orm';

// Watch the "statements" folder in the root
const WATCH_DIR = path.resolve(process.cwd(), '../statements');

console.log(`Starting file watcher on: ${WATCH_DIR}`);

const watcher = chokidar.watch(WATCH_DIR, {
    persistent: true,
    ignoreInitial: false, // Parse existing files on startup
    depth: 0,
    awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
    }
});

watcher.on('add', async (filePath) => {
    const filename = path.basename(filePath);

    // Skip non-statement files (simple check)
    if (!filename.toLowerCase().endsWith('.pdf') && !filename.toLowerCase().endsWith('.csv') && !filename.toLowerCase().endsWith('.png')) {
        return;
    }

    console.log(`File detected: ${filename}`);

    try {
        const fileBuffer = fs.readFileSync(filePath);
        const hashSpec = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Check if duplicate
        const existing = await db.select().from(statements).where(eq(statements.hash, hashSpec)).get();

        if (existing) {
            console.log(`Skipping duplicate file: ${filename} (ID: ${existing.id})`);
            return;
        }

        // New file! Register it.
        const newStatementId = crypto.randomUUID();
        console.log(`Registering new statement: ${filename} (ID: ${newStatementId})`);

        await db.insert(statements).values({
            id: newStatementId,
            filename: filename,
            hash: hashSpec,
            uploadDate: new Date().toISOString(),
            parsingStatus: 'PENDING',
        });

        // Trigger Parsing Pipeline
        console.log(`Parsing triggered for ${newStatementId}...`);
        import('./services/pipeline.js').then(({ pipeline }) => {
            pipeline.processStatement(newStatementId, filePath);
        });

    } catch (err) {
        console.error(`Error processing file ${filename}:`, err);
    }
});
