# OKTrade Code

1. npm install

2. Create .env file in the root folder and use your values in the empty fields.

```
SERVER_PORT=5102
STRATEGIES_PATH=
STRATEGY_JS_FILE="strategy.js"
STRATEGY_NOTEBOOK_FILE="calculate.ipynb"
STRATEGY_PY_FILE="calculate.py"
LIVE_TRADING_CLIENT_PORTS="5103"
```

3. To start microservice execute the follwing commands

```
# in dev mode
npm run dev 

# in prod mode
npm start
```