import express from 'express';
import pool from '../../db.js';

const router = express.Router();

router.get('/uiconfig', async (req, res) => {
  try {
    const ui_config = await pool.query(
      "SELECT * FROM ui_configuration"
    );
    res.status(200).json({
      success: true,
      data: ui_config.rows
    })
  }
  catch(error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: 'App Server Error, please contact the admin',
      error_code: 1000,
      data: {}
    });
  }
})

export default router;