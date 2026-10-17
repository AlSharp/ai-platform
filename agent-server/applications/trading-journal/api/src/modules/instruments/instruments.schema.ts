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

export type ResolveOptionParams = {
  underlyingSymbol: string;
  optionType: 'CALL' | 'PUT';
  expirationDate: string;
  strike: string;
  multiplier?: string;
};