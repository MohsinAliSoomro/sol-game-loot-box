/**
 * Project User Service (Frontend)
 * 
 * Handles multi-tenant user operations from the frontend
 * Ensures same wallet gets different profiles per project
 */

// BACKEND_API_URL should be base URL (without /api) since we append /api in fetch calls
// Remove /api if present, then code will add it
const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || '';
const BACKEND_API_URL = BACKEND_BASE_URL.replace(/\/api\/?$/, ''); // Remove trailing /api if present

export interface ProjectUser {
  id: string;
  project_id: string;
  wallet_address: string;
  username?: string;
  avatar?: string;
  email?: string;
  full_name?: string;
  provider: string;
  apes: number;
  total_spending: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectTokenBalance {
  id: string;
  project_id: number; // INTEGER
  wallet_address: string;
  token_id: number; // INTEGER (matches project_tokens.id which is SERIAL)
  balance: number;
  project_tokens?: {
    token_name: string;
    token_symbol: string;
    decimals: number;
    mint_address: string;
  };
}

/**
 * Get or create project user for a wallet
 */
export async function getOrCreateProjectUser(
  projectSlug: string,
  walletAddress: string,
  options?: {
    username?: string;
    avatar?: string;
    email?: string;
    full_name?: string;
  }
): Promise<{ success: boolean; user?: ProjectUser; isNew?: boolean; error?: string }> {
  try {
    // No authentication token needed - wallet users don't have JWT tokens
    const response = await fetch(
      `${BACKEND_API_URL}/api/projects/${projectSlug}/users/get-or-create`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          wallet_address: walletAddress,
          ...(options ? Object.fromEntries(
            Object.entries(options).filter(([_, value]) => value !== null && value !== undefined)
          ) : {})
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Include validation details if available
      const errorMessage = data.details 
        ? `${data.error || 'Validation failed'}: ${JSON.stringify(data.details)}`
        : data.error || 'Failed to get or create user';
      
      console.error('API Error:', {
        status: response.status,
        error: data.error,
        details: data.details
      });
      
      return {
        success: false,
        error: errorMessage
      };
    }

    return {
      success: true,
      user: data.user,
      isNew: data.isNew
    };
  } catch (error: any) {
    console.error('Error getting or creating project user:', error);
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * Get project user by wallet address
 */
export async function getProjectUser(
  projectSlug: string,
  walletAddress: string
): Promise<{ success: boolean; user?: ProjectUser; error?: string }> {
  try {
    // No authentication token needed - wallet users don't have JWT tokens
    const response = await fetch(
      `${BACKEND_API_URL}/api/projects/${projectSlug}/users/${walletAddress}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: 'User not found in this project'
        };
      }
      return {
        success: false,
        error: data.error || 'Failed to get user'
      };
    }

    return {
      success: true,
      user: data.user
    };
  } catch (error: any) {
    console.error('Error getting project user:', error);
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * Update project user balance
 */
export async function updateProjectUserBalance(
  projectSlug: string,
  walletAddress: string,
  balance: number
): Promise<{ success: boolean; user?: ProjectUser; error?: string }> {
  try {
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('auth_token') || ''
      : '';

    const response = await fetch(
      `${BACKEND_API_URL}/api/projects/${projectSlug}/users/${walletAddress}/balance`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          balance: balance
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to update balance'
      };
    }

    return {
      success: true,
      user: data.user
    };
  } catch (error: any) {
    console.error('Error updating project user balance:', error);
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * Get all token balances for a user in a project
 */
export async function getAllProjectTokenBalances(
  projectSlug: string,
  walletAddress: string
): Promise<{ success: boolean; balances?: ProjectTokenBalance[]; error?: string }> {
  try {
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('auth_token') || ''
      : '';

    const response = await fetch(
      `${BACKEND_API_URL}/api/projects/${projectSlug}/users/${walletAddress}/token-balances`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to get token balances'
      };
    }

    return {
      success: true,
      balances: data.balances || []
    };
  } catch (error: any) {
    console.error('Error getting project token balances:', error);
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * Update token balance for a user
 */
export async function updateProjectTokenBalance(
  projectSlug: string,
  walletAddress: string,
  tokenId: string,
  balance: number
): Promise<{ success: boolean; balance?: ProjectTokenBalance; error?: string }> {
  try {
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('auth_token') || ''
      : '';

    const response = await fetch(
      `${BACKEND_API_URL}/api/projects/${projectSlug}/users/${walletAddress}/token-balances/${tokenId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          balance: balance
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to update token balance'
      };
    }

    return {
      success: true,
      balance: data.balance
    };
  } catch (error: any) {
    console.error('Error updating project token balance:', error);
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

