import { ReasoningRequest, ReasoningResponse } from '../types/reasoning';
import { getOllamaModel, reasonWithOllama } from '../providers/ollama';
import { reasonWithHermes } from '../providers/hermes';

export async function reason(request: ReasoningRequest): Promise<ReasoningResponse> {
  const { tier = 'local', messages } = request;

  if (tier === 'frontier') {
    const content = await reasonWithHermes(messages);

    return {
      tier,
      provider: 'hermes',
      model: 'hermes-agent',
      content
    }
  }

  const content = await reasonWithOllama(messages);

  return {
    tier,
    provider: 'ollama',
    model: getOllamaModel(),
    content
  }
}