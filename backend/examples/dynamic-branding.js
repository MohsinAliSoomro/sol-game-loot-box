/**
 * Example: Dynamic Branding in API Responses
 * 
 * This example shows how to include project branding
 * in your API responses dynamically
 */

import { multiTenantMiddleware, getProjectBranding } from '../middleware/multiTenant.js';

/**
 * Example 1: Include branding in all responses
 * 
 * This middleware adds branding to all responses automatically
 */
export function brandingResponseMiddleware(req, res, next) {
    // Store original json method
    const originalJson = res.json;

    // Override json method to include branding
    res.json = function(data) {
        // Only add branding if project context exists
        if (req.projectContext) {
            const response = {
                ...data,
                branding: getProjectBranding(req.project),
                project: {
                    id: req.projectContext.id,
                    name: req.projectContext.name,
                    slug: req.projectContext.slug
                }
            };
            return originalJson.call(this, response);
        }
        
        return originalJson.call(this, data);
    };

    next();
}

/**
 * Example 2: Custom endpoint with branding
 */
export function createBrandedEndpoint(router) {
    router.get('/api/dashboard', multiTenantMiddleware, (req, res) => {
        res.json({
            success: true,
            data: {
                // Your dashboard data
                stats: {
                    total_nfts: 100,
                    total_jackpots: 5
                },
                // Automatically include branding
                branding: getProjectBranding(req.project),
                project: req.projectContext
            }
        });
    });
}

/**
 * Example 3: Frontend integration example
 * 
 * How to use branding in your frontend:
 */

/*
// React/Next.js example
import { useEffect, useState } from 'react';

function useProjectBranding(projectId) {
    const [branding, setBranding] = useState(null);

    useEffect(() => {
        fetch(`/api/branding?project_id=${projectId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                setBranding(data.data.branding);
                
                // Apply branding to document
                document.documentElement.style.setProperty(
                    '--primary-color', 
                    data.data.branding.primary_color
                );
                document.documentElement.style.setProperty(
                    '--secondary-color', 
                    data.data.branding.secondary_color
                );
            }
        });
    }, [projectId]);

    return branding;
}

// Usage in component
function App() {
    const branding = useProjectBranding(projectId);
    
    return (
        <div style={{ 
            backgroundColor: branding?.primary_color,
            color: branding?.secondary_color 
        }}>
            {branding?.logo_url && (
                <img src={branding.logo_url} alt="Logo" />
            )}
        </div>
    );
}
*/

/**
 * Example 4: CSS Variables injection
 */
export function injectBrandingCSS(branding) {
    return `
        :root {
            --primary-color: ${branding.primary_color};
            --secondary-color: ${branding.secondary_color};
            --theme: ${branding.theme};
        }
        
        body {
            background-color: var(--primary-color);
            color: var(--secondary-color);
        }
        
        .logo {
            background-image: url('${branding.logo_url}');
        }
    `;
}

/**
 * Example 5: Express route with branding injection
 */
export function createBrandedPageRoute(router) {
    router.get('/dashboard', multiTenantMiddleware, (req, res) => {
        const branding = getProjectBranding(req.project);
        
        // Inject CSS variables into HTML
        const css = injectBrandingCSS(branding);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${req.projectContext.name} Dashboard</title>
                <style>${css}</style>
            </head>
            <body>
                <div class="logo"></div>
                <h1>Welcome to ${req.projectContext.name}</h1>
                <!-- Your dashboard content -->
            </body>
            </html>
        `);
    });
}

export default {
    brandingResponseMiddleware,
    createBrandedEndpoint,
    injectBrandingCSS,
    createBrandedPageRoute
};

