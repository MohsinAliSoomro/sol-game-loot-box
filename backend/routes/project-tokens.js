/**
 * Project Tokens Management Routes
 * 
 * Handles CRUD operations for project-specific tokens
 * Only accessible by project admins
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { supabaseAdmin } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/projects/:projectId/tokens
 * Get all tokens for a project
 */
router.get(
    '/:projectId/tokens',
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const projectId = parseInt(req.params.projectId);
            
            // Verify project access
            if (req.user.role === 'project_admin' && req.user.project_id !== projectId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. You can only manage tokens for your own project.'
                });
            }

            // Get token type filter from query params
            const tokenType = req.query.token_type; // 'offchain' or 'onchain'
            
            let query = supabaseAdmin
                .from('project_tokens')
                .select('*')
                .eq('project_id', projectId);
            
            // Filter by token type if provided
            if (tokenType === 'offchain' || tokenType === 'onchain') {
                query = query.eq('token_type', tokenType);
            }
            
            const { data: tokens, error } = await query
                .order('is_default', { ascending: false })
                .order('display_order', { ascending: true });

            if (error) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch tokens',
                    details: error.message
                });
            }

            res.json({
                success: true,
                data: tokens || []
            });
        } catch (error) {
            console.error('Error fetching project tokens:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * POST /api/projects/:projectId/tokens
 * Add a new token for a project
 */
router.post(
    '/:projectId/tokens',
    authenticateToken,
    requireAdmin,
    [
        body('name').trim().notEmpty().withMessage('Token name is required'),
        body('symbol').trim().notEmpty().withMessage('Token symbol is required'),
        body('mint_address').trim().notEmpty().withMessage('Mint address is required'),
        body('decimals').isInt({ min: 0, max: 18 }).withMessage('Decimals must be between 0 and 18')
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

            const projectId = parseInt(req.params.projectId);
            
            // Verify project access
            if (req.user.role === 'project_admin' && req.user.project_id !== projectId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. You can only manage tokens for your own project.'
                });
            }

            let {
                name,
                symbol,
                mint_address,
                decimals,
                is_default = false,
                is_active = true,
                display_order = 0,
                coingecko_id,
                fallback_price,
                exchange_rate_to_sol,
                token_type = 'onchain' // 'offchain' or 'onchain'
            } = req.body;
            
            // Validate token_type
            if (token_type !== 'offchain' && token_type !== 'onchain') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid token_type. Must be "offchain" or "onchain"'
                });
            }
            
            // For offchain tokens: only one allowed, must be default, no mint address needed
            if (token_type === 'offchain') {
                // Check if offchain token already exists
                const { data: existingOffchain } = await supabaseAdmin
                    .from('project_tokens')
                    .select('id')
                    .eq('project_id', projectId)
                    .eq('token_type', 'offchain')
                    .single();
                
                if (existingOffchain) {
                    return res.status(400).json({
                        success: false,
                        error: 'Off-chain token already exists. You can only have one off-chain token per project. Please edit the existing one instead.'
                    });
                }
                
                // Offchain tokens must be default
                is_default = true;
                // Offchain tokens don't need mint address (they're off-chain)
                if (!mint_address) {
                    mint_address = 'OFFCHAIN'; // Placeholder
                }
            } else {
                // Onchain tokens require mint address
                if (!mint_address || mint_address.trim() === '') {
                    return res.status(400).json({
                        success: false,
                        error: 'Mint address is required for on-chain tokens'
                    });
                }
            }

            // Check if symbol already exists for this project
            const { data: existingToken } = await supabaseAdmin
                .from('project_tokens')
                .select('id')
                .eq('project_id', projectId)
                .eq('symbol', symbol.toUpperCase())
                .single();

            if (existingToken) {
                return res.status(400).json({
                    success: false,
                    error: `Token with symbol "${symbol}" already exists for this project`
                });
            }

            // If setting as default, unset other default tokens
            if (is_default) {
                await supabaseAdmin
                    .from('project_tokens')
                    .update({ is_default: false })
                    .eq('project_id', projectId)
                    .eq('is_default', true);
            }

            // Insert new token
            const { data: token, error: insertError } = await supabaseAdmin
                .from('project_tokens')
                .insert({
                    project_id: projectId,
                    name: name.trim(),
                    symbol: symbol.toUpperCase().trim(),
                    mint_address: token_type === 'offchain' ? 'OFFCHAIN' : mint_address.trim(),
                    decimals: parseInt(decimals),
                    is_default: is_default === true,
                    is_active: is_active !== false,
                    display_order: parseInt(display_order) || 0,
                    coingecko_id: coingecko_id || null,
                    fallback_price: fallback_price ? parseFloat(fallback_price) : 1,
                    exchange_rate_to_sol: exchange_rate_to_sol ? parseFloat(exchange_rate_to_sol) : null,
                    token_type: token_type
                })
                .select()
                .single();

            if (insertError) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to create token',
                    details: insertError.message
                });
            }

            // Update project's default_token_id and token_symbol if this is default
            if (is_default) {
                await supabaseAdmin
                    .from('projects')
                    .update({
                        default_token_id: token.id,
                        token_symbol: token.symbol
                    })
                    .eq('id', projectId);
            }

            res.status(201).json({
                success: true,
                message: 'Token created successfully',
                data: token
            });
        } catch (error) {
            console.error('Error creating token:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * PUT /api/projects/:projectId/tokens/:tokenId
 * Update a token
 */
router.put(
    '/:projectId/tokens/:tokenId',
    authenticateToken,
    requireAdmin,
    [
        body('name').optional().trim().notEmpty().withMessage('Token name cannot be empty'),
        body('symbol').optional().trim().notEmpty().withMessage('Token symbol cannot be empty'),
        body('mint_address').optional().trim().notEmpty().withMessage('Mint address cannot be empty'),
        body('decimals').optional().isInt({ min: 0, max: 18 }).withMessage('Decimals must be between 0 and 18')
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

            const projectId = parseInt(req.params.projectId);
            const tokenId = parseInt(req.params.tokenId);
            
            // Verify project access
            if (req.user.role === 'project_admin' && req.user.project_id !== projectId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. You can only manage tokens for your own project.'
                });
            }

            // Verify token belongs to project
            const { data: existingToken, error: fetchError } = await supabaseAdmin
                .from('project_tokens')
                .select('*')
                .eq('id', tokenId)
                .eq('project_id', projectId)
                .single();

            if (fetchError || !existingToken) {
                return res.status(404).json({
                    success: false,
                    error: 'Token not found'
                });
            }

            const {
                name,
                symbol,
                mint_address,
                decimals,
                is_default,
                is_active,
                display_order,
                coingecko_id,
                fallback_price,
                exchange_rate_to_sol,
                token_type
            } = req.body;
            
            // For offchain tokens: only allow editing name and symbol, no mint address change
            if (existingToken.token_type === 'offchain') {
                // Offchain tokens can only have name and symbol updated
                if (mint_address && mint_address !== 'OFFCHAIN' && mint_address !== existingToken.mint_address) {
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot change mint address for off-chain tokens'
                    });
                }
                // Offchain tokens must remain default
                if (is_default === false) {
                    return res.status(400).json({
                        success: false,
                        error: 'Off-chain token must remain as default token'
                    });
                }
            }

            // Check if symbol already exists (if changing)
            if (symbol && symbol.toUpperCase() !== existingToken.symbol) {
                const { data: symbolExists } = await supabaseAdmin
                    .from('project_tokens')
                    .select('id')
                    .eq('project_id', projectId)
                    .eq('symbol', symbol.toUpperCase())
                    .neq('id', tokenId)
                    .single();

                if (symbolExists) {
                    return res.status(400).json({
                        success: false,
                        error: `Token with symbol "${symbol}" already exists for this project`
                    });
                }
            }

            // If setting as default, unset other default tokens
            if (is_default === true && !existingToken.is_default) {
                await supabaseAdmin
                    .from('project_tokens')
                    .update({ is_default: false })
                    .eq('project_id', projectId)
                    .eq('is_default', true)
                    .neq('id', tokenId);
            }

            // Build update object
            const updateData = {};
            if (name !== undefined) updateData.name = name.trim();
            if (symbol !== undefined) updateData.symbol = symbol.toUpperCase().trim();
            // Only update mint_address for onchain tokens
            if (mint_address !== undefined && existingToken.token_type === 'onchain') {
                updateData.mint_address = mint_address.trim();
            }
            if (decimals !== undefined) updateData.decimals = parseInt(decimals);
            if (is_default !== undefined) updateData.is_default = is_default === true;
            if (is_active !== undefined) updateData.is_active = is_active === true;
            if (display_order !== undefined) updateData.display_order = parseInt(display_order) || 0;
            if (coingecko_id !== undefined) updateData.coingecko_id = coingecko_id || null;
            if (fallback_price !== undefined) updateData.fallback_price = fallback_price ? parseFloat(fallback_price) : 1;
            if (exchange_rate_to_sol !== undefined) updateData.exchange_rate_to_sol = exchange_rate_to_sol ? parseFloat(exchange_rate_to_sol) : null;
            if (token_type !== undefined) updateData.token_type = token_type;

            // Update token
            const { data: updatedToken, error: updateError } = await supabaseAdmin
                .from('project_tokens')
                .update(updateData)
                .eq('id', tokenId)
                .eq('project_id', projectId)
                .select()
                .single();

            if (updateError) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update token',
                    details: updateError.message
                });
            }

            // Update project's default_token_id and token_symbol if this is now default
            if (is_default === true) {
                await supabaseAdmin
                    .from('projects')
                    .update({
                        default_token_id: updatedToken.id,
                        token_symbol: updatedToken.symbol
                    })
                    .eq('id', projectId);
            }

            res.json({
                success: true,
                message: 'Token updated successfully',
                data: updatedToken
            });
        } catch (error) {
            console.error('Error updating token:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * DELETE /api/projects/:projectId/tokens/:tokenId
 * Delete a token
 */
router.delete(
    '/:projectId/tokens/:tokenId',
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const projectId = parseInt(req.params.projectId);
            const tokenId = parseInt(req.params.tokenId);
            
            // Verify project access
            if (req.user.role === 'project_admin' && req.user.project_id !== projectId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. You can only manage tokens for your own project.'
                });
            }

            // Verify token belongs to project
            const { data: token, error: fetchError } = await supabaseAdmin
                .from('project_tokens')
                .select('*')
                .eq('id', tokenId)
                .eq('project_id', projectId)
                .single();

            if (fetchError || !token) {
                return res.status(404).json({
                    success: false,
                    error: 'Token not found'
                });
            }

            // Prevent deleting offchain token (it's the project's native token)
            if (token.token_type === 'offchain') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete off-chain token. This is your project\'s native token. You can only edit its name and symbol.'
                });
            }
            
            // Prevent deleting default token
            if (token.is_default) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete default token. Set another token as default first.'
                });
            }

            // Delete token
            const { error: deleteError } = await supabaseAdmin
                .from('project_tokens')
                .delete()
                .eq('id', tokenId)
                .eq('project_id', projectId);

            if (deleteError) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to delete token',
                    details: deleteError.message
                });
            }

            res.json({
                success: true,
                message: 'Token deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting token:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * PATCH /api/projects/:projectId/tokens/:tokenId/set-default
 * Set a token as default
 */
router.patch(
    '/:projectId/tokens/:tokenId/set-default',
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const projectId = parseInt(req.params.projectId);
            const tokenId = parseInt(req.params.tokenId);
            
            // Verify project access
            if (req.user.role === 'project_admin' && req.user.project_id !== projectId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. You can only manage tokens for your own project.'
                });
            }

            // Verify token belongs to project and is active
            const { data: token, error: fetchError } = await supabaseAdmin
                .from('project_tokens')
                .select('*')
                .eq('id', tokenId)
                .eq('project_id', projectId)
                .single();

            if (fetchError || !token) {
                return res.status(404).json({
                    success: false,
                    error: 'Token not found'
                });
            }

            if (!token.is_active) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot set inactive token as default'
                });
            }

            // Unset other default tokens
            await supabaseAdmin
                .from('project_tokens')
                .update({ is_default: false })
                .eq('project_id', projectId)
                .eq('is_default', true)
                .neq('id', tokenId);

            // Set this token as default
            const { data: updatedToken, error: updateError } = await supabaseAdmin
                .from('project_tokens')
                .update({ is_default: true })
                .eq('id', tokenId)
                .eq('project_id', projectId)
                .select()
                .single();

            if (updateError) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to set default token',
                    details: updateError.message
                });
            }

            // Update project's default_token_id and token_symbol
            await supabaseAdmin
                .from('projects')
                .update({
                    default_token_id: updatedToken.id,
                    token_symbol: updatedToken.symbol
                })
                .eq('id', projectId);

            res.json({
                success: true,
                message: 'Default token updated successfully',
                data: updatedToken
            });
        } catch (error) {
            console.error('Error setting default token:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

export default router;

