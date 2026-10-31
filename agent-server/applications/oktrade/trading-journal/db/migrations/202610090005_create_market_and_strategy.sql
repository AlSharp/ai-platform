-- migrate:up

CREATE TABLE strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, name)
);

CREATE TABLE strategy_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID NOT NULL REFERENCES strategies(id),
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    rules JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(rules) = 'object'),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (strategy_id, version_number)
);

-- An analysis may consider several strategy versions.
CREATE TABLE analysis_strategies (
    analysis_id UUID NOT NULL REFERENCES journal_entries(id),
    strategy_version_id UUID NOT NULL REFERENCES strategy_versions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (analysis_id, strategy_version_id)
);
CREATE INDEX analysis_strategies_version_idx
    ON analysis_strategies(strategy_version_id);

-- Evaluations refer to an existing analysis/strategy association.
CREATE TABLE strategy_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID NOT NULL,
    strategy_version_id UUID NOT NULL,
    assessment TEXT NOT NULL CHECK (length(trim(assessment)) > 0),
    verdict TEXT NOT NULL CHECK (
        verdict IN ('QUALIFIED', 'REJECTED', 'INCONCLUSIVE')
    ),
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(metrics) = 'object'),
    evaluated_at TIMESTAMPTZ,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (analysis_id, strategy_version_id)
        REFERENCES analysis_strategies(analysis_id, strategy_version_id)
);
CREATE INDEX strategy_evaluations_pair_idx
    ON strategy_evaluations(analysis_id, strategy_version_id);

-- Immutable/versioned S3 CSV objects containing historical candles.
CREATE TABLE ohlcv_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_id UUID NOT NULL REFERENCES instruments(id),
    timeframe TEXT NOT NULL CHECK (timeframe IN ('1m', '1d')),
    bucket TEXT NOT NULL CHECK (length(trim(bucket)) > 0),
    object_key TEXT NOT NULL CHECK (length(trim(object_key)) > 0),
    object_version TEXT,
    source TEXT,
    range_start TIMESTAMPTZ NOT NULL,
    range_end TIMESTAMPTZ NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (range_end >= range_start),
    UNIQUE (bucket, object_key, object_version)
);
CREATE INDEX ohlcv_datasets_instrument_time_idx
    ON ohlcv_datasets(instrument_id, timeframe, range_start, range_end);

-- A chart context describes exactly one displayed chart configuration.
CREATE TABLE chart_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timeframe TEXT NOT NULL CHECK (timeframe IN ('1m', '1d')),
    settings JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(settings) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Each snapshot has exactly one chart context (not shared).
CREATE TABLE market_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_id UUID NOT NULL REFERENCES instruments(id),
    trade_id UUID REFERENCES trades(id),
    journal_entry_id UUID REFERENCES journal_entries(id),
    snapshot_type TEXT NOT NULL CHECK (
        snapshot_type IN ('OPEN', 'CLOSE', 'AFTER_CLOSE', 'ANALYSIS')
    ),
    observed_at TIMESTAMPTZ NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    chart_context_id UUID NOT NULL UNIQUE REFERENCES chart_contexts(id),
    CHECK (trade_id IS NOT NULL OR journal_entry_id IS NOT NULL)
);
CREATE INDEX market_snapshots_instrument_time_idx
    ON market_snapshots(instrument_id, observed_at);
CREATE INDEX market_snapshots_trade_idx ON market_snapshots(trade_id);
CREATE INDEX market_snapshots_entry_idx ON market_snapshots(journal_entry_id);

-- A snapshot may use zero or multiple S3 datasets, shared across snapshots.
CREATE TABLE market_snapshot_datasets (
    snapshot_id UUID NOT NULL REFERENCES market_snapshots(id),
    dataset_id UUID NOT NULL REFERENCES ohlcv_datasets(id),
    PRIMARY KEY (snapshot_id, dataset_id)
);
CREATE INDEX market_snapshot_datasets_dataset_idx
    ON market_snapshot_datasets(dataset_id);

-- migrate:down
DROP TABLE market_snapshot_datasets;
DROP TABLE market_snapshots;
DROP TABLE chart_contexts;
DROP TABLE ohlcv_datasets;
DROP TABLE strategy_evaluations;
DROP TABLE analysis_strategies;
DROP TABLE strategy_versions;
DROP TABLE strategies;
