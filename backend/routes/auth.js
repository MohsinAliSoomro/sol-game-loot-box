/**
 * Authentication Routes
 * 
 * Handles login for both master admins and project admins
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { supabaseAdmin } from '../config/database.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

/**
 * POST /api/auth/login
 * Login endpoint for admins
 * 
 * Request body:
 * {
 *   email: string,
 *   password: string,
 *   project_id?: number (optional, for project admin login)
 * }
 */
router.post(
    '/login',
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { email, password, project_id } = req.body;

            console.log(`[AUTH] Login attempt: email=${email}, project_id=${project_id || 'none'}`);

            // Try master admin first
            const { data: masterAdmin, error: masterError } = await supabaseAdmin
                .from('master_admins')
                .select('id, email, password_hash, full_name, role, is_active')
                .eq('email', email)
                .single();

            if (!masterError && masterAdmin && masterAdmin.is_active) {
                // Verify password
                const passwordValid = await bcrypt.compare(password, masterAdmin.password_hash);
                
                if (passwordValid) {
                    console.log(`[AUTH] Master admin login successful: ${email}`);
                    // Update last login
                    await supabaseAdmin
                        .from('master_admins')
                        .update({ last_login: new Date().toISOString() })
                        .eq('id', masterAdmin.id);

                    // Generate token
                    const token = generateToken({
                        id: masterAdmin.id,
                        email: masterAdmin.email,
                        role: 'master_admin'
                    });

                    return res.json({
                        success: true,
                        message: 'Login successful',
                        data: {
                            user: {
                                id: masterAdmin.id,
                                email: masterAdmin.email,
                                full_name: masterAdmin.full_name,
                                role: 'master_admin'
                            },
                            token,
                            project_id: null
                        }
                    });
                } else {
                    console.log(`[AUTH] Master admin password invalid for: ${email}`);
                }
            } else if (masterError && masterError.code !== 'PGRST116') {
                console.error(`[AUTH] Error checking master admin:`, masterError);
            }

            // Try project admin
            let projectAdminQuery = supabaseAdmin
                .from('project_admins')
                .select('id, project_id, email, password_hash, full_name, role, is_active, projects(id, name, slug)')
                .eq('email', email)
                .eq('is_active', true);

            // If project_id provided, filter by it
            if (project_id) {
                projectAdminQuery = projectAdminQuery.eq('project_id', project_id);
                console.log(`[AUTH] Searching for project admin with project_id=${project_id}`);
            }

            const { data: projectAdmins, error: projectError } = await projectAdminQuery;

            if (projectError) {
                console.error(`[AUTH] Error querying project admins:`, projectError);
            } else {
                console.log(`[AUTH] Found ${projectAdmins?.length || 0} project admin(s) for email: ${email}`);
            }

            if (!projectError && projectAdmins && projectAdmins.length > 0) {
                // Try each project admin (in case email exists in multiple projects)
                for (const admin of projectAdmins) {
                    const passwordValid = await bcrypt.compare(password, admin.password_hash);
                    
                    if (passwordValid) {
                        console.log(`[AUTH] Project admin login successful: ${email}, project_id=${admin.project_id}`);
                        // Update last login
                        await supabaseAdmin
                            .from('project_admins')
                            .update({ last_login: new Date().toISOString() })
                            .eq('id', admin.id);

                        // Generate token
                        const token = generateToken({
                            id: admin.id,
                            email: admin.email,
                            role: 'project_admin'
                        }, admin.project_id);

                        return res.json({
                            success: true,
                            message: 'Login successful',
                            data: {
                                user: {
                                    id: admin.id,
                                    email: admin.email,
                                    full_name: admin.full_name,
                                    role: 'project_admin',
                                    project_id: admin.project_id
                                },
                                token,
                                project: admin.projects,
                                project_id: admin.project_id
                            }
                        });
                    } else {
                        console.log(`[AUTH] Password invalid for project admin: ${email}, project_id=${admin.project_id}`);
                    }
                }
            } else {
                if (project_id) {
                    console.log(`[AUTH] No project admin found for email=${email}, project_id=${project_id}`);
                } else {
                    console.log(`[AUTH] No project admin found for email=${email}`);
                }
            }

            // Invalid credentials
            console.log(`[AUTH] Login failed: Invalid email or password for ${email}`);
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/auth/me
 * Get current user info (requires authentication)
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                user: req.user
            }
        });
    } catch (error) {
        console.error('Error getting user info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user info'
        });
    }
});

export default router;

