import { buildApp } from './app.js';
import { createDbPool } from './db.js';

const port = Number(process.env.API_PORT);
const host = process.env.API_HOST;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('API_PORT must be a valid port number');
}

if (!host) {
  throw new Error('API_HOST is required');
}

const db = createDbPool();
const app = buildApp(db);

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
  await app.close();
  await db.end();
}