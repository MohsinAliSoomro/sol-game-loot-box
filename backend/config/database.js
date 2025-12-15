/**
 * Supabase Database Configuration
 * 
 * This module handles the connection to Supabase and provides
 * helper functions for database operations.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase configuration from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key for admin operations

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
}

/**
 * Create Supabase client with service role key
 * This client has admin privileges and bypasses RLS
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

/**
 * Create Supabase client for regular operations
 * This client respects RLS policies
 */
export const supabase = createClient(
    supabaseUrl,
    process.env.SUPABASE_ANON_KEY || supabaseServiceKey
);

/**
 * Helper function to handle Supabase errors
 */
export function handleSupabaseError(error, defaultMessage = 'Database error') {
    if (error) {
        console.error('Supabase Error:', error);
        return {
            success: false,
            error: error.message || defaultMessage,
            details: error
        };
    }
    return { success: true };
}

/**
 * Test database connection
 */
export async function testConnection() {
    try {
        const { data, error } = await supabaseAdmin
            .from('projects')
            .select('count')
            .limit(1);
        
        if (error) throw error;
        
        console.log('✅ Database connection successful');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        return false;
    }
}

export default {
    supabase,
    supabaseAdmin,
    handleSupabaseError,
    testConnection
};

