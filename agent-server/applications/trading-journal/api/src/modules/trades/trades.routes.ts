import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import {
  createTradeRequestSchema,
  createTradeResponseSchema,
  createTradeWithCampaignRequestSchema,
  createTradeWithCampaignResponseSchema,
  getTradePathParamsSchema,
  getTradeResponseSchema,
  openPositionLotsQuerySchema,
  openPositionLotsResponseSchema
} from './trades.schema.js';

import { errorResponseSchema } from '../../shared/schemas/error.schemas.js';

import { createTradesRepository } from './trades.repository.js';
import { createTradesService } from './trades.service.js';

export function registerTradeRoutes(
  app: FastifyInstance,
  db: Pool
) {
  const repository = createTradesRepository(db);
  const service = createTradesService(db);

  app.withTypeProvider<ZodTypeProvider>().post(
    '/trades',
    {
      schema: {
        body: createTradeRequestSchema,
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
        body: createTradeWithCampaignRequestSchema,
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

  app.withTypeProvider<ZodTypeProvider>().get(
    '/trades/:id',
    {
      schema: {
        params: getTradePathParamsSchema,
        response: {
          200: getTradeResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const trade = await repository.findById(request.params.id);

      if (!trade) {
        return reply.code(404).send({
          statusCode: 404,
          code: 'TRADE_NOT_FOUND',
          error: 'Not Found',
          message: 'Trade not found',
        });
      }

      const legs = await repository.findLegsWithExecutions(trade.id);

      return { trade, legs };
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/position-lots/open',
    {
      schema: {
        querystring: openPositionLotsQuerySchema,
        response: {
          200: openPositionLotsResponseSchema,
        },
      },
    },
    async (request) => {
      const lots = await repository.findOpenPositionLotsByAccountId(
        request.query.accountId
      );

      return { lots };
    }
  );
}