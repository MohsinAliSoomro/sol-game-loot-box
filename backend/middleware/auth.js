/**
 * Authentication Middleware
 * 
 * Handles JWT token verification and user authentication
 * Supports both master admins and project admins
 */

import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/database.js';
import { megaDashboardAdmin } from '../config/mega-dashboard-db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Verify JWT token and attach user to request
 */
export async function authenticateToken(req, res, next) {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required. Please provide a valid token.'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check if user is master admin
        if (decoded.role === 'master_admin') {
            // Support both userId (backend format) and id (mega dashboard format)
            const adminId = decoded.userId || decoded.id;
            
            // First try main database (master_admins table)
            let masterAdmin = null;
            let error = null;
            
            const { data: mainAdmin, error: mainError } = await supabaseAdmin
                .from('master_admins')
                .select('id, email, full_name, role, is_active')
                .eq('id', adminId)
                .eq('is_active', true)
                .single();

            if (!mainError && mainAdmin) {
                masterAdmin = mainAdmin;
            } else {
                // If not found in main DB, try mega dashboard DB (master_admin_settings table)
                if (megaDashboardAdmin) {
                    const { data: megaAdmin, error: megaError } = await megaDashboardAdmin
                        .from('master_admin_settings')
                        .select('id, email, full_name, is_active')
                        .eq('id', adminId)
                        .eq('is_active', true)
                        .single();

                    if (!megaError && megaAdmin) {
                        masterAdmin = {
                            id: megaAdmin.id,
                            email: megaAdmin.email,
                            full_name: megaAdmin.full_name || null,
                            role: 'master_admin',
                            is_active: megaAdmin.is_active
                        };
                    } else {
                        error = megaError || mainError;
                    }
                } else {
                    error = mainError;
                }
            }

            if (error || !masterAdmin) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid token. User not found or inactive.'
                });
            }

            req.user = {
                id: masterAdmin.id,
                email: masterAdmin.email,
                full_name: masterAdmin.full_name,
                role: 'master_admin',
                project_id: null // Master admins have access to all projects
            };

            return next();
        }

        // Check if user is project admin
        if (decoded.role === 'project_admin' && decoded.project_id) {
            const { data: projectAdmin, error } = await supabaseAdmin
                .from('project_admins')
                .select('id, project_id, email, full_name, role, is_active')
                .eq('id', decoded.userId)
                .eq('project_id', decoded.project_id)
                .eq('is_active', true)
                .single();

            if (error || !projectAdmin) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid token. User not found or inactive.'
                });
            }

            req.user = {
                id: projectAdmin.id,
                email: projectAdmin.email,
                full_name: projectAdmin.full_name,
                role: 'project_admin',
                project_id: projectAdmin.project_id
            };

            return next();
        }

        // Invalid token structure
        return res.status(401).json({
            success: false,
            error: 'Invalid token structure.'
        });

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token.'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired. Please login again.'
            });
        }

        console.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication failed.'
        });
    }
}

/**
 * Middleware to require master admin role
 */
export function requireMasterAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'master_admin') {
        return res.status(403).json({
            success: false,
            error: 'Master admin access required.'
        });
    }
    next();
}

/**
 * Middleware to require project admin or master admin
 */
export function requireAdmin(req, res, next) {
    if (!req.user || (req.user.role !== 'master_admin' && req.user.role !== 'project_admin')) {
        return res.status(403).json({
            success: false,
            error: 'Admin access required.'
        });
    }
    next();
}

/**
 * Generate JWT token for user
 */
export function generateToken(user, projectId = null) {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        project_id: projectId || user.project_id || null
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
}

export default {
    authenticateToken,
    requireMasterAdmin,
    requireAdmin,
    generateToken
};

