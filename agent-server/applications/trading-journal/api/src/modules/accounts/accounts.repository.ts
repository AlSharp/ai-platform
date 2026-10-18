import type {
  Account,
  CreateAccount,
  UpdateAccount,
  ListAccountsQuery
} from './accounts.schema.js';
import type { Db } from '../../shared/db/db.types.js';

export function createAccountsRepository(db: Db) {
  return {
    async findAll(
      status: ListAccountsQuery['status'] = 'active'
    ): Promise<Account[]> {
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
        WHERE
          ($1 = 'all')
          OR ($1 = 'active' AND archived_at IS NULL)
          OR ($1 = 'archived' AND archived_at IS NOT NULL)
        ORDER BY created_at, id`,
        [status]
      );

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
    async update(
      id: string,
      input: UpdateAccount
    ): Promise<Account | null> {
      const result = await db.query<Account>(
        `UPDATE accounts
        SET name = $2
        WHERE id = $1
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
        [id, input.name]
      );

      return result.rows[0] ?? null;
    },

    async archive(id: string): Promise<Account | null> {
      const result = await db.query<Account>(
        `UPDATE accounts
        SET archived_at = COALESCE(archived_at, now())
        WHERE id = $1
        RETURNING
          id, name, broker, mode, currency,
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS created_at,
          to_char(
            archived_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS archived_at`,
        [id]
      );

      return result.rows[0] ?? null;
    },

    async restore(id: string): Promise<Account | null> {
      const result = await db.query<Account>(
        `UPDATE accounts
        SET archived_at = NULL
        WHERE id = $1
        RETURNING
          id, name, broker, mode, currency,
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          ) AS created_at,
          NULL::text AS archived_at`,
        [id]
      );

      return result.rows[0] ?? null;
    },
  };
};

