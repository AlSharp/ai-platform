import type { Db } from '../../shared/db/db.types.js';

import type {
  Trade,
  Leg,
  InsertTradeParams,
  InsertLegParams,
} from './trades.schema.js';

export function createTradesRepository(db: Db) {
  return {
    async createTrade(params: InsertTradeParams): Promise<Trade> {
      const result = await db.query<Trade>(
        `INSERT INTO trades (
          campaign_id,
          actor_id,
          source,
          action_type,
          occurred_at,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          campaign_id,
          actor_id,
          source,
          action_type,
          to_char(
            occurred_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS occurred_at,
          notes,
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS created_at`,
        [
          params.campaignId,
          params.actorId,
          params.source,
          params.actionType,
          params.occurredAt,
          params.notes ?? null,
        ]
      );

      return result.rows[0]!;
    },

    async createLeg(params: InsertLegParams): Promise<Leg> {
      const result = await db.query<Leg>(
        `INSERT INTO legs (
          trade_id,
          instrument_id,
          direction,
          quantity
        )
        VALUES ($1, $2, $3, $4::numeric)
        RETURNING
          id,
          trade_id,
          instrument_id,
          direction,
          quantity::text AS quantity,
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS created_at`,
        [
          params.tradeId,
          params.instrumentId,
          params.direction,
          params.quantity,
        ]
      );

      return result.rows[0]!;
    },
  };
}