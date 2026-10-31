#!/usr/bin/env python3
"""Two-session PostgreSQL allocation race test. Requires psql and migrations 001-008.
Run with PGHOST/PGPORT/PGUSER/PGDATABASE/PGPASSWORD configured, or use
Docker: docker compose exec -T postgres python3 ... (if Python is installed).
Prefer host-side psql with PGHOST/PGPORT configured.
"""
import os
import subprocess
import threading
import time
import uuid
from decimal import Decimal

ids = {k: str(uuid.uuid4()) for k in ('account','actor','instrument','campaign','open_trade','close_trade_a','close_trade_b','open_leg','close_leg_a','close_leg_b','open_order','close_order_a','close_order_b','open_exec','close_exec_a','close_exec_b','lot','allocation_a','allocation_b')}
marker = 'TJCONC_' + uuid.uuid4().hex[:12].upper()

def sql(s):
    for key, value in ids.items():
        s = s.replace('{' + key + '}', value)
    return s.replace('{marker}', marker)

def psql(script, timeout=30):
    return subprocess.run(['docker', 'compose', 'exec', '-T', 'postgres', 'psql','-X', '-A', '-t', '-v','ON_ERROR_STOP=1','-U', 'trading_journal', '-d', 'trading_journal'],input=sql(script),text=True,capture_output=True,timeout=timeout)

setup = '''
BEGIN;
INSERT INTO accounts(id,name,mode) VALUES ('{account}','{marker}','PAPER');
INSERT INTO actors(id,name,role) VALUES ('{actor}','{marker}','HUMAN');
INSERT INTO instruments(id,symbol,instrument_type,multiplier) VALUES ('{instrument}','{marker}','STOCK',1);
INSERT INTO campaigns(id,account_id,name) VALUES ('{campaign}','{account}','{marker}');
INSERT INTO trades(id,campaign_id,actor_id,source,action_type,occurred_at) VALUES
 ('{open_trade}','{campaign}','{actor}','MANUAL','MANUAL',now()),
 ('{close_trade_a}','{campaign}','{actor}','MANUAL','MANUAL',now()),
 ('{close_trade_b}','{campaign}','{actor}','MANUAL','MANUAL',now());
INSERT INTO legs(id,trade_id,instrument_id,direction,quantity,trade_type) VALUES
 ('{open_leg}','{open_trade}','{instrument}','LONG',2,'BUY_TO_OPEN'),
 ('{close_leg_a}','{close_trade_a}','{instrument}','LONG',2,'SELL_TO_CLOSE'),
 ('{close_leg_b}','{close_trade_b}','{instrument}','LONG',2,'SELL_TO_CLOSE');
INSERT INTO orders(id,leg_id,order_type,status) VALUES
 ('{open_order}','{open_leg}','MARKET','FILLED'),
 ('{close_order_a}','{close_leg_a}','MARKET','FILLED'),
 ('{close_order_b}','{close_leg_b}','MARKET','FILLED');
INSERT INTO executions(id,order_id,quantity,price,fees,executed_at) VALUES
 ('{open_exec}','{open_order}',2,4.20,0.20,now()),
 ('{close_exec_a}','{close_order_a}',2,5.00,0.20,now()),
 ('{close_exec_b}','{close_order_b}',2,5.00,0.20,now());
INSERT INTO position_lots(id,opening_leg_id,position_side,opened_quantity,fill_price)
 VALUES ('{lot}','{open_leg}','LONG',2,4.20);
INSERT INTO position_lot_executions(position_lot_id,execution_id) VALUES ('{lot}','{open_exec}');
COMMIT;
'''
cleanup = '''
BEGIN;
DELETE FROM financial_outcomes WHERE lot_allocation_id IN
 (SELECT id FROM lot_allocations WHERE position_lot_id='{lot}');
DELETE FROM lot_allocations WHERE position_lot_id='{lot}';
DELETE FROM position_lot_executions WHERE position_lot_id='{lot}';
DELETE FROM lot_relationships WHERE source_lot_id='{lot}' OR target_lot_id='{lot}';
DELETE FROM position_lots WHERE id='{lot}';
DELETE FROM executions WHERE id IN ('{open_exec}','{close_exec_a}','{close_exec_b}');
DELETE FROM orders WHERE id IN ('{open_order}','{close_order_a}','{close_order_b}');
DELETE FROM legs WHERE id IN ('{open_leg}','{close_leg_a}','{close_leg_b}');
DELETE FROM trades WHERE id IN ('{open_trade}','{close_trade_a}','{close_trade_b}');
DELETE FROM campaigns WHERE id='{campaign}';
DELETE FROM instruments WHERE id='{instrument}';
DELETE FROM actors WHERE id='{actor}';
DELETE FROM accounts WHERE id='{account}';
COMMIT;
'''
# Each allocation uses a distinct closing execution, competing for the same opening lot.
a = '''BEGIN;
INSERT INTO lot_allocations(id,position_lot_id,closing_execution_id,quantity)
 VALUES ('{allocation_a}','{lot}','{close_exec_a}',2);
SELECT 'A_INSERTED';
SELECT pg_sleep(4);
COMMIT;
'''
b = '''BEGIN;
SET LOCAL lock_timeout='10s';
INSERT INTO lot_allocations(id,position_lot_id,closing_execution_id,quantity)
 VALUES ('{allocation_b}','{lot}','{close_exec_b}',2);
COMMIT;
'''

try:
    r=psql(setup)
    if r.returncode: raise RuntimeError('Fixture setup failed:\n'+r.stderr)
    result={}
    def run_a():
        result['a']=psql(a,timeout=20)
    t=threading.Thread(target=run_a)
    t.start()
    time.sleep(1.5)  # A has inserted and holds the lot lock while pg_sleep runs.
    result['b']=psql(b,timeout=20)
    t.join()
    if result['a'].returncode:
        raise RuntimeError('Transaction A failed:\n'+result['a'].stderr)
    if result['b'].returncode == 0:
        raise RuntimeError('FAIL: Transaction B unexpectedly succeeded')
    if 'Closing allocation exceeds remaining lot quantity' not in result['b'].stderr:
        raise RuntimeError('B failed for unexpected reason:\n'+result['b'].stderr)
    check=psql("SELECT opened_quantity, remaining_quantity FROM available_position_lots WHERE position_lot_id='{lot}';")
    if check.returncode:
        raise RuntimeError('Query failed: ' + check.stderr)

    opened, remaining = map(Decimal, check.stdout.strip().split('|'))

    if opened != Decimal('2') or remaining != Decimal('0'):
        raise RuntimeError(
            f'FAIL: remaining quantity incorrect: {opened}, {remaining}'
        )
    print('PASS: Transaction A committed 2 contracts')
    print('PASS: Transaction B rejected after waiting on the lot lock')
    print('PASS: opening=2, remaining=0')
finally:
    r=psql(cleanup)
    if r.returncode: print('WARNING: fixture cleanup failed:',r.stderr)
    else: print('Fixture cleanup complete')
