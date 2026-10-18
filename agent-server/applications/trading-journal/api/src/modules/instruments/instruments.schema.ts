import { z } from 'zod';

export const instrumentSchema = z.object({
  id: z.uuid(),
  symbol: z.string(),
  instrument_type: z.enum(['STOCK', 'OPTION']),
  underlying_instrument_id: z.uuid().nullable(),
  option_type: z.enum(['CALL', 'PUT']).nullable(),
  expiration_date: z.string().nullable(),
  strike: z.string().nullable(),
  multiplier: z.string(),
  created_at: z.string(),
});

export type Instrument = z.infer<typeof instrumentSchema>;

const stockSymbolSchema = z.string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9.-]*$/);

export const resolveStockSchema = z.object({
  symbol: stockSymbolSchema,
});

export type ResolveStockParams = z.infer<typeof resolveStockSchema>;

const positiveDecimalSchema = z.string()
  .regex(/^\d+(\.\d+)?$/)
  .refine(value => Number(value) > 0, {
    message: 'Must be greater than zero',
  });

const expirationDateSchema = z.iso.date();

export const resolveOptionSchema = z.object({
  underlyingSymbol: stockSymbolSchema,
  optionType: z.enum(['CALL', 'PUT']),
  expirationDate: expirationDateSchema,
  strike: positiveDecimalSchema,
  multiplier: positiveDecimalSchema.default('100'),
});

export type ResolveOptionParams = z.infer<typeof resolveOptionSchema>;