/**
 * Project API Utility
 * Handles authenticated API calls with project token
 */

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001/api";

/**
 * Get project authentication token from localStorage
 */
export function getProjectToken(projectId: number | null): string | null {
  if (!projectId) return null;
  return localStorage.getItem(`project_${projectId}_token`);
}

/**
 * Get project user info from localStorage
 */
export function getProjectUser(projectId: number | null): any | null {
  if (!projectId) return null;
  const userStr = localStorage.getItem(`project_${projectId}_user`);
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Make authenticated API request
 */
export async function projectApiRequest(
  endpoint: string,
  options: RequestInit = {},
  projectId: number | null
): Promise<Response> {
  const token = getProjectToken(projectId);
  
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  return fetch(`${BACKEND_API_URL}${endpoint}`, {
    ...options,
    headers,
  });
}

/**
 * Check if user is authenticated for a project
 */
export async function checkProjectAuth(projectId: number | null): Promise<boolean> {
  if (!projectId) return false;
  
  const token = getProjectToken(projectId);
  if (!token) return false;

  try {
    const response = await projectApiRequest("/auth/me", { method: "GET" }, projectId);
    return response.ok;
  } catch {
    return false;
  }
}



