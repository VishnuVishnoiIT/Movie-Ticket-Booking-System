const express = require('express');
const pool = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Is file ke saare routes: pehle login check, phir admin role check
router.use(authenticate, requireAdmin);

// GET /api/admin/summary
router.get('/summary', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM users)                              AS users,
         (SELECT COUNT(*) FROM movies WHERE is_hidden = FALSE)     AS movies,
         (SELECT COUNT(*) FROM shows)                              AS shows,
         (SELECT COUNT(*) FROM bookings)                           AS bookings,
         (SELECT COALESCE(SUM(total_price), 0) FROM bookings)      AS revenue`
    );
    res.json({ success: true, summary: result.rows[0] });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ success: false, message: 'Unable to load summary' });
  }
});

// POST /api/admin/movies
router.post('/movies', async (req, res) => {
  try {
    const title = (req.body.title || '').trim();
    const genre = (req.body.genre || '').trim();
    const description = (req.body.description || '').trim();
    const duration = req.body.durationMin ? Number(req.body.durationMin) : null;
    const poster = (req.body.posterUrl || '').trim() || null;

    if (!title || !genre) {
      return res.status(400).json({ success: false, message: 'Title and genre are required' });
    }
    if (duration !== null && (!Number.isInteger(duration) || duration <= 0)) {
      return res.status(400).json({ success: false, message: 'Duration must be a positive number' });
    }

    const result = await pool.query(
      `INSERT INTO movies (title, genre, description, duration_min, poster_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, genre, description, duration, poster]
    );
    res.status(201).json({ success: true, message: 'Movie added', movie: result.rows[0] });
  } catch (err) {
    console.error('Add movie error:', err);
    res.status(500).json({ success: false, message: 'Unable to add movie' });
  }
});

// DELETE /api/admin/movies/:id  (movie delete nahi hoti, sirf hide hoti hai)
router.delete('/movies/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: 'Invalid movie id' });
    }
    const result = await pool.query('UPDATE movies SET is_hidden = TRUE WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }
    res.json({ success: true, message: 'Movie hidden' });
  } catch (err) {
    console.error('Hide movie error:', err);
    res.status(500).json({ success: false, message: 'Unable to hide movie' });
  }
});

// POST /api/admin/shows  -> show + uske 48 seats ek transaction mein
router.post('/shows', async (req, res) => {
  const movieId = Number(req.body.movieId);
  const showTime = req.body.showTime;
  const regularPrice = Number(req.body.regularPrice);
  const premiumPrice = Number(req.body.premiumPrice);

  if (!Number.isInteger(movieId) || !showTime || !(regularPrice > 0) || !(premiumPrice > 0)) {
    return res.status(400).json({ success: false, message: 'movieId, showTime and valid prices are required' });
  }
  if (Number.isNaN(Date.parse(showTime))) {
    return res.status(400).json({ success: false, message: 'Invalid show time' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const movie = await client.query('SELECT id FROM movies WHERE id = $1', [movieId]);
    if (!movie.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }

    const show = await client.query(
      `INSERT INTO shows (movie_id, show_time, regular_price, premium_price)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [movieId, showTime, regularPrice, premiumPrice]
    );

    // Rows A-F x 1-8 = 48 seats. A-D regular, E-F premium
    await client.query(
      `INSERT INTO seats (show_id, seat_label, seat_type)
       SELECT $1, r.letter || c.n,
              CASE WHEN r.letter IN ('E', 'F') THEN 'premium' ELSE 'regular' END
         FROM (VALUES ('A'), ('B'), ('C'), ('D'), ('E'), ('F')) AS r(letter)
         CROSS JOIN generate_series(1, 8) AS c(n)`,
      [show.rows[0].id]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Show created with 48 seats', show: show.rows[0] });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
    console.error('Create show error:', err);
    res.status(500).json({ success: false, message: 'Unable to create show' });
  } finally {
    client.release();
  }
});

module.exports = router;