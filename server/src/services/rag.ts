import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_PATH = path.resolve(__dirname, '../../venv/Scripts/python.exe');
const SCRIPT_PATH = path.resolve(__dirname, './rag.py');

export class RAGService {
    private async runPython(args: string[]): Promise<any> {
        return new Promise((resolve, reject) => {
            const process = spawn(PYTHON_PATH, [SCRIPT_PATH, ...args]);
            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python process exited with code ${code}. Error: ${stderr}`));
                    return;
                }
                try {
                    // Cognee might print registration messages, so we only parse the last line
                    const lines = stdout.trim().split('\n');
                    const lastLine = lines[lines.length - 1];
                    resolve(JSON.parse(lastLine));
                } catch (_e) {
                    reject(new Error(`Failed to parse Python output: ${stdout}`));
                }
            });
        });
    }

    async indexTransactions(transactions: unknown[]) {
        const data = (transactions as any[]).map(tx =>
            `Date: ${tx.date}, Description: ${tx.description}, Amount: ${tx.amount / 100}, Category: ${tx.category}, Notes: ${tx.aiReasoningNotes}`
        );
        return this.runPython(['add', JSON.stringify(data), 'bank_transactions']);
    }

    async addDocuments(documents: string[], datasetName: string = 'knowledge_base') {
        return this.runPython(['add', JSON.stringify(documents), datasetName]);
    }

    async search(query: string, model: string) {
        return this.runPython(['search', query, model]);
    }
}

export const ragService = new RAGService();
