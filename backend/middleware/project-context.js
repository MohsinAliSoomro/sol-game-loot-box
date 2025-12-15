/**
 * Project Context Middleware
 * 
 * Sets the PostgreSQL session variable for project context
 * This enables RLS policies to filter data by project_id
 */

import { supabaseAdmin } from '../config/database.js';

/**
 * Set project context for the current database session
 * This sets app.current_project_id which RLS policies use
 * 
 * @param {number} projectId - The project ID to set as context
 * @returns {Promise<void>}
 */
export async function setProjectContext(projectId) {
  if (!projectId) {
    throw new Error('Project ID is required');
  }

  try {
    // Set the session variable using a raw SQL query
    // Note: This requires the service role key to execute
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      query: `SET LOCAL app.current_project_id = ${projectId};`
    });

    if (error) {
      console.warn('Failed to set project context via RPC, using direct filtering instead:', error);
      // Fallback: Don't throw, just log warning
      // The application should filter by project_id directly in queries
    }
  } catch (err) {
    console.warn('Error setting project context:', err);
    // Don't throw - allow queries to proceed with direct filtering
  }
}

/**
 * Get project by slug
 * 
 * @param {string} slug - Project slug
 * @returns {Promise<Object|null>} Project data or null
 */
export async function getProjectBySlug(slug) {
  try {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Error getting project by slug:', err);
    throw err;
  }
}

/**
 * Get project ID by slug
 * 
 * @param {string} slug - Project slug
 * @returns {Promise<number|null>} Project ID or null
 */
export async function getProjectIdBySlug(slug) {
  try {
    const project = await getProjectBySlug(slug);
    return project ? project.id : null;
  } catch (err) {
    console.error('Error getting project ID by slug:', err);
    throw err;
  }
}

/**
 * Validate admin access to project
 * 
 * @param {string} projectSlug - Project slug
 * @param {string} adminEmail - Admin email
 * @returns {Promise<boolean>} True if admin has access
 */
export async function validateProjectAdmin(projectSlug, adminEmail) {
  try {
    const project = await getProjectBySlug(projectSlug);
    if (!project) {
      return false;
    }

    const { data, error } = await supabaseAdmin
      .from('project_admins')
      .select('id')
      .eq('project_id', project.id)
      .eq('email', adminEmail)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return false; // Admin not found
      }
      throw error;
    }

    return !!data;
  } catch (err) {
    console.error('Error validating project admin:', err);
    return false;
  }
}

/**
 * Express middleware to set project context from URL slug
 * 
 * Usage:
 *   app.use('/api/:projectSlug', setProjectContextMiddleware);
 */
export function setProjectContextMiddleware(req, res, next) {
  const projectSlug = req.params.projectSlug;

  if (!projectSlug) {
    return next(); // No project slug, skip context setting
  }

  // Get project ID and set context
  getProjectIdBySlug(projectSlug)
    .then(projectId => {
      if (projectId) {
        req.projectId = projectId;
        req.projectSlug = projectSlug;
        // Note: Setting session variable requires raw SQL
        // For now, we'll just attach to request object
        // The route handlers should filter by project_id directly
      }
      next();
    })
    .catch(err => {
      console.error('Error setting project context:', err);
      next(err);
    });
}

export default {
  setProjectContext,
  getProjectBySlug,
  getProjectIdBySlug,
  validateProjectAdmin,
  setProjectContextMiddleware
};

