import type { Pool } from 'pg';
import type { Db } from '../../shared/db/db.types.js';

import type {
  CreateTradeRequest,
  CreateTradeResponse,
  ExecutionRecord,
} from './trades.schema.js';

import type {
  CreateTradeWithCampaignRequest,
  CreateTradeWithCampaignResponse,
} from './trades.schema.js';

import { createCampaignsRepository } from '../campaigns/campaigns.repository.js';

import { createTradesRepository } from './trades.repository.js';
import { createInstrumentsRepository } from '../instruments/instruments.repository.js';

async function validateExecutionQuantity(
  db: Db,
  legQuantity: string,
  executionQuantities: string[]
): Promise<void> {
  const result = await db.query<{ matches: boolean }>(
    `SELECT
      COALESCE(SUM(q::numeric), 0) = $2::numeric AS matches
    FROM unnest($1::text[]) AS q`,
    [executionQuantities, legQuantity]
  );

  if (!result.rows[0]?.matches) {
    throw new Error(
      'Total execution quantity must equal leg quantity'
    );
  }
}

async function insertTrade(
  db: Db,
  params: CreateTradeRequest
): Promise<CreateTradeResponse> {
  const trades = createTradesRepository(db);
  const instruments = createInstrumentsRepository(db);

  const trade = await trades.createTrade({
    campaignId: params.campaignId,
    actorId: params.actorId,
    source: params.source,
    actionType: params.actionType,
    occurredAt: params.occurredAt,
    notes: params.notes,
  });

  const legs: CreateTradeResponse['legs'] = [];

  for (const leg of params.legs) {
    await validateExecutionQuantity(
      db,
      leg.quantity,
      leg.executions.map(execution => execution.quantity)
    );

    const instrument =
      leg.instrumentType === 'STOCK'
        ? await instruments.resolveStock(leg.instrument)
        : await instruments.resolveOption(leg.instrument);

    const createdLeg = await trades.createLeg({
      tradeId: trade.id,
      instrumentId: instrument.id,
      direction: leg.direction,
      tradeType: leg.tradeType,
      quantity: leg.quantity,
    });

    const executions: ExecutionRecord[] = [];

    for (const execution of leg.executions) {
      executions.push(
        await trades.createExecution({
          legId: createdLeg.id,
          brokerExecutionId: execution.brokerExecutionId,
          quantity: execution.quantity,
          price: execution.price,
          fees: execution.fees,
          executedAt: execution.executedAt,
        })
      )
    }

    legs.push({
      ...createdLeg,
      executions,
    });
  }

  return { trade, legs };
}

export function createTradesService(pool: Pool) {
  return {
    async create(
      params: CreateTradeRequest
    ): Promise<CreateTradeResponse> {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const result = await insertTrade(client, params);

        await client.query('COMMIT');

        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          // Preserve the original failure.
          // Log rollbackError when service logging is introduced.
        }

        throw error;
      } finally {
        client.release();
      }
    },

    async createWithCampaign(
      params: CreateTradeWithCampaignRequest
    ): Promise<CreateTradeWithCampaignResponse> {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const campaigns = createCampaignsRepository(client);

        const campaign = await campaigns.create(params.campaign);

        const result = await insertTrade(client, {
          ...params.trade,
          campaignId: campaign.id,
        });

        await client.query('COMMIT');

        return {
          campaign,
          ...result,
        };
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Preserve original error.
        }

        throw error;
      } finally {
        client.release();
      }
    }
  };
}