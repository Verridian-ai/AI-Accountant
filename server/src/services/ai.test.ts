import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to define mock functions that are used in vi.mock
const { mockCreate, mockModerations } = vi.hoisted(() => ({
    mockCreate: vi.fn(),
    mockModerations: vi.fn().mockResolvedValue({ results: [{ flagged: false }] })
}));

// Mock OpenAI module
vi.mock('openai', () => {
    return {
        default: class MockOpenAI {
            chat = {
                completions: {
                    create: mockCreate
                }
            };
            moderations = {
                create: mockModerations
            };
        }
    };
});

import { AIService } from './ai';

describe('AIService', () => {
    let aiService: AIService;

    beforeEach(() => {
        vi.clearAllMocks();
        aiService = new AIService();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('categorizeTransaction', () => {
        it('should return categorized data from AI response', async () => {
            const mockResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            category: 'Food',
                            gst: true,
                            notes: 'Looks like a restaurant'
                        })
                    }
                }]
            };
            mockCreate.mockResolvedValue(mockResponse);

            const result = await aiService.categorizeTransaction('Woolworths', -5000);

            expect(result).toEqual({
                category: 'Food',
                gst: true,
                notes: 'Looks like a restaurant'
            });
            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
                model: 'google/gemini-3-flash-preview',
                response_format: { type: "json_object" }
            }));
        });

        it('should return default values on AI error', async () => {
            mockCreate.mockRejectedValue(new Error('AI Error'));

            const result = await aiService.categorizeTransaction('Error Case', -100);

            expect(result.category).toBe('Uncategorized');
            expect(result.gst).toBe(false);
        });
    });

    describe('parseStatementText', () => {
        it('should extract transactions from text', async () => {
            const mockTransactions = [
                { date: '2024-01-01', description: 'Test 1', amount_cents: -1000 },
                { date: '2024-01-02', description: 'Test 2', amount_cents: 2000 }
            ];
            const mockResponse = {
                choices: [{
                    message: {
                        content: JSON.stringify({ transactions: mockTransactions })
                    }
                }]
            };
            mockCreate.mockResolvedValue(mockResponse);

            const result = await aiService.parseStatementText('Some raw text');

            expect(result.transactions).toHaveLength(2);
            expect(result.transactions[0].description).toBe('Test 1');
        });
    });
});
