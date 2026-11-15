import express from 'express';
import pool from '../db.js';
import axios from 'axios';
import { getLiveTradingClients } from '../utils/resource.js';
import camelcaseKeys from 'camelcase-keys';

function liveTradingClients(okTrade) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const clients = await getLiveTradingClients(okTrade, req.query);
      res.status(200).json({
        success: true,
        data: camelcaseKeys(clients)
      })
    }
    catch(error) {
      console.log(error.message);
      res.status(500).json({
        success: false,
        message: 'Could not get live trading clients',
        error_code: 1003,
        data: {}
      })
    }
  })

  router.post('/', async (req, res) => {

    const { name, port, brokerName, config } = req.body;

    try {
      const result = await pool.query('INSERT INTO live_trading_client (name, port, broker_name, config) VALUES ($1, $2, $3, $4::jsonb) RETURNING *', [name, port, brokerName, config]);

      okTrade.state.liveTradingClients.push(camelcaseKeys(result.rows[0]));

      res.status(201).json({
        success: true,
        message: `Live Trading Client ${name} with id ${result.rows[0].id} was successfully created!`,
        data: {}
      })
    }
    catch(error) {
      console.log(error);
      res.status(500).json({
        success: false,
        message: 'Could not create live trading client',
        error_code: 1003,
        data: {}
      })
    }
  })

  // router.put('/:id', async (req, res) => {

  //   const id = parseInt(req.params.id);

  //   try {
  //     const { name, type, description, brokerName, accountNumber } = req.body;

  //     const result = await pool.query('UPDATE account SET name = $1, type = $2, description = $3, broker_name = $4, account_number = $5  WHERE id = $6', [name, type, description, brokerName, accountNumber, id]);

  //     okTrade.state.accounts = okTrade.state.accounts.map(account => {
  //       if (account.id === id) {
  //         return result.rows[0];
  //       }
  //       return account;
  //     })

  //     res.status(200).json({
  //       success: true,
  //       message: `Account with id ${id} was updated`,
  //       data: {}
  //     });
  //   }
  //   catch(error) {
  //     console.log(error);
  //     res.status(500).json({
  //       success: false,
  //       message: 'Could not update account',
  //       error_code: 1003,
  //       data: {}
  //     })
  //   }
  // })

  router.delete('/:id', async (req, res) => {
    const id = parseInt(req.params.id);

    try {
      await pool.query('DELETE FROM live_trading_client WHERE id = $1', [id]);

      okTrade.state.liveTradingClients = okTrade.state.liveTradingClients.filter(client => client.id !== id);

      res.status(200).json({
        success: true,
        message: `Live Trading Client with ID ${id} was deleted`,
        data: {}
      });
    }
    catch(error) {
      res.status(500).json({
        success: false,
        message: `Could not delete live trading client with id ${id}`,
        error_code: 1003,
        data: {}
      });
    }
  })

  return router;
}

export default liveTradingClients;