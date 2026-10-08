
-- migrate:up

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    actor_id UUID NOT NULL REFERENCES actors(id),
    source TEXT NOT NULL CHECK (
        source IN ('MANUAL', 'BROKER_IMPORT', 'API')
    ),
    action_type TEXT NOT NULL CHECK (
        action_type IN (
            'MANUAL', 'ASSIGNMENT', 'EXERCISE', 'EXPIRATION'
        )
    ),
    occurred_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE legs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID NOT NULL REFERENCES trades(id),
    instrument_id UUID NOT NULL REFERENCES instruments(id),
    direction TEXT NOT NULL CHECK (
        direction IN ('LONG', 'SHORT')
    ),
    quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    broker_execution_id TEXT,
    quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
    price NUMERIC(20, 6) NOT NULL CHECK (price >= 0),
    fees NUMERIC(20, 6) NOT NULL DEFAULT 0
        CHECK (fees >= 0),
    executed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX campaigns_account_idx
    ON campaigns(account_id);

CREATE INDEX trades_campaign_occurred_idx
    ON trades(campaign_id, occurred_at);

CREATE INDEX trades_actor_idx
    ON trades(actor_id);

CREATE INDEX legs_trade_idx
    ON legs(trade_id);

CREATE INDEX legs_instrument_idx
    ON legs(instrument_id);

CREATE INDEX orders_leg_idx
    ON orders(leg_id);

CREATE UNIQUE INDEX orders_broker_order_unique
    ON orders(broker_order_id)
    WHERE broker_order_id IS NOT NULL;

CREATE INDEX executions_order_idx
    ON executions(order_id);

CREATE UNIQUE INDEX executions_broker_execution_unique
    ON executions(broker_execution_id)
    WHERE broker_execution_id IS NOT NULL;

-- migrate:down

DROP TABLE executions;
DROP TABLE orders;
DROP TABLE legs;
DROP TABLE trades;
DROP TABLE campaigns;
