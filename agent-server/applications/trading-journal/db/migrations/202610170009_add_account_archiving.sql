-- migrate:up

ALTER TABLE accounts
ADD COLUMN archived_at TIMESTAMPTZ;

-- migrate:down

ALTER TABLE accounts
DROP COLUMN archived_at;