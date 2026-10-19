-- migrate:up

CREATE OR REPLACE FUNCTION tj_validate_lot_execution()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_lot position_lots%ROWTYPE;
  v_exec executions%ROWTYPE;
  v_leg legs%ROWTYPE;
BEGIN
  SELECT *
  INTO v_lot
  FROM position_lots
  WHERE id = NEW.position_lot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Position lot not found';
  END IF;

  SELECT *
  INTO v_exec
  FROM executions
  WHERE id = NEW.execution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Execution not found';
  END IF;

  SELECT *
  INTO v_leg
  FROM legs
  WHERE id = v_exec.leg_id;

  IF v_leg.id IS DISTINCT FROM v_lot.opening_leg_id
     OR v_leg.trade_type NOT IN (
       'BUY_TO_OPEN',
       'SELL_TO_OPEN'
     )
     OR v_exec.price <> v_lot.fill_price
     OR v_exec.executed_at <> v_lot.opened_at
  THEN
    RAISE EXCEPTION
      'Opening execution must match lot leg, fill price, and opening time';
  END IF;

  RETURN NEW;
END;
$$;

-- migrate:down

-- Intentionally no automatic rollback to the obsolete
-- orders-based implementation.