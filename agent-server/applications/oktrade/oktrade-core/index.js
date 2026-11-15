import express from 'express';
import dotenv from 'dotenv';

import OKTrade from './OkTrade.js';

import strategies from './routes/strategies.js';
import state from './routes/state.js';
import accounts from './routes/accounts.js';
import strategyFiles from './routes/strategyFiles.js';
import liveTradingClients from './routes/liveTradingClients.js';
import resources from './routes/resources.js';

dotenv.config();

async function main() {
  const app = express();

  const okTrade = new OKTrade();
  await okTrade.init();

  app.use(express.json());

  app.use('/strategies', strategies(okTrade));
  app.use('/state', state(okTrade));
  app.use('/accounts', accounts(okTrade));
  app.use('/strategyfiles', strategyFiles(okTrade));
  app.use('/live-trading-clients', liveTradingClients(okTrade));
  app.use('/resources', resources(okTrade));

  app.listen(process.env.SERVER_PORT);
}

main();