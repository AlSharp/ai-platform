export type ReasoningRole = 'system' | 'user' | 'assistant';

export type ReasoningMessage = {
  role: ReasoningRole;
  content: string;
};

export type ReasoningTier = 'local' | 'frontier'

export type ReasoningRequest = {
  tier?: ReasoningTier,
  messages: ReasoningMessage[];
};

export type ReasoningResponse = {
  tier: ReasoningTier,
  provider: 'ollama' | 'hermes';
  model: string;
  content: string;
};