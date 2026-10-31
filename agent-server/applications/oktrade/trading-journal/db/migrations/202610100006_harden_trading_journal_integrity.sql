-- migrate:up

-- 1. Disallow multiple opening lots for the same opening leg; ensure leg semantics.
CREATE UNIQUE INDEX position_lots_opening_leg_unique ON position_lots(opening_leg_id);

CREATE FUNCTION tj_validate_opening_lot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_leg legs%ROWTYPE;
BEGIN
    SELECT * INTO v_leg FROM legs WHERE id = NEW.opening_leg_id;
    IF NOT FOUND OR v_leg.trade_type NOT IN ('BUY_TO_OPEN','SELL_TO_OPEN')
       OR v_leg.direction <> NEW.position_side
       OR NEW.opened_quantity > v_leg.quantity THEN
        RAISE EXCEPTION 'Opening lot must match opening leg side and quantity';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER tj_opening_lot_guard BEFORE INSERT OR UPDATE ON position_lots
FOR EACH ROW EXECUTE FUNCTION tj_validate_opening_lot();

-- 2. Validate lot allocations and serialize allocations per lot.
-- Locking the parent lot ensures two concurrent transactions cannot both
-- allocate the same remaining quantity.
CREATE FUNCTION tj_validate_lot_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_lot position_lots%ROWTYPE;
    v_open legs%ROWTYPE;
    v_close legs%ROWTYPE;
    v_open_account UUID;
    v_close_account UUID;
    v_used NUMERIC(20,6);
    v_close_used NUMERIC(20,6);
BEGIN
    SELECT * INTO v_lot FROM position_lots WHERE id = NEW.position_lot_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Position lot not found'; END IF;
    SELECT * INTO v_open FROM legs WHERE id = v_lot.opening_leg_id;
    SELECT * INTO v_close FROM legs WHERE id = NEW.closing_leg_id;
    IF NOT FOUND OR v_close.trade_type NOT IN ('BUY_TO_CLOSE','SELL_TO_CLOSE')
       OR v_open.instrument_id <> v_close.instrument_id
       OR NOT ((v_lot.position_side = 'LONG' AND v_close.trade_type = 'SELL_TO_CLOSE')
           OR (v_lot.position_side = 'SHORT' AND v_close.trade_type = 'BUY_TO_CLOSE')) THEN
        RAISE EXCEPTION 'Closing leg does not match position lot';
    END IF;
    SELECT c.account_id INTO v_open_account FROM trades t JOIN campaigns c ON c.id=t.campaign_id WHERE t.id=v_open.trade_id;
    SELECT c.account_id INTO v_close_account FROM trades t JOIN campaigns c ON c.id=t.campaign_id WHERE t.id=v_close.trade_id;
    IF v_open_account IS DISTINCT FROM v_close_account THEN
        RAISE EXCEPTION 'Cannot allocate across accounts';
    END IF;
    SELECT COALESCE(sum(quantity),0) INTO v_used FROM lot_allocations
      WHERE position_lot_id=NEW.position_lot_id AND id <> NEW.id;
    IF v_used + NEW.quantity > v_lot.opened_quantity THEN
        RAISE EXCEPTION 'Closing allocation exceeds remaining lot quantity';
    END IF;
    -- Lock the closing leg to serialize allocations from different lots.
    PERFORM 1 FROM legs WHERE id = NEW.closing_leg_id FOR UPDATE;
    SELECT COALESCE(sum(quantity),0) INTO v_close_used FROM lot_allocations
      WHERE closing_leg_id=NEW.closing_leg_id AND id <> NEW.id;
    IF v_close_used + NEW.quantity > v_close.quantity THEN
        RAISE EXCEPTION 'Allocated quantity exceeds closing leg quantity';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER tj_lot_allocation_guard BEFORE INSERT OR UPDATE ON lot_allocations
FOR EACH ROW EXECUTE FUNCTION tj_validate_lot_allocation();

-- 3. Ensure coverage/roll relationships stay within the same account.
CREATE FUNCTION tj_validate_lot_relationship() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a UUID; b UUID;
BEGIN
    SELECT c.account_id INTO a FROM position_lots p JOIN legs l ON l.id=p.opening_leg_id
      JOIN trades t ON t.id=l.trade_id JOIN campaigns c ON c.id=t.campaign_id
      WHERE p.id=NEW.source_lot_id;
    SELECT c.account_id INTO b FROM position_lots p JOIN legs l ON l.id=p.opening_leg_id
      JOIN trades t ON t.id=l.trade_id JOIN campaigns c ON c.id=t.campaign_id
      WHERE p.id=NEW.target_lot_id;
    IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'Lot relationship crosses accounts'; END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER tj_lot_relationship_guard BEFORE INSERT OR UPDATE ON lot_relationships
FOR EACH ROW EXECUTE FUNCTION tj_validate_lot_relationship();

-- 4. Validate reasoning/trade and reasoning/strategy ownership and type.
CREATE FUNCTION tj_validate_entry_trade() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_type TEXT; v_entry_account UUID; v_trade_account UUID;
BEGIN
    SELECT entry_type,account_id INTO v_type,v_entry_account FROM journal_entries WHERE id=NEW.journal_entry_id;
    SELECT c.account_id INTO v_trade_account FROM trades t JOIN campaigns c ON c.id=t.campaign_id WHERE t.id=NEW.trade_id;
    IF v_entry_account IS DISTINCT FROM v_trade_account THEN
        RAISE EXCEPTION 'Journal entry and trade must belong to same account';
    END IF;
    IF NEW.relationship_type = 'SUPPORTS_TRADE' AND v_type <> 'ANALYSIS' THEN
        RAISE EXCEPTION 'SUPPORTS_TRADE requires ANALYSIS entry';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER tj_entry_trade_guard BEFORE INSERT OR UPDATE ON journal_entry_trades
