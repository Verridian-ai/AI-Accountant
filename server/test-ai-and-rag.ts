import { aiService } from './src/services/ai.js';
import { ragService } from './src/services/rag.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../env.local' });

async function testOpenRouter() {
    console.log('--- Testing OpenRouter Model Call ---');
    try {
        const query = "Say 'OpenRouter is working' if you can read this.";
        const context = [];
        const model = 'google/gemini-3-flash-preview';
        
        console.log(`Calling model: ${model}`);
        const answer = await aiService.generateInsight(query, context, model);
        console.log(`Response: ${answer}`);
        return true;
    } catch (error) {
        console.error('OpenRouter test failed:', error);
        return false;
    }
}

async function testCognee() {
    console.log('\n--- Testing Cognee RAG Setup ---');
    try {
        const testTransactions = [
            {
                date: '2024-01-01',
                description: 'TEST COGNEE COFFEE',
                amount: -550,
                category: 'Meals',
                aiReasoningNotes: 'Test transaction for RAG verification'
            }
        ];

        console.log('1. Indexing test transaction...');
        const indexResult = await ragService.indexTransactions(testTransactions);
        console.log('Index Result:', JSON.stringify(indexResult));

        console.log('2. Searching for the transaction...');
        const searchResult = await ragService.search('Where did I buy coffee?', 'google/gemini-3-flash-preview');
        console.log('Search Result:', JSON.stringify(searchResult));
        
        return true;
    } catch (error) {
        console.error('Cognee test failed:', error);
        return false;
    }
}

async function runTests() {
    const aiOk = await testOpenRouter();
    const ragOk = await testCognee();
    
    console.log('\n--- Test Summary ---');
    console.log(`OpenRouter: ${aiOk ? 'PASS' : 'FAIL'}`);
    console.log(`Cognee RAG: ${ragOk ? 'PASS' : 'FAIL'}`);
}

runTests();
