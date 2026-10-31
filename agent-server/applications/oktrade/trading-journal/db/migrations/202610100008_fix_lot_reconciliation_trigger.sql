-- migrate:up
-- Fix deferred reconciliation for INSERT/UPDATE/DELETE trigger records.
-- PostgreSQL does not provide OLD for INSERT or NEW for DELETE.
-- Reconcile both lots when an execution association moves between lots.
CREATE OR REPLACE FUNCTION tj_reconcile_opening_lot()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_id UUID;
    v_previous_id UUID;
    v_opened NUMERIC(20,6);
    v_filled NUMERIC(20,6);
    v_leg_id UUID;
    v_leg_qty NUMERIC(20,6);
    v_total NUMERIC(20,6);
BEGIN
    IF TG_TABLE_NAME = 'position_lots' THEN
        IF TG_OP = 'DELETE' THEN
            v_id := OLD.id;
        ELSE
            v_id := NEW.id;
        END IF;
    ELSIF TG_TABLE_NAME = 'position_lot_executions' THEN
        IF TG_OP = 'DELETE' THEN
            v_id := OLD.position_lot_id;
        ELSE
            v_id := NEW.position_lot_id;
        END IF;
        IF TG_OP = 'UPDATE' THEN
            v_previous_id := OLD.position_lot_id;
        END IF;
    ELSE
        RAISE EXCEPTION 'Unexpected reconciliation trigger table: %', TG_TABLE_NAME;
    END IF;

    -- Deferred triggers see the transaction's final state.
    -- If a lot was deleted, there is no remaining lot to reconcile.
    SELECT opened_quantity, opening_leg_id INTO v_opened, v_leg_id
    FROM position_lots WHERE id = v_id;
    IF FOUND THEN
        SELECT COALESCE(SUM(e.quantity), 0) INTO v_filled
        FROM position_lot_executions x
        JOIN executions e ON e.id = x.execution_id
        WHERE x.position_lot_id = v_id;
        IF v_opened <> v_filled THEN
            RAISE EXCEPTION 'Lot % quantity % differs from associated execution quantity %',
                v_id, v_opened, v_filled;
        END IF;
        SELECT quantity INTO v_leg_qty FROM legs WHERE id = v_leg_id;
        SELECT COALESCE(SUM(opened_quantity), 0) INTO v_total
        FROM position_lots WHERE opening_leg_id = v_leg_id;
        IF v_total > v_leg_qty THEN
            RAISE EXCEPTION 'Total opening lots exceed opening leg quantity';
        END IF;
    END IF;

    IF v_previous_id IS NOT NULL AND v_previous_id IS DISTINCT FROM v_id THEN
        SELECT opened_quantity INTO v_opened FROM position_lots WHERE id = v_previous_id;
        IF FOUND THEN
            SELECT COALESCE(SUM(e.quantity), 0) INTO v_filled
            FROM position_lot_executions x
            JOIN executions e ON e.id = x.execution_id
            WHERE x.position_lot_id = v_previous_id;
            IF v_opened <> v_filled THEN
                RAISE EXCEPTION 'Previous lot % quantity % differs from associated execution quantity %',
                    v_previous_id, v_opened, v_filled;
            END IF;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

-- migrate:down
-- Restore the implementation from migration 007 (including its original bug).
CREATE OR REPLACE FUNCTION tj_reconcile_opening_lot()
RETURNS trigger LANGUAGE plpgsql AS $$
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
