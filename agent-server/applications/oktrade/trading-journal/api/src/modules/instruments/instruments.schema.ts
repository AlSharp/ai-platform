import { z } from 'zod';

export const instrumentRecordSchema = z.object({
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

export type InstrumentRecord = z.infer<typeof instrumentRecordSchema>;

const stockSymbolSchema = z.string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9.-]*$/);

export const resolveStockInputSchema = z.object({
  symbol: stockSymbolSchema,
});

export type ResolveStockInput = z.infer<typeof resolveStockInputSchema>;

const positiveDecimalSchema = z.string()
  .regex(/^\d+(\.\d+)?$/)
  .refine(value => Number(value) > 0, {
    message: 'Must be greater than zero',
  });

const expirationDateSchema = z.iso.date();

export const resolveOptionInputSchema = z.object({
  underlyingSymbol: stockSymbolSchema,
  optionType: z.enum(['CALL', 'PUT']),
  expirationDate: expirationDateSchema,
  strike: positiveDecimalSchema,
  multiplier: positiveDecimalSchema.default('100'),
});

export type ResolveOptionInput = z.infer<typeof resolveOptionInputSchema>;