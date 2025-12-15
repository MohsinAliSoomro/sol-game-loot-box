/**
 * Vercel Serverless Function Entry Point
 * 
 * This file exports the Express app as a serverless function handler
 * for Vercel deployment. The original server.js remains for Railway/Render.
 */

import app from '../server.js';

// Export the Express app as a serverless function
// Vercel will automatically handle routing
export default app;

