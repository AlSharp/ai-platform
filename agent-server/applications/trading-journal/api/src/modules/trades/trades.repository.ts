import type { Db } from '../../shared/db/db.types.js';

import type {
  TradeRecord,
  LegRecord,
  TradeInsert,
  LegInsert,
} from './trades.schema.js';

export function createTradesRepository(db: Db) {
  return {
    async createTrade(params: TradeInsert): Promise<TradeRecord> {
      const result = await db.query<TradeRecord>(
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

    async createLeg(params: LegInsert): Promise<LegRecord> {
      const result = await db.query<LegRecord>(
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

    async findById(id: string): Promise<TradeRecord | null> {
      const result = await db.query<TradeRecord>(
        `SELECT
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
          ) AS created_at
        FROM trades
        WHERE id = $1`,
        [id]
      );

      return result.rows[0] ?? null;
    },

    async findLegsByTradeId(tradeId: string): Promise<LegRecord[]> {
      const result = await db.query<LegRecord>(
        `SELECT
          id,
          trade_id,
          instrument_id,
          direction,
          quantity::text AS quantity,
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS created_at
        FROM legs
        WHERE trade_id = $1
        ORDER BY created_at ASC, id ASC`,
        [tradeId]
      );

      return result.rows;
    },
  };
}