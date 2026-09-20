import { ReasoningMessage } from '../types/reasoning';

type OllamaRequest = {
  model: string;
  messages: ReasoningMessage[];
  stream?: boolean;
};

type OllamaResponse = {
  message: {
    role: 'assistant';
    content: string;
  };
};

const baseUrl = process.env.OLLAMA_BASE_URL;

if (!baseUrl) {
  throw new Error('OLLAMA_BASE_URL is not configured');
}

const model = process.env.OLLAMA_MODEL ?? 'qwen3.5:9b';

export async function reasonWithOllama(
  messages: ReasoningMessage[],
  signal?: AbortSignal
): Promise<string> {
  const body: OllamaRequest = {
    model,
    messages,
    stream: false,
  };

  const timeout = Number(process.env.OLLAMA_TIMEOUT_MS) ?? 120000;

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([
        signal,
        AbortSignal.timeout(timeout)
      ])
      : AbortSignal.timeout(timeout),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as OllamaResponse;

  return data.message.content;
}

export function getOllamaModel(): string {
  return model;
}