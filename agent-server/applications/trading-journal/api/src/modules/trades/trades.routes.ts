import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import {
  createTradeSchema,
  createTradeResponseSchema,
  createTradeWithCampaignSchema,
  createTradeWithCampaignResponseSchema,
} from './trades.schema.js';

import { createTradesService } from './trades.service.js';

export function registerTradeRoutes(
  app: FastifyInstance,
  db: Pool
) {
  const service = createTradesService(db);

  app.withTypeProvider<ZodTypeProvider>().post(
    '/trades',
    {
      schema: {
        body: createTradeSchema,
        response: {
          201: createTradeResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.create(request.body);

      return reply.code(201).send(result);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/trades/with-campaign',
    {
      schema: {
        body: createTradeWithCampaignSchema,
        response: {
          201: createTradeWithCampaignResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.createWithCampaign(request.body);

      return reply.code(201).send(result);
    }
  );
}