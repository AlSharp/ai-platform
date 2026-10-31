import type { FastifyInstance } from 'fastify';
import type { Db } from '../../shared/db/db.types.js';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import {
  campaignRecordSchema,
  createCampaignRequestSchema,
  campaignPathParamsSchema,
  listCampaignsQuerySchema,
  listCampaignsResponseSchema,
  updateCampaignRequestSchema
} from './campaigns.schema.js';
import { listCampaignTradesResponseSchema } from '../trades/trades.schema.js';

import { createCampaignsRepository } from './campaigns.repository.js';
import { createTradesRepository } from '../trades/trades.repository.js';

import {
  errorResponseSchema,
} from '../../shared/schemas/error.schemas.js';

export function registerCampaignRoutes(
  app: FastifyInstance,
  db: Db
) {
  const repository = createCampaignsRepository(db);
  const tradeRepository = createTradesRepository(db);

  app.withTypeProvider<ZodTypeProvider>().post(
    '/campaigns',
    {
      schema: {
        body: createCampaignRequestSchema,
        response: {
          201: campaignRecordSchema,
        },
      },
    },
    async (request, reply) => {
      const campaign = await repository.create(request.body);

      return reply.code(201).send(campaign);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/campaigns/:id',
    {
      schema: {
        params: campaignPathParamsSchema,
        response: {
          200: campaignRecordSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const campaign = await repository.findById(request.params.id);

      if (!campaign) {
        return reply.code(404).send({
          statusCode: 404,
          code: 'CAMPAIGN_NOT_FOUND',
          error: 'Not Found',
          message: 'Campaign not found',
        });
      }

      return reply.code(200).send(campaign);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/campaigns',
    {
      schema: {
        querystring: listCampaignsQuerySchema,
        response: {
          200: listCampaignsResponseSchema,
        },
      },
    },
    async (request) => {
      const campaigns = await repository.list(request.query);

      return { campaigns };
    }
  );

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/campaigns/:id',
    {
      schema: {
        params: campaignPathParamsSchema,
        body: updateCampaignRequestSchema,
        response: {
          200: campaignRecordSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const campaign = await repository.update(
        request.params.id,
        request.body
      );

      return reply.code(200).send(campaign);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/campaigns/:id/complete',
    {
      schema: {
        params: campaignPathParamsSchema,
        response: {
          200: campaignRecordSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      return repository.complete(request.params.id);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/campaigns/:id/reopen',
    {
      schema: {
        params: campaignPathParamsSchema,
        response: {
          200: campaignRecordSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      return repository.reopen(request.params.id);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/campaigns/:id/trades',
    {
      schema: {
        params: campaignPathParamsSchema,
        response: {
          200: listCampaignTradesResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const campaign = await repository.findById(
        request.params.id
      );

      if (!campaign) {
        return reply.code(404).send({
          statusCode: 404,
          code: 'CAMPAIGN_NOT_FOUND',
          error: 'Not Found',
          message: 'Campaign not found',
        });
      }

      const trades = await tradeRepository.findByCampaignId(
        request.params.id
      );

      return reply.code(200).send({ trades });
    }
  );
}