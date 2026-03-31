require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors     = require('cors');
const cookieParser = require('cookie-parser');

const quotationRoutes = require('./quotation');
const authRoutes      = require('./auth');

const app = express();
const allowedOrigins = [
  'http://localhost:4200',
  'https://www.lacasitadelsabor.com',
  'https://lacasitadelsabor.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS blocked'));
    }
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);

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
