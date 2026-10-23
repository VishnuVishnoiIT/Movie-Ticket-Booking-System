
const express = require("express");
const pool = require("../db");

const router = express.Router();

// GET /api/shows?movie_id=1
router.get("/", async (req, res) => {
  try {
    const movieId = Number(req.query.movie_id);

    if (!Number.isInteger(movieId) || movieId < 1) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid movie_id."
      });
    }

    const result = await pool.query(
      `SELECT
          s.id,
          s.movie_id,
          s.cinema_name,
          s.screen_name,
          s.show_time,
          s.ticket_price,
          s.available_seats,
          m.title AS movie_title
       FROM shows s
       JOIN movies m ON m.id = s.movie_id
       WHERE s.movie_id = $1
         AND s.show_time >= CURRENT_TIMESTAMP
         AND s.available_seats > 0
       ORDER BY s.show_time ASC`,
      [movieId]
    );

    res.json({
      success: true,
      shows: result.rows
    });
  } catch (error) {
    console.error("Get shows error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load available shows."
    });
  }
});

// GET /api/shows/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid show ID."
      });
    }

    const result = await pool.query(
      `SELECT s.*, m.title AS movie_title
       FROM shows s
       JOIN movies m ON m.id = s.movie_id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Show not found."
      });
    }

    res.json({
      success: true,
      show: result.rows[0]
    });
  } catch (error) {
    console.error("Get show error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load show details."
    });
  }
});

module.exports = router;
