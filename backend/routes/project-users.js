/**
 * Project Users API Routes
 * 
 * Handles multi-tenant user operations
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import {
    getOrCreateProjectUser,
    getProjectUser,
    updateProjectUserBalance,
    getProjectTokenBalance,
    updateProjectTokenBalance,
    getAllProjectTokenBalances,
    getProjectIdBySlug
} from '../services/projectUserService.js';

const router = express.Router();

/**
 * POST /api/projects/:projectSlug/users/get-or-create
 * Get or create a project user for a wallet
 * Note: No authentication required - wallet users don't have JWT tokens
 */
router.post(
    '/:projectSlug/users/get-or-create',
    // authenticateToken removed - wallet users don't have JWT tokens
    [
        body('wallet_address').trim().notEmpty().withMessage('Wallet address is required'),
        body('username').optional({ nullable: true, checkFalsy: true }).trim(),
        body('avatar').optional({ nullable: true, checkFalsy: true }).trim(),
        body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email must be a valid email address'),
        body('full_name').optional({ nullable: true, checkFalsy: true }).trim()
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

            const { projectSlug } = req.params;
            const { wallet_address, username, avatar, email, full_name } = req.body;

            // Get project ID
            const projectId = await getProjectIdBySlug(projectSlug);
            if (!projectId) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            // Get or create user
            const result = await getOrCreateProjectUser(projectId, wallet_address, {
                username,
                avatar,
                email,
                full_name
            });

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    error: result.error || 'Failed to get or create user'
                });
            }

            res.json({
                success: true,
                user: result.user,
                isNew: result.isNew
            });
        } catch (error) {
            console.error('Error in get-or-create user:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/projects/:projectSlug/users/:walletAddress
 * Get project user by wallet address
 * Note: No authentication required - wallet users don't have JWT tokens
 */
router.get(
    '/:projectSlug/users/:walletAddress',
    // authenticateToken removed - wallet users don't have JWT tokens
    async (req, res) => {
        try {
            const { projectSlug, walletAddress } = req.params;

            // Get project ID
            const projectId = await getProjectIdBySlug(projectSlug);
            if (!projectId) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            // Get user
            const result = await getProjectUser(projectId, walletAddress);

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    error: result.error || 'Failed to get user'
                });
            }

            if (!result.user) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found in this project'
                });
            }

            res.json({
                success: true,
                user: result.user
            });
        } catch (error) {
            console.error('Error getting user:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * PATCH /api/projects/:projectSlug/users/:walletAddress/balance
 * Update project user balance
 */
router.patch(
    '/:projectSlug/users/:walletAddress/balance',
    authenticateToken,
    [
        body('balance').isNumeric().withMessage('Balance must be a number')
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

            const { projectSlug, walletAddress } = req.params;
            const { balance } = req.body;

            // Get project ID
            const projectId = await getProjectIdBySlug(projectSlug);
            if (!projectId) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            // Update balance
            const result = await updateProjectUserBalance(projectId, walletAddress, parseFloat(balance));

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    error: result.error || 'Failed to update balance'
                });
            }

            res.json({
                success: true,
                user: result.user
            });
        } catch (error) {
            console.error('Error updating balance:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * GET /api/projects/:projectSlug/users/:walletAddress/token-balances
 * Get all token balances for a user in a project
 */
router.get(
    '/:projectSlug/users/:walletAddress/token-balances',
    authenticateToken,
    async (req, res) => {
        try {
            const { projectSlug, walletAddress } = req.params;

            // Get project ID
            const projectId = await getProjectIdBySlug(projectSlug);
            if (!projectId) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            // Get balances
            const result = await getAllProjectTokenBalances(projectId, walletAddress);

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    error: result.error || 'Failed to get balances'
                });
            }

            res.json({
                success: true,
                balances: result.balances
            });
        } catch (error) {
            console.error('Error getting token balances:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

/**
 * PATCH /api/projects/:projectSlug/users/:walletAddress/token-balances/:tokenId
 * Update token balance for a user
 */
router.patch(
    '/:projectSlug/users/:walletAddress/token-balances/:tokenId',
    authenticateToken,
    [
        body('balance').isNumeric().withMessage('Balance must be a number')
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

            const { projectSlug, walletAddress, tokenId } = req.params;
            const { balance } = req.body;

            // Get project ID
            const projectId = await getProjectIdBySlug(projectSlug);
            if (!projectId) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            // Update balance
            const result = await updateProjectTokenBalance(
                projectId,
                walletAddress,
                tokenId,
                parseFloat(balance)
            );

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    error: result.error || 'Failed to update token balance'
                });
            }

            res.json({
                success: true,
                balance: result.balance
            });
        } catch (error) {
            console.error('Error updating token balance:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: error.message
            });
        }
    }
);

export default router;

