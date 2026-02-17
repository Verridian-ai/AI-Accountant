/**
 * Vertex AI Client
 *
 * Supports Google Gemini models, Anthropic Claude (via Model Garden),
 * and other third-party models available on Vertex AI.
 */

import { config } from '../../lib/config.js';
import type { VertexModel, VertexAIRequest, VertexAIResponse } from './types.js';
import { VERTEX_AI_MODELS, FINTECH_MODEL_PRESETS } from './models.js';
import {
  parseGeminiResponse,
  parseClaudeResponse,
  parseGenericResponse,
} from './response-parsers.js';

export class VertexAIClient {
  private projectId: string;
  private region: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(clientConfig: { projectId: string; region: string }) {
    this.projectId = clientConfig.projectId;
    this.region = clientConfig.region;
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
    const apiKey = config.vertexAiApiKey;
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
      return parseGeminiResponse(data, request.model);
    } else if (model.provider === 'anthropic') {
      return parseClaudeResponse(data, request.model);
    }

    return parseGenericResponse(data, request.model);
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
}

// Singleton
let _client: VertexAIClient | null = null;

export function getVertexAIClient(): VertexAIClient {
  if (!_client) {
    _client = new VertexAIClient({
      projectId: config.gcpProjectId,
      region: config.gcpRegion,
    });
  }
  return _client;
}

export default VertexAIClient;
