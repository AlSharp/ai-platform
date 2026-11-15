import express from 'express';
import pool from '../db.js';
import camelcaseKeys from 'camelcase-keys';
import { createAccount, deleteAccount, getAccountById, getAccounts, updateAccount } from '../utils/resource.js';

function accounts(okTrade) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const accounts = await getAccounts(okTrade, req);
      res.status(200).json({
        success: true,
        data: accounts
      })
    }
    catch(error) {
      console.log('get accounts error: ', error);
      res.status(500).json({
        success: false,
        message: 'Could not get accounts',
        error_code: 1003,
        data: {}
      })
    }
  })

  router.get('/:id', async (req, res) => {
    try {
      const account = await getAccountById(okTrade, req);
      if (account) {
        res.status(200).json({
          success: true,
          data: account
        });
      } else {
        res.status(404).json({
          success: true,
          message: 'Could not find account',
          data: null
        });
      }
    }
    catch(error) {
      res.status(500).json({
        success: false,
        message: 'Could not get account',
        error_code: 1003,
        data: {}
      })
    }
  })

  router.post('/', async (req, res) => {
    try {
      await createAccount(okTrade, req.body);
      res.status(201).json({
        success: true,
        message: 'Account was successfully created!',
        data: {}
      })
    }
    catch(error) {
      console.log('create account error: ', error);
      res.status(500).json({
        success: false,
        message: 'Could not create account',
        error_code: 1003,
        data: {}
      })
    }
  })

  router.put('/:id', async (req, res) => {
    try {
      await updateAccount(okTrade, req, req.body);
      res.status(200).json({
        success: true,
        message: 'Account was updated',
        data: {}
      });
    }
    catch(error) {
      console.log(error);
      res.status(500).json({
        success: false,
        message: 'Could not update account',
        error_code: 1003,
        data: {}
      })
    }
  })

  router.delete('/:id', async (req, res) => {
    try {
      await deleteAccount(okTrade, req);

      res.status(200).json({
        success: true,
        message: 'Account has been deleted',
        data: {}
      });
    }
    catch(error) {
      console.log('delete account error: ', error);
      res.status(500).json({
        success: false,
        message: 'Could not delete account',
        error_code: 1003,
        data: {}
      });
    }
  })

  return router;
}

export default accounts;