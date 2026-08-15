export type ReasoningMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ReasoningRequest = {
  messages: ReasoningMessage[];
};

export type ReasoningResponse = {
  provider: "ollama" | "hermes";
  model: string;
  content: string;
};