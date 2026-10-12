import Fastify from 'fastify';
import type { Pool } from 'pg';

export function buildApp(db: Pool) {
  const app = Fastify({
    logger: true,
  });

  app.get('/health', async () => {
    return {
      status: 'ok',
    };
  });

  app.get('/ready', async(_request, reply) => {
    try {
      await db.query('SELECT 1');

      return { status: 'ready' };
    } catch(error) {
      app.log.error(error, 'Database readiness check failed');
      return reply.code(503).send({ status: 'unavailable' });
    }
  })

  return app;
}