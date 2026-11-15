import express from 'express';
import pool from '../../db.js';
const router = express.Router();

router.post('/logout', async (req, res) => {
  console.log('POST /api/logout');

  const { username } = req.body;
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

    const updatedUser = await pool.query(
      "UPDATE users SET refresh_token = null WHERE username = $1 RETURNING *",
      [username]
    );

    res.clearCookie('jwt', {
      httpOnly: true, sameSite: 'None', secure: true, maxAge: 24 * 60 * 60 * 1000
    });
    return res.status(200).json({
      success: true,
      message: `User ${updatedUser.rows[0].username} has been successfully logged out`,
      data: {}
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