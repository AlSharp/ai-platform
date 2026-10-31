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

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  app.log.info({ signal }, 'Shutting down Trading Journal API');

  try {
    await app.close();
    await db.end();

    app.log.info('Trading Journal API stopped');
  } catch (error) {
    app.log.error(error, 'Error during shutdown');
    process.exitCode = 1;
  }
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error, 'Failed to start Trading Journal API');
  process.exitCode = 1;
  await shutdown('startup failure');
}