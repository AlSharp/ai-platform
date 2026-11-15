class LiveTrading {
  constructor(okTrade, strategy) {
    this.TDAClient = okTrade.TDAClient;
    this.ThetaDataClient = okTrade.ThetaDataClient;
    this.DBClient = okTrade.DBClient;
  }

  submitOrder() {

  }

  updatePosition() {

  }

  cancelOrder() {

  }

  hasPendingOrder() {

  }

  hasOpenPosition() {
    
  }
}

export default LiveTrading;