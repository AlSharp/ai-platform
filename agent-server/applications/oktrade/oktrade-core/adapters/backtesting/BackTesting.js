class BackTesting {
  constructor(okTrade, strategy) {
    this.ThetaDataClient = okTrade.ThetaDataClient;
    this.DBClient = okTrade.DBClient;
    this.strategy = strategy;

    this.state = {
      hasOpenPosition: false,
      position: null,
      hasPendingOrder: false,
      pendingOrder: null
    }

    this.data = {
      equity: null,
    }
  }

  async start() {
    try {
      const tickerSymbol = this.strategy.config.tickerSymbol;
      const backtestOptions = this.strategy.config.backtestOptions;

      const { startDate, endDate, aggregationPeriod } = backtestOptions;
      
      // const data1 = await this.ThetaDataClient.getEquityOHLCV(tickerSymbol, aggregationPeriod, startDate, endDate);
      const data2 = await this.ThetaDataClient.getOptionOHLCV(tickerSymbol, '02/09/2024', 'C', 500, aggregationPeriod, startDate, endDate);

      console.log('data: ', data2);

    }
    catch(error) {
      console.log(error);
    }
  }

  async run() {
    try {
      await this.strategy.run();
    }
    catch(error) {
      console.log(error);
    }
  }

  submitOrder() {

  }

  async updatePosition(calculations) {
    
    const updatedPosition = this.strategy.updatePosition(calculations);

    this.position = updatedPosition;

    if (this.position) return false;
    return true;
  }

  cancelOrder() {

  }

  async hasPendingOrder() {
    return this.state.hasPendingOrder;
  }

  async hasOpenPosition() {
    return this.state.hasOpenPosition;
  }
}

export default BackTesting;