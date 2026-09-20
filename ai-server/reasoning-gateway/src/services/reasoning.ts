import { ReasoningRequest, ReasoningResponse } from '../types/reasoning';
import { getOllamaModel, reasonWithOllama } from '../providers/ollama';
import { reasonWithHermes } from '../providers/hermes';
import type { FastifyBaseLogger } from 'fastify';

export async function reason(
  request: ReasoningRequest,
  logger: FastifyBaseLogger,
  signal: AbortSignal
): Promise<ReasoningResponse> {
  const { tier = 'local', messages } = request;

  const startedAt = Date.now();

  if (tier === 'frontier') {
    const content = await reasonWithHermes(messages, signal);

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

  const content = await reasonWithOllama(messages, signal);

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