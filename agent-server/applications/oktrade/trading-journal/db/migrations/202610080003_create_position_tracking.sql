
-- migrate:up

-- Explicit trade direction from the manual entry UI.
ALTER TABLE legs
ADD COLUMN trade_type TEXT NOT NULL DEFAULT 'BUY_TO_OPEN'
CHECK (
    trade_type IN (
        'BUY_TO_OPEN',
        'SELL_TO_OPEN',
        'BUY_TO_CLOSE',
        'SELL_TO_CLOSE'
    )
);

-- Remove the default after migration so new legs
-- must explicitly specify their trade type.
ALTER TABLE legs
ALTER COLUMN trade_type DROP DEFAULT;

ALTER TABLE legs
ADD CONSTRAINT legs_direction_matches_trade_type
CHECK (
    (trade_type IN ('BUY_TO_OPEN', 'SELL_TO_CLOSE')
        AND direction = 'LONG')
    OR
    (trade_type IN ('SELL_TO_OPEN', 'BUY_TO_CLOSE')
        AND direction = 'SHORT')
);

-- An opening lot represents a historical position opening.
CREATE TABLE position_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    opening_leg_id UUID NOT NULL REFERENCES legs(id),

    position_side TEXT NOT NULL CHECK (
        position_side IN ('LONG', 'SHORT')
    ),

    opened_quantity NUMERIC(20, 6) NOT NULL
        CHECK (opened_quantity > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A closing leg consumes quantity from an opening lot.
CREATE TABLE lot_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    position_lot_id UUID NOT NULL
        REFERENCES position_lots(id),

    closing_leg_id UUID NOT NULL
        REFERENCES legs(id),

    quantity NUMERIC(20, 6) NOT NULL
        CHECK (quantity > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (position_lot_id, closing_leg_id)
);

-- Relationships do not consume position quantity.
-- Example: a covered call references its stock lot.
CREATE TABLE lot_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source_lot_id UUID NOT NULL
        REFERENCES position_lots(id),

    target_lot_id UUID NOT NULL
        REFERENCES position_lots(id),

    relationship_type TEXT NOT NULL CHECK (
        relationship_type IN (
            'COVERED_BY',
            'ROLLED_FROM',
            'RELATED'
        )
    ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (source_lot_id <> target_lot_id),

    UNIQUE (
        source_lot_id,
        target_lot_id,
        relationship_type
    )
);

CREATE INDEX position_lots_opening_leg_idx
    ON position_lots(opening_leg_id);

CREATE INDEX lot_allocations_lot_idx
    ON lot_allocations(position_lot_id);

CREATE INDEX lot_allocations_closing_leg_idx
    ON lot_allocations(closing_leg_id);

CREATE INDEX lot_relationships_target_idx
    ON lot_relationships(target_lot_id);

-- migrate:down

DROP TABLE lot_relationships;
DROP TABLE lot_allocations;
DROP TABLE position_lots;

ALTER TABLE legs DROP COLUMN trade_type;
