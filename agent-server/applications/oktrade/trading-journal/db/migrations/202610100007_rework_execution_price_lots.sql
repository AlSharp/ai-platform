-- migrate:up
-- Phase 4.2.7: schema correction for EMPTY development position tables.
-- Run using the migration runner's transaction. Never run against populated positions.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM position_lots) OR EXISTS (SELECT 1 FROM lot_allocations)
    OR EXISTS (SELECT 1 FROM lot_relationships) THEN
   RAISE EXCEPTION 'Migration 007 requires empty position_lots, lot_allocations and lot_relationships';
 END IF;
END $$;

DROP TRIGGER tj_opening_lot_guard ON position_lots;
DROP TRIGGER tj_lot_allocation_guard ON lot_allocations;
DROP INDEX position_lots_opening_leg_unique;

ALTER TABLE position_lots ADD COLUMN fill_price NUMERIC(20,6) NOT NULL CHECK (fill_price >= 0);
ALTER TABLE position_lots ADD CONSTRAINT position_lots_leg_price_unique UNIQUE(opening_leg_id,fill_price);

CREATE TABLE position_lot_executions (
  position_lot_id UUID NOT NULL REFERENCES position_lots(id),
  execution_id UUID NOT NULL UNIQUE REFERENCES executions(id),
  PRIMARY KEY(position_lot_id,execution_id)
);
CREATE INDEX position_lot_executions_execution_idx ON position_lot_executions(execution_id);

ALTER TABLE lot_allocations DROP CONSTRAINT lot_allocations_position_lot_id_closing_leg_id_key;
DROP INDEX lot_allocations_closing_leg_idx;
ALTER TABLE lot_allocations DROP COLUMN closing_leg_id;
ALTER TABLE lot_allocations ADD COLUMN closing_execution_id UUID NOT NULL REFERENCES executions(id);
ALTER TABLE lot_allocations ADD CONSTRAINT lot_allocations_lot_execution_unique UNIQUE(position_lot_id,closing_execution_id);
CREATE INDEX lot_allocations_closing_execution_idx ON lot_allocations(closing_execution_id);

CREATE TABLE financial_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_allocation_id UUID NOT NULL UNIQUE REFERENCES lot_allocations(id) ON DELETE RESTRICT,
  realized_pl NUMERIC(20,6) NOT NULL,
  calculation_version TEXT NOT NULL CHECK (length(trim(calculation_version)) > 0),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Parent-row locks serialize concurrent lot creation, linking and allocations.
-- All writers must use READ COMMITTED; applications must retry deadlocks/serialization errors.
CREATE OR REPLACE FUNCTION tj_validate_opening_lot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_leg legs%ROWTYPE;
BEGIN
 SELECT * INTO v_leg FROM legs WHERE id=NEW.opening_leg_id FOR UPDATE;
 IF NOT FOUND OR v_leg.trade_type NOT IN ('BUY_TO_OPEN','SELL_TO_OPEN')
   OR v_leg.direction <> NEW.position_side THEN
   RAISE EXCEPTION 'Opening lot must match an opening leg and side';
 END IF;
 IF NEW.opened_quantity > v_leg.quantity THEN
   RAISE EXCEPTION 'Opening lot quantity exceeds opening leg quantity';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tj_opening_lot_guard BEFORE INSERT OR UPDATE ON position_lots
FOR EACH ROW EXECUTE FUNCTION tj_validate_opening_lot();

CREATE FUNCTION tj_validate_lot_execution() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_lot position_lots%ROWTYPE; v_exec executions%ROWTYPE; v_leg UUID; v_type TEXT;
BEGIN
 SELECT * INTO v_lot FROM position_lots WHERE id=NEW.position_lot_id FOR UPDATE;
 SELECT * INTO v_exec FROM executions WHERE id=NEW.execution_id FOR UPDATE;
 SELECT o.leg_id,l.trade_type INTO v_leg,v_type FROM orders o JOIN legs l ON l.id=o.leg_id
 WHERE o.id=v_exec.order_id;
 IF v_lot.id IS NULL OR v_exec.id IS NULL OR v_leg IS DISTINCT FROM v_lot.opening_leg_id
    OR v_type NOT IN ('BUY_TO_OPEN','SELL_TO_OPEN') OR v_exec.price <> v_lot.fill_price THEN
   RAISE EXCEPTION 'Opening execution must match lot leg and fill price';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tj_lot_execution_guard BEFORE INSERT OR UPDATE ON position_lot_executions
FOR EACH ROW EXECUTE FUNCTION tj_validate_lot_execution();

