const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/bookings   body: { showId, seatIds: [..] }
router.post('/', authenticate, async (req, res) => {
  const showId = Number(req.body.showId);
  let seatIds = req.body.seatIds;

  if (!Number.isInteger(showId) || !Array.isArray(seatIds) || seatIds.length === 0) {
    return res.status(400).json({ success: false, message: 'showId and a non-empty seatIds list are required' });
  }

  seatIds = [...new Set(seatIds.map(Number))];
  if (seatIds.some((n) => !Number.isInteger(n)) || seatIds.length > 10) {
    return res.status(400).json({ success: false, message: 'Invalid seat list (maximum 10 seats)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Show exist karta hai aur upcoming hai?
    const show = await client.query('SELECT * FROM shows WHERE id = $1 AND show_time > NOW()', [showId]);
    if (!show.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Show not found or already started' });
    }

    // Seats lock karo (FOR UPDATE): dusra user wait karega jab tak ye transaction khatam na ho
    const seatResult = await client.query(
      `SELECT id, seat_label, seat_type, is_booked
         FROM seats
        WHERE show_id = $1 AND id = ANY($2::int[])
        ORDER BY id
        FOR UPDATE`,
      [showId, seatIds]
    );

    if (seatResult.rows.length !== seatIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Some seats do not belong to this show' });
    }

    if (seatResult.rows.some((s) => s.is_booked)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'One or more seats are already booked. Please choose other seats.' });
    }

    // Price server par calculate hota hai (client se kabhi nahi aata)
    const { regular_price, premium_price } = show.rows[0];
    const total = seatResult.rows.reduce(
      (sum, s) => sum + Number(s.seat_type === 'premium' ? premium_price : regular_price),
      0
    );
    const labels = seatResult.rows.map((s) => s.seat_label).join(', ');
    const code = 'RT' + crypto.randomBytes(4).toString('hex').toUpperCase();

    await client.query('UPDATE seats SET is_booked = TRUE WHERE id = ANY($1::int[])', [seatIds]);

    const booking = await client.query(
      `INSERT INTO bookings (user_id, show_id, seat_ids, seat_labels, total_price, confirmation_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, confirmation_code, seat_labels, total_price, created_at`,
      [req.user.id, showId, seatIds, labels, total, code]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Booking confirmed', booking: booking.rows[0] });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    console.error('Booking error:', err);
    res.status(500).json({ success: false, message: 'Unable to complete booking' });
  } finally {
    client.release();
  }
});

// GET /api/bookings/mine  (sirf logged-in user ki bookings, user id token se aati hai)
router.get('/mine', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, b.confirmation_code, b.seat_labels, b.total_price, b.created_at,
              m.title, s.show_time
         FROM bookings b
         JOIN shows  s ON s.id = b.show_id
         JOIN movies m ON m.id = s.movie_id
        WHERE b.user_id = $1
        ORDER BY b.id DESC`,
      [req.user.id]
    );
    res.json({ success: true, bookings: result.rows });
  } catch (err) {
    console.error('My bookings error:', err);
    res.status(500).json({ success: false, message: 'Unable to load bookings' });
  }
});

module.exports = router;