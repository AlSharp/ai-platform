import { ReasoningRequest, ReasoningResponse } from '../types/reasoning';
import { getOllamaModel, reasonWithOllama } from '../providers/ollama';
import { reasonWithHermes } from '../providers/hermes';
import type { FastifyBaseLogger } from 'fastify';

export async function reason(
  request: ReasoningRequest,
  logger: FastifyBaseLogger
): Promise<ReasoningResponse> {
  const { tier = 'local', messages } = request;

  const startedAt = Date.now();

  if (tier === 'frontier') {
    const content = await reasonWithHermes(messages);

    logger.info({
      event: 'reasoning.completed',
      tier,
      provider: 'hermes',
      model: 'hermes',
      duration: Date.now() - startedAt,
    });

    return {
      tier,
      provider: 'hermes',
      model: 'hermes-agent',
      content
    }
  }

  const content = await reasonWithOllama(messages);

  logger.info({
    event: 'reasoning.completed',
    tier,
    provider: 'ollama',
    model: getOllamaModel(),
    duration: Date.now() - startedAt,
  });

  return {
    tier,
    provider: 'ollama',
    model: getOllamaModel(),
    content
  }
}