/**
 * Multi-Tenant Whitelabel Backend Server
 * 
 * Express server for managing multiple whitelabel projects
 * Supports subdomain-based routing and JWT authentication
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { testConnection } from './config/database.js';

// Import routes
import projectsRouter from './routes/projects.js';
import projectTokensRouter from './routes/project-tokens.js';
import projectUsersRouter from './routes/project-users.js';
import nftsRouter from './routes/nfts.js';
import authRouter from './routes/auth.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// =====================================================
// MIDDLEWARE SETUP
// =====================================================

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - General API limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: Math.ceil(15 * 60)
        });
    }
});

// Rate limiting - More lenient for auth routes (login attempts)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 login attempts per 15 minutes (increased for development)
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting in development mode
        return process.env.NODE_ENV === 'development';
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: 'Too many login attempts. Please wait 15 minutes and try again.',
            retryAfter: Math.ceil(15 * 60)
        });
    }
});

// Apply auth limiter to auth routes (must be before general limiter)
app.use('/api/auth', authLimiter);

// Apply general limiter to all other API routes (excludes /api/auth due to order)
app.use('/api/projects', apiLimiter);
app.use('/api/nfts', apiLimiter);
app.use('/api/branding', apiLimiter);

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// =====================================================
// HEALTH CHECK ENDPOINT
// =====================================================

app.get('/health', async (req, res) => {
    try {
        const dbStatus = await testConnection();
        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: dbStatus ? 'connected' : 'disconnected',
            environment: process.env.NODE_ENV || 'development',
            port: PORT
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message
        });
    }
});

// Root endpoint for Railway health checks
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Multi-Tenant Whitelabel Backend API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            api: '/api'
        }
    });
});

// =====================================================
// API ROUTES
// =====================================================

// Authentication routes (no auth required)
app.use('/api/auth', authRouter);

// Project management routes (master admin only)
app.use('/api/projects', projectsRouter);

// Project tokens routes (project admin only)
app.use('/api/projects', projectTokensRouter);

// Project users routes (multi-tenant user management)
app.use('/api/projects', projectUsersRouter);

// NFT routes (project-specific, requires multi-tenant middleware)
app.use('/api/nfts', nftsRouter);

// =====================================================
// EXAMPLE: Project Branding Endpoint
// =====================================================

/**
 * GET /api/branding
 * Get project branding information
 * Uses multi-tenant middleware to automatically detect project
 */
import { multiTenantMiddleware, getProjectBranding } from './middleware/multiTenant.js';

app.get('/api/branding', multiTenantMiddleware, (req, res) => {
    res.json({
        success: true,
        data: {
            branding: getProjectBranding(req.project),
            project: {
                id: req.project.id,
                name: req.project.name,
                slug: req.project.slug
            }
        }
    });
});

// =====================================================
// ERROR HANDLING MIDDLEWARE
// =====================================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// =====================================================
// SERVER STARTUP
// =====================================================

async function startServer() {
    try {
        // Test database connection (non-blocking - server will start even if DB check fails)
        console.log('Testing database connection...');
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.warn('⚠️  Database connection test failed, but server will start anyway.');
            console.warn('⚠️  Health check endpoint will show database status.');
        }

        // Start server - listen on 0.0.0.0 for Railway/Render compatibility
        const server = app.listen(PORT, '0.0.0.0', (err) => {
            if (err) {
                console.error('❌ Failed to start server:', err);
                process.exit(1);
            }
            
            console.log('================================================');
            console.log('🚀 Multi-Tenant Whitelabel Backend Server');
            console.log('================================================');
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`✅ Listening on 0.0.0.0:${PORT} (all interfaces)`);
            console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`✅ Database: ${dbConnected ? 'Connected' : 'Connection test failed'}`);
            console.log('================================================');
            console.log(`📡 API Base URL: http://0.0.0.0:${PORT}/api`);
            console.log(`🏥 Health Check: http://0.0.0.0:${PORT}/health`);
            console.log('================================================');
        });

        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use`);
            } else {
                console.error('❌ Server error:', error);
            }
            process.exit(1);
        });

        // Handle graceful shutdown
        const gracefulShutdown = (signal) => {
            console.log(`\n${signal} received. Starting graceful shutdown...`);
            server.close(() => {
                console.log('✅ Server closed successfully');
                process.exit(0);
            });

            // Force shutdown after 10 seconds
            setTimeout(() => {
                console.error('❌ Forced shutdown after timeout');
                process.exit(1);
            }, 10000);
        };

        // Listen for termination signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Handle uncaught errors
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught Exception:', error);
            gracefulShutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            gracefulShutdown('unhandledRejection');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Only start the server if not running on Vercel
// Vercel will use the exported app as a serverless function
if (process.env.VERCEL !== '1') {
    startServer();
}

export default app;

