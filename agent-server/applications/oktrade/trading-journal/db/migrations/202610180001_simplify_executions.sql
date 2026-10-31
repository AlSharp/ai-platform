-- migrate:up

ALTER TABLE executions
    DROP COLUMN order_id;

ALTER TABLE executions
    ADD COLUMN leg_id UUID NOT NULL REFERENCES legs(id);

CREATE INDEX executions_leg_idx
    ON executions(leg_id);

DROP TABLE orders;


-- migrate:down

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leg_id UUID NOT NULL REFERENCES legs(id),
    broker_order_id TEXT,
    order_type TEXT NOT NULL CHECK (
        order_type IN ('MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT')
    ),
    status TEXT NOT NULL CHECK (
        status IN (
            'NEW', 'SUBMITTED', 'PARTIALLY_FILLED',
            'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'
        )
    ),
    limit_price NUMERIC(20, 6),
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT orders_limit_price_positive
        CHECK (limit_price IS NULL OR limit_price >= 0)
);

CREATE INDEX orders_leg_idx
    ON orders(leg_id);

CREATE UNIQUE INDEX orders_broker_order_unique
    ON orders(broker_order_id)
    WHERE broker_order_id IS NOT NULL;

DROP INDEX executions_leg_idx;

ALTER TABLE executions
    DROP COLUMN leg_id;

ALTER TABLE executions
    ADD COLUMN order_id UUID NOT NULL REFERENCES orders(id);

CREATE INDEX executions_order_idx
    ON executions(order_id);