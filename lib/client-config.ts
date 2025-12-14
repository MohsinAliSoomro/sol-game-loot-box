/**
 * Client Configuration
 * Loads client-specific settings based on environment variables
 */

export interface ClientConfig {
  clientName: string;
  projectId: number;
  slug: string;
  domain?: string;
  branding: {
    primaryColor: string;
    logo: string;
  };
  features: {
    jackpot: boolean;
    tickets: boolean;
    nfts: boolean;
  };
}

let cachedConfig: ClientConfig | null = null;

/**
 * Get client configuration from environment or config file
 */
export async function getClientConfig(): Promise<ClientConfig | null> {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Try to load from environment variables first
  const projectId = process.env.NEXT_PUBLIC_DEFAULT_PROJECT_ID;
  const clientName = process.env.NEXT_PUBLIC_CLIENT_NAME;
  const clientSlug = process.env.NEXT_PUBLIC_CLIENT_SLUG;

  if (projectId && clientName) {
    cachedConfig = {
      clientName,
      projectId: parseInt(projectId),
      slug: clientSlug || clientName.toLowerCase().replace(/\s+/g, '-'),
      domain: process.env.NEXT_PUBLIC_DOMAIN,
      branding: {
        primaryColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#FF6B35',
        logo: process.env.NEXT_PUBLIC_LOGO || `/logos/${clientSlug || 'default'}.png`,
      },
      features: {
        jackpot: process.env.NEXT_PUBLIC_FEATURE_JACKPOT !== 'false',
        tickets: process.env.NEXT_PUBLIC_FEATURE_TICKETS !== 'false',
        nfts: process.env.NEXT_PUBLIC_FEATURE_NFTS !== 'false',
      },
    };
    return cachedConfig;
  }

  // Try to load from config file (client-side only)
  if (typeof window !== 'undefined') {
    try {
      const slug = clientSlug || 'default';
      const response = await fetch(`/configs/${slug}.json`);
      if (response.ok) {
        cachedConfig = await response.json();
        return cachedConfig;
      }
    } catch (error) {
      console.warn('Failed to load client config file:', error);
    }
  }

  return null;
}

/**
 * Get client theme colors
 */
export function getClientTheme() {
  return {
    primary: process.env.NEXT_PUBLIC_PRIMARY_COLOR || '#FF6B35',
    logo: process.env.NEXT_PUBLIC_LOGO || '/logo.png',
  };
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: 'jackpot' | 'tickets' | 'nfts'): boolean {
  const envKey = `NEXT_PUBLIC_FEATURE_${feature.toUpperCase()}`;
  return process.env[envKey] !== 'false';
}


