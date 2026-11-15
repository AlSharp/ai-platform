import express from 'express';
import { getStrategyFiles } from '../utils/resource.js';

function strategyFiles(okTrade) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const strategyFiles = await getStrategyFiles(okTrade, req);
      res.status(200).json({
        success: true,
        data: strategyFiles
      })
    }
    catch(error) {
      console.log('get strategy files error: ', error);
      res.status(500).json({
        success: false,
        message: 'Could not get list of strategy files',
        error_code: 1011,
        data: {}
      })
    }
  })

  router.post('/start', async (req, res) => {
    try {
      const strategies = req.body.strategies;
      const result = await okTrade.startStrategies(strategies);
      res.status(200).json(result);
    }
    catch(error) {
      console.log(error);
      res.status(500).json({
        success: false,
        message: 'App Server Error, please contact the admin',
        error_code: 1000,
        data: {}
      })
    }
  })

  router.post('/stop', async (req, res) => {

  })

  return router;
}

export default strategyFiles;