-- Deferred reconciliation permits creating the lot and associating its fills
-- in either order within ONE transaction. Each committed lot must reconcile.
CREATE FUNCTION tj_reconcile_opening_lot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_id UUID; v_opened NUMERIC(20,6); v_filled NUMERIC(20,6); v_leg_id UUID; v_leg_qty NUMERIC(20,6); v_total NUMERIC(20,6);
BEGIN
 v_id := CASE WHEN TG_TABLE_NAME='position_lots' THEN
   CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END
   ELSE CASE WHEN TG_OP='DELETE' THEN OLD.position_lot_id ELSE NEW.position_lot_id END END;
 SELECT opened_quantity,opening_leg_id INTO v_opened,v_leg_id FROM position_lots WHERE id=v_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT COALESCE(SUM(e.quantity),0) INTO v_filled FROM position_lot_executions x
 JOIN executions e ON e.id=x.execution_id WHERE x.position_lot_id=v_id;
 IF v_opened <> v_filled THEN
   RAISE EXCEPTION 'Lot % quantity % differs from associated execution quantity %',v_id,v_opened,v_filled;
 END IF;
 SELECT quantity INTO v_leg_qty FROM legs WHERE id=v_leg_id;
 SELECT COALESCE(SUM(opened_quantity),0) INTO v_total FROM position_lots WHERE opening_leg_id=v_leg_id;
 IF v_total>v_leg_qty THEN RAISE EXCEPTION 'Total opening lots exceed opening leg quantity'; END IF;
 IF TG_TABLE_NAME='position_lot_executions' AND TG_OP='UPDATE'
    AND OLD.position_lot_id IS DISTINCT FROM NEW.position_lot_id THEN
   SELECT opened_quantity INTO v_opened FROM position_lots WHERE id=OLD.position_lot_id;
   IF FOUND THEN
     SELECT COALESCE(SUM(e.quantity),0) INTO v_filled FROM position_lot_executions x
       JOIN executions e ON e.id=x.execution_id WHERE x.position_lot_id=OLD.position_lot_id;
     IF v_opened <> v_filled THEN RAISE EXCEPTION 'Previous lot no longer reconciles'; END IF;
   END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER tj_lot_quantity_reconcile AFTER INSERT OR UPDATE ON position_lots
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tj_reconcile_opening_lot();
CREATE CONSTRAINT TRIGGER tj_lot_link_reconcile AFTER INSERT OR UPDATE OR DELETE ON position_lot_executions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tj_reconcile_opening_lot();

-- Referenced fills cannot be edited or removed outside a future explicit correction workflow.
CREATE FUNCTION tj_guard_referenced_execution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM position_lot_executions WHERE execution_id=OLD.id)
    OR EXISTS (SELECT 1 FROM lot_allocations WHERE closing_execution_id=OLD.id) THEN
   RAISE EXCEPTION 'Cannot change a referenced execution; use a correction workflow';
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER tj_referenced_execution_guard BEFORE UPDATE OR DELETE ON executions
 FOR EACH ROW EXECUTE FUNCTION tj_guard_referenced_execution();

CREATE OR REPLACE FUNCTION tj_validate_lot_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_lot position_lots%ROWTYPE; v_exec executions%ROWTYPE;
 v_open legs%ROWTYPE; v_close legs%ROWTYPE;
 v_open_account UUID; v_close_account UUID;
 v_used NUMERIC(20,6); v_close_used NUMERIC(20,6);
BEGIN
 -- Consistent lock order: closing execution, then opening lot.
 SELECT * INTO v_exec FROM executions WHERE id=NEW.closing_execution_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Closing execution not found'; END IF;
 SELECT * INTO v_lot FROM position_lots WHERE id=NEW.position_lot_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Position lot not found'; END IF;
 SELECT * INTO v_open FROM legs WHERE id=v_lot.opening_leg_id;
 SELECT l.* INTO v_close FROM orders o JOIN legs l ON l.id=o.leg_id WHERE o.id=v_exec.order_id;
 IF v_close.id IS NULL OR v_close.trade_type NOT IN ('BUY_TO_CLOSE','SELL_TO_CLOSE')
    OR v_open.instrument_id <> v_close.instrument_id
    OR NOT ((v_lot.position_side='LONG' AND v_close.trade_type='SELL_TO_CLOSE')
        OR (v_lot.position_side='SHORT' AND v_close.trade_type='BUY_TO_CLOSE')) THEN
   RAISE EXCEPTION 'Closing execution does not match position lot';
 END IF;
 SELECT c.account_id INTO v_open_account FROM trades t JOIN campaigns c ON c.id=t.campaign_id
  WHERE t.id=v_open.trade_id;
 SELECT c.account_id INTO v_close_account FROM trades t JOIN campaigns c ON c.id=t.campaign_id
  WHERE t.id=v_close.trade_id;
 IF v_open_account IS DISTINCT FROM v_close_account THEN
   RAISE EXCEPTION 'Cannot allocate across accounts';
 END IF;
 SELECT COALESCE(SUM(quantity),0) INTO v_used FROM lot_allocations
 WHERE position_lot_id=NEW.position_lot_id AND id<>NEW.id;
 IF v_used+NEW.quantity > v_lot.opened_quantity THEN
   RAISE EXCEPTION 'Closing allocation exceeds remaining lot quantity';
 END IF;
 SELECT COALESCE(SUM(quantity),0) INTO v_close_used FROM lot_allocations
 WHERE closing_execution_id=NEW.closing_execution_id AND id<>NEW.id;
 IF v_close_used+NEW.quantity > v_exec.quantity THEN
   RAISE EXCEPTION 'Allocated quantity exceeds closing execution quantity';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tj_lot_allocation_guard BEFORE INSERT OR UPDATE ON lot_allocations
 FOR EACH ROW EXECUTE FUNCTION tj_validate_lot_allocation();

