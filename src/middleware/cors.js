import cors from 'cors';

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:3000' , 'https://still-citadel-95346-111a1dcad6bd.herokuapp.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600
};

export default cors(corsOptions);
