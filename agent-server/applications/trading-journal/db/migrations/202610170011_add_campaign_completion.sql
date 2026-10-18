-- migrate:up

ALTER TABLE campaigns
ADD COLUMN completed_at TIMESTAMPTZ;

CREATE INDEX campaigns_active_account_idx
ON campaigns(account_id)
WHERE completed_at IS NULL;

-- migrate:down

DROP INDEX campaigns_active_account_idx;

ALTER TABLE campaigns
DROP COLUMN completed_at;