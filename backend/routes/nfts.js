/**
 * NFT Management Routes
 * 
 * Handles CRUD operations for project-specific NFTs
 * Uses multi-tenant middleware to ensure data isolation
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { supabaseAdmin } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { multiTenantMiddleware, verifyProjectAccess } from '../middleware/multiTenant.js';

const router = express.Router();

// Apply multi-tenant middleware to all routes
router.use(multiTenantMiddleware);
router.use(authenticateToken);
router.use(requireAdmin);
router.use(verifyProjectAccess);

/**
 * GET /api/nfts
 * Get all NFTs for the current project
 */
router.get('/', async (req, res) => {
    try {
        const { data: nfts, error } = await supabaseAdmin
            .from('project_nfts')
            .select('*')
            .eq('project_id', req.projectId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch NFTs',
                details: error.message
            });
        }

        res.json({
            success: true,
            data: nfts,
            count: nfts.length,
            project: {
                id: req.projectContext.id,
                name: req.projectContext.name
            }
        });
    } catch (error) {
        console.error('Error fetching NFTs:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * POST /api/nfts
 * Create a new NFT for the current project
 */
router.post(
    '/',
    [
        body('name').trim().notEmpty().withMessage('NFT name is required'),
        body('mint_address').optional().isString(),
        body('image_url').optional().isURL().withMessage('Image URL must be valid')
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

            const {
                name,
                description,
                image_url,
                mint_address,
                collection_address,
                rarity,
                attributes
            } = req.body;

            const { data: nft, error } = await supabaseAdmin
                .from('project_nfts')
                .insert({
                    project_id: req.projectId,
                    name,
                    description: description || null,
                    image_url: image_url || null,
                    mint_address: mint_address || null,
                    collection_address: collection_address || null,
                    rarity: rarity || null,
                    attributes: attributes || {}
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating NFT:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to create NFT',
                    details: error.message
                });
            }

            res.status(201).json({
                success: true,
                message: 'NFT created successfully',
                data: nft
            });
        } catch (error) {
            console.error('Error in create NFT:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/nfts/:id
 * Get a specific NFT
 */
router.get('/:id', async (req, res) => {
    try {
        const { data: nft, error } = await supabaseAdmin
            .from('project_nfts')
            .select('*')
            .eq('id', req.params.id)
            .eq('project_id', req.projectId)
            .single();

        if (error || !nft) {
            return res.status(404).json({
                success: false,
                error: 'NFT not found'
            });
        }

        res.json({
            success: true,
            data: nft
        });
    } catch (error) {
        console.error('Error fetching NFT:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * PUT /api/nfts/:id
 * Update an NFT
 */
router.put('/:id', async (req, res) => {
    try {
        const updateData = {};
        const allowedFields = ['name', 'description', 'image_url', 'mint_address', 'collection_address', 'rarity', 'attributes', 'is_active'];
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        const { data: nft, error } = await supabaseAdmin
            .from('project_nfts')
            .update(updateData)
            .eq('id', req.params.id)
            .eq('project_id', req.projectId)
            .select()
            .single();

        if (error || !nft) {
            return res.status(404).json({
                success: false,
                error: 'NFT not found or update failed'
            });
        }

        res.json({
            success: true,
            message: 'NFT updated successfully',
            data: nft
        });
    } catch (error) {
        console.error('Error updating NFT:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * DELETE /api/nfts/:id
 * Soft delete an NFT
 */
router.delete('/:id', async (req, res) => {
    try {
        const { data: nft, error } = await supabaseAdmin
            .from('project_nfts')
            .update({ is_active: false })
            .eq('id', req.params.id)
            .eq('project_id', req.projectId)
            .select()
            .single();

        if (error || !nft) {
            return res.status(404).json({
                success: false,
                error: 'NFT not found'
            });
        }

        res.json({
            success: true,
            message: 'NFT deleted successfully',
            data: nft
        });
    } catch (error) {
        console.error('Error deleting NFT:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

export default router;