-- Do not silently invalidate recorded outcomes through direct allocation edits.
CREATE FUNCTION tj_guard_finalized_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM financial_outcomes WHERE lot_allocation_id=OLD.id) THEN
   RAISE EXCEPTION 'Cannot change allocation with recorded financial outcome';
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER tj_finalized_allocation_guard BEFORE UPDATE OR DELETE ON lot_allocations
 FOR EACH ROW EXECUTE FUNCTION tj_guard_finalized_allocation();

-- Prevent changing leg/order attribution after an execution is referenced.
CREATE FUNCTION tj_guard_referenced_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.leg_id IS DISTINCT FROM OLD.leg_id AND EXISTS (
   SELECT 1 FROM executions e WHERE e.order_id=OLD.id AND
   (EXISTS (SELECT 1 FROM position_lot_executions x WHERE x.execution_id=e.id)
    OR EXISTS (SELECT 1 FROM lot_allocations a WHERE a.closing_execution_id=e.id))
 ) THEN RAISE EXCEPTION 'Cannot reassign order with referenced executions'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tj_referenced_order_guard BEFORE UPDATE ON orders
 FOR EACH ROW EXECUTE FUNCTION tj_guard_referenced_order();

CREATE FUNCTION tj_guard_referenced_leg() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.trade_id,NEW.instrument_id,NEW.direction,NEW.trade_type) IS DISTINCT FROM
    (OLD.trade_id,OLD.instrument_id,OLD.direction,OLD.trade_type)
 AND (EXISTS (SELECT 1 FROM position_lots WHERE opening_leg_id=OLD.id)
   OR EXISTS (SELECT 1 FROM orders o JOIN executions e ON e.order_id=o.id
      JOIN lot_allocations a ON a.closing_execution_id=e.id WHERE o.leg_id=OLD.id)) THEN
   RAISE EXCEPTION 'Cannot reassign a leg referenced by position accounting';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tj_referenced_leg_guard BEFORE UPDATE ON legs
 FOR EACH ROW EXECUTE FUNCTION tj_guard_referenced_leg();

CREATE VIEW available_position_lots AS
SELECT p.id AS position_lot_id, p.opening_leg_id, l.trade_id AS opening_trade_id,
       c.account_id, t.campaign_id, l.instrument_id, p.position_side,
       p.fill_price, p.opened_quantity,
       p.opened_quantity-COALESCE(SUM(a.quantity),0) AS remaining_quantity
FROM position_lots p
JOIN legs l ON l.id=p.opening_leg_id
JOIN trades t ON t.id=l.trade_id
JOIN campaigns c ON c.id=t.campaign_id
LEFT JOIN lot_allocations a ON a.position_lot_id=p.id
GROUP BY p.id,l.trade_id,c.account_id,t.campaign_id,l.instrument_id;

-- migrate:down
-- Development-only rollback; empty position tables required to avoid data loss.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM position_lots) OR EXISTS (SELECT 1 FROM lot_allocations)
    OR EXISTS (SELECT 1 FROM lot_relationships) OR EXISTS (SELECT 1 FROM financial_outcomes) THEN
   RAISE EXCEPTION 'Rollback 007 requires empty position and financial outcome tables';
 END IF;
