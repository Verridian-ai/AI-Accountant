export interface ModelInfo {
  id: string;
  name: string;
  context: string;
  description: string;
  capabilities: string[];
}

export const OPENROUTER_MODELS: ModelInfo[] = [
  // January 2026
  {
    id: 'allenai/olmo-3.1-32b-instruct',
    name: 'AllenAI: Olmo 3.1 32B Instruct',
    context: '65K',
    description: '32B instruction-tuned model for conversational AI',
    capabilities: ['chat'],
  },
  {
    id: 'allenai/olmo-3.1-32b-think',
    name: 'AllenAI: Olmo 3.1 32B Think',
    context: '65K',
    description: '32B model for deep reasoning and multi-step logic',
    capabilities: ['chat', 'reasoning'],
  },

  // December 2025
  {
    id: 'bytedance-seed/seed-1.6-flash',
    name: 'ByteDance Seed 1.6 Flash',
    context: '256K',
    description: 'Ultra-fast multimodal deep thinking model',
    capabilities: ['chat', 'vision', 'reasoning'],
  },
  {
    id: 'bytedance-seed/seed-1.6',
    name: 'ByteDance Seed 1.6',
    context: '256K',
    description: 'General-purpose multimodal with adaptive thinking',
    capabilities: ['chat', 'vision'],
  },
  {
    id: 'minimax/minimax-m2.1',
    name: 'MiniMax M2.1',
    context: '196K',
    description: '10B active params, coding & agentic workflows',
    capabilities: ['chat'],
  },
  {
    id: 'z-ai/glm-4.7',
    name: 'Z.AI: GLM 4.7',
    context: '202K',
    description: 'Enhanced programming and multi-step reasoning',
    capabilities: ['chat', 'reasoning'],
  },
  {
    id: 'google/gemini-3-flash-preview',
    name: 'Google: Gemini 3 Flash Preview',
    context: '1M',
    description: 'High-speed thinking, near Pro-level reasoning',
    capabilities: ['chat', 'vision', 'reasoning'],
  },
  {
    id: 'openai/gpt-5.2',
    name: 'OpenAI: GPT-5.2',
    context: '400K',
    description: 'Frontier model with adaptive reasoning',
    capabilities: ['chat', 'reasoning'],
  },
  {
    id: 'openai/gpt-5.2-pro',
    name: 'OpenAI: GPT-5.2 Pro',
    context: '400K',
    description: 'Most advanced for complex reasoning',
    capabilities: ['chat', 'reasoning'],
  },
  {
    id: 'openai/gpt-5.2-chat',
    name: 'OpenAI: GPT-5.2 Chat',
    context: '128K',
    description: 'Fast, lightweight chat with adaptive reasoning',
    capabilities: ['chat'],
  },
  {
    id: 'z-ai/glm-4.6v',
    name: 'Z.AI: GLM 4.6V',
    context: '128K',
    description: 'Multimodal for visual understanding',
    capabilities: ['chat', 'vision'],
  },
  {
    id: 'amazon/nova-2-lite-v1',
    name: 'Amazon: Nova 2 Lite',
    context: '1M',
    description: 'Fast reasoning model',
    capabilities: ['chat', 'reasoning'],
  },
  {
    id: 'mistralai/ministral-14b-2512',
    name: 'Mistral: Ministral 3 14B 2512',
    context: '256K',
    description: 'Vision-capable efficient model',
    capabilities: ['chat', 'vision'],
  },
  {
    id: 'mistralai/ministral-8b-2512',
    name: 'Mistral: Ministral 3 8B 2512',
    context: '256K',
    description: 'Vision-capable tiny model',
    capabilities: ['chat', 'vision'],
  },
  {
    id: 'mistralai/ministral-3b-2512',
    name: 'Mistral: Ministral 3 3B 2512',
    context: '131K',
    description: 'Smallest vision-capable model',
    capabilities: ['chat', 'vision'],
  },
  {
    id: 'mistralai/mistral-large-2512',
    name: 'Mistral: Mistral Large 3 2512',
    context: '256K',
    description: '675B MoE (41B active), Apache 2.0',
    capabilities: ['chat'],
  },
  {
    id: 'deepseek/deepseek-v3.2',
    name: 'DeepSeek: DeepSeek V3.2',
    context: '163K',
    description: 'GPT-5 class with sparse attention',
    capabilities: ['chat'],
  },

  // November 2025
  {
    id: 'anthropic/claude-opus-4.5',
    name: 'Anthropic: Claude Opus 4.5',
    context: '200K',
    description: 'Frontier reasoning for agentic workflows',
    capabilities: ['chat', 'reasoning'],
  },
  {
    id: 'google/gemini-3-pro-preview',
    name: 'Google: Gemini 3 Pro Preview',
    context: '1M',
    description: 'Flagship frontier multimodal',
    capabilities: ['chat', 'vision', 'reasoning'],
  },
  {
    id: 'x-ai/grok-4.1-fast',
    name: 'xAI: Grok 4.1 Fast',
    context: '2M',
    description: 'Best agentic tool calling',
    capabilities: ['chat'],
  },
  {
    id: 'qwen/qwen3-vl-32b-instruct',
    name: 'Qwen: Qwen3 VL 32B Instruct',
    context: '256K',
    description: 'Multimodal vision-language',
    capabilities: ['chat', 'vision'],
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Anthropic: Claude Haiku 4.5',
    context: '200K',
    description: 'Fast, most efficient Claude',
    capabilities: ['chat'],
  },
  {
    id: 'qwen/qwen3-vl-8b-thinking',
    name: 'Qwen: Qwen3 VL 8B Thinking',
    context: '256K',
    description: 'Reasoning-optimized multimodal',
    capabilities: ['chat', 'vision', 'reasoning'],
  },

  // Embedding Models (Commonly used ones)
  {
    id: 'openai/text-embedding-3-large',
    name: 'OpenAI: Text Embedding 3 Large',
    context: '8K',
    description: 'Most capable embedding model',
    capabilities: ['embedding'],
  },
  {
    id: 'openai/text-embedding-3-small',
    name: 'OpenAI: Text Embedding 3 Small',
    context: '8K',
    description: 'Efficient embedding model',
    capabilities: ['embedding'],
  },
  {
    id: 'google/text-embedding-004',
    name: 'Google: Text Embedding 004',
    context: '2K',
    description: 'High-performance Google embeddings',
    capabilities: ['embedding'],
  },
];

export function getModelsByCapability(capability: string): ModelInfo[] {
  return OPENROUTER_MODELS.filter((m) => m.capabilities.includes(capability));
}
