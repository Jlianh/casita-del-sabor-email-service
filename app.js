require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors     = require('cors');
const cookieParser = require('cookie-parser');

const quotationRoutes = require('./quotation');
const authRoutes      = require('./auth');

const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200' || 'https://www.lacasitadelsabor.com', // Adjus for your Angular app URL
  credentials: true // Allow credentials (cookies)
}));
app.use(cookieParser());
app.use(express.json());

// ── MongoDB connection ────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err.message));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Spice Quotation API running' });
});

app.use('/api/auth',      authRoutes);
app.use('/api/quotation', quotationRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
