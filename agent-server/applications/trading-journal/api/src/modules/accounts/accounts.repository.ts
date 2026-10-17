import type { Pool } from 'pg';
import type { Account, CreateAccount } from './accounts.schema.js';

export function createAccountsRepository(db: Pool) {
  return {
    async findAll(): Promise<Account[]> {
      const result = await db.query<Account>(`
        SELECT
          id,
          name,
          broker,
          mode,
          currency,
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS created_at,
          CASE
            WHEN archived_at IS NULL THEN NULL
            ELSE to_char(
              archived_at AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            )
          END AS archived_at
        FROM accounts
        ORDER BY created_at, id
      `);

      return result.rows;
    },
    async create(input: CreateAccount): Promise<Account> {
      const result = await db.query<Account>(
        `INSERT INTO accounts (name, broker, mode, currency)
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          name,
          broker,
          mode,
          currency,
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS created_at,
          CASE
            WHEN archived_at IS NULL THEN NULL
            ELSE to_char(
              archived_at AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            )
          END AS archived_at`,
        [
          input.name,
          input.broker ?? null,
          input.mode,
          input.currency,
        ]
      );

      return result.rows[0]!;
    },
    async findById(id: string): Promise<Account | null> {
      const result = await db.query<Account>(
        `SELECT
          id,
          name,
          broker,
          mode,
          currency,
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS created_at,
          CASE
            WHEN archived_at IS NULL THEN NULL
            ELSE to_char(
              archived_at AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            )
          END AS archived_at
        FROM accounts
        WHERE id = $1`,
        [id]
      );

      return result.rows[0] ?? null;
    },
  };
};

