import type { Db } from '../../shared/db/db.types.js';

import type {
  TradeRecord,
  LegRecord,
  TradeInsert,
  LegInsert,
  GetTradeResponse,
  ExecutionRecord,
  ExecutionInsert,
  TradeLegResponse,
  PositionLotRecord,
  PositionLotInsert,
  PositionLotExecutionInsert,
  LotAllocationInsert,
  LotAllocationRecord,
  ClosablePositionLotRecord
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
          trade_type,
          quantity
        )
        VALUES ($1, $2, $3, $4, $5::numeric)
        RETURNING
          id,
          trade_id,
          instrument_id,
          direction,
          trade_type,
          quantity::text AS quantity,
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS created_at`,
        [
          params.tradeId,
          params.instrumentId,
          params.direction,
          params.tradeType,
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
          trade_type,
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
        WHERE campaign_id = $1
        ORDER BY occurred_at ASC, id ASC`,
        [campaignId]
      );

      return Promise.all(
        result.rows.map(async trade => ({
          trade,
          legs: await this.findLegsWithExecutions(trade.id),
        }))
      );
    },

    async createExecution(
      params: ExecutionInsert
    ): Promise<ExecutionRecord> {
      const result = await db.query<ExecutionRecord>(
        `INSERT INTO executions (
          leg_id,
          broker_execution_id,
          quantity,
          price,
          fees,
          executed_at
        )
        VALUES (
          $1,
          $2,
          $3::numeric,
          $4::numeric,
          $5::numeric,
          $6
        )
        RETURNING
          id,
          leg_id,
          broker_execution_id,
          quantity::text AS quantity,
          price::text AS price,
          fees::text AS fees,
          to_char(
            executed_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS executed_at,
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS created_at`,
        [
          params.legId,
          params.brokerExecutionId ?? null,
          params.quantity,
          params.price,
          params.fees,
          params.executedAt,
        ]
      );

      return result.rows[0]!;
    },

    async findExecutionsByLegId(
      legId: string
    ): Promise<ExecutionRecord[]> {
      const result = await db.query<ExecutionRecord>(
        `SELECT
          id,
          leg_id,
          broker_execution_id,
          quantity::text AS quantity,
          price::text AS price,
          fees::text AS fees,
          to_char(
            executed_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS executed_at,
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS created_at
        FROM executions
        WHERE leg_id = $1
        ORDER BY executed_at ASC, id ASC`,
        [legId]
      );

      return result.rows;
    },

    async findLegsWithExecutions(
      tradeId: string
    ): Promise<TradeLegResponse[]> {
      const legs = await this.findLegsByTradeId(tradeId);

      return Promise.all(
        legs.map(async leg => ({
          ...leg,
          executions: await this.findExecutionsByLegId(leg.id),
        }))
      );
    },

    async createPositionLot(
      params: PositionLotInsert
    ): Promise<PositionLotRecord> {
      const result = await db.query<PositionLotRecord>(
        `INSERT INTO position_lots (
          opening_leg_id,
          position_side,
          opened_quantity,
          fill_price,
          opened_at
        )
        VALUES ($1, $2, $3::numeric, $4::numeric, $5)
        RETURNING
          id,
          opening_leg_id,
          position_side,
          opened_quantity::text AS opened_quantity,
          fill_price::text AS fill_price,
          to_char(
            opened_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS opened_at,
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS created_at`,
        [
          params.openingLegId,
          params.positionSide,
          params.openedQuantity,
          params.fillPrice,
          params.openedAt,
        ]
      );

      return result.rows[0]!;
    },

    async linkPositionLotExecution(
      params: PositionLotExecutionInsert
    ): Promise<void> {
      await db.query(
        `INSERT INTO position_lot_executions (
          position_lot_id,
          execution_id
        )
        VALUES ($1, $2)`,
        [params.positionLotId, params.executionId]
      );
    },

    async createLotAllocation(
      params: LotAllocationInsert
    ): Promise<LotAllocationRecord> {
      const result = await db.query<LotAllocationRecord>(
        `INSERT INTO lot_allocations (
          position_lot_id,
          closing_execution_id,
          quantity
        )
        VALUES ($1, $2, $3::numeric)
        RETURNING
          id,
          position_lot_id,
          closing_execution_id,
          quantity::text AS quantity,
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS created_at`,
        [
          params.positionLotId,
          params.closingExecutionId,
          params.quantity,
        ]
      );

      return result.rows[0]!;
    },

    async findClosablePositionLot(
      positionLotId: string
    ): Promise<ClosablePositionLotRecord | null> {
      await db.query(
        `SELECT id
        FROM position_lots
        WHERE id = $1
        FOR UPDATE`,
        [positionLotId]
      );
      const result = await db.query<ClosablePositionLotRecord>(
        `SELECT
          pl.id,
          c.account_id,
          l.instrument_id,
          pl.position_side,
          to_char(
            pl.opened_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS opened_at,
          (
            pl.opened_quantity -
            COALESCE(SUM(la.quantity), 0)
          )::text AS remaining_quantity
        FROM position_lots pl
        JOIN legs l
          ON l.id = pl.opening_leg_id
        JOIN trades t
          ON t.id = l.trade_id
        JOIN campaigns c
          ON c.id = t.campaign_id
        LEFT JOIN lot_allocations la
          ON la.position_lot_id = pl.id
        WHERE pl.id = $1
        GROUP BY
          pl.id,
          c.account_id,
          l.instrument_id,
          pl.position_side,
          pl.opened_quantity`,
        [positionLotId]
      );

      return result.rows[0] ?? null;
    },
  };
}