import express from 'express';

function state(okTrade) {
  const router = express.Router();

  router.get('/get', (req, res) => {
    res.status(200).json({
      success: true,
      data: okTrade.state
    });
  })

  return router;
}

export default state;