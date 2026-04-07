const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const path = require('path');
const { connectDB } = require('./config/db');
const { initializeAdminCredentials } = require('./controllers/authController');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
let initializePromise = null;

// Honor x-forwarded-proto so generated absolute URLs use https in production behind proxies.
app.set('trust proxy', 1);

const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const corsAllowlist = String(process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isOriginAllowed = (origin = '') => {
  if (!origin) {
    return !isProduction;
  }
  if (!corsAllowlist.length) {
    return !isProduction;
  }
  return corsAllowlist.includes(origin);
};

const createRateLimiter = ({ windowMs, maxRequests, isMatch }) => {
  const bucket = new Map();

  return (req, res, next) => {
    if (!isMatch(req)) {
      return next();
    }

    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const hit = bucket.get(key);

    if (!hit || now > hit.resetAt) {
      bucket.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (hit.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((hit.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    hit.count += 1;
    return next();
  };
};

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS blocked for this origin'));
  },
  credentials: true,
}));
app.use(createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 300,
  isMatch: () => true,
}));
app.use(createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 40,
  isMatch: (req) => req.path.startsWith('/api/auth'),
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/stories', require('./routes/storyRoutes'));
app.use('/api/videos', require('./routes/videoRoutes'));
app.use('/api/slokas', require('./routes/slokaRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/movies', require('./routes/movieRoutes'));

console.log('Routes registered');

app.get('/', (req, res) => {
  res.send('Gita Wisdom API is running');
});

const PORT = process.env.PORT || 8888;
const LEGACY_PORT = process.env.LEGACY_PORT || 5000;

const initializeApp = async () => {
  if (!initializePromise) {
    initializePromise = connectDB()
      .then(async () => {
        try {
          await initializeAdminCredentials();
        } catch (error) {
          console.warn('Admin bootstrap skipped:', error.message);
        }
      })
      .catch((error) => {
        initializePromise = null;
        throw error;
      });
  }

  return initializePromise;
};

const startServer = async () => {
  try {
    await initializeApp();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });

    if (String(LEGACY_PORT) !== String(PORT)) {
      app.listen(LEGACY_PORT, '0.0.0.0', () => {
        console.log(`Legacy compatibility port running on ${LEGACY_PORT}`);
      });
    }
  } catch (err) {
    console.error('DB Connection Failed:', err);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, initializeApp, startServer };
