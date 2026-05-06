import cors from 'cors';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:4000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4000',
  'http://172.16.95.109',
  'http://172.16.95.109:4000',
  'http://edutube.college.local',
  'https://edutube.college.local',
  'https://still-citadel-95346-111a1dcad6bd.herokuapp.com'
];

const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins])];

// CORS configuration
const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600
};

export default cors(corsOptions);
