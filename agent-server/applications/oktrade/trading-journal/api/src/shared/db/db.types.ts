import type { Pool, PoolClient } from 'pg';

export type Db = Pick<Pool | PoolClient, 'query'>;