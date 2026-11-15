import { spawn } from 'node:child_process';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

import LiveTrading from './adapters/live/LiveTrading.js';
import PaperTrading from './adapters/paper/PaperTrading.js';
import BackTesting from './adapters/backtesting/BackTesting.js';

import { getStrategyFiles, getLiveTradingClients, getStrategies, getAccounts } from './utils/resource.js';

class OKTrade {
  constructor(io) {
    this.state = {
      accounts: [],
      strategies: [],
      strategyFiles: [],
      liveTradingClients: [],
    };

    // this.TDAClient = process.env.NODE_ENV === 'production' ?
    //   new TDAClient(process.env.TD_CLIENT_ID, process.env.TD_CALLBACK_URL) :
    //   new TDAClient(process.env.TD_CLIENT_ID, process.env.TD_CALLBACK_URL_DEV);
    // this.ThetaDataClient = new ThetaDataClient(process.env.THETA_DATA_BASE_URL);

    this.trading = {
      'live': LiveTrading,
      'paper': PaperTrading,
      'backtest': BackTesting
    }

    this.strategiesFolder = process.env.STRATEGIES_PATH;
  }

  async init() {
    await this.getInitialState();

    console.log('okTrade.state: ', this.state);
  }

  async getInitialState() {
    try {
      await getAccounts(this);
      await getLiveTradingClients(this, { with_state: true });
      await getStrategyFiles(this);
      await getStrategies(this);
    }
    catch(error) {
      console.log('get initial state error: ', error);
    }
  }

  startStrategy(strategy) {
    return new Promise((resolve, reject) => {
      const { name, config } = strategy;
      const subprocess = spawn('node',
        ['index.js'],
        {
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          cwd: `${this.strategiesFolder}/${name}`
        }
      );

      console.log('pid: ', subprocess.pid);

      subprocess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
      });
      
      subprocess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
      });

      subprocess.on('message', message => {
        if (message.reply) {
          if (message.eventName === 'command') {
            // 
          }
          if (message.eventName === 'config') {
            subprocess.send({ id: message.id, data: config });
          }
        } else {
          if (message.eventName === 'started') {
            console.log('started');
            return resolve({ error: false, subprocess });
          }
          if (message.eventName === '__error') {
            console.log('error: ', message.data);
            return reject({ error: true, errorMessage: message.data });
          }
        }
      })
    })
  }

  async startStrategies(strategies) {

    const started = [];
    const failed = [];

    try {
      const _strategies = strategies.map(strategy => ({...strategy, id: uuidv4()}));

      for (const strategy of _strategies) {
        const result = await this.startStrategy(strategy);
        if (result.error) {
          failed.push({ name: strategy.name, config: strategy.config });
        } else {
          started.push({ process: result.subprocess, ...strategy });
        }
      }
  
      this.strategies.concat(started);
  
      return {
        error: false,
        started: started.map(strategy => ({ name: strategy.name, config: strategy.config })),
        failed
      };
    }
    catch(error) {
      console.log(error);
      return {
        error: true,
        started: started.map(strategy => ({ name: strategy.name, config: strategy.config })),
        failed
      }
    }
    // config = {
    //   runAs: 'live'|'paper'|'backtest',
    //   tickerSymbol: 'SPY',
    //   liveOptions: {},
    //   paperOptions: {},
    //   backtestOptions: {}
    // }
  }

  async pauseStrategies(strategies) {

  }

  async stopStrategies(strategies) {

  }

  async runStrategies(data) {

  }
}

export default OKTrade;