FOR EACH ROW EXECUTE FUNCTION tj_validate_entry_trade();

CREATE FUNCTION tj_validate_analysis_strategy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_type TEXT; a UUID; b UUID;
BEGIN
    SELECT entry_type,account_id INTO v_type,a FROM journal_entries WHERE id=NEW.analysis_id;
    SELECT s.account_id INTO b FROM strategy_versions sv JOIN strategies s ON s.id=sv.strategy_id
      WHERE sv.id=NEW.strategy_version_id;
    IF v_type <> 'ANALYSIS' THEN RAISE EXCEPTION 'Strategy link requires ANALYSIS entry'; END IF;
    IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'Analysis and strategy must belong to same account'; END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER tj_analysis_strategy_guard BEFORE INSERT OR UPDATE ON analysis_strategies
FOR EACH ROW EXECUTE FUNCTION tj_validate_analysis_strategy();

CREATE FUNCTION tj_validate_entry_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a UUID; b UUID;
BEGIN
    SELECT account_id INTO a FROM journal_entries WHERE id=NEW.source_entry_id;
    SELECT account_id INTO b FROM journal_entries WHERE id=NEW.target_entry_id;
    IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'Journal entries must belong to same account'; END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER tj_entry_link_guard BEFORE INSERT OR UPDATE ON journal_entry_links
FOR EACH ROW EXECUTE FUNCTION tj_validate_entry_link();

-- 5. Chart evidence must match snapshot instrument/timeframe and must not
-- introduce candles from after the snapshot observation time.
CREATE FUNCTION tj_validate_snapshot_dataset() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_snapshot market_snapshots%ROWTYPE; v_dataset ohlcv_datasets%ROWTYPE; v_timeframe TEXT;
BEGIN
    SELECT * INTO v_snapshot FROM market_snapshots WHERE id=NEW.snapshot_id;
    SELECT * INTO v_dataset FROM ohlcv_datasets WHERE id=NEW.dataset_id;
    SELECT timeframe INTO v_timeframe FROM chart_contexts WHERE id=v_snapshot.chart_context_id;
    IF v_snapshot.instrument_id <> v_dataset.instrument_id OR v_timeframe <> v_dataset.timeframe THEN
        RAISE EXCEPTION 'Dataset instrument/timeframe does not match snapshot chart';
    END IF;
    -- Datasets may contain later candles; callers MUST filter at observed_at.
    IF v_dataset.range_start > v_snapshot.observed_at THEN
        RAISE EXCEPTION 'Dataset begins after snapshot observation';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER tj_snapshot_dataset_guard BEFORE INSERT OR UPDATE ON market_snapshot_datasets
FOR EACH ROW EXECUTE FUNCTION tj_validate_snapshot_dataset();

-- 6. Validate snapshot ownership when linked to both trade and journal entry.
CREATE FUNCTION tj_validate_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a UUID; b UUID;
BEGIN
    IF NEW.trade_id IS NOT NULL AND NEW.journal_entry_id IS NOT NULL THEN
        SELECT c.account_id INTO a FROM trades t JOIN campaigns c ON c.id=t.campaign_id WHERE t.id=NEW.trade_id;
        SELECT account_id INTO b FROM journal_entries WHERE id=NEW.journal_entry_id;
        IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'Snapshot links cross accounts'; END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER tj_snapshot_guard BEFORE INSERT OR UPDATE ON market_snapshots
FOR EACH ROW EXECUTE FUNCTION tj_validate_snapshot();

-- A null S3 version is not a distinct version; deduplicate unversioned objects.
CREATE UNIQUE INDEX ohlcv_datasets_unversioned_unique ON ohlcv_datasets(bucket,object_key)
WHERE object_version IS NULL;

-- One evaluation per analysis/strategy pair at a given recorded instant;
-- repeated evaluations at different times remain possible.
CREATE UNIQUE INDEX strategy_evaluations_pair_recorded_unique
ON strategy_evaluations(analysis_id,strategy_version_id,recorded_at);

-- migrate:down
DROP INDEX strategy_evaluations_pair_recorded_unique;
DROP INDEX ohlcv_datasets_unversioned_unique;
DROP TRIGGER tj_snapshot_guard ON market_snapshots;
DROP FUNCTION tj_validate_snapshot();
DROP TRIGGER tj_snapshot_dataset_guard ON market_snapshot_datasets;
DROP FUNCTION tj_validate_snapshot_dataset();
DROP TRIGGER tj_entry_link_guard ON journal_entry_links;
DROP FUNCTION tj_validate_entry_link();
DROP TRIGGER tj_analysis_strategy_guard ON analysis_strategies;
DROP FUNCTION tj_validate_analysis_strategy();
DROP TRIGGER tj_entry_trade_guard ON journal_entry_trades;
DROP FUNCTION tj_validate_entry_trade();
DROP TRIGGER tj_lot_relationship_guard ON lot_relationships;
DROP FUNCTION tj_validate_lot_relationship();
DROP TRIGGER tj_lot_allocation_guard ON lot_allocations;
DROP FUNCTION tj_validate_lot_allocation();
DROP TRIGGER tj_opening_lot_guard ON position_lots;
DROP FUNCTION tj_validate_opening_lot();
DROP INDEX position_lots_opening_leg_unique;
