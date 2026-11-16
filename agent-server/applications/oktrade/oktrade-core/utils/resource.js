import { readdir } from 'node:fs/promises';
import pool from '../db.js';
import axios from 'axios';
import { exec } from 'node:child_process';
import camelcaseKeys from 'camelcase-keys';

// accounts
export async function getAccounts(okTrade, req = {}) {
  return [];
  try {
    const cache = req.query?.cache;

    if (cache === 'true') {
      return okTrade.state.accounts;
    } else {
      const result = await pool.query('SELECT * FROM account');

      okTrade.state.accounts = camelcaseKeys(result.rows);
    
      return okTrade.state.accounts;
    }
  }
  catch(error) {
    throw error;
  }
}

export async function getAccountById(okTrade, req) {
  try {
    const id = parseInt(req.params.id);
    const cache = req.query.cache;

    if (cache === 'true') {
      const account = okTrade.state.accounts.find(account => account.id === id);
      return account ? account : null;
    } else {
      const result = await pool.query(`SELECT * FROM account WHERE id = ${id}`);

      if (result.rows[0]) {
        okTrade.state.accounts = okTrade.state.accounts.map(account => {
          if (account.id === id) {
            return camelcaseKeys(result.rows[0]);
          }
          return account;
        })
        const account = okTrade.state.accounts.find(account => account.id === id);
        return account ? account : null;
      } else {
        return null;
      }
    }
  }
  catch(error) {
    throw error;
  }
}

export async function createAccount(okTrade, data) {
  try {
    const { name, type, description, brokerName, accountNumber } = data;
    const result = await pool.query('INSERT INTO account (name, type, description, broker_name, account_number) VALUES ($1, $2, $3, $4, $5) RETURNING *', [name, type, description, brokerName, accountNumber]);

    const createdAccount = camelcaseKeys(result.rows[0])

    okTrade.state.accounts.push(createdAccount);

    return createAccount;
  }
  catch(error) {
    throw error;
  }
}

export async function updateAccount(okTrade, req, data) {
  try {
    const id = parseInt(req.params.id);
    const { name, type, description, brokerName, accountNumber, liveTradingClientId } = data.account;
    const strategyIds = data.strategyIds;

    await pool.query('BEGIN');

    const updatedAccount = await pool.query('UPDATE account SET name = $1, type = $2, description = $3, broker_name = $4, account_number = $5, live_trading_client_id = $6  WHERE id = $7 RETURNING *', [name, type, description, brokerName, accountNumber, liveTradingClientId, id]);

    const updatedStrategies = await pool.query('UPDATE strategy SET account_id = $1 WHERE id = ANY($2) RETURNING *', [id, strategyIds]);

    await pool.query('UPDATE strategy SET account_id = NULL WHERE account_id = $1 AND id <> ALL($2)', [id, strategyIds]);

    await pool.query('COMMIT');

    okTrade.state.accounts = okTrade.state.accounts.map(account => {
      if (account.id === id) {
        return camelcaseKeys(updatedAccount.rows[0]);
      }
      return account;
    })

    okTrade.state.strategies = okTrade.state.strategies
      .map(strategy => {
        if (strategyIds.includes(strategy.id)) {
          return camelcaseKeys(updatedStrategies.rows.find(row => row.id === strategy.id));
        }
        return strategy;
      }).filter(strategy => strategy.accountId === id && strategyIds.includes(strategy.id));

    return { updatedAccount, updatedStrategies };
  }
  catch(error) {
    throw error;
  }
}

export async function deleteAccount(okTrade, req) {
  try {
    const id = parseInt(req.params.id);
    await pool.query('DELETE FROM account WHERE id = $1', [id]);

    okTrade.state.accounts = okTrade.state.accounts.filter(account => account.id !== id);

    return id;
  }
  catch(error) {
    throw error;
  }
}

