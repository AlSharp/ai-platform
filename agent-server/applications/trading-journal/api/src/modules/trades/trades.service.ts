import type { Pool } from 'pg';
import type { Db } from '../../shared/db/db.types.js';

import type {
  CreateTradeRequest,
  LegRecord,
  CreateTradeResponse
} from './trades.schema.js';

import type {
  CreateTradeWithCampaignRequest,
  CreateTradeWithCampaignResponse,
} from './trades.schema.js';

import { createCampaignsRepository } from '../campaigns/campaigns.repository.js';

import { createTradesRepository } from './trades.repository.js';
import { createInstrumentsRepository } from '../instruments/instruments.repository.js';

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

  const legs: LegRecord[] = [];

  for (const leg of params.legs) {
    const instrument =
      leg.instrumentType === 'STOCK'
        ? await instruments.resolveStock(leg.instrument)
        : await instruments.resolveOption(leg.instrument);

    legs.push(
      await trades.createLeg({
        tradeId: trade.id,
        instrumentId: instrument.id,
        direction: leg.direction,
        quantity: leg.quantity,
      })
    );
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