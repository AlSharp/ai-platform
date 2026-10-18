import { z } from 'zod';

import {
  resolveStockSchema,
  resolveOptionSchema,
} from '../instruments/instruments.schema.js';

import {
  createCampaignSchema,
  campaignSchema,
} from '../campaigns/campaigns.schema.js';

const stockLegSchema = z.object({
  instrumentType: z.literal('STOCK'),
  instrument: resolveStockSchema,
  direction: z.enum(['LONG', 'SHORT']),
  quantity: z.string().regex(/^\d+(\.\d+)?$/)
    .refine(value => Number(value) > 0),
});

const optionLegSchema = z.object({
  instrumentType: z.literal('OPTION'),
  instrument: resolveOptionSchema,
  direction: z.enum(['LONG', 'SHORT']),
  quantity: z.string().regex(/^\d+(\.\d+)?$/)
    .refine(value => Number(value) > 0),
});

export const createTradeSchema = z.object({
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

export type CreateTradeParams = z.infer<typeof createTradeSchema>;
export type CreateTradeLeg = CreateTradeParams['legs'][number];

export const tradeSchema = z.object({
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

export type Trade = z.infer<typeof tradeSchema>;

export const legSchema = z.object({
  id: z.uuid(),
  trade_id: z.uuid(),
  instrument_id: z.uuid(),
  direction: z.enum(['LONG', 'SHORT']),
  quantity: z.string(),
  created_at: z.string(),
});

export type Leg = z.infer<typeof legSchema>;

export const insertTradeSchema = createTradeSchema.omit({
  legs: true,
});

export type InsertTradeParams = z.infer<typeof insertTradeSchema>;

export const insertLegSchema = z.object({
  tradeId: z.uuid(),
  instrumentId: z.uuid(),
  direction: z.enum(['LONG', 'SHORT']),
  quantity: z.string(),
});

export type InsertLegParams = z.infer<typeof insertLegSchema>;

export const createTradeResponseSchema = z.object({
  trade: tradeSchema,
  legs: z.array(legSchema),
});

export type CreateTradeResponse = z.infer<
  typeof createTradeResponseSchema
>;

export type TradeResult = {
  trade: Trade;
  legs: Leg[];
};

export const createTradeWithCampaignSchema = z.object({
  campaign: createCampaignSchema,
  trade: createTradeSchema.omit({
    campaignId: true,
  }),
});

export type CreateTradeWithCampaignParams = z.infer<
  typeof createTradeWithCampaignSchema
>;

export const createTradeWithCampaignResponseSchema = z.object({
  campaign: campaignSchema,
  trade: tradeSchema,
  legs: z.array(legSchema),
});

export type CreateTradeWithCampaignResponse = z.infer<
  typeof createTradeWithCampaignResponseSchema
>;