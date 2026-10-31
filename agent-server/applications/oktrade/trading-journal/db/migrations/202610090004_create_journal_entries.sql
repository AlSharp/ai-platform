
-- migrate:up

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    account_id UUID NOT NULL REFERENCES accounts(id),
    campaign_id UUID REFERENCES campaigns(id),
    actor_id UUID NOT NULL REFERENCES actors(id),

    entry_type TEXT NOT NULL CHECK (
        entry_type IN ('ANALYSIS', 'DECISION', 'REFLECTION')
    ),

    title TEXT,
    content TEXT NOT NULL
        CHECK (length(trim(content)) > 0),

    -- When the reasoning actually occurred, if known.
    occurred_at TIMESTAMPTZ,

    -- When the entry was documented.
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT journal_entry_title_not_empty
        CHECK (title IS NULL OR length(trim(title)) > 0)
);

-- Relationships between reasoning entries.
CREATE TABLE journal_entry_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source_entry_id UUID NOT NULL
        REFERENCES journal_entries(id),

    target_entry_id UUID NOT NULL
        REFERENCES journal_entries(id),

    relationship_type TEXT NOT NULL CHECK (
        relationship_type IN (
            'SUPPORTS',
            'CHALLENGES',
            'REVISES',
            'REFERENCES'
        )
    ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (source_entry_id <> target_entry_id),

    UNIQUE (
        source_entry_id,
        target_entry_id,
        relationship_type
    )
);

-- Connect reasoning to actual trades.
CREATE TABLE journal_entry_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    journal_entry_id UUID NOT NULL
        REFERENCES journal_entries(id),

    trade_id UUID NOT NULL REFERENCES trades(id),

    relationship_type TEXT NOT NULL CHECK (
        relationship_type IN (
            'SUPPORTS_TRADE',
            'EXPLAINS_DECISION',
            'EVALUATES_TRADE',
            'REFERENCES_TRADE'
        )
    ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (
        journal_entry_id,
        trade_id,
        relationship_type
    )
);

CREATE INDEX journal_entries_account_idx
    ON journal_entries(account_id, recorded_at);

CREATE INDEX journal_entries_campaign_idx
    ON journal_entries(campaign_id);

CREATE INDEX journal_entries_actor_idx
    ON journal_entries(actor_id);

CREATE INDEX journal_entry_links_target_idx
    ON journal_entry_links(target_entry_id);

CREATE INDEX journal_entry_trades_trade_idx
    ON journal_entry_trades(trade_id);

-- migrate:down

DROP TABLE journal_entry_trades;
DROP TABLE journal_entry_links;
DROP TABLE journal_entries;
