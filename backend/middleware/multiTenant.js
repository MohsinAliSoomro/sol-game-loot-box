/**
 * Multi-Tenant Middleware
 * 
 * This middleware handles project isolation by:
 * 1. Extracting project_id from JWT token, subdomain, or request header
 * 2. Verifying the project exists and is active
 * 3. Attaching project context to request object
 * 4. Enforcing access control based on user role
 */

import { supabaseAdmin } from '../config/database.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Extract project identifier from various sources
 * Priority: JWT token > subdomain > header > query param
 */
function extractProjectIdentifier(req) {
    // 1. Try JWT token (highest priority)
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded.project_id) {
                return { source: 'token', identifier: decoded.project_id };
            }
        } catch (error) {
            // Token invalid, continue to other methods
        }
    }

    // 2. Try subdomain (e.g., project1.example.com)
    const host = req.headers.host || '';
    const subdomain = host.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
        return { source: 'subdomain', identifier: subdomain };
    }

    // 3. Try X-Project-Id header
    const projectIdHeader = req.headers['x-project-id'];
    if (projectIdHeader) {
        return { source: 'header', identifier: projectIdHeader };
    }

    // 4. Try query parameter
    const projectIdQuery = req.query.project_id;
    if (projectIdQuery) {
        return { source: 'query', identifier: projectIdQuery };
    }

    return null;
}

/**
 * Resolve project identifier to project_id
 * Handles both numeric IDs and slugs/subdomains
 */
async function resolveProject(identifier) {
    // Try as numeric ID first
    if (!isNaN(identifier)) {
        const { data, error } = await supabaseAdmin
            .from('projects')
            .select('id, name, slug, subdomain, is_active, logo_url, primary_color, secondary_color, theme, settings')
            .eq('id', parseInt(identifier))
            .eq('is_active', true)
            .single();
        
        if (!error && data) {
            return data;
        }
    }

    // Try as slug
    const { data: slugData, error: slugError } = await supabaseAdmin
        .from('projects')
        .select('id, name, slug, subdomain, is_active, logo_url, primary_color, secondary_color, theme, settings')
        .eq('slug', identifier)
        .eq('is_active', true)
        .single();

    if (!slugError && slugData) {
        return slugData;
    }

    // Try as subdomain
    const { data: subdomainData, error: subdomainError } = await supabaseAdmin
        .from('projects')
        .select('id, name, slug, subdomain, is_active, logo_url, primary_color, secondary_color, theme, settings')
        .eq('subdomain', identifier)
        .eq('is_active', true)
        .single();

    if (!subdomainError && subdomainData) {
        return subdomainData;
    }

    return null;
}

/**
 * Main multi-tenant middleware
 * Attaches project context to request object
 */
export async function multiTenantMiddleware(req, res, next) {
    try {
        // Extract project identifier
        const projectInfo = extractProjectIdentifier(req);
        
        if (!projectInfo) {
            return res.status(400).json({
                success: false,
                error: 'Project identifier not found. Provide project_id via token, subdomain, header, or query parameter.'
            });
        }

        // Resolve project
        const project = await resolveProject(projectInfo.identifier);
        
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found or inactive',
                identifier: projectInfo.identifier,
                source: projectInfo.source
            });
        }

        // Attach project context to request
        req.project = project;
        req.projectId = project.id;
        req.projectContext = {
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
            settings: project.settings || {}
        };

        next();
    } catch (error) {
        console.error('Multi-tenant middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resolve project context',
            details: error.message
        });
    }
}

/**
 * Middleware to verify admin access to project
 * Must be used after multiTenantMiddleware and authentication middleware
 */
export function verifyProjectAccess(req, res, next) {
    // Check if user is master admin (can access all projects)
    if (req.user && req.user.role === 'master_admin') {
        return next();
    }

    // Check if user is project admin for this project
    if (req.user && req.user.project_id === req.projectId) {
        return next();
    }

    // Access denied
    return res.status(403).json({
        success: false,
        error: 'Access denied. You do not have permission to access this project.',
        project_id: req.projectId
    });
}

/**
 * Optional: Middleware for subdomain-based routing
 * Use this if you want to automatically detect project from subdomain
 */
export function subdomainMiddleware(req, res, next) {
    const host = req.headers.host || '';
    const parts = host.split('.');
    
    // Extract subdomain (first part before domain)
    if (parts.length >= 3) {
        const subdomain = parts[0];
        req.subdomain = subdomain;
    }
    
    next();
}

/**
 * Helper function to get project branding for API responses
 */
export function getProjectBranding(project) {
    return {
        logo_url: project.logo_url,
        favicon_url: project.favicon_url,
        primary_color: project.primary_color,
        secondary_color: project.secondary_color,
        theme: project.theme,
        name: project.name
    };
}

export default {
    multiTenantMiddleware,
    verifyProjectAccess,
    subdomainMiddleware,
    getProjectBranding
};

