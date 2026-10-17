import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import {
  accountSchema,
  createAccountSchema,
  listAccountsResponseSchema,
  accountParamsSchema,
  updateAccountSchema,
  listAccountsQuerySchema
} from './accounts.schema.js';
import {
  errorResponseSchema
} from '../../shared/schemas/error.schemas.js';
import { createAccountsRepository } from './accounts.repository.js';
import { request } from 'node:http';

export function registerAccountRoutes(
  app: FastifyInstance,
  db: Pool
) {
  const repository = createAccountsRepository(db);

  app.withTypeProvider<ZodTypeProvider>().get(
    '/accounts',
    {
      schema: {
        querystring: listAccountsQuerySchema,
        response: {
          200: listAccountsResponseSchema,
        },
      },
    },
    async (request) => {
      const accounts = await repository.findAll(request.query.status);
      return { accounts };
    }
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/accounts',
    {
      schema: {
        body: createAccountSchema,
        response: {
          201: accountSchema,
        },
      },
    },
    async (request, reply) => {
      const account = await repository.create(request.body);

      return reply.code(201).send(account);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/accounts/:id',
    {
      schema: {
        params: accountParamsSchema,
        response: {
          200: accountSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const account = await repository.findById(request.params.id);

      if (!account) {
        return reply.code(404).send({
          statusCode: 404,
          code: 'ACCOUNT_NOT_FOUND',
          error: 'Not Found',
          message: 'Account not found'
        });
      }

      return reply.code(200).send(account);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/accounts/:id',
    {
      schema: {
        params: accountParamsSchema,
        body: updateAccountSchema,
        response: {
          200: accountSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const account = await repository.update(
        request.params.id,
        request.body
      );

      if (!account) {
        return reply.code(404).send({
          statusCode: 404,
          code: 'ACCOUNT_NOT_FOUND',
          error: 'Not Found',
          message: 'Account not found',
        });
      }

      return reply.code(200).send(account);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/accounts/:id/archive',
    {
      schema: {
        params: accountParamsSchema,
        response: {
          200: accountSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const account = await repository.archive(request.params.id);

      if (!account) {
        return reply.code(404).send({
          statusCode: 404,
          code: 'ACCOUNT_NOT_FOUND',
          error: 'Not Found',
          message: 'Account not found',
        });
      }

      return reply.code(200).send(account);
    }
  );

  app.withTypeProvider<ZodTypeProvider>().patch(
    '/accounts/:id/restore',
    {
      schema: {
        params: accountParamsSchema,
        response: {
          200: accountSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const account = await repository.restore(request.params.id);

      if (!account) {
        return reply.code(404).send({
          statusCode: 404,
          code: 'ACCOUNT_NOT_FOUND',
          error: 'Not Found',
          message: 'Account not found',
        });
      }

      return reply.code(200).send(account);
    }
  );
}