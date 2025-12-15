/**
 * Project User Service
 * 
 * Handles multi-tenant user operations with complete project isolation
 * Same wallet = different profiles per project
 */

import { supabaseAdmin } from '../config/database.js';

/**
 * Get project ID by slug
 */
export async function getProjectIdBySlug(slug) {
    try {
        const { data, error } = await supabaseAdmin
            .from('projects')
            .select('id')
            .eq('slug', slug)
            .single();

        if (error) {
            console.error('Error fetching project:', error);
            return null;
        }

        // Return integer ID (projects.id is INTEGER/SERIAL)
        return data?.id || null;
    } catch (error) {
        console.error('Error in getProjectIdBySlug:', error);
        return null;
    }
}

/**
 * Get or create project user
 * Creates a new profile for wallet in this project if doesn't exist
 */
export async function getOrCreateProjectUser(projectId, walletAddress, options = {}) {
    try {
        // Ensure projectId is INTEGER (matches existing projects.id type)
        const projectIntId = parseInt(projectId);
        
        if (!projectIntId || isNaN(projectIntId)) {
            throw new Error('Invalid project ID - must be an integer');
        }

        // Check if user exists
        const { data: existingUser, error: fetchError } = await supabaseAdmin
            .from('project_users')
            .select('*')
            .eq('project_id', projectIntId)
            .eq('wallet_address', walletAddress)
            .single();

        if (existingUser && !fetchError) {
            console.log(`✅ Found existing project user for wallet ${walletAddress} in project ${projectIntId}`);
            return { success: true, user: existingUser, isNew: false };
        }

        // Create new project user
        const { data: newUser, error: createError } = await supabaseAdmin
            .from('project_users')
            .insert({
                project_id: projectIntId,
                wallet_address: walletAddress,
                username: options.username || null,
                avatar: options.avatar || null,
                email: options.email || null,
                full_name: options.full_name || null,
                provider: options.provider || 'wallet',
                apes: 0,
                total_spending: 0
            })
            .select()
            .single();

        if (createError) {
            console.error('Error creating project user:', createError);
            throw createError;
        }

        console.log(`✅ Created new project user for wallet ${walletAddress} in project ${projectIntId}`);
        return { success: true, user: newUser, isNew: true };
    } catch (error) {
        console.error('Error in getOrCreateProjectUser:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get project user by wallet and project
 */
export async function getProjectUser(projectId, walletAddress) {
    try {
        const projectIntId = parseInt(projectId);
        
        if (!projectIntId || isNaN(projectIntId)) {
            throw new Error('Invalid project ID - must be an integer');
        }

        const { data, error } = await supabaseAdmin
            .from('project_users')
            .select('*')
            .eq('project_id', projectIntId)
            .eq('wallet_address', walletAddress)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return { success: true, user: data || null };
    } catch (error) {
        console.error('Error in getProjectUser:', error);
        return { success: false, error: error.message, user: null };
    }
}

/**
 * Update project user balance
 */
export async function updateProjectUserBalance(projectId, walletAddress, balance) {
    try {
        const projectIntId = parseInt(projectId);
        
        if (!projectIntId || isNaN(projectIntId)) {
            throw new Error('Invalid project ID - must be an integer');
        }

        const { data, error } = await supabaseAdmin
            .from('project_users')
            .update({ 
                apes: balance,
                updated_at: new Date().toISOString()
            })
            .eq('project_id', projectIntId)
            .eq('wallet_address', walletAddress)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return { success: true, user: data };
    } catch (error) {
        console.error('Error updating project user balance:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get project token balance for a wallet
 */
export async function getProjectTokenBalance(projectId, walletAddress, tokenId) {
    try {
        const projectIntId = parseInt(projectId);
        const tokenIntId = parseInt(tokenId);
        
        if (!projectIntId || isNaN(projectIntId)) {
            throw new Error('Invalid project ID - must be an integer');
        }
        
        if (!tokenIntId || isNaN(tokenIntId)) {
            throw new Error('Invalid token ID - must be an integer');
        }

        const { data, error } = await supabaseAdmin
            .from('project_token_balances')
            .select('*')
            .eq('project_id', projectIntId)
            .eq('wallet_address', walletAddress)
            .eq('token_id', tokenIntId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return { success: true, balance: data?.balance || 0, record: data };
    } catch (error) {
        console.error('Error getting project token balance:', error);
        return { success: false, error: error.message, balance: 0 };
    }
}

/**
 * Update project token balance
 */
export async function updateProjectTokenBalance(projectId, walletAddress, tokenId, balance) {
    try {
        const projectIntId = parseInt(projectId);
        const tokenIntId = parseInt(tokenId);
        
        if (!projectIntId || isNaN(projectIntId)) {
            throw new Error('Invalid project ID - must be an integer');
        }
        
        if (!tokenIntId || isNaN(tokenIntId)) {
            throw new Error('Invalid token ID - must be an integer');
        }

        const { data, error } = await supabaseAdmin
            .from('project_token_balances')
            .upsert({
                project_id: projectIntId,
                wallet_address: walletAddress,
                token_id: tokenIntId,
                balance: balance,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'project_id,wallet_address,token_id'
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        return { success: true, balance: data };
    } catch (error) {
        console.error('Error updating project token balance:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all token balances for a wallet in a project
 */
export async function getAllProjectTokenBalances(projectId, walletAddress) {
    try {
        const projectIntId = parseInt(projectId);
        
        if (!projectIntId || isNaN(projectIntId)) {
            throw new Error('Invalid project ID - must be an integer');
        }

        const { data, error } = await supabaseAdmin
            .from('project_token_balances')
            .select(`
                *,
                project_tokens (
                    token_name,
                    token_symbol,
                    decimals,
                    mint_address
                )
            `)
            .eq('project_id', projectIntId)
            .eq('wallet_address', walletAddress);

        if (error) {
            throw error;
        }

        return { success: true, balances: data || [] };
    } catch (error) {
        console.error('Error getting all project token balances:', error);
        return { success: false, error: error.message, balances: [] };
    }
}

