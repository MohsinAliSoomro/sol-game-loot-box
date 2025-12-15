/**
 * Project Management Routes
 * 
 * Handles CRUD operations for projects (tenants)
 * Only accessible by master admins
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { supabaseAdmin } from '../config/database.js';
import { authenticateToken, requireMasterAdmin, generateToken } from '../middleware/auth.js';
import { checkProjectCreationPermission } from '../config/mega-dashboard-db.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

/**
 * POST /api/projects/create
 * Create a new whitelabel project with admin user
 * 
 * Request body:
 * {
 *   name: string (required),
 *   slug: string (optional, auto-generated if not provided),
 *   subdomain: string (optional),
 *   admin_email: string (required),
 *   admin_password: string (required),
 *   admin_full_name: string (optional),
 *   branding: {
 *     logo_url: string (optional),
 *     primary_color: string (optional),
 *     secondary_color: string (optional),
 *     theme: string (optional)
 *   }
 * }
 */
router.post(
    '/create',
    authenticateToken,
    requireMasterAdmin,
    [
        body('name').trim().notEmpty().withMessage('Project name is required'),
        body('admin_email').isEmail().withMessage('Valid admin email is required'),
        body('admin_password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
        body('slug').optional().matches(/^[a-z0-9-]+$/).withMessage('Slug must be lowercase alphanumeric with hyphens'),
        body('subdomain').optional().matches(/^[a-z0-9-]+$/).withMessage('Subdomain must be lowercase alphanumeric with hyphens')
    ],
    async (req, res) => {
        try {
            // Validate request
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            // Check project creation permission from mega dashboard database
            const permissionCheck = await checkProjectCreationPermission();

            if (!permissionCheck.allowed) {
                return res.status(403).json({
                    success: false,
                    error: 'Project creation error. Please contact the administrator.',
                    code: 'PROJECT_CREATION_DISABLED',
                    reason: permissionCheck.reason
                });
            }

            const {
                name,
                slug,
                subdomain,
                admin_email,
                admin_password,
                admin_full_name,
                branding = {},
                max_lootboxes = null,
                max_jackpots = null
            } = req.body;

            // Generate slug if not provided
            const projectSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

            // Check if slug or subdomain already exists
            const { data: existingProject } = await supabaseAdmin
                .from('projects')
                .select('id')
                .or(`slug.eq.${projectSlug},subdomain.eq.${subdomain || ''}`)
                .limit(1);

            if (existingProject && existingProject.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Project with this slug or subdomain already exists'
                });
            }

            // Check if admin email already exists for any project
            const { data: existingAdmin } = await supabaseAdmin
                .from('project_admins')
                .select('id, project_id')
                .eq('email', admin_email)
                .limit(1);

            if (existingAdmin && existingAdmin.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Admin email already exists'
                });
            }

            // Hash password
            const passwordHash = await bcrypt.hash(admin_password, 10);

            // Generate unique placeholder values for Solana fields (project_id and project_pda)
            // These are required if the database schema includes them (for backward compatibility)
            // For whitelabel projects created via backend API, we use placeholder values
            // since they may not have on-chain Solana presence

            // Get max project_id to ensure uniqueness
            let placeholderProjectId = Date.now();
            try {
                const { data: maxProject } = await supabaseAdmin
                    .from('projects')
                    .select('project_id')
                    .order('project_id', { ascending: false })
                    .limit(1)
                    .single();

                if (maxProject && maxProject.project_id) {
                    // Increment from max project_id to ensure uniqueness
                    placeholderProjectId = Number(maxProject.project_id) + 1;
                }
            } catch (e) {
                // If query fails (columns don't exist or no data), use timestamp
                console.log('Using timestamp for project_id');
            }

            const placeholderPDA = `whitelabel-${projectSlug}-${placeholderProjectId}`;

            // Generate placeholder values for required Solana/on-chain fields
            // These are required if the database schema includes them (for backward compatibility)
            const placeholderClientName = name; // Use project name as client name
            // admin_wallet should be NULL for new projects - admin must configure it in Website Settings
            // This ensures each project admin sets their own wallet for NFT and SOL withdrawals
            const placeholderMintAddress = 'So11111111111111111111111111111111111111112'; // SOL mint
            const placeholderFeeAmount = 1000000; // 0.001 SOL in lamports

            // Create project
            // Include all required fields - if columns don't exist, Supabase will ignore them
            // If they do exist and are required, they'll be inserted with placeholder values
            const { data: project, error: projectError } = await supabaseAdmin
                .from('projects')
                .insert({
                    name,
                    slug: projectSlug,
                    subdomain: subdomain || null,
                    logo_url: branding.logo_url || null,
                    primary_color: branding.primary_color || '#ff914d',
                    secondary_color: branding.secondary_color || '#ff6b35',
                    theme: branding.theme || 'light',
                    created_by: req.user.id,
                    settings: {},
                    // Add Solana/on-chain fields with placeholder values (for backward compatibility)
                    // These will be ignored if columns don't exist in the schema
                    project_id: placeholderProjectId,
                    project_pda: placeholderPDA,
                    client_name: placeholderClientName,
                    // admin_wallet: Set to empty string - admin must configure wallet in Website Settings
                    // Empty string indicates no wallet configured (column is NOT NULL)
                    admin_wallet: '', // Empty string - admin must configure wallet in Website Settings
                    mint_address: placeholderMintAddress,
                    fee_amount: req.body.fee_amount || 1000000,
                    max_lootboxes: max_lootboxes,
                    max_jackpots: max_jackpots
                })
                .select()
                .single();

            if (projectError) {
                console.error('Error creating project:', projectError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to create project',
                    details: projectError.message
                });
            }

            // Create admin user for the project
            const { data: admin, error: adminError } = await supabaseAdmin
                .from('project_admins')
                .insert({
                    project_id: project.id,
                    email: admin_email,
                    password_hash: passwordHash,
                    full_name: admin_full_name || null,
                    role: 'admin'
                })
                .select()
                .single();

            if (adminError) {
                // Rollback: delete project if admin creation fails
                await supabaseAdmin.from('projects').delete().eq('id', project.id);

                console.error('Error creating admin:', adminError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to create admin user',
                    details: adminError.message
                });
            }

            // Create initial data for the project (jackpots, settings, etc.)
            try {
                // Create default jackpot pools
                const { error: jackpotError } = await supabaseAdmin
                    .from('project_jackpots')
                    .insert([
                        {
                            project_id: project.id,
                            name: 'Mini Jackpot',
                            description: 'Small daily jackpot for quick wins',
                            prize_amount: 0.1,
                            current_balance: 0.5,
                            ticket_price: 0.01,
                            status: 'active',
                            is_active: true
                        },
                        {
                            project_id: project.id,
                            name: 'Daily Jackpot',
                            description: 'Daily jackpot with medium prizes',
                            prize_amount: 1,
                            current_balance: 5.0,
                            ticket_price: 0.02,
                            status: 'active',
                            is_active: true
                        },
                        {
                            project_id: project.id,
                            name: 'Weekly Jackpot',
                            description: 'Weekly jackpot with big prizes',
                            prize_amount: 10,
                            current_balance: 50.0,
                            ticket_price: 0.05,
                            status: 'active',
                            is_active: true
                        },
                        {
                            project_id: project.id,
                            name: 'Mega Jackpot',
                            description: 'Monthly mega jackpot with huge prizes',
                            prize_amount: 100,
                            current_balance: 500.0,
                            ticket_price: 0.1,
                            status: 'active',
                            is_active: true
                        }
                    ]);

                if (jackpotError) {
                    console.warn('Warning: Failed to create initial jackpots:', jackpotError);
                    // Don't fail the project creation, just log the warning
                }

                // Create default project settings
                const { error: settingsError } = await supabaseAdmin
                    .from('project_settings')
                    .insert([
                        {
                            project_id: project.id,
                            setting_key: 'jackpot_win_chance',
                            setting_value: { value: '0.001' }
                        },
                        {
                            project_id: project.id,
                            setting_key: 'ticket_price',
                            setting_value: { value: '0.01' }
                        },
                        {
                            project_id: project.id,
                            setting_key: 'min_spin_amount',
                            setting_value: { value: '0.1' }
                        },
                        {
                            project_id: project.id,
                            setting_key: 'spin_cost',
                            setting_value: { value: '0.1' }
                        },
                        {
                            project_id: project.id,
                            setting_key: 'max_spins_per_day',
                            setting_value: { value: '100' }
                        }
                    ]);

                if (settingsError) {
                    console.warn('Warning: Failed to create initial settings:', settingsError);
                    // Don't fail the project creation, just log the warning
                }
            } catch (initError) {
                console.warn('Warning: Error creating initial project data:', initError);
                // Don't fail the project creation
            }

            // Generate token for the new admin
            const adminToken = generateToken({
                id: admin.id,
                email: admin.email,
                role: 'project_admin'
            }, project.id);

            // Return success response
            res.status(201).json({
                success: true,
                message: 'Project and admin created successfully',
                data: {
                    project: {
                        id: project.id,
                        name: project.name,
                        slug: project.slug,
                        subdomain: project.subdomain,
                        branding: {
                            logo_url: project.logo_url,
                            primary_color: project.primary_color,
                            secondary_color: project.secondary_color,
                            theme: project.theme
                        },
                        created_at: project.created_at
                    },
                    admin: {
                        id: admin.id,
                        email: admin.email,
                        full_name: admin.full_name,
                        role: admin.role
                    },
                    token: adminToken, // Token for the new admin to use immediately
                    access_urls: {
                        api: subdomain
                            ? `https://${subdomain}.${process.env.DOMAIN || 'yourdomain.com'}/api`
                            : `https://api.${process.env.DOMAIN || 'yourdomain.com'}/api?project_id=${project.id}`,
                        dashboard: subdomain
                            ? `https://${subdomain}.${process.env.DOMAIN || 'yourdomain.com'}`
                            : `https://${process.env.DOMAIN || 'yourdomain.com'}?project=${project.slug}`
                    }
                }
            });

        } catch (error) {
            console.error('Error in create project:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/projects
 * List all projects (master admin only)
 */
router.get(
    '/',
    authenticateToken,
    requireMasterAdmin,
    async (req, res) => {
        try {
            // Fetch all projects - handle missing columns gracefully
            let { data: projects, error } = await supabaseAdmin
                .from('projects')
                .select('*') // Select all columns to avoid missing column errors
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching projects:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch projects',
                    details: error.message
                });
            }

            // Normalize projects data with defaults for missing fields
            const normalizedProjects = (projects || []).map(project => ({
                id: project.id,
                name: project.name || 'Unnamed Project',
                slug: project.slug || project.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `project-${project.id}`,
                subdomain: project.subdomain || null,
                logo_url: project.logo_url || null,
                primary_color: project.primary_color || '#ff914d',
                secondary_color: project.secondary_color || '#ff6b35',
                theme: project.theme || 'light',
                is_active: project.is_active !== false && project.is_active !== null, // Default to true if null/undefined
                read_only: project.read_only || false,
                settings: project.settings || {},
                fee_amount: project.fee_amount !== undefined && project.fee_amount !== null ? Number(project.fee_amount) : 1000000, // Default to 0.001 SOL
                max_lootboxes: project.max_lootboxes || null,
                max_jackpots: project.max_jackpots || null,
                created_at: project.created_at || project.createdAt || new Date().toISOString(),
                updated_at: project.updated_at || project.updatedAt || new Date().toISOString(),
            }));

            console.log(`[BACKEND] Returning ${normalizedProjects.length} projects`);

            res.json({
                success: true,
                data: normalizedProjects,
                count: normalizedProjects.length
            });
        } catch (error) {
            console.error('Error fetching projects:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/projects/:id
 * Get project details by ID
 */
router.get(
    '/:id',
    authenticateToken,
    requireMasterAdmin,
    async (req, res) => {
        try {
            const { data: project, error } = await supabaseAdmin
                .from('projects')
                .select('*')
                .eq('id', req.params.id)
                .single();

            if (error || !project) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            res.json({
                success: true,
                data: project
            });
        } catch (error) {
            console.error('Error fetching project:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * PUT /api/projects/:id
 * Update project details
 */
router.put(
    '/:id',
    authenticateToken,
    requireMasterAdmin,
    async (req, res) => {
        try {
            const { name, slug, subdomain, branding, settings, is_active, fee_amount } = req.body;

            const updateData = {};
            if (name) updateData.name = name;
            if (slug) updateData.slug = slug;
            if (subdomain !== undefined) updateData.subdomain = subdomain;
            if (is_active !== undefined) updateData.is_active = is_active;
            if (fee_amount !== undefined) updateData.fee_amount = parseInt(fee_amount, 10); // Ensure it's an integer
            if (req.body.max_lootboxes !== undefined) updateData.max_lootboxes = req.body.max_lootboxes;
            if (req.body.max_jackpots !== undefined) updateData.max_jackpots = req.body.max_jackpots;
            if (branding) {
                if (branding.logo_url) updateData.logo_url = branding.logo_url;
                if (branding.primary_color) updateData.primary_color = branding.primary_color;
                if (branding.secondary_color) updateData.secondary_color = branding.secondary_color;
                if (branding.theme) updateData.theme = branding.theme;
            }
            if (settings) updateData.settings = settings;

            const { data: project, error } = await supabaseAdmin
                .from('projects')
                .update(updateData)
                .eq('id', req.params.id)
                .select()
                .single();

            if (error || !project) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found or update failed'
                });
            }

            res.json({
                success: true,
                message: 'Project updated successfully',
                data: project
            });
        } catch (error) {
            console.error('Error updating project:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * DELETE /api/projects/:id
 * Permanently delete a project and all its data (HARD DELETE)
 * WARNING: This action cannot be undone!
 * 
 * Query params:
 * - hard: boolean (default: false) - If true, permanently deletes the project
 * - confirm: string - Project name to confirm deletion
 */
router.delete(
    '/:id',
    authenticateToken,
    requireMasterAdmin,
    async (req, res) => {
        try {
            const projectId = parseInt(req.params.id);
            const hardDelete = req.query.hard === 'true';
            const confirmName = req.query.confirm;

            // Fetch project first
            const { data: project, error: fetchError } = await supabaseAdmin
                .from('projects')
                .select('id, name, client_name')
                .eq('id', projectId)
                .single();

            if (fetchError || !project) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            // Require confirmation name for hard delete
            if (hardDelete) {
                if (!confirmName || confirmName !== project.name) {
                    return res.status(400).json({
                        success: false,
                        error: 'Project name confirmation required',
                        message: `Please confirm by providing the exact project name: "${project.name}"`
                    });
                }

                // First, delete all project-related data using the reset function
                try {
                    const { error: resetError } = await supabaseAdmin.rpc('reset_project_data', {
                        target_project_id: projectId
                    });

                    if (resetError) {
                        console.error('Error resetting project data:', resetError);
                        // Continue anyway - try to delete project admins and settings
                    }
                } catch (resetErr) {
                    console.error('Error calling reset_project_data:', resetErr);
                    // Continue with deletion
                }

                // Delete project admins
                await supabaseAdmin
                    .from('project_admins')
                    .delete()
                    .eq('project_id', projectId);

                // Delete project settings
                await supabaseAdmin
                    .from('project_settings')
                    .delete()
                    .eq('project_id', projectId);

                // Delete project tokens
                await supabaseAdmin
                    .from('project_tokens')
                    .delete()
                    .eq('project_id', projectId);

                // Delete project NFTs
                await supabaseAdmin
                    .from('project_nfts')
                    .delete()
                    .eq('project_id', projectId);

                // Delete project jackpot pools
                await supabaseAdmin
                    .from('jackpot_pools')
                    .delete()
                    .eq('project_id', projectId);

                // Finally, delete the project itself
                const { error: deleteError } = await supabaseAdmin
                    .from('projects')
                    .delete()
                    .eq('id', projectId);

                if (deleteError) {
                    throw deleteError;
                }

                res.json({
                    success: true,
                    message: `Project "${project.name}" and all its data have been permanently deleted`,
                    data: { deleted_project_id: projectId }
                });
            } else {
                // Soft delete (default behavior for backward compatibility)
                const { data: updatedProject, error: updateError } = await supabaseAdmin
                    .from('projects')
                    .update({ is_active: false })
                    .eq('id', projectId)
                    .select()
                    .single();

                if (updateError) {
                    throw updateError;
                }

                res.json({
                    success: true,
                    message: 'Project deactivated successfully',
                    data: updatedProject
                });
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * POST /api/projects/:id/admin
 * Set or update project admin credentials
 * Creates admin if doesn't exist, updates if exists
 * 
 * Request body:
 * {
 *   email: string (required),
 *   password: string (required, min 8 characters),
 *   full_name: string (optional)
 * }
 */
router.post(
    '/:id/admin',
    authenticateToken,
    requireMasterAdmin,
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
        body('full_name').optional().trim()
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

            const projectId = parseInt(req.params.id);
            const { email, password, full_name } = req.body;

            // Verify project exists
            const { data: project, error: projectError } = await supabaseAdmin
                .from('projects')
                .select('id, name, slug')
                .eq('id', projectId)
                .single();

            if (projectError || !project) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            // Check if admin already exists for this project
            const { data: existingAdmin, error: checkError } = await supabaseAdmin
                .from('project_admins')
                .select('id, email')
                .eq('project_id', projectId)
                .eq('email', email)
                .single();

            let admin;
            let isNew = false;

            if (existingAdmin && !checkError) {
                // Update existing admin
                const { data: updatedAdmin, error: updateError } = await supabaseAdmin
                    .from('project_admins')
                    .update({
                        password_hash: passwordHash,
                        full_name: full_name || existingAdmin.full_name,
                        is_active: true,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingAdmin.id)
                    .select()
                    .single();

                if (updateError) {
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to update admin',
                        details: updateError.message
                    });
                }

                admin = updatedAdmin;
            } else {
                // Create new admin
                // Check if email exists in another project
                const { data: emailExists } = await supabaseAdmin
                    .from('project_admins')
                    .select('id, project_id')
                    .eq('email', email)
                    .limit(1);

                if (emailExists && emailExists.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'This email is already used for another project'
                    });
                }

                const { data: newAdmin, error: createError } = await supabaseAdmin
                    .from('project_admins')
                    .insert({
                        project_id: projectId,
                        email: email,
                        password_hash: passwordHash,
                        full_name: full_name || null,
                        role: 'admin',
                        is_active: true
                    })
                    .select()
                    .single();

                if (createError) {
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to create admin',
                        details: createError.message
                    });
                }

                admin = newAdmin;
                isNew = true;
            }

            // Generate token for the admin
            const adminToken = generateToken({
                id: admin.id,
                email: admin.email,
                role: 'project_admin'
            }, projectId);

            res.json({
                success: true,
                message: isNew ? 'Admin created successfully' : 'Admin credentials updated successfully',
                data: {
                    admin: {
                        id: admin.id,
                        email: admin.email,
                        full_name: admin.full_name,
                        role: admin.role,
                        project_id: projectId
                    },
                    project: {
                        id: project.id,
                        name: project.name,
                        slug: project.slug
                    },
                    token: adminToken,
                    access_url: `https://${process.env.DOMAIN || 'spinloot.orangutanx.com'}/${project.slug}/auth`
                }
            });

        } catch (error) {
            console.error('Error setting project admin:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * POST /api/projects/:id/auth/change-password
 * Change password for project admin
 * Only accessible by project admins (not master admins)
 * 
 * Request body:
 * {
 *   email: string (required),
 *   oldPassword: string (required),
 *   newPassword: string (required, min 6 characters)
 * }
 */
router.post(
    '/:id/auth/change-password',
    authenticateToken,
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('oldPassword').notEmpty().withMessage('Current password is required'),
        body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
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

            const projectId = parseInt(req.params.id);
            const { email, oldPassword, newPassword } = req.body;

            // Only allow project admins (not master admins) to change their password
            if (!req.user || req.user.role !== 'project_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Only project admins can change their password'
                });
            }

            // Verify the project ID matches the authenticated user's project
            if (req.user.project_id !== projectId) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only change password for your own project'
                });
            }

            // Verify the email matches the authenticated user
            if (req.user.email !== email) {
                return res.status(403).json({
                    success: false,
                    error: 'Email does not match authenticated user'
                });
            }

            // Get the project admin from database
            const { data: projectAdmin, error: adminError } = await supabaseAdmin
                .from('project_admins')
                .select('id, email, password_hash, project_id, is_active')
                .eq('id', req.user.id)
                .eq('project_id', projectId)
                .eq('email', email)
                .eq('is_active', true)
                .single();

            if (adminError || !projectAdmin) {
                return res.status(404).json({
                    success: false,
                    error: 'Project admin not found or inactive'
                });
            }

            // Verify old password
            const passwordValid = await bcrypt.compare(oldPassword, projectAdmin.password_hash);
            if (!passwordValid) {
                return res.status(401).json({
                    success: false,
                    error: 'Current password is incorrect'
                });
            }

            // Check if new password is different from old password
            const samePassword = await bcrypt.compare(newPassword, projectAdmin.password_hash);
            if (samePassword) {
                return res.status(400).json({
                    success: false,
                    error: 'New password must be different from current password'
                });
            }

            // Hash new password
            const newPasswordHash = await bcrypt.hash(newPassword, 10);

            // Update password in database
            const { error: updateError } = await supabaseAdmin
                .from('project_admins')
                .update({
                    password_hash: newPasswordHash,
                    updated_at: new Date().toISOString()
                })
                .eq('id', projectAdmin.id)
                .eq('project_id', projectId);

            if (updateError) {
                console.error('Error updating password:', updateError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update password. Please try again.'
                });
            }

            console.log(`[AUTH] Password changed successfully for project admin: ${email}, project_id=${projectId}`);

            return res.json({
                success: true,
                message: 'Password changed successfully'
            });

        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

export default router;

