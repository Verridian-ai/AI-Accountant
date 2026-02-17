/**
 * Vertex AI Integration for AI Accountant
 *
 * Supports Google Gemini models, Anthropic Claude (via Model Garden),
 * and other third-party models available on Vertex AI.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface VertexModel {
  id: string;
  name: string;
  provider: 'google' | 'anthropic' | 'meta' | 'mistral' | 'deepseek';
  category: 'reasoning' | 'fast' | 'vision' | 'code' | 'embedding';
  contextWindow: number;
  maxOutput: number;
  status: 'ga' | 'preview' | 'deprecated';
  pricing: { input: number; output: number }; // per 1M tokens
  features: string[];
}

export interface VertexAIConfig {
  projectId: string;
  region: string;
  apiKey?: string;
  models: VertexModel[];
}

export interface VertexAIRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

export interface VertexAIResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

// ============================================================================
// AVAILABLE MODELS (January 2026)
// ============================================================================

export const VERTEX_AI_MODELS: VertexModel[] = [
  // ---- GEMINI 3 (Preview) ----
  {
    id: 'gemini-3.0-pro',
    name: 'Gemini 3 Pro',
    provider: 'google',
    category: 'reasoning',
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    status: 'preview',
    pricing: { input: 1.25, output: 5.0 },
    features: ['adaptive-thinking', 'grounding', 'multimodal', 'code', 'agentic'],
  },
  {
    id: 'gemini-3.0-flash',
    name: 'Gemini 3 Flash',
    provider: 'google',
    category: 'fast',
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    status: 'preview',
    pricing: { input: 0.15, output: 0.6 },
    features: ['multimodal', 'reasoning', 'code', 'agentic'],
  },

  // ---- GEMINI 2.5 (GA / Production) ----
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    category: 'reasoning',
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    status: 'ga',
    pricing: { input: 1.25, output: 5.0 },
    features: ['adaptive-thinking', 'code', 'multimodal', 'grounding'],
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    category: 'fast',
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    status: 'ga',
    pricing: { input: 0.15, output: 0.6 },
    features: ['thinking-budgets', 'multimodal', 'code'],
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'google',
    category: 'fast',
    contextWindow: 1_000_000,
    maxOutput: 65_536,
    status: 'ga',
    pricing: { input: 0.04, output: 0.15 },
    features: ['high-throughput', 'cost-effective'],
  },

  // ---- GEMINI 2.0 (Legacy - deprecated March 2026) ----
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    category: 'fast',
    contextWindow: 1_000_000,
    maxOutput: 8_192,
    status: 'deprecated',
    pricing: { input: 0.1, output: 0.4 },
    features: ['multimodal', 'general-purpose'],
  },

  // ---- ANTHROPIC CLAUDE (via Model Garden) ----
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    category: 'reasoning',
    contextWindow: 200_000,
    maxOutput: 32_000,
    status: 'ga',
    pricing: { input: 15.0, output: 75.0 },
    features: ['deep-reasoning', 'code', 'analysis', 'long-context'],
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    category: 'reasoning',
    contextWindow: 200_000,
    maxOutput: 16_000,
    status: 'ga',
    pricing: { input: 3.0, output: 15.0 },
    features: ['balanced', 'code', 'analysis'],
  },
  {
    id: 'claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    category: 'fast',
    contextWindow: 200_000,
    maxOutput: 8_192,
    status: 'ga',
    pricing: { input: 0.8, output: 4.0 },
    features: ['fast', 'cost-effective', 'code'],
  },

  // ---- THIRD-PARTY (Model Garden) ----
  {
    id: 'deepseek-v3.2',
    name: 'DeepSeek V3.2',
    provider: 'deepseek',
    category: 'reasoning',
    contextWindow: 128_000,
    maxOutput: 8_192,
    status: 'ga',
    pricing: { input: 0.27, output: 1.1 },
    features: ['reasoning', 'code', 'math'],
  },
  {
    id: 'mistral-codestral-2',
    name: 'Mistral Codestral 2',
    provider: 'mistral',
    category: 'code',
    contextWindow: 256_000,
    maxOutput: 16_384,
    status: 'ga',
    pricing: { input: 0.3, output: 0.9 },
    features: ['code-generation', 'fill-in-middle', '80+ languages'],
  },
];

// ============================================================================
// RECOMMENDED MODEL CONFIGURATIONS FOR FINTECH
// ============================================================================

export const FINTECH_MODEL_PRESETS = {
  // Best models for each task type
  reasoning: 'gemini-2.5-pro', // Complex financial analysis
  fast: 'gemini-2.5-flash', // Quick categorization
  vision: 'gemini-3.0-flash', // PDF/receipt OCR
  code: 'gemini-2.5-pro', // Code generation for agents
  categorization: 'gemini-2.5-flash-lite', // Bulk transaction categorization
  tax: 'gemini-2.5-pro', // Tax calculations (accuracy critical)
  chat: 'gemini-2.5-flash', // User chat interactions
  embedding: 'text-embedding-005', // Embeddings for RAG
} as const;

// ============================================================================
// VERTEX AI CLIENT
// ============================================================================

export class VertexAIClient {
  private projectId: string;
  private region: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: { projectId: string; region: string }) {
    this.projectId = config.projectId;
    this.region = config.region;
  }

  /**
   * Get access token via metadata server (Cloud Run) or gcloud
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      // Try metadata server first (works on Cloud Run)
      const metadataUrl =
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
      const response = await fetch(metadataUrl, {
        headers: { 'Metadata-Flavor': 'Google' },
      });
      if (response.ok) {
        const data = (await response.json()) as { access_token: string; expires_in: number };
        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
        return this.accessToken;
      }
    } catch {
      // Not running on GCP - fall back to API key or gcloud
    }

    // Fall back to API key
    const apiKey = process.env.VERTEX_AI_API_KEY;
    if (apiKey) {
      this.accessToken = apiKey;
      this.tokenExpiry = Date.now() + 3600 * 1000;
      return apiKey;
    }

    throw new Error('No Vertex AI authentication available');
  }

  /**
   * Get the API endpoint URL for a model
   */
  private getEndpoint(modelId: string): string {
    const model = VERTEX_AI_MODELS.find((m) => m.id === modelId);
    if (!model) throw new Error(`Unknown model: ${modelId}`);

    if (model.provider === 'google') {
      return `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.region}/publishers/google/models/${modelId}:generateContent`;
    }

    if (model.provider === 'anthropic') {
      return `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.region}/publishers/anthropic/models/${modelId}:rawPredict`;
    }

    // Model Garden
    return `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.region}/publishers/${model.provider}/models/${modelId}:predict`;
  }

  /**
   * Generate content using a Vertex AI model
   */
  async generate(request: VertexAIRequest): Promise<VertexAIResponse> {
    const token = await this.getAccessToken();
    const model = VERTEX_AI_MODELS.find((m) => m.id === request.model);

    if (!model) {
      throw new Error(`Model ${request.model} not found in registry`);
    }

    const endpoint = this.getEndpoint(request.model);

    // Build request body based on provider
    let body: unknown;
    if (model.provider === 'google') {
      body = this.buildGeminiRequest(request);
    } else if (model.provider === 'anthropic') {
      body = this.buildClaudeRequest(request);
    } else {
      body = this.buildGenericRequest(request);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vertex AI error (${response.status}): ${error}`);
    }

    const data = await response.json();

    if (model.provider === 'google') {
      return this.parseGeminiResponse(data, request.model);
    } else if (model.provider === 'anthropic') {
      return this.parseClaudeResponse(data, request.model);
    }

    return this.parseGenericResponse(data, request.model);
  }

  /**
   * List all available models
   */
  getAvailableModels(filter?: {
    provider?: string;
    category?: string;
    status?: string;
  }): VertexModel[] {
    let models = [...VERTEX_AI_MODELS];

    if (filter?.provider) {
      models = models.filter((m) => m.provider === filter.provider);
    }
    if (filter?.category) {
      models = models.filter((m) => m.category === filter.category);
    }
    if (filter?.status) {
      models = models.filter((m) => m.status === filter.status);
    }

    return models;
  }

  /**
   * Get recommended model for a task type
   */
  getRecommendedModel(task: keyof typeof FINTECH_MODEL_PRESETS): VertexModel | undefined {
    const modelId = FINTECH_MODEL_PRESETS[task];
    return VERTEX_AI_MODELS.find((m) => m.id === modelId);
  }

  /**
   * Test connectivity to Vertex AI
   */
  async testConnection(): Promise<{
    success: boolean;
    models: number;
    project: string;
    region: string;
    error?: string;
  }> {
    try {
      const _token = await this.getAccessToken();
      // Test with a simple Gemini request
      const _response = await this.generate({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Reply with "OK" only.' }],
        maxTokens: 10,
        temperature: 0,
      });

      return {
        success: true,
        models: VERTEX_AI_MODELS.length,
        project: this.projectId,
        region: this.region,
      };
    } catch (error) {
      return {
        success: false,
        models: VERTEX_AI_MODELS.length,
        project: this.projectId,
        region: this.region,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ========================================================================
  // PROVIDER-SPECIFIC REQUEST/RESPONSE BUILDERS
  // ========================================================================

  private buildGeminiRequest(request: VertexAIRequest) {
    const contents = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = request.messages.find((m) => m.role === 'system');

    return {
      contents,
      ...(systemInstruction && {
        systemInstruction: { parts: [{ text: systemInstruction.content }] },
      }),
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 8192,
        topP: request.topP ?? 0.95,
      },
    };
  }

  private buildClaudeRequest(request: VertexAIRequest) {
    const systemMessage = request.messages.find((m) => m.role === 'system');
    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    return {
      anthropic_version: 'vertex-2024-10-22',
      max_tokens: request.maxTokens ?? 8192,
      temperature: request.temperature ?? 0.7,
      top_p: request.topP ?? 0.95,
      ...(systemMessage && { system: systemMessage.content }),
      messages,
    };
  }

  private buildGenericRequest(request: VertexAIRequest) {
    return {
      instances: [
        {
          messages: request.messages.map((m) => ({
            author: m.role,
            content: m.content,
          })),
        },
      ],
      parameters: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 8192,
        topP: request.topP ?? 0.95,
      },
    };
  }

  private parseGeminiResponse(data: unknown, model: string): VertexAIResponse {
    const d = data as {
      candidates?: { content?: { parts?: { text: string }[] }; finishReason?: string }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };
    const candidate = d.candidates?.[0];
    const content = candidate?.content?.parts?.map((p) => p.text).join('') ?? '';

    return {
      content,
      model,
      usage: {
        promptTokens: d.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: d.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: d.usageMetadata?.totalTokenCount ?? 0,
      },
      finishReason: candidate?.finishReason ?? 'unknown',
    };
  }

  private parseClaudeResponse(data: unknown, model: string): VertexAIResponse {
    const d = data as {
      content?: { text: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
      stop_reason?: string;
    };
    const content = d.content?.map((c) => c.text).join('') ?? '';

    return {
      content,
      model,
      usage: {
        promptTokens: d.usage?.input_tokens ?? 0,
        completionTokens: d.usage?.output_tokens ?? 0,
        totalTokens: (d.usage?.input_tokens ?? 0) + (d.usage?.output_tokens ?? 0),
      },
      finishReason: d.stop_reason ?? 'unknown',
    };
  }

  private parseGenericResponse(data: unknown, model: string): VertexAIResponse {
    const d = data as { predictions?: { content?: string }[] };
    const prediction = d.predictions?.[0];
    const content =
      typeof prediction === 'string'
        ? prediction
        : (prediction?.content ?? JSON.stringify(prediction));

    return {
      content,
      model,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: 'stop',
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let _client: VertexAIClient | null = null;

export function getVertexAIClient(): VertexAIClient {
  if (!_client) {
    _client = new VertexAIClient({
      projectId: process.env.GCP_PROJECT_ID || 'accountant-485713',
      region: process.env.GCP_REGION || 'australia-southeast1',
    });
  }
  return _client;
}

export default VertexAIClient;
