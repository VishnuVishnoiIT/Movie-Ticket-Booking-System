require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware (routes se pehle)
app.use(cors()); // abhi sab origins ke liye open hai (report ke Limitations mein likha hai)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/movies', require('./src/routes/movies'));
app.use('/api/shows', require('./src/routes/shows'));
app.use('/api/bookings', require('./src/routes/bookings'));
app.use('/api/admin', require('./src/routes/admin'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'ReelTime API is running' });
});

// Unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

app.listen(PORT, () => {
  console.log(`ReelTime running at http://localhost:${PORT}`);
});