import { afterAll, describe, expect, it } from 'vitest';
import { createDbPool } from '../../src/db.js';

describe('PostgreSQL integration', () => {
  const db = createDbPool();

  afterAll(async () => {
    await db.end();
  });

  it('connects to PostgreSQL', async () => {
    const result = await db.query('SELECT 1 AS value');

    expect(result.rows[0].value).toBe(1);
  });

  it('connects to the Trading Journal database', async () => {
    const result = await db.query(
      'SELECT current_database() AS name'
    );

    expect(result.rows[0].name).toBe('trading_journal');
  });

  it('can access the Trading Journal schema', async () => {
    const result = await db.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'trades'
      ) AS exists
    `);

    expect(result.rows[0].exists).toBe(true);
  });
});