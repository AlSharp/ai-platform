-- Phase 4.2.7.2: execution-price lots integration test.
-- Requires migrations 001-007. All fixtures roll back.
-- Run: psql -v ON_ERROR_STOP=1 -U trading_journal -d trading_journal -f ...
BEGIN;
DO $test$
DECLARE
 a uuid; a2 uuid; actor_id uuid; stock_id uuid;
 campaign_id uuid; campaign2_id uuid; other_campaign uuid;
 t1 uuid; t2 uuid; tc uuid; tx uuid;
 l1 uuid; l2 uuid; lc uuid; lx uuid;
 o1 uuid; o2 uuid; oc uuid; ox uuid;
 e1 uuid; e2 uuid; e3 uuid; e4 uuid; e5 uuid; ec uuid; ex uuid;
 lot_a uuid; lot_b uuid; lot_c uuid;
 allocation_id uuid; qty numeric; n integer;
BEGIN
 INSERT INTO accounts(name,mode) VALUES ('test007','PAPER') RETURNING id INTO a;
 INSERT INTO accounts(name,mode) VALUES ('test007-other','PAPER') RETURNING id INTO a2;
 INSERT INTO actors(name,role) VALUES ('test007-human','HUMAN') RETURNING id INTO actor_id;
 INSERT INTO instruments(symbol,instrument_type,multiplier) VALUES ('TEST007','STOCK',1) RETURNING id INTO stock_id;
 INSERT INTO campaigns(account_id,name) VALUES(a,'test007 campaign') RETURNING id INTO campaign_id;
 INSERT INTO campaigns(account_id,name) VALUES(a,'test007 campaign 2') RETURNING id INTO campaign2_id;
 INSERT INTO campaigns(account_id,name) VALUES(a2,'test007 other account') RETURNING id INTO other_campaign;
 INSERT INTO trades(campaign_id,actor_id,source,action_type,occurred_at)
 VALUES(campaign_id,actor_id,'MANUAL','MANUAL',now()) RETURNING id INTO t1;
 INSERT INTO trades(campaign_id,actor_id,source,action_type,occurred_at)
 VALUES(campaign2_id,actor_id,'MANUAL','MANUAL',now()) RETURNING id INTO t2;
 INSERT INTO trades(campaign_id,actor_id,source,action_type,occurred_at)
 VALUES(campaign_id,actor_id,'MANUAL','MANUAL',now()) RETURNING id INTO tc;
 INSERT INTO trades(campaign_id,actor_id,source,action_type,occurred_at)
 VALUES(other_campaign,actor_id,'MANUAL','MANUAL',now()) RETURNING id INTO tx;
 INSERT INTO legs(trade_id,instrument_id,direction,quantity,trade_type)
 VALUES(t1,stock_id,'LONG',6,'BUY_TO_OPEN') RETURNING id INTO l1;
 INSERT INTO legs(trade_id,instrument_id,direction,quantity,trade_type)
 VALUES(t2,stock_id,'LONG',2,'BUY_TO_OPEN') RETURNING id INTO l2;
 INSERT INTO legs(trade_id,instrument_id,direction,quantity,trade_type)
 VALUES(tc,stock_id,'LONG',4,'SELL_TO_CLOSE') RETURNING id INTO lc;
 INSERT INTO legs(trade_id,instrument_id,direction,quantity,trade_type)
 VALUES(tx,stock_id,'LONG',1,'SELL_TO_CLOSE') RETURNING id INTO lx;
 INSERT INTO orders(leg_id,order_type,status) VALUES(l1,'MARKET','FILLED') RETURNING id INTO o1;
 INSERT INTO orders(leg_id,order_type,status) VALUES(l2,'MARKET','FILLED') RETURNING id INTO o2;
 INSERT INTO orders(leg_id,order_type,status) VALUES(lc,'MARKET','FILLED') RETURNING id INTO oc;
 INSERT INTO orders(leg_id,order_type,status) VALUES(lx,'MARKET','FILLED') RETURNING id INTO ox;
 -- One execution can represent quantity 2. Two executions at the same price group.
 INSERT INTO executions(order_id,quantity,price,fees,executed_at)
 VALUES(o1,2,4.20,0.20,now()) RETURNING id INTO e1;
 INSERT INTO executions(order_id,quantity,price,fees,executed_at)
 VALUES(o1,3,4.20,0.30,now()) RETURNING id INTO e2;
 INSERT INTO executions(order_id,quantity,price,fees,executed_at)
 VALUES(o1,1,4.25,0.10,now()) RETURNING id INTO e3;
 INSERT INTO executions(order_id,quantity,price,fees,executed_at)
 VALUES(o2,2,4.20,0.20,now()) RETURNING id INTO e4;
 INSERT INTO executions(order_id,quantity,price,fees,executed_at)
 VALUES(oc,4,5.00,0.40,now()) RETURNING id INTO ec;
 INSERT INTO executions(order_id,quantity,price,fees,executed_at)
 VALUES(ox,1,5.00,0.10,now()) RETURNING id INTO ex;
 INSERT INTO position_lots(opening_leg_id,position_side,opened_quantity,fill_price)
 VALUES(l1,'LONG',5,4.20) RETURNING id INTO lot_a;
 INSERT INTO position_lots(opening_leg_id,position_side,opened_quantity,fill_price)
 VALUES(l1,'LONG',1,4.25) RETURNING id INTO lot_b;
 INSERT INTO position_lots(opening_leg_id,position_side,opened_quantity,fill_price)
 VALUES(l2,'LONG',2,4.20) RETURNING id INTO lot_c;
 INSERT INTO position_lot_executions(position_lot_id,execution_id)
 VALUES(lot_a,e1),(lot_a,e2),(lot_b,e3),(lot_c,e4);
 -- Force deferred reconciliation now; ensures one exec qty 2 and grouped quantities pass.
 SET CONSTRAINTS tj_lot_quantity_reconcile, tj_lot_link_reconcile IMMEDIATE;
 SELECT count(*) INTO n FROM position_lots WHERE opening_leg_id=l1;
 IF n<>2 THEN RAISE EXCEPTION 'Expected two price-specific lots, got %',n; END IF;
 SELECT count(*) INTO n FROM position_lots WHERE fill_price=4.20 AND id IN(lot_a,lot_c);
 IF n<>2 THEN RAISE EXCEPTION 'Same price across different trades must remain separate'; END IF;
 RAISE NOTICE 'PASS: one execution quantity 2, grouped fills, separate prices and trades';

 -- Duplicate execution mapping, incorrect price/leg and duplicate price lot rejected.
 BEGIN
   INSERT INTO position_lot_executions(position_lot_id,execution_id) VALUES(lot_b,e1);
   RAISE EXCEPTION 'FAIL: invalid execution association accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM = 'Opening execution must match lot leg and fill price' THEN
    RAISE NOTICE 'PASS: invalid execution association rejected';
  ELSE
    RAISE;
  END IF;
 END;
 BEGIN
   INSERT INTO position_lot_executions(position_lot_id,execution_id) VALUES(lot_a,e4);
   RAISE EXCEPTION 'FAIL: cross-trade execution link accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
 END;
 BEGIN
   INSERT INTO position_lots(opening_leg_id,position_side,opened_quantity,fill_price)
   VALUES(l1,'LONG',1,4.20);
   RAISE EXCEPTION 'FAIL: duplicate lot price accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 RAISE NOTICE 'PASS: duplicate and cross-trade associations rejected';

 INSERT INTO lot_allocations(position_lot_id,closing_execution_id,quantity)
 VALUES(lot_a,ec,3) RETURNING id INTO allocation_id;
 INSERT INTO lot_allocations(position_lot_id,closing_execution_id,quantity)
 VALUES(lot_b,ec,1);
 SELECT remaining_quantity INTO qty FROM available_position_lots WHERE position_lot_id=lot_a;
 IF qty<>2 THEN RAISE EXCEPTION 'Expected lot A remaining 2, got %',qty; END IF;
 SELECT remaining_quantity INTO qty FROM available_position_lots WHERE position_lot_id=lot_b;
 IF qty<>0 THEN RAISE EXCEPTION 'Expected lot B remaining 0, got %',qty; END IF;
 SELECT remaining_quantity INTO qty FROM available_position_lots WHERE position_lot_id=lot_c;
 IF qty<>2 THEN RAISE EXCEPTION 'Expected other trade remaining 2, got %',qty; END IF;
 BEGIN
   INSERT INTO lot_allocations(position_lot_id,closing_execution_id,quantity) VALUES(lot_c,ec,1);
   RAISE EXCEPTION 'FAIL: closing execution over-allocation accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
 END;
 BEGIN
   INSERT INTO lot_allocations(position_lot_id,closing_execution_id,quantity) VALUES(lot_c,ex,1);
   RAISE EXCEPTION 'FAIL: cross-account allocation accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'PASS: partial closes, remaining quantities, execution limits and account isolation';

 INSERT INTO financial_outcomes(lot_allocation_id,realized_pl,calculation_version)
 VALUES(allocation_id,2.10,'test-v1');
 BEGIN
   UPDATE lot_allocations SET quantity=2 WHERE id=allocation_id;
   RAISE EXCEPTION 'FAIL: finalized allocation modified';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
 END;
 BEGIN
   UPDATE executions SET fees=0 WHERE id=e1;
   RAISE EXCEPTION 'FAIL: referenced execution modified';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
 END;
 BEGIN
   INSERT INTO financial_outcomes(lot_allocation_id,realized_pl,calculation_version)
   VALUES(allocation_id,9,'test-v1');
   RAISE EXCEPTION 'FAIL: duplicate financial outcome accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 RAISE NOTICE 'PASS: financial outcome linkage and immutability guards';
END
$test$;
ROLLBACK;
