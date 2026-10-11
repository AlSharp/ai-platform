import dotenv from 'dotenv';
import { buildApp } from './app.js';

dotenv.config({ path: '../.env' });

const port = Number(process.env.API_PORT);
const host = process.env.API_HOST;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('API_PORT must be a valid port number');
}

if (!host) {
  throw new Error('API_HOST is required');
}

const app = buildApp();

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}