import type { Pool } from 'pg';
import type { Db } from '../../shared/db/db.types.js';

import type {
  CreateTradeRequest,
  CreateTradeResponse,
  ExecutionRecord,
  CreateTradeWithCampaignRequest,
  CreateTradeWithCampaignResponse,
  ClosablePositionLotRecord,
  ValidateClosingAllocationsInput
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

async function validateClosingAllocations(
  db: Db,
  params: ValidateClosingAllocationsInput
): Promise<void> {
  if (params.allocations.length === 0) {
    throw new Error('Closing execution requires lot allocations');
  }

  const lotIds = params.allocations.map(a => a.positionLotId);

  if (new Set(lotIds).size !== lotIds.length) {
    throw new Error('Duplicate position lot allocation');
  }

  const trades = createTradesRepository(db);

  // Lock in deterministic order to reduce deadlock risk.
  const lots = new Map<string, ClosablePositionLotRecord>();

  for (const id of [...lotIds].sort()) {
    const lot = await trades.findClosablePositionLot(id);

    if (!lot) {
      throw new Error(`Position lot not found: ${id}`);
    }

    lots.set(id, lot);
  }

  const expectedSide =
    params.closingTradeType === 'BUY_TO_CLOSE'
      ? 'SHORT'
      : 'LONG';

  for (const allocation of params.allocations) {
    const lot = lots.get(allocation.positionLotId)!;

    if (lot.account_id !== params.accountId) {
      throw new Error('Position lot belongs to another account');
    }

    if (lot.instrument_id !== params.instrumentId) {
      throw new Error('Position lot instrument mismatch');
    }

    if (lot.position_side !== expectedSide) {
      throw new Error('Position lot side mismatch');
    }
  }

  const result = await db.query<{
    matches: boolean;
    withinRemaining: boolean;
    chronological: boolean;
  }>(
    `SELECT
      COALESCE(SUM(a.quantity), 0) = $2::numeric AS matches,
      COALESCE(BOOL_AND(
        a.quantity > 0
        AND a.quantity <= a.remaining
      ), false) AS "withinRemaining",
      COALESCE(BOOL_AND(
        a.opened_at <= $4::timestamptz
      ), false) AS chronological
    FROM unnest(
      $1::numeric[],
      $3::numeric[],
      $5::timestamptz[]
    ) AS a(quantity, remaining, opened_at)`,
    [
      params.allocations.map(a => a.quantity),
      params.executionQuantity,
      params.allocations.map(
        a => lots.get(a.positionLotId)!.remaining_quantity
      ),
      params.executionTime,
      params.allocations.map(
        a => lots.get(a.positionLotId)!.opened_at
      ),
    ]
  );

  if (!result.rows[0]?.chronological) {
    throw new Error(
      'Closing execution cannot precede position lot opening'
    );
  }

  if (!result.rows[0]?.matches) {
    throw new Error(
      'Allocation quantities must equal execution quantity'
    );
  }

  if (!result.rows[0]?.withinRemaining) {
    throw new Error(
      'Allocation exceeds remaining position lot quantity'
    );
  }
}

async function insertTrade(
  db: Db,
  params: CreateTradeRequest
): Promise<CreateTradeResponse> {
  const trades = createTradesRepository(db);
  const instruments = createInstrumentsRepository(db);
  const campaigns = createCampaignsRepository(db);

  const campaign = await campaigns.findById(params.campaignId);

  if (!campaign) {
    throw new Error('Campaign not found');
  };

  const accountId = campaign.account_id;

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
      const createdExecution = await trades.createExecution({
        legId: createdLeg.id,
        brokerExecutionId: execution.brokerExecutionId,
        quantity: execution.quantity,
        price: execution.price,
        fees: execution.fees,
        executedAt: execution.executedAt,
      });
      executions.push(createdExecution);

      if (
        leg.tradeType === 'BUY_TO_OPEN' ||
        leg.tradeType === 'SELL_TO_OPEN'
      ) {
        const lot = await trades.createPositionLot({
          openingLegId: createdLeg.id,
          positionSide:
            leg.tradeType === 'BUY_TO_OPEN' ? 'LONG' : 'SHORT',
          openedQuantity: createdExecution.quantity,
          fillPrice: createdExecution.price,
          openedAt: createdExecution.executed_at,
        });

        await trades.linkPositionLotExecution({
          positionLotId: lot.id,
          executionId: createdExecution.id,
        });
      }

      if (
        leg.tradeType === 'BUY_TO_CLOSE' ||
        leg.tradeType === 'SELL_TO_CLOSE'
      ) {
        const allocations = execution.allocations ?? [];

        await validateClosingAllocations(db, {
          accountId,
          instrumentId: instrument.id,
          closingTradeType: leg.tradeType,
          executionQuantity: createdExecution.quantity,
          allocations,
          executionTime: createdExecution.executed_at,
        });

        for (const allocation of allocations) {
          await trades.createLotAllocation({
            positionLotId: allocation.positionLotId,
            closingExecutionId: createdExecution.id,
            quantity: allocation.quantity,
          });
        }
      } else if (execution.allocations?.length) {
        throw new Error(
          'Opening executions cannot contain closing allocations'
        );
      }
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