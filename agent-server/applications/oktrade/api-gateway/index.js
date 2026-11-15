import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import corsOptions from './config/corsOptions.js';

import credentials from './middleware/credentials.js';
import verifyJWT from './middleware/verifyJWT.js';
import proxy from 'express-http-proxy';

import login from './routes/public/login.js';
import refreshToken from './routes/public/refreshToken.js';
import logout from './routes/secure/logout.js'
import uiConfig from './routes/public/uiConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: __dirname +'/.env' });

function proxyErrorHandler(err, res, next) {
  const errorObj = {
    success: false,
    message: 'App Server Error, please contact the admin',
    error_code: 1010,
    data: {}
  }
  switch (err && err.code) {
    case 'ECONNRESET':    { return res.status(500).json(errorObj); }
    case 'ECONNREFUSED':  { return res.status(500).json(errorObj); }
    default:              { next(err); }
  }
}

async function main() {
  const app = express();

  app.use(credentials);

  app.use(cors(corsOptions));

  app.use(express.urlencoded({ extended: false }));

  app.use(express.json());

  app.use(cookieParser());

  app.use('/dashboard', express.static(path.join(__dirname, '..', 'dashboard', 'dist')));

  app.use('/api', login);
  app.use('/api', refreshToken);
  app.use('/api/thetadata', proxy(process.env.THETA_TERMINAL_CLIENT_URL, {
    timeout: 3000,
    proxyErrorHandler: proxyErrorHandler
  }));
  app.use('/api', uiConfig);

  app.use(verifyJWT);

  app.use('/api', logout);
  app.use('/api/core', proxy(process.env.CORE_URL, {
    timeout: 3000,
    proxyErrorHandler: proxyErrorHandler
  }));
  // app.use('/api/schwab-login-url', proxy(process.env.SCHWAB_LOGIN_URL, {
  //   timeout: 3000
  // }));
  // app.use('/api/schwab-authenticate', proxy(process.env.SCHWAB_AUTHENTICATE_URL))

  app.listen(process.env.SERVER_PORT);
}

main();
