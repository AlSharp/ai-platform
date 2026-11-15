# API Gateway

1. npm install

2. Create .env file in the root folder and use your values in the empty fields.

```
SERVER_PORT=5100
ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=
DATABASE_NAME=oklabstrade
DATABASE_HOST=localhost
DATABASE_USER=
DATABASE_PASSWORD=
DATABASE_PORT=5432
TD_CLIENT_ID=
TD_LOGIN_URL=
TD_LOGIN_URL_DEV=
TD_CALLBACK_URL=
TD_CALLBACK_URL_DEV=
THETA_TERMINAL_CLIENT_URL="http://localhost:5101"
SCHWAB_LOGIN_URL="http://localhost:5103/api/login-url"
SCHWAB_AUTHENTICATE_URL="http://localhost:5103/api/authenticate"
CORE_URL="http://localhost:5102"
```

3. To start microservice execute the follwing commands

```
# in dev mode
npm run dev 

# in prod mode
npm start
```