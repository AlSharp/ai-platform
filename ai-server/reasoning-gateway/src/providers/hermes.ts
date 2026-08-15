import { ReasoningMessage } from '../types/reasoning';

type HermesRequest = {
  model: string;
  messages: ReasoningMessage[];
  stream: boolean;
};

type HermesResponse = {
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
};

const baseUrl = process.env.HERMES_BASE_URL;
const apiKey = process.env.HERMES_API_KEY;

if (!baseUrl) {
  throw new Error('HERMES_BASE_URL is not configured');
}

if (!apiKey) {
  throw new Error('HERMES_API_KEY is not configured');
}

const timeout = Number(
  process.env.HERMES_TIMEOUT_MS ?? 300000,
);

export async function reasonWithHermes(
  messages: ReasoningMessage[],
): Promise<string> {
  const body: HermesRequest = {
    model: 'hermes-agent',
    messages,
    stream: false,
  };

  const response = await fetch(
    `${baseUrl}/v1/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Hermes request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as HermesResponse;

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Hermes returned no response content');
  }

  return content;
}