import express from 'express';
import dotenv from 'dotenv';
import corsMiddleware from './middleware/cors.js';
import { globalErrorHandler } from './utils/errorHandler.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import enrollmentRoutes from './routes/enrollmentRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import watchHistoryRoutes from './routes/watchHistoryRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js';

dotenv.config();

const app = express();

// Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(corsMiddleware);

// Routes
app.get("/", (req, res) => {
  res.json({message:"Hello from Edutube!"});
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/enrollment', enrollmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', teacherRoutes);
app.use('/api', courseRoutes);
app.use('/api', searchRoutes);
app.use('/api', watchHistoryRoutes);

// Legacy routes (keeping for backward compatibility)
app.use('/', userRoutes);
app.use('/', enrollmentRoutes);
app.use('/', courseRoutes);
app.use('/', searchRoutes);
app.use('/', watchHistoryRoutes);
app.use('/', authRoutes);

// Global error handling middleware
app.use(globalErrorHandler);

export default app;
