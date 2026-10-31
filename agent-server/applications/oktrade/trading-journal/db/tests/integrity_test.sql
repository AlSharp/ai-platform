\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
 a uuid; b uuid; actor_id uuid; ca uuid; cb uuid; stock uuid; opt uuid;
 t_open uuid; t_close uuid; t_bad uuid; leg_open uuid; leg_close uuid; leg_bad uuid; lot uuid;
 entry1 uuid; entry2 uuid; entry_other uuid; strat uuid; ver1 uuid; ver2 uuid;
 chart uuid; snap uuid; dataset uuid;
BEGIN
 INSERT INTO accounts(name,mode) VALUES ('TEST ACCOUNT A','PAPER') RETURNING id INTO a;
 INSERT INTO accounts(name,mode) VALUES ('TEST ACCOUNT B','PAPER') RETURNING id INTO b;
 INSERT INTO actors(name,role) VALUES ('TEST TRADER','HUMAN') RETURNING id INTO actor_id;
 INSERT INTO campaigns(account_id,name) VALUES (a,'TEST AMZN') RETURNING id INTO ca;
 INSERT INTO campaigns(account_id,name) VALUES (b,'TEST OTHER') RETURNING id INTO cb;
 INSERT INTO instruments(symbol,instrument_type) VALUES ('TEST_AMZN_006','STOCK') RETURNING id INTO stock;
 INSERT INTO instruments(symbol,instrument_type,underlying_instrument_id,option_type,expiration_date,strike,multiplier)
 VALUES ('TEST_AMZN_006_P200','OPTION',stock,'PUT','2026-11-20',200,100) RETURNING id INTO opt;
 INSERT INTO trades(campaign_id,actor_id,source,action_type,occurred_at) VALUES (ca,actor_id,'MANUAL','MANUAL',now()) RETURNING id INTO t_open;
 INSERT INTO trades(campaign_id,actor_id,source,action_type,occurred_at) VALUES (ca,actor_id,'MANUAL','MANUAL',now()) RETURNING id INTO t_close;
 INSERT INTO trades(campaign_id,actor_id,source,action_type,occurred_at) VALUES (cb,actor_id,'MANUAL','MANUAL',now()) RETURNING id INTO t_bad;
 INSERT INTO legs(trade_id,instrument_id,direction,quantity,trade_type) VALUES(t_open,opt,'SHORT',5,'SELL_TO_OPEN') RETURNING id INTO leg_open;
 INSERT INTO legs(trade_id,instrument_id,direction,quantity,trade_type) VALUES(t_close,opt,'SHORT',3,'BUY_TO_CLOSE') RETURNING id INTO leg_close;
 INSERT INTO legs(trade_id,instrument_id,direction,quantity,trade_type) VALUES(t_bad,opt,'SHORT',1,'BUY_TO_CLOSE') RETURNING id INTO leg_bad;
 INSERT INTO position_lots(opening_leg_id,position_side,opened_quantity) VALUES(leg_open,'SHORT',5) RETURNING id INTO lot;
 INSERT INTO lot_allocations(position_lot_id,closing_leg_id,quantity) VALUES(lot,leg_close,3);
 IF (SELECT opened_quantity - (SELECT coalesce(sum(quantity),0) FROM lot_allocations WHERE position_lot_id=lot) FROM position_lots WHERE id=lot) <> 2 THEN
 RAISE EXCEPTION 'Remaining quantity not 2'; END IF;
 BEGIN
   INSERT INTO lot_allocations(position_lot_id,closing_leg_id,quantity) VALUES(lot,leg_bad,1);
   RAISE EXCEPTION 'FAIL: cross-account allocation accepted';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM = 'FAIL: cross-account allocation accepted' THEN RAISE; END IF;
 END;
 BEGIN
   UPDATE lot_allocations SET quantity=6 WHERE position_lot_id=lot AND closing_leg_id=leg_close;
   RAISE EXCEPTION 'FAIL: over-allocation accepted';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM = 'FAIL: over-allocation accepted' THEN RAISE; END IF;
 END;
 INSERT INTO journal_entries(account_id,campaign_id,actor_id,entry_type,content) VALUES(a,ca,actor_id,'ANALYSIS','Test valuation analysis') RETURNING id INTO entry1;
 INSERT INTO journal_entries(account_id,campaign_id,actor_id,entry_type,content) VALUES(a,ca,actor_id,'ANALYSIS','Test technical analysis') RETURNING id INTO entry2;
 INSERT INTO journal_entries(account_id,campaign_id,actor_id,entry_type,content) VALUES(b,cb,actor_id,'ANALYSIS','Other account') RETURNING id INTO entry_other;
 INSERT INTO journal_entry_trades(journal_entry_id,trade_id,relationship_type) VALUES(entry1,t_open,'SUPPORTS_TRADE'),(entry2,t_open,'SUPPORTS_TRADE');
 BEGIN
   INSERT INTO journal_entry_trades(journal_entry_id,trade_id,relationship_type) VALUES(entry_other,t_open,'SUPPORTS_TRADE');
   RAISE EXCEPTION 'FAIL: cross-account analysis accepted';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM = 'FAIL: cross-account analysis accepted' THEN RAISE; END IF;
 END;
 INSERT INTO strategies(account_id,name) VALUES(a,'TEST CSP STRATEGY') RETURNING id INTO strat;
 INSERT INTO strategy_versions(strategy_id,version_number) VALUES(strat,1) RETURNING id INTO ver1;
 INSERT INTO strategy_versions(strategy_id,version_number) VALUES(strat,2) RETURNING id INTO ver2;
 INSERT INTO analysis_strategies(analysis_id,strategy_version_id) VALUES(entry1,ver1),(entry1,ver2);
 INSERT INTO strategy_evaluations(analysis_id,strategy_version_id,assessment,verdict) VALUES(entry1,ver1,'Qualified','QUALIFIED'),(entry1,ver2,'Rejected','REJECTED');
 INSERT INTO chart_contexts(timeframe,settings) VALUES('1d','{}') RETURNING id INTO chart;
 INSERT INTO market_snapshots(instrument_id,trade_id,journal_entry_id,snapshot_type,observed_at,chart_context_id)
 VALUES(stock,t_open,entry1,'OPEN','2026-10-01 16:00:00+00',chart) RETURNING id INTO snap;
 INSERT INTO ohlcv_datasets(instrument_id,timeframe,bucket,object_key,range_start,range_end)
 VALUES(stock,'1d','test-bucket','integration/test_amzn_daily.csv','2026-09-01 00:00:00+00','2026-10-01 00:00:00+00') RETURNING id INTO dataset;
 INSERT INTO market_snapshot_datasets(snapshot_id,dataset_id) VALUES(snap,dataset);
 RAISE NOTICE 'PASS: partial close, over-allocation, cross-account checks, analysis/strategy and snapshot linkage';
END $$;
ROLLBACK;
