import type { Db } from '../../shared/db/db.types.js';

import type {
  TradeRecord,
  LegRecord,
  TradeInsert,
  LegInsert,
  GetTradeResponse
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

    async findByCampaignId(
      campaignId: string
    ): Promise<GetTradeResponse[]> {
      const result = await db.query<{
        trade: TradeRecord;
        legs: LegRecord[];
      }>(
        `SELECT
          jsonb_build_object(
            'id', t.id,
            'campaign_id', t.campaign_id,
            'actor_id', t.actor_id,
            'source', t.source,
            'action_type', t.action_type,
            'occurred_at', to_char(
              t.occurred_at AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            ),
            'notes', t.notes,
            'created_at', to_char(
              t.created_at AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            )
          ) AS trade,
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', l.id,
                  'trade_id', l.trade_id,
                  'instrument_id', l.instrument_id,
                  'direction', l.direction,
                  'quantity', l.quantity::text,
                  'created_at', to_char(
                    l.created_at AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
                  )
                )
                ORDER BY l.created_at ASC, l.id ASC
              )
              FROM legs l
              WHERE l.trade_id = t.id
            ),
            '[]'::jsonb
          ) AS legs
        FROM trades t
        WHERE t.campaign_id = $1
        ORDER BY t.occurred_at ASC, t.id ASC`,
        [campaignId]
      );

      return result.rows;
    }
  };
}