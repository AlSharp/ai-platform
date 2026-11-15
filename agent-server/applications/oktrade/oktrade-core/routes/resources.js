import express from 'express';
import axios from 'axios';
import { getLiveTradingClientByPort, startLiveTradingClient } from '../utils/resource.js';
import camelcaseKeys from 'camelcase-keys';

function resources(okTrade) {
  const router = express.Router();

  router.post('/live-trading-clients/start', async (req, res) => {
    try {
      const brokerName = req.query.brokerName
      await startLiveTradingClient(okTrade, brokerName);
      res.status(200).json({
        success: true,
        message: 'Live trading client has been started',
        data: {}
      })
    }
    catch(error) {
      res.status(500).json({
        success: false,
        message: 'Could not start live trading client',
        error_code: 1003,
        data: {}
      })
    }
  })

  router.get('/live-trading-clients/by-port/:port', async (req, res) => {
    try {
      const { port } = req.params;
      const client = await getLiveTradingClientByPort(okTrade, port, req.query);
      res.status(200).json({
        success: true,
        data: camelcaseKeys(client)
      })
    }
    catch(error) {
      console.log(error);
      res.status(500).json({
        success: false,
        message: 'Could not get live trading client by port',
        error_code: 1003,
        data: {}
      })
    }
  })

  router.get('/live-trading-clients/config-schema', async (req, res) => {
    const { port } = req.query;

    try {
      const response = await axios.get(`http://localhost:${port}/api/config-schema`);
    
      res.status(200).json({
        success: true,
        data: camelcaseKeys(response.data)
      });
    }
    catch(error) {
      res.status(500).json({
        success: false,
        message: 'Could not get config schema',
        error_code: 1003,
        data: {}
      })
    }
  })

  router.get('/live-trading-clients/config', async (req, res) => {
    const { port } = req.query;

    try {
      const response = await axios.get(`http://localhost:${port}/api/config`);
    
      res.status(200).json({
        success: true,
        data: camelcaseKeys(response.data, { preserveConsecutiveUppercase: true })
      });
    }
    catch(error) {
      res.status(500).json({
        success: false,
        message: 'Could not get config schema',
        error_code: 1003,
        data: {}
      })
    }
  })

  router.post('/live-trading-clients/configure', async (req, res) => {

    const { port } = req.query;

    try {
      const response = await axios.post(`http://localhost:${port}/api/configure`, req.body);

      res.status(200).json({
        success: true,
        data: camelcaseKeys(response.data)
      });
    }
    catch(error) {
      res.status(500).json({
        success: false,
        message: 'Could not configure resource',
        error_code: 1003,
        data: {}
      })
    }
  })

  router.post('/live-trading-clients/authenticate', async (req, res) => {

    const { port } = req.query;

    try {
      const response = await axios.post(`http://localhost:${port}/api/authenticate`, req.body);

      res.status(200).json({
        success: true,
        message: 'Client has been authenticated successfully',
        data: camelcaseKeys(response.data)
      });
    }
    catch(error) {
      res.status(500).json({
        success: false,
        message: 'Could not authenticate client',
        error_code: 1003,
        data: {}
      })
    }
  })

  return router;
}

export default resources;