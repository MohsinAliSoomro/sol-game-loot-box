/**
 * Mega Dashboard Database Configuration
 * 
 * This is a separate Supabase instance for the mega dashboard
 * Used to check project creation permissions
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Mega Dashboard Supabase configuration
const megaDashboardUrl = process.env.MEGA_DASHBOARD_SUPABASE_URL;
const megaDashboardServiceKey = process.env.MEGA_DASHBOARD_SERVICE_ROLE_KEY;

/**
 * Create Supabase client for mega dashboard database
 * This is used to check project creation permissions
 */
let megaDashboardAdmin = null;

if (megaDashboardUrl && megaDashboardServiceKey) {
    megaDashboardAdmin = createClient(megaDashboardUrl, megaDashboardServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
} else {
    console.warn('⚠️  Mega Dashboard database not configured. Project creation permissions will not be checked.');
    console.warn('   Set MEGA_DASHBOARD_SUPABASE_URL and MEGA_DASHBOARD_SERVICE_ROLE_KEY in .env');
}

/**
 * Check if project creation is allowed
 */
export async function checkProjectCreationPermission() {
    if (!megaDashboardAdmin) {
        // If mega dashboard DB not configured, allow creation (backward compatibility)
        console.warn('Mega dashboard DB not configured - allowing project creation');
        return { allowed: true, reason: 'Mega dashboard not configured' };
    }

    try {
        const { data: permission, error } = await megaDashboardAdmin
            .from('project_creation_permissions')
            .select('allow_project_creation, reason')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            // If table doesn't exist or error, allow creation (backward compatibility)
            if (error.code === 'PGRST116') {
                console.warn('Project creation permissions table not found - allowing creation');
                return { allowed: true, reason: 'Permissions table not found' };
            }
            console.error('Error checking permission:', error);
            return { allowed: true, reason: 'Error checking permission' };
        }

        return {
            allowed: permission?.allow_project_creation || false,
            reason: permission?.reason || null
        };
    } catch (error) {
        console.error('Error checking project creation permission:', error);
        // On error, allow creation (fail open for backward compatibility)
        return { allowed: true, reason: 'Error checking permission' };
    }
}

export { megaDashboardAdmin };