END $$;
DROP VIEW available_position_lots;
DROP TRIGGER tj_referenced_leg_guard ON legs;
DROP FUNCTION tj_guard_referenced_leg();
DROP TRIGGER tj_referenced_order_guard ON orders;
DROP FUNCTION tj_guard_referenced_order();
DROP TRIGGER tj_finalized_allocation_guard ON lot_allocations;
DROP FUNCTION tj_guard_finalized_allocation();
DROP TRIGGER tj_referenced_execution_guard ON executions;
DROP FUNCTION tj_guard_referenced_execution();
DROP TRIGGER tj_lot_link_reconcile ON position_lot_executions;
DROP TRIGGER tj_lot_quantity_reconcile ON position_lots;
DROP FUNCTION tj_reconcile_opening_lot();
DROP TRIGGER tj_lot_execution_guard ON position_lot_executions;
DROP FUNCTION tj_validate_lot_execution();
DROP TRIGGER tj_lot_allocation_guard ON lot_allocations;
DROP TRIGGER tj_opening_lot_guard ON position_lots;
DROP TABLE financial_outcomes;
DROP TABLE position_lot_executions;
ALTER TABLE lot_allocations DROP CONSTRAINT lot_allocations_lot_execution_unique;
DROP INDEX lot_allocations_closing_execution_idx;
ALTER TABLE lot_allocations DROP COLUMN closing_execution_id;
ALTER TABLE lot_allocations ADD COLUMN closing_leg_id UUID NOT NULL REFERENCES legs(id);
ALTER TABLE lot_allocations ADD CONSTRAINT lot_allocations_position_lot_id_closing_leg_id_key
 UNIQUE(position_lot_id,closing_leg_id);
CREATE INDEX lot_allocations_closing_leg_idx ON lot_allocations(closing_leg_id);
ALTER TABLE position_lots DROP CONSTRAINT position_lots_leg_price_unique;
ALTER TABLE position_lots DROP COLUMN fill_price;
CREATE UNIQUE INDEX position_lots_opening_leg_unique ON position_lots(opening_leg_id);

-- Restore the migration 006 functions under their original names.
CREATE OR REPLACE FUNCTION tj_validate_opening_lot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_leg legs%ROWTYPE;
BEGIN
 SELECT * INTO v_leg FROM legs WHERE id=NEW.opening_leg_id;
 IF NOT FOUND OR v_leg.trade_type NOT IN ('BUY_TO_OPEN','SELL_TO_OPEN')
    OR v_leg.direction<>NEW.position_side OR NEW.opened_quantity>v_leg.quantity THEN
  RAISE EXCEPTION 'Opening lot must match opening leg side and quantity';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tj_opening_lot_guard BEFORE INSERT OR UPDATE ON position_lots
 FOR EACH ROW EXECUTE FUNCTION tj_validate_opening_lot();

CREATE OR REPLACE FUNCTION tj_validate_lot_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_lot position_lots%ROWTYPE; v_open legs%ROWTYPE; v_close legs%ROWTYPE;
 v_open_account UUID; v_close_account UUID; v_used NUMERIC(20,6); v_close_used NUMERIC(20,6);
BEGIN
 SELECT * INTO v_lot FROM position_lots WHERE id=NEW.position_lot_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Position lot not found'; END IF;
 SELECT * INTO v_open FROM legs WHERE id=v_lot.opening_leg_id;
 SELECT * INTO v_close FROM legs WHERE id=NEW.closing_leg_id;
 IF NOT FOUND OR v_close.trade_type NOT IN ('BUY_TO_CLOSE','SELL_TO_CLOSE')
    OR v_open.instrument_id<>v_close.instrument_id
    OR NOT ((v_lot.position_side='LONG' AND v_close.trade_type='SELL_TO_CLOSE')
      OR (v_lot.position_side='SHORT' AND v_close.trade_type='BUY_TO_CLOSE')) THEN
   RAISE EXCEPTION 'Closing leg does not match position lot';
 END IF;
 SELECT c.account_id INTO v_open_account FROM trades t JOIN campaigns c ON c.id=t.campaign_id WHERE t.id=v_open.trade_id;
 SELECT c.account_id INTO v_close_account FROM trades t JOIN campaigns c ON c.id=t.campaign_id WHERE t.id=v_close.trade_id;
 IF v_open_account IS DISTINCT FROM v_close_account THEN RAISE EXCEPTION 'Cannot allocate across accounts'; END IF;
 SELECT COALESCE(SUM(quantity),0) INTO v_used FROM lot_allocations WHERE position_lot_id=NEW.position_lot_id AND id<>NEW.id;
 IF v_used+NEW.quantity>v_lot.opened_quantity THEN RAISE EXCEPTION 'Closing allocation exceeds remaining lot quantity'; END IF;
 PERFORM 1 FROM legs WHERE id=NEW.closing_leg_id FOR UPDATE;
 SELECT COALESCE(SUM(quantity),0) INTO v_close_used FROM lot_allocations WHERE closing_leg_id=NEW.closing_leg_id AND id<>NEW.id;
 IF v_close_used+NEW.quantity>v_close.quantity THEN RAISE EXCEPTION 'Allocated quantity exceeds closing leg quantity'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tj_lot_allocation_guard BEFORE INSERT OR UPDATE ON lot_allocations
 FOR EACH ROW EXECUTE FUNCTION tj_validate_lot_allocation();
