const jwt = require('jsonwebtoken');
const pool = require('../db');

// Token verify karta hai aur req.user mein user ki identity daalta hai
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');

  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'Please login first' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// Role database se check hota hai, isliye role badalne ke baad naya login zaruri nahi
async function requireAdmin(req, res, next) {
  try {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length || result.rows[0].role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied: admin only' });
    }
    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { authenticate, requireAdmin };