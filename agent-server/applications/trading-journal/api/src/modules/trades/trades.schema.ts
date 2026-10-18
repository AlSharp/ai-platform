import { z } from 'zod';

import {
  resolveStockInputSchema,
  resolveOptionInputSchema,
} from '../instruments/instruments.schema.js';

import {
  createCampaignRequestSchema,
  campaignRecordSchema,
} from '../campaigns/campaigns.schema.js';

const stockLegSchema = z.object({
  instrumentType: z.literal('STOCK'),
  instrument: resolveStockInputSchema,
  direction: z.enum(['LONG', 'SHORT']),
  quantity: z.string().regex(/^\d+(\.\d+)?$/)
    .refine(value => Number(value) > 0),
});

const optionLegSchema = z.object({
  instrumentType: z.literal('OPTION'),
  instrument: resolveOptionInputSchema,
  direction: z.enum(['LONG', 'SHORT']),
  quantity: z.string().regex(/^\d+(\.\d+)?$/)
    .refine(value => Number(value) > 0),
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
  quantity: z.string(),
});

export type LegInsert = z.infer<typeof legInsertSchema>;

export const createTradeResponseSchema = z.object({
  trade: tradeRecordSchema,
  legs: z.array(legRecordSchema),
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
  legs: z.array(legRecordSchema),
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