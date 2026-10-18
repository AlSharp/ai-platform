import type {
  Campaign,
  CreateCampaignParams,
  ListCampaignsParams,
  UpdateCampaignParams,
} from './campaigns.schema.js';

import type { Db } from '../../shared/db/db.types.js';
import { NotFoundError } from '../../shared/errors.js';

const campaignColumns = `
  id,
  account_id,
  name,
  description,
  to_char(
    created_at AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  ) AS created_at,
  CASE
    WHEN completed_at IS NULL THEN NULL
    ELSE to_char(
      completed_at AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
    )
  END AS completed_at
`;

export function createCampaignsRepository(db: Db) {
  return {
    async create(params: CreateCampaignParams): Promise<Campaign> {
      const result = await db.query<Campaign>(
        `INSERT INTO campaigns (
          account_id,
          name,
          description
        )
        VALUES ($1, $2, $3)
        RETURNING ${campaignColumns}`,
        [
          params.accountId,
          params.name,
          params.description ?? null,
        ]
      );

      return result.rows[0]!;
    },

    async findById(id: string): Promise<Campaign | null> {
      const result = await db.query<Campaign>(
        `SELECT ${campaignColumns}
         FROM campaigns
         WHERE id = $1`,
        [id]
      );

      return result.rows[0] ?? null;
    },

    async list(params: ListCampaignsParams): Promise<Campaign[]> {
      const statusCondition =
        params.status === 'active'
          ? 'AND completed_at IS NULL'
          : params.status === 'completed'
            ? 'AND completed_at IS NOT NULL'
            : '';

      const result = await db.query<Campaign>(
        `SELECT ${campaignColumns}
        FROM campaigns
        WHERE account_id = $1
        ${statusCondition}
        ORDER BY created_at DESC, id DESC`,
        [params.accountId]
      );

      return result.rows;
    },

    async complete(id: string): Promise<Campaign> {
      const result = await db.query<Campaign>(
        `UPDATE campaigns
        SET completed_at = COALESCE(completed_at, now())
        WHERE id = $1
        RETURNING ${campaignColumns}`,
        [id]
      );

      if (!result.rows[0]) {
        throw new NotFoundError('Campaign not found');
      }

      return result.rows[0];
    },

    async reopen(id: string): Promise<Campaign> {
      const result = await db.query<Campaign>(
        `UPDATE campaigns
        SET completed_at = NULL
        WHERE id = $1
        RETURNING ${campaignColumns}`,
        [id]
      );

      if (!result.rows[0]) {
        throw new NotFoundError('Campaign not found');
      }

      return result.rows[0];
    },

    async update(
      id: string,
      params: UpdateCampaignParams
    ): Promise<Campaign> {
      const result = await db.query<Campaign>(
        `UPDATE campaigns
        SET
          name = COALESCE($2, name),
          description = CASE
            WHEN $3::boolean THEN $4::text
            ELSE description
          END
        WHERE id = $1
        RETURNING ${campaignColumns}`,
        [
          id,
          params.name ?? null,
          params.description !== undefined,
          params.description ?? null,
        ]
      );

      if (!result.rows[0]) {
        throw new NotFoundError('Campaign not found');
      }

      return result.rows[0];
    },
  };
}