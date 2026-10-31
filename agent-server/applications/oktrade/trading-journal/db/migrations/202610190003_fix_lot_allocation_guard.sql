-- migrate:up

CREATE OR REPLACE FUNCTION tj_validate_lot_allocation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_lot position_lots%ROWTYPE;
  v_exec executions%ROWTYPE;
  v_open legs%ROWTYPE;
  v_close legs%ROWTYPE;
  v_open_account UUID;
  v_close_account UUID;
  v_used NUMERIC(20,6);
  v_close_used NUMERIC(20,6);
BEGIN
  -- Preserve the existing lock order.
  SELECT * INTO v_exec
  FROM executions
  WHERE id = NEW.closing_execution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Closing execution not found';
  END IF;

  SELECT * INTO v_lot
  FROM position_lots
  WHERE id = NEW.position_lot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Position lot not found';
  END IF;

  SELECT * INTO v_open
  FROM legs
  WHERE id = v_lot.opening_leg_id;

  -- Execution now references its leg directly.
  SELECT * INTO v_close
  FROM legs
  WHERE id = v_exec.leg_id;

  IF v_close.id IS NULL
     OR v_close.trade_type NOT IN ('BUY_TO_CLOSE', 'SELL_TO_CLOSE')
     OR v_open.instrument_id <> v_close.instrument_id
     OR NOT (
       (v_lot.position_side = 'LONG'
        AND v_close.trade_type = 'SELL_TO_CLOSE')
       OR
       (v_lot.position_side = 'SHORT'
        AND v_close.trade_type = 'BUY_TO_CLOSE')
     )
  THEN
    RAISE EXCEPTION 'Closing execution does not match position lot';
  END IF;

  IF v_exec.executed_at < v_lot.opened_at THEN
    RAISE EXCEPTION 'Closing execution precedes lot opening';
  END IF;

  SELECT c.account_id INTO v_open_account
  FROM trades t
  JOIN campaigns c ON c.id = t.campaign_id
  WHERE t.id = v_open.trade_id;

  SELECT c.account_id INTO v_close_account
  FROM trades t
  JOIN campaigns c ON c.id = t.campaign_id
  WHERE t.id = v_close.trade_id;

  IF v_open_account IS DISTINCT FROM v_close_account THEN
    RAISE EXCEPTION 'Cannot allocate across accounts';
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_used
  FROM lot_allocations
  WHERE position_lot_id = NEW.position_lot_id
    AND id <> NEW.id;

  IF v_used + NEW.quantity > v_lot.opened_quantity THEN
    RAISE EXCEPTION
      'Closing allocation exceeds remaining lot quantity';
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_close_used
  FROM lot_allocations
  WHERE closing_execution_id = NEW.closing_execution_id
    AND id <> NEW.id;

  IF v_close_used + NEW.quantity > v_exec.quantity THEN
    RAISE EXCEPTION
      'Allocated quantity exceeds closing execution quantity';
  END IF;

  RETURN NEW;
END;
$$;

-- migrate:down

-- No automatic rollback to the obsolete orders-based implementation.