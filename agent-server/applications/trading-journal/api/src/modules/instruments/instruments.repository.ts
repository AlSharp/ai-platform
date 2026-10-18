import type {
  Instrument,
  ResolveStockParams,
  ResolveOptionParams,
} from './instruments.schema.js';

import type { Db } from '../../shared/db/db.types.js';

export function createInstrumentsRepository(db: Db) {
  const repository = {
    async resolveStock(params: ResolveStockParams): Promise<Instrument> {
      const result = await db.query<Instrument>(
        `INSERT INTO instruments (
           symbol,
           instrument_type,
           multiplier
         )
         VALUES ($1, 'STOCK', 1)
         ON CONFLICT (symbol)
           WHERE instrument_type = 'STOCK'
         DO UPDATE SET symbol = EXCLUDED.symbol
         RETURNING
           id,
           symbol,
           instrument_type,
           underlying_instrument_id,
           option_type,
           expiration_date::text AS expiration_date,
           strike::text AS strike,
           multiplier::text AS multiplier,
           to_char(
             created_at AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
           ) AS created_at`,
        [params.symbol]
      );

      return result.rows[0]!;
    },
    async resolveOption(input: ResolveOptionParams): Promise<Instrument> {
      const underlying = await repository.resolveStock({
        symbol: input.underlyingSymbol,
      });

      const result = await db.query<Instrument>(
        `INSERT INTO instruments (
          symbol,
          instrument_type,
          underlying_instrument_id,
          option_type,
          expiration_date,
          strike,
          multiplier
        )
        VALUES (
          $1,
          'OPTION',
          $2,
          $3,
          $4::date,
          $5::numeric,
          $6::numeric
        )
        ON CONFLICT (
          underlying_instrument_id,
          option_type,
          expiration_date,
          strike
        )
        WHERE instrument_type = 'OPTION'
        DO UPDATE SET symbol = instruments.symbol
        RETURNING
          id,
          symbol,
          instrument_type,
          underlying_instrument_id,
          option_type,
          expiration_date::text AS expiration_date,
          strike::text AS strike,
          multiplier::text AS multiplier,
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS created_at`,
        [
          `${underlying.symbol}-${input.expirationDate}-${input.optionType}-${input.strike}`,
          underlying.id,
          input.optionType,
          input.expirationDate,
          input.strike,
          input.multiplier,
        ]
      );

      return result.rows[0]!;
    },
  }
  return repository;
}