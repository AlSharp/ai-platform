import express from 'express';
import pool from '../../db.js';
import jwt from 'jsonwebtoken';
const router = express.Router();

router.get('/refresh-token', async (req, res) => {
  const refreshToken = req.cookies?.jwt;

  if (!refreshToken) return res.status(400).json({
    success: false,
    message: 'Missing Parameters',
    error_code: 1002, 
    data: {} 
  });

  try {
    const user = await pool.query(
      "SELECT * FROM users WHERE refresh_token = $1",
      [refreshToken]
    );

    if (user.rowCount === 0) {
      res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
        error_code: 1101, 
        data: {}
      });
    }

    const accessToken = jwt.sign(
      { username: user.rows[0].username },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '12h' }
    );

    const newRefreshToken = jwt.sign(
      { username: user.rows[0].username },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '1d' }
    );

    const updatedUser = await pool.query(
      "UPDATE users SET refresh_token = $1 WHERE refresh_token = $2 RETURNING *",
      [newRefreshToken, refreshToken]
    );

    res.cookie('jwt', newRefreshToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      maxAge: 24 * 60 * 60 * 1000
    });
    return res.status(200).json({
      success: true,
      message: 'Tokens updated',
      data: { accessToken }
    });
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