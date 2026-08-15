import 'dotenv/config';
import Fastify from 'fastify';
import { ReasoningRequest } from './types/reasoning';
import { reason } from './services/reasoning';
import { reasoningSchema } from './schemas/reasoning';

const app = Fastify({
  logger: true,
});

app.get('/health', async () => ({
  status: 'ok',
  service: 'reasoning-gateway',
}));

app.post<{
  Body: ReasoningRequest;
}>('/reason', { schema: reasoningSchema }, async (request, reply) => {
  try {
    return await reason(request.body);
  } catch (error) {
    request.log.error(error);

    return reply.status(502).send({
      error: 'reasoning provider unavailable',
    });
  }
});

const port = Number(process.env.PORT ?? 9000);

async function start() {
  try {
    await app.listen({
      host: '0.0.0.0',
      port,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();