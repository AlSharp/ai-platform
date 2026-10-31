import type {
  AccountRecord,
  CreateAccountRequest,
  UpdateAccountRequest,
  ListAccountsQuery
} from './accounts.schema.js';
import type { Db } from '../../shared/db/db.types.js';

export function createAccountsRepository(db: Db) {
  return {
    async findAll(
      status: ListAccountsQuery['status'],
    ): Promise<AccountRecord[]> {
      const result = await db.query<AccountRecord>(
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
    async create(input: CreateAccountRequest): Promise<AccountRecord> {
      const result = await db.query<AccountRecord>(
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
    async findById(id: string): Promise<AccountRecord | null> {
      const result = await db.query<AccountRecord>(
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
      input: UpdateAccountRequest
    ): Promise<AccountRecord | null> {
      const result = await db.query<AccountRecord>(
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

    async archive(id: string): Promise<AccountRecord | null> {
      const result = await db.query<AccountRecord>(
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

    async restore(id: string): Promise<AccountRecord | null> {
      const result = await db.query<AccountRecord>(
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

