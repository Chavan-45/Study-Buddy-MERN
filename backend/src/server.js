import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB, getDBStatus } from './config/db.js';
import { notFoundHandler, errorHandler } from './middleware/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';

// Load environment variables
dotenv.config();

// Validate critical environment configurations
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
const missingEnv = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.warn(
    `⚠️  Warning: Missing recommended environment variables: ${missingEnv.join(', ')}`
  );
  console.warn('   Please copy backend/.env.example to backend/.env and provide valid values.');
}

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// 1. Strict CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman) in development
    if (!origin || origin === CLIENT_URL || origin === 'http://localhost:5173') {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: Origin ${origin} is not allowed.`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// 2. Request Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Health-Check Endpoints
const healthHandler = (req, res) => {
  const dbStatus = getDBStatus();
  const statusCode = dbStatus.isConnected ? 200 : 503;

  res.status(statusCode).json({
    success: dbStatus.isConnected,
    service: 'Study Buddy Roulette Backend API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    database: {
      status: dbStatus.status,
      connected: dbStatus.isConnected,
      host: dbStatus.host,
      name: dbStatus.name,
    },
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Root informational endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Study Buddy Roulette API Server 🎲',
    healthCheck: '/api/health',
    status: 'online',
  });
});

// 4. Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);

// 5. Centralized Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

// 6. Connect to MongoDB Atlas & Start Server
async function startServer() {
  if (process.env.MONGO_URI) {
    try {
      await connectDB();
    } catch (err) {
      console.error(
        '⚠️  Failed to connect to MongoDB Atlas on initial startup. Server will continue running for diagnostics.'
      );
    }
  } else {
    console.warn('⚠️  MONGO_URI not provided. Skipping database connection on startup.');
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 Study Buddy Roulette backend running on port ${PORT}`);
    console.log(`📡 Health-check available at: http://localhost:${PORT}/api/health`);
    console.log(`🔒 Allowed Client URL: ${CLIENT_URL}`);
  });

  // Graceful shutdown handling
  const handleShutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

startServer();

export default app;
