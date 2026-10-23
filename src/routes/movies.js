const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/movies?q=...&genre=...
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const genre = (req.query.genre || '').trim();

    const result = await pool.query(
      `SELECT id, title, genre, description, duration_min, poster_url
         FROM movies
        WHERE is_hidden = FALSE
          AND ($1 = '' OR title ILIKE '%' || $1 || '%')
          AND ($2 = '' OR genre ILIKE $2)
        ORDER BY id`,
      [q, genre]
    );

    res.json({ success: true, movies: result.rows });
  } catch (err) {
    console.error('Movies list error:', err);
    res.status(500).json({ success: false, message: 'Unable to load movies' });
  }
});

// GET /api/movies/:id
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: 'Invalid movie id' });
    }

    const result = await pool.query(
      `SELECT id, title, genre, description, duration_min, poster_url
         FROM movies WHERE id = $1 AND is_hidden = FALSE`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }
    res.json({ success: true, movie: result.rows[0] });
  } catch (err) {
    console.error('Movie detail error:', err);
    res.status(500).json({ success: false, message: 'Unable to load movie' });
  }
});

module.exports = router;