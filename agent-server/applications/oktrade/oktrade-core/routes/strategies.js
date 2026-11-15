import express from 'express';
import pool from '../db.js';
import camelcaseKeys from 'camelcase-keys';
import { getStrategies } from '../utils/resource.js';

function strategies(okTrade) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const strategies = await getStrategies(okTrade, req);
      res.status(200).json({
        success: true,
        data: strategies
      })
    }
    catch(error) {
      console.log('get strategies error: ', error);
      res.status(500).json({
        success: false,
        message: 'Could not get strategies',
        error_code: 1003,
        data: {}
      })
    }
  })

  router.post('/', async (req, res) => {

    const { name, description, type, file } = req.body;

    try {
      const result = await pool.query('INSERT INTO strategy (name, description, type, file) VALUES ($1, $2, $3, $4) RETURNING *', [name, description, type, file]);

      okTrade.state.strategies.push(camelcaseKeys(result.rows[0]));

      res.status(201).json({
        success: true,
        message: `Strategy ${name} with id ${result.rows[0].id} was successfully created!`,
        data: {}
      })
    }
    catch(error) {
      console.log(error);
      res.status(500).json({
        success: false,
        message: 'Could not create strategy',
        error_code: 1003,
        data: {}
      })
    }
  })

  router.put('/:id', async (req, res) => {

    const id = parseInt(req.params.id);

    try {
      const { name, description, accountId, configId } = req.body;

      const result = await pool.query('UPDATE account SET name = $1, description = $2, account_id = $3, config_id = $4 WHERE id = $5', [name, description, accountId, configId, id]);

      okTrade.state.strategies = okTrade.state.strategies.map(strategy => {
        if (strategy.id === id) {
          return camelcaseKeys(result.rows[0]);
        }
        return strategy;
      })

      res.status(200).json({
        success: true,
        message: `Strategy with id ${id} was updated`,
        data: {}
      });
    }
    catch(error) {
      console.log(error);
      res.status(500).json({
        success: false,
        message: 'Could not update strategy',
        error_code: 1003,
        data: {}
      })
    }
  })

  router.delete('/:id', async (req, res) => {
    const id = parseInt(req.params.id);

    try {
      await pool.query('DELETE FROM strategy WHERE id = $1', [id]);

      okTrade.state.strategies = okTrade.state.strategies.filter(strategy => strategy.id !== id);

      res.status(200).json({
        success: true,
        message: `Strategy with ID ${id} was deleted`,
        data: {}
      });
    }
    catch(error) {
      res.status(500).json({
        success: false,
        message: `Could not delete strategy with id ${id}`,
        error_code: 1003,
        data: {}
      });
    }
  })

  return router;
}

export default strategies;