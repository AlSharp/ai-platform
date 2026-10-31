import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { buildApp } from '../../src/app.js';

describe('Trading Journal API', () => {
  it('returns healthy status', async () => {
    const db = {
      query: vi.fn(),
    } as unknown as Pool;

    const app = buildApp(db);

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
      expect(db.query).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('returns ready when PostgreSQL is available', async () => {
    const db = {
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
    } as unknown as Pool;

    const app = buildApp(db);

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ready' });
      expect(db.query).toHaveBeenCalledWith('SELECT 1');
    } finally {
      await app.close();
    }
  });

  it('returns unavailable when PostgreSQL fails', async () => {
    const db = {
      query: vi.fn().mockRejectedValue(new Error('Database unavailable')),
    } as unknown as Pool;

    const app = buildApp(db);

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ status: 'unavailable' });
    } finally {
      await app.close();
    }
  });
});