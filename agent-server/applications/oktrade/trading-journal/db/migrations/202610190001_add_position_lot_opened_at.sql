-- migrate:up

ALTER TABLE position_lots
    ADD COLUMN opened_at TIMESTAMPTZ;

UPDATE position_lots pl
SET opened_at = e.executed_at
FROM position_lot_executions ple
JOIN executions e
    ON e.id = ple.execution_id
WHERE ple.position_lot_id = pl.id;

ALTER TABLE position_lots
    ALTER COLUMN opened_at SET NOT NULL;


-- migrate:down

ALTER TABLE position_lots
    DROP COLUMN opened_at;