// strategies
export async function getStrategyFiles(okTrade, req = {}) {
  return [];
  try {

    const cache = req.query?.cache;

    if (cache === 'true') {
      return okTrade.state.strategyFiles;
    } else {
      const content = await readdir(okTrade.strategiesFolder, {
        withFileTypes: true
      });
    
      let strategyFiles = [];
    
      for (const object of content) {
        if (object.isDirectory()) {
          const fileNames = await readdir(okTrade.strategiesFolder + '/' + object.name);
    
          if (fileNames.includes(process.env.STRATEGY_JS_FILE) && (fileNames.includes(process.env.STRATEGY_NOTEBOOK_FILE) || fileNames.includes(process.env.STRATEGY_PY_FILE))) {
            strategyFiles.push({ name: object.name, path: okTrade.strategiesFolder + '/' + object.name });
          }
        }
      }
    
      okTrade.state.strategyFiles = camelcaseKeys(strategyFiles);
    
      return okTrade.state.strategyFiles;
    }
  }
  catch(error) {
    throw error;
  }
}

export async function getStrategies(okTrade, req = {}) {
  return [];
  try {
    const cache = req.query?.cache;

    if (cache === 'true') {
      return okTrade.state.strategies;
    } else {
      const result = await pool.query('SELECT * FROM strategy');

      okTrade.state.strategies = camelcaseKeys(result.rows);

      return okTrade.state.strategies;
    }
  }
  catch(error) {
    throw error;
  }
}

// live trading clients
export async function getLiveTradingClients(okTrade, queryParams) {
  return [];
  try {
    const { cache, with_state } = queryParams;

    if (cache === 'true') {
      return okTrade.state.liveTradingClients;
    } else {
      const result = await pool.query('SELECT * FROM live_trading_client');
  
      okTrade.state.liveTradingClients = camelcaseKeys(result.rows);
  
      if (with_state === 'true') {
        for (const [index, client] of okTrade.state.liveTradingClients.entries()) {
          try {
            const { data: clientState } = await axios.get(`http://localhost:${client.port}/api/state`);
            okTrade.state.liveTradingClients[index].state = clientState;
            okTrade.state.liveTradingClients[index].active = true;
          }
          catch(error) {
            okTrade.state.liveTradingClients[index].active = false;
          }
        }
      }
  
      return okTrade.state.liveTradingClients;
    }
  }
  catch(error) {
    throw error;
  }
}

export async function getLiveTradingClientByPort(okTrade, port, queryParams = {}) {
  try {
    if (!port) throw new Error('Port number is not provided');
    const { cache, with_state } = queryParams;
    if (cache === 'true') {
      return okTrade.state.liveTradingClients.find(client => client.port == port)
    } else {
      const result = await pool.query(`SELECT * FROM live_trading_client WHERE port=${port}`);

      if (!result.rows[0]) return null;

      if (with_state === 'true') {
        const { data: clientState } = await axios.get(`http://localhost:${port}/api/state`);
  
        okTrade.state.liveTradingClients = okTrade.state.liveTradingClients.map(client => {
          if (client.port == port) {
            return {
              ...result.rows[0],
              state: clientState
            };
          }
          return client;
        })

        return {
          ...result.rows[0],
          state: clientState
        };
      } else {
        okTrade.state.liveTradingClients = okTrade.state.liveTradingClients.map(client => {
          if (client.port == port) {
            return result.rows[0]
          }
          return client;
        })

        return result.rows[0];
      }
    }
  }
  catch(error) {
    console.log(error);
    throw error;
  }
}

export function startLiveTradingClient(okTrade, brokerName) {
  return new Promise((resolve, reject) => {
    exec(`sudo systemctl start oktrade-live-client-node@${brokerName}`, (error) => {
      if (error) {
        return reject(error);
      }
      okTrade.state.liveTradingClients = okTrade.state.liveTradingClients.map(client => {
        if (client.brokerName === brokerName) {
          return {
            ...client,
            active: true
          }
        }
        return client;
      })
      return resolve();
    })

  })
}