/**
 * Backend API Client
 * 
 * Client for interacting with the multi-tenant whitelabel backend API
 */

// Get backend URL from environment or use default, ensuring it's always an absolute URL
const getBackendUrl = (): string => {
  let url = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://spinlootbackend-production-f64b.up.railway.app/api';
  
  // Strip leading slashes (which would make it a relative path)
  url = url.trim().replace(/^\/+/, '');
  
  // Ensure the URL is properly formatted (must start with http:// or https://)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.warn(`Backend URL missing protocol, prepending https://: ${url}`);
    url = `https://${url}`;
  }
  
  // Final validation: ensure it's an absolute URL (not relative)
  if (!url.match(/^https?:\/\//)) {
    throw new Error(`Invalid backend URL format: ${url}. Must be an absolute URL starting with http:// or https://`);
  }
  
  return url;
};

const API_BASE_URL = getBackendUrl();

// Log in development to help debug
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('Backend API URL:', API_BASE_URL);
}

export interface BackendProject {
  id: number;
  name: string;
  slug: string;
  subdomain?: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  theme: string;
  is_active: boolean;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  fee_amount?: number;
  max_lootboxes?: number;
  max_jackpots?: number;
}

export interface CreateProjectRequest {
  name: string;
  slug?: string;
  subdomain?: string;
  admin_email: string;
  admin_password: string;
  admin_full_name?: string;
  branding?: {
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    theme?: string;
  };
  fee_amount?: number;
  max_lootboxes?: number;
  max_jackpots?: number;
  token_limit?: number;
}

export interface CreateProjectResponse {
  success: boolean;
  message: string;
  data: {
    project: BackendProject;
    admin: {
      id: number;
      email: string;
      full_name?: string;
      role: string;
    };
    token: string;
    access_urls: {
      api: string;
      dashboard: string;
    };
  };
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: number;
      email: string;
      full_name?: string;
      role: 'master_admin' | 'project_admin';
      project_id?: number;
    };
    token: string;
    project?: BackendProject;
  };
}

/**
 * Get authentication token from localStorage or sessionStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  // Check localStorage first (persistent), then sessionStorage
  return localStorage.getItem('backend_auth_token') || sessionStorage.getItem('backend_auth_token');
}

/**
 * Set authentication token
 */
export function setAuthToken(token: string, persistent: boolean = true): void {
  if (typeof window === 'undefined') return;
  if (persistent) {
    localStorage.setItem('backend_auth_token', token);
  } else {
    sessionStorage.setItem('backend_auth_token', token);
  }
}

/**
 * Remove authentication token
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('backend_auth_token');
  sessionStorage.removeItem('backend_auth_token');
}

/**
 * Make API request with authentication
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorObj: any = new Error(error.error || error.message || `HTTP ${response.status}`);
    // Preserve error details for validation errors
    if (error.details) {
      errorObj.details = error.details;
    }
    if (error.error) {
      errorObj.error = error.error;
    }
    
    // If token expired (401), clear it so login form appears
    if (response.status === 401) {
      clearAuthToken();
      errorObj.status = 401;
      errorObj.isTokenExpired = true;
    }
    
    throw errorObj;
  }

  return response.json();
}

/**
 * Authentication API
 */
export const authAPI = {
  /**
   * Login as master admin or project admin
   */
  async login(email: string, password: string, projectId?: number): Promise<LoginResponse> {
    const response = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, project_id: projectId }),
    });

    if (response.success && response.data.token) {
      setAuthToken(response.data.token, true);
    }

    return response;
  },

  /**
   * Logout
   */
  logout(): void {
    clearAuthToken();
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return getAuthToken() !== null;
  },
};

/**
 * Projects API
 */
export const projectsAPI = {
  /**
   * Create a new whitelabel project
   */
  async create(data: CreateProjectRequest): Promise<CreateProjectResponse> {
    return apiRequest<CreateProjectResponse>('/projects/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * List all projects (master admin only)
   */
  async list(): Promise<{ success: boolean; data: BackendProject[]; count: number }> {
    return apiRequest('/projects');
  },

  /**
   * Get project by ID
   */
  async getById(id: number): Promise<{ success: boolean; data: BackendProject }> {
    return apiRequest(`/projects/${id}`);
  },

  /**
   * Update project
   */
  async update(
    id: number,
    updates: Partial<BackendProject>
  ): Promise<{ success: boolean; message: string; data: BackendProject }> {
    return apiRequest(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Deactivate project (soft delete)
   */
  async deactivate(id: number): Promise<{ success: boolean; message: string; data: BackendProject }> {
    return apiRequest(`/projects/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Set or update project admin credentials
   */
  async setAdmin(
    id: number,
    adminData: {
      email: string;
      password: string;
      full_name?: string;
    }
  ): Promise<{
    success: boolean;
    message: string;
    data: {
      admin: {
        id: number;
        email: string;
        full_name: string | null;
        role: string;
        project_id: number;
      };
      project: {
        id: number;
        name: string;
        slug: string;
      };
      token: string;
      access_url: string;
    };
  }> {
    return apiRequest(`/projects/${id}/admin`, {
      method: 'POST',
      body: JSON.stringify(adminData),
    });
  },
};

/**
 * Branding API
 */
export const brandingAPI = {
  /**
   * Get project branding
   * Automatically detects project from subdomain, header, or query param
   */
  async get(projectId?: number): Promise<{
    success: boolean;
    data: {
      branding: {
        logo_url?: string;
        favicon_url?: string;
        primary_color: string;
        secondary_color: string;
        theme: string;
        name: string;
      };
      project: {
        id: number;
        name: string;
        slug: string;
      };
    };
  }> {
    const endpoint = projectId ? `/branding?project_id=${projectId}` : '/branding';
    return apiRequest(endpoint);
  },
};

/**
 * NFTs API (project-specific)
 */
export const nftsAPI = {
  /**
   * Get all NFTs for current project
   */
  async list(projectId?: number): Promise<{
    success: boolean;
    data: any[];
    count: number;
    project: { id: number; name: string };
  }> {
    const endpoint = projectId ? `/nfts?project_id=${projectId}` : '/nfts';
    return apiRequest(endpoint);
  },

  /**
   * Create NFT
   */
  async create(data: {
    name: string;
    description?: string;
    image_url?: string;
    mint_address?: string;
    collection_address?: string;
    rarity?: string;
    attributes?: Record<string, any>;
  }, projectId?: number): Promise<{ success: boolean; message: string; data: any }> {
    const endpoint = projectId ? `/nfts?project_id=${projectId}` : '/nfts';
    return apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export default {
  auth: authAPI,
  projects: projectsAPI,
  branding: brandingAPI,
  nfts: nftsAPI,
};

