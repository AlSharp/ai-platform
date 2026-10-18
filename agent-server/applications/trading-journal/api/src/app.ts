import Fastify from 'fastify';
import type { Pool } from 'pg';
import {
  validatorCompiler,
  serializerCompiler,
} from 'fastify-type-provider-zod';

import {registerAccountRoutes } from './modules/accounts/accounts.routes.js';
import { registerCampaignRoutes } from './modules/campaigns/campaigns.routes.js';
import { registerTradeRoutes } from './modules/trades/trades.routes.js';

export function buildApp(db: Pool) {
  const app = Fastify({
    logger: true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

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
  });

  registerAccountRoutes(app, db);
  registerCampaignRoutes(app, db);
  registerTradeRoutes(app, db);

  return app;
}