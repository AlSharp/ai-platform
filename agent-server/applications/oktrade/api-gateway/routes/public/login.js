import express from 'express';
import pool from '../../db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // const user = await pool.query(
    //   "SELECT * FROM users WHERE username = $1",
    //   [username]
    // );

    // if (user.rowCount === 0) {
    //   return res.status(401).json({
    //     success: false,
    //     message: 'Invalid credentials',
    //     error_code: 3005, 
    //     data: {} 
    //   });
    // }

    // const validPassport = await bcrypt.compare(
    //   password,
    //   user.rows[0].passhash
    // );

    // if (!validPassport) {
    //   return res.status(401).json({
    //     success: false,
    //     message: 'Invalid credentials',
    //     error_code: 3005, 
    //     data: {} 
    //   });
    // }

    // const accessToken = jwt.sign(
    //   { username: user.rows[0].username },
    //   process.env.ACCESS_TOKEN_SECRET,
    //   { expiresIn: '12h' }
    // );

    // const refreshToken = jwt.sign(
    //   { username: user.rows[0].username },
    //   process.env.REFRESH_TOKEN_SECRET,
    //   { expiresIn: '1d' }
    // );

    // const updatedUser = await pool.query(
    //   "UPDATE users SET refresh_token = $1 WHERE username = $2 RETURNING *",
    //   [refreshToken, username]
    // );

    // res.cookie('jwt', refreshToken, {
    //   httpOnly: true,
    //   sameSite: 'none',
    //   secure: true,
    //   maxAge: 24 * 60 * 60 * 1000
    // });
    // return res.status(200).json({
    //   success: true,
    //   message: `User ${updatedUser.rows[0].username} has been successfully logged in`,
    //   data: { accessToken, role: user.rows[0].role }
    // });
    return res.status(200).json({
      success: true,
      message: `User migration has been successfully logged in`,
      data: { accessToken: 'migration', role: 'admin' }
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