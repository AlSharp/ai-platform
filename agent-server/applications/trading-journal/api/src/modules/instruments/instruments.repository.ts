import type {
  Instrument,
  ResolveOptionParams,
} from './instruments.schema.js';

import type { Db } from '../../shared/db/db.types.js';

export function createInstrumentsRepository(db: Db) {
  const repository = {
    async resolveStock(symbol: string): Promise<Instrument> {
      const normalizedSymbol = symbol.trim().toUpperCase();

      if (!/^[A-Z][A-Z0-9.-]*$/.test(normalizedSymbol)) {
        throw new Error('Invalid stock symbol');
      }

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
        [normalizedSymbol]
      );

      return result.rows[0]!;
    },
    async resolveOption(input: ResolveOptionParams): Promise<Instrument> {
      const underlying = await repository.resolveStock(
        input.underlyingSymbol
      );

      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expirationDate) ||
          !Number.isFinite(Date.parse(`${input.expirationDate}T00:00:00Z`)) ||
          new Date(`${input.expirationDate}T00:00:00Z`)
            .toISOString().slice(0, 10) !== input.expirationDate) {
        throw new Error('Invalid option expiration date');
      }

      if (!/^\d+(\.\d+)?$/.test(input.strike) ||
          !/^\d+(\.\d+)?$/.test(input.multiplier ?? '100') ||
          Number(input.strike) <= 0 ||
          Number(input.multiplier ?? '100') <= 0) {
        throw new Error('Invalid option strike or multiplier');
      }

      const multiplier = input.multiplier ?? '100';

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
          multiplier,
        ]
      );

      return result.rows[0]!;
    },
  }
  return repository;
}