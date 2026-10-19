import { z } from 'zod';

import {
  resolveStockInputSchema,
  resolveOptionInputSchema,
} from '../instruments/instruments.schema.js';

import {
  createCampaignRequestSchema,
  campaignRecordSchema,
} from '../campaigns/campaigns.schema.js';

const positiveDecimalSchema = z.string()
  .regex(
    /^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/,
    'Must be a decimal with at most 14 integer digits and 6 fractional digits'
  )
  .refine(
    value => /[1-9]/.test(value),
    'Must be greater than zero'
  );

const nonNegativeDecimalSchema = z.string()
  .regex(
    /^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/,
    'Must be a non-negative decimal with at most 14 integer digits and 6 fractional digits'
  );

export const executionRecordSchema = z.object({
  id: z.uuid(),
  leg_id: z.uuid(),
  broker_execution_id: z.string().nullable(),
  quantity: positiveDecimalSchema,
  price: nonNegativeDecimalSchema,
  fees: nonNegativeDecimalSchema.default('0'),
  executed_at: z.string(),
  created_at: z.string(),
});

export type ExecutionRecord = z.infer<
  typeof executionRecordSchema
>;

export const executionInsertSchema = z.object({
  legId: z.uuid(),
  brokerExecutionId: z.string().nullable().optional(),
  quantity: z.string().regex(/^\d+(\.\d+)?$/)
    .refine(value => Number(value) > 0),
  price: z.string().regex(/^\d+(\.\d+)?$/),
  fees: z.string().regex(/^\d+(\.\d+)?$/).default('0'),
  executedAt: z.iso.datetime({ offset: true }),
});

export type ExecutionInsert = z.infer<
  typeof executionInsertSchema
>;

const createTradeExecutionSchema = executionInsertSchema.omit({
  legId: true,
});

export const tradeTypeSchema = z.enum([
  'BUY_TO_OPEN',
  'SELL_TO_OPEN',
  'BUY_TO_CLOSE',
  'SELL_TO_CLOSE',
]);

const stockLegSchema = z.object({
  instrumentType: z.literal('STOCK'),
  instrument: resolveStockInputSchema,
  direction: z.enum(['LONG', 'SHORT']),
  quantity: positiveDecimalSchema,
  executions: z.array(createTradeExecutionSchema).min(1),
  tradeType: tradeTypeSchema,
});

const optionLegSchema = z.object({
  instrumentType: z.literal('OPTION'),
  instrument: resolveOptionInputSchema,
  direction: z.enum(['LONG', 'SHORT']),
  tradeType: tradeTypeSchema,
  quantity: positiveDecimalSchema,
  executions: z.array(createTradeExecutionSchema).min(1),
});

export const createTradeRequestSchema = z.object({
  campaignId: z.uuid(),
  actorId: z.uuid(),

  source: z.enum([
    'MANUAL',
    'BROKER_IMPORT',
    'API',
  ]).default('MANUAL'),

  actionType: z.enum([
    'MANUAL',
    'ASSIGNMENT',
    'EXERCISE',
    'EXPIRATION',
  ]).default('MANUAL'),

  occurredAt: z.iso.datetime({ offset: true }),

  notes: z.string().nullable().optional(),

  legs: z.array(
    z.discriminatedUnion('instrumentType', [
      stockLegSchema,
      optionLegSchema,
    ])
  ).min(1),
});

export type CreateTradeRequest = z.infer<typeof createTradeRequestSchema>;
export type CreateTradeLeg = CreateTradeRequest['legs'][number];

export const tradeRecordSchema = z.object({
  id: z.uuid(),
  campaign_id: z.uuid(),
  actor_id: z.uuid(),
  source: z.enum(['MANUAL', 'BROKER_IMPORT', 'API']),
  action_type: z.enum([
    'MANUAL',
    'ASSIGNMENT',
    'EXERCISE',
    'EXPIRATION',
  ]),
  occurred_at: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

export type TradeRecord = z.infer<typeof tradeRecordSchema>;

export const legRecordSchema = z.object({
  id: z.uuid(),
  trade_id: z.uuid(),
  instrument_id: z.uuid(),
  direction: z.enum(['LONG', 'SHORT']),
  trade_type: tradeTypeSchema,
  quantity: z.string(),
  created_at: z.string(),
});

export type LegRecord = z.infer<typeof legRecordSchema>;

export const tradeInsertSchema = createTradeRequestSchema.omit({
  legs: true,
});

export type TradeInsert = z.infer<typeof tradeInsertSchema>;

export const legInsertSchema = z.object({
  tradeId: z.uuid(),
  instrumentId: z.uuid(),
  direction: z.enum(['LONG', 'SHORT']),
  tradeType: tradeTypeSchema,
  quantity: z.string(),
});

export type LegInsert = z.infer<typeof legInsertSchema>;

export const tradeLegResponseSchema = legRecordSchema.extend({
  executions: z.array(executionRecordSchema),
});

export type TradeLegResponse = z.infer<
  typeof tradeLegResponseSchema
>;

export const createTradeResponseSchema = z.object({
  trade: tradeRecordSchema,
  legs: z.array(tradeLegResponseSchema),
});

export type CreateTradeResponse = z.infer<
  typeof createTradeResponseSchema
>;

export const createTradeWithCampaignRequestSchema = z.object({
  campaign: createCampaignRequestSchema,
  trade: createTradeRequestSchema.omit({
    campaignId: true,
  }),
});

export type CreateTradeWithCampaignRequest = z.infer<
  typeof createTradeWithCampaignRequestSchema
>;

export const createTradeWithCampaignResponseSchema = z.object({
  campaign: campaignRecordSchema,
  trade: tradeRecordSchema,
  legs: z.array(tradeLegResponseSchema),
});

export type CreateTradeWithCampaignResponse = z.infer<
  typeof createTradeWithCampaignResponseSchema
>;

export const getTradePathParamsSchema = z.object({
  id: z.uuid(),
});

export const getTradeResponseSchema = createTradeResponseSchema;

export type GetTradeResponse = z.infer<typeof getTradeResponseSchema>;

export const listCampaignTradesResponseSchema = z.object({
  trades: z.array(getTradeResponseSchema),
});

export type ListCampaignTradesResponse = z.infer<
  typeof listCampaignTradesResponseSchema
>;

export const positionLotRecordSchema = z.object({
  id: z.uuid(),
  opening_leg_id: z.uuid(),
  position_side: z.enum(['LONG', 'SHORT']),
  opened_quantity: positiveDecimalSchema,
  fill_price: nonNegativeDecimalSchema,
  opened_at: z.string(),
  created_at: z.string(),
});

export type PositionLotRecord = z.infer<
  typeof positionLotRecordSchema
>;

export const positionLotInsertSchema = z.object({
  openingLegId: z.uuid(),
  positionSide: z.enum(['LONG', 'SHORT']),
  openedQuantity: positiveDecimalSchema,
  fillPrice: nonNegativeDecimalSchema,
  openedAt: z.iso.datetime({ offset: true }),
});

export type PositionLotInsert = z.infer<
  typeof positionLotInsertSchema
>;

export const positionLotExecutionInsertSchema = z.object({
  positionLotId: z.uuid(),
  executionId: z.uuid(),
});

export type PositionLotExecutionInsert = z.infer<
  typeof positionLotExecutionInsertSchema
>;