
-- migrate:up

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    broker TEXT,
    mode TEXT NOT NULL
        CHECK (mode IN ('LIVE', 'PAPER')),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT accounts_name_not_empty
        CHECK (length(trim(name)) > 0)
);

CREATE TABLE actors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL
        CHECK (role IN (
            'HUMAN',
            'TRADING_BOT',
            'AI_ANALYST',
            'SYSTEM'
        )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT actors_name_not_empty
        CHECK (length(trim(name)) > 0)
);

CREATE TABLE instruments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    symbol TEXT NOT NULL,
    instrument_type TEXT NOT NULL
        CHECK (instrument_type IN ('STOCK', 'OPTION')),

    underlying_instrument_id UUID
        REFERENCES instruments(id),

    option_type TEXT
        CHECK (option_type IN ('CALL', 'PUT')),

    expiration_date DATE,
    strike NUMERIC(20, 6),
    multiplier NUMERIC(20, 6) NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT instruments_symbol_not_empty
        CHECK (length(trim(symbol)) > 0),

    CONSTRAINT instruments_multiplier_positive
        CHECK (multiplier > 0),

    CONSTRAINT instruments_valid_definition CHECK (
        (
            instrument_type = 'STOCK'
            AND underlying_instrument_id IS NULL
            AND option_type IS NULL
            AND expiration_date IS NULL
            AND strike IS NULL
        )
        OR
        (
            instrument_type = 'OPTION'
            AND underlying_instrument_id IS NOT NULL
            AND option_type IS NOT NULL
            AND expiration_date IS NOT NULL
            AND strike > 0
        )
    )
);

CREATE UNIQUE INDEX instruments_stock_symbol_unique
    ON instruments (symbol)
    WHERE instrument_type = 'STOCK';

CREATE UNIQUE INDEX instruments_option_contract_unique
    ON instruments (
        underlying_instrument_id,
        option_type,
        expiration_date,
        strike
    )
    WHERE instrument_type = 'OPTION';

CREATE INDEX instruments_underlying_idx
    ON instruments (underlying_instrument_id)
    WHERE underlying_instrument_id IS NOT NULL;

-- migrate:down

DROP TABLE IF EXISTS instruments;
DROP TABLE IF EXISTS actors;
DROP TABLE IF EXISTS accounts;
