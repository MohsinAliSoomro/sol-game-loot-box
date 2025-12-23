"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProject } from "@/lib/project-context";
import Loader from "@/app/Components/Loader";

// Ensure BACKEND_API_URL includes /api if not already present
const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || '';
const BACKEND_API_URL = BACKEND_BASE_URL.endsWith('/api') 
  ? BACKEND_BASE_URL 
  : BACKEND_BASE_URL.endsWith('/') 
    ? `${BACKEND_BASE_URL}api` 
    : `${BACKEND_BASE_URL}/api`;

// Global flag to prevent multiple simultaneous checks
const globalAuthCheckInProgress = new Map<string, boolean | number>();

export default function ProjectAuthPage() {
  const params = useParams();
  const router = useRouter();
  const { loadProjectBySlug } = useProject();
  const projectSlug = params?.projectSlug as string;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentProject, setCurrentProject] = useState<any>(null);

  // Refs to prevent multiple simultaneous checks
  const checkingRef = useRef(false);
  const lastCheckedSlugRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false); // Track if check has completed for this slug

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
    };
  }, []);

  // Check if already authenticated
  useEffect(() => {
    // Early return if no slug
    if (!projectSlug) {
      router.push("/");
      return;
    }

    // STRICT CHECK: If we already checked this exact slug, NEVER check again
    // This prevents infinite loops - once checked, don't check again until slug changes
    if (lastCheckedSlugRef.current === projectSlug && completedRef.current) {
      console.log(`[AUTH] Already completed check for ${projectSlug}, skipping completely...`);
      return;
    }

    // Reset state when slug changes
    if (lastCheckedSlugRef.current && lastCheckedSlugRef.current !== projectSlug) {
      setCurrentProject(null);
      setCheckingAuth(true);
      setError("");
      checkingRef.current = false;
      completedRef.current = false;
      globalAuthCheckInProgress.delete(lastCheckedSlugRef.current);
      globalAuthCheckInProgress.delete(`${lastCheckedSlugRef.current}_time`);
    }

    // GLOBAL CHECK: Prevent multiple instances from checking the same slug
    // But allow if it's been more than 10 seconds since last check (stale)
    const lastCheckTime = globalAuthCheckInProgress.get(`${projectSlug}_time`) as number | undefined;
    const now = Date.now();
    if (globalAuthCheckInProgress.has(projectSlug) && globalAuthCheckInProgress.get(projectSlug)) {
      if (lastCheckTime && typeof lastCheckTime === 'number' && (now - lastCheckTime) < 10000) {
        console.log(`[AUTH] Another instance is checking ${projectSlug}, waiting...`);
        return; // Still checking, wait
      } else {
        // Stale check (more than 10 seconds old), clear it
        console.log(`[AUTH] Clearing stale check for ${projectSlug}`);
        globalAuthCheckInProgress.delete(projectSlug);
        globalAuthCheckInProgress.delete(`${projectSlug}_time`);
      }
    }

    // Mark as checking immediately
    checkingRef.current = true;
    lastCheckedSlugRef.current = projectSlug;
    globalAuthCheckInProgress.set(projectSlug, true);
    globalAuthCheckInProgress.set(`${projectSlug}_time`, Date.now());

    // Fallback timeout to ensure loading state is cleared even if something goes wrong
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
    }
    fallbackTimeoutRef.current = setTimeout(() => {
      console.warn(`[AUTH] Fallback timeout reached, forcing checkingAuth to false`);
      if (mountedRef.current) {
        setCheckingAuth(false);
      }
      globalAuthCheckInProgress.delete(projectSlug);
      globalAuthCheckInProgress.delete(`${projectSlug}_time`);
      checkingRef.current = false;
    }, 15000); // 15 second fallback

    const checkAuth = async () => {
      try {
        console.log(`[AUTH] Starting auth check for project: ${projectSlug}`);
        
        // Load project first with timeout
        const projectPromise = loadProjectBySlug(projectSlug);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Project load timeout')), 10000)
        );
        
        let project;
        try {
          project = await Promise.race([projectPromise, timeoutPromise]) as any;
        } catch (err: any) {
          console.error(`[AUTH] Error loading project: ${err.message}`);
          if (mountedRef.current && lastCheckedSlugRef.current === projectSlug) {
            setError(`Failed to load project: ${err.message}. Please refresh the page.`);
            setCheckingAuth(false);
          }
          globalAuthCheckInProgress.delete(projectSlug);
          globalAuthCheckInProgress.delete(`${projectSlug}_time`);
          checkingRef.current = false;
          if (fallbackTimeoutRef.current) {
            clearTimeout(fallbackTimeoutRef.current);
            fallbackTimeoutRef.current = null;
          }
          return;
        }
        
        if (!project) {
          console.error(`[AUTH] Project not found: ${projectSlug}`);
          if (mountedRef.current && lastCheckedSlugRef.current === projectSlug) {
            setError(`Project "${projectSlug}" not found.`);
            setCheckingAuth(false);
          }
          globalAuthCheckInProgress.delete(projectSlug);
          globalAuthCheckInProgress.delete(`${projectSlug}_time`);
          checkingRef.current = false;
          if (fallbackTimeoutRef.current) {
            clearTimeout(fallbackTimeoutRef.current);
            fallbackTimeoutRef.current = null;
          }
          // Don't redirect immediately - let user see the error
          return;
        }

        console.log(`[AUTH] Project loaded: ${project.name} (ID: ${project.id})`);

        // Store project in local state so we can use it immediately
        if (mountedRef.current && lastCheckedSlugRef.current === projectSlug) {
          setCurrentProject(project);
        }

        // Clear tokens from other projects when switching
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
          if (key.startsWith('project_') && key.endsWith('_token')) {
            const projectId = key.replace('project_', '').replace('_token', '');
            if (projectId !== project.id.toString()) {
              localStorage.removeItem(key);
              localStorage.removeItem(`project_${projectId}_user`);
            }
          }
        });

        // Check if user is already authenticated for THIS project
        const token = localStorage.getItem(`project_${project.id}_token`);
        if (token) {
          console.log(`[AUTH] Token found, verifying...`);
          // Verify token is still valid with timeout
          const controller = new AbortController();
          abortControllerRef.current = controller;
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

          try {
            const response = await fetch(`${BACKEND_API_URL}/auth/me`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            abortControllerRef.current = null;

            // Only process if still mounted and on same slug
            if (!mountedRef.current || lastCheckedSlugRef.current !== projectSlug) {
              return;
            }

            if (response.ok) {
              const data = await response.json();
              // Verify the token is for the correct project
              if (data.success && data.data?.user?.project_id === project.id) {
                console.log(`[AUTH] Already authenticated, redirecting...`);
                // Already authenticated, redirect to project home
                globalAuthCheckInProgress.delete(projectSlug);
                globalAuthCheckInProgress.delete(`${projectSlug}_time`);
                checkingRef.current = false;
                router.push(`/${projectSlug}`);
                return;
              } else {
                console.log(`[AUTH] Token is for different project, removing...`);
                // Token is for a different project, remove it
                localStorage.removeItem(`project_${project.id}_token`);
                localStorage.removeItem(`project_${project.id}_user`);
              }
            } else {
              console.log(`[AUTH] Token invalid (${response.status}), removing...`);
              // Token invalid (401, 403, etc.), remove it
              localStorage.removeItem(`project_${project.id}_token`);
              localStorage.removeItem(`project_${project.id}_user`);
            }
          } catch (err: any) {
            clearTimeout(timeoutId);
            abortControllerRef.current = null;

            // Only process if still mounted and on same slug
            if (!mountedRef.current || lastCheckedSlugRef.current !== projectSlug) {
              return;
            }

            // Don't log AbortError (timeout) - just continue to login
            if (err.name !== 'AbortError') {
              console.error("[AUTH] Error verifying token:", err);
            } else {
              console.log("[AUTH] Token verification timeout, continuing to login form");
            }
            localStorage.removeItem(`project_${project.id}_token`);
            localStorage.removeItem(`project_${project.id}_user`);
          }
        } else {
          console.log(`[AUTH] No token found, showing login form`);
        }

        // ALWAYS set checkingAuth to false to show login form
        if (fallbackTimeoutRef.current) {
          clearTimeout(fallbackTimeoutRef.current);
          fallbackTimeoutRef.current = null;
        }
        if (mountedRef.current && lastCheckedSlugRef.current === projectSlug) {
          console.log(`[AUTH] Setting checkingAuth to false, showing login form`);
          setCheckingAuth(false);
          completedRef.current = true; // Mark as completed
        }
        globalAuthCheckInProgress.delete(projectSlug);
        globalAuthCheckInProgress.delete(`${projectSlug}_time`);
        checkingRef.current = false;
      } catch (err: any) {
        console.error("[AUTH] Error in checkAuth:", err);
        if (fallbackTimeoutRef.current) {
          clearTimeout(fallbackTimeoutRef.current);
          fallbackTimeoutRef.current = null;
        }
        // ALWAYS set checkingAuth to false even on error
        if (mountedRef.current) {
          setCheckingAuth(false);
          completedRef.current = true; // Mark as completed even on error
        }
        globalAuthCheckInProgress.delete(projectSlug);
        globalAuthCheckInProgress.delete(`${projectSlug}_time`);
        checkingRef.current = false;
      }
    };

    checkAuth();

    // Cleanup function
    return () => {
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      globalAuthCheckInProgress.delete(projectSlug);
      globalAuthCheckInProgress.delete(`${projectSlug}_time`);
    };
    // Only depend on projectSlug - router and loadProjectBySlug are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectSlug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // If project not loaded yet, try to load it now
    let project = currentProject;
    if (!project && projectSlug) {
      try {
        console.log(`[AUTH] Project not loaded, loading now...`);
        project = await loadProjectBySlug(projectSlug);
        if (project) {
          setCurrentProject(project);
        }
      } catch (err: any) {
        console.error(`[AUTH] Error loading project during login:`, err);
      }
    }

    if (!project) {
      setError(`Project "${projectSlug}" not found. Please check the URL and try again.`);
      setLoading(false);
      return;
    }

    try {
      console.log(`[AUTH] Attempting login for project: ${project.id}, email: ${email}`);
      
      const response = await fetch(`${BACKEND_API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          project_id: project.id,
        }),
      });

      console.log(`[AUTH] Login response status: ${response.status}`);

      // Handle rate limiting (429) and other non-JSON responses
      if (response.status === 429) {
        setError("Too many login attempts. Please wait a few minutes and try again.");
        setLoading(false);
        return;
      }

      // Try to parse JSON, but handle non-JSON responses gracefully
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error(`[AUTH] Non-JSON response: ${text}`);
        setError(text || `Server error (${response.status}). Please try again.`);
        setLoading(false);
        return;
      }

      console.log(`[AUTH] Login response data:`, data);

      if (!response.ok || !data.success) {
        console.error(`[AUTH] Login failed:`, data.error);
        setError(data.error || "Invalid email or password");
        setLoading(false);
        return;
      }

      // Verify we have the required data
      if (!data.data || !data.data.token || !data.data.user) {
        console.error(`[AUTH] Invalid response data:`, data);
        setError("Invalid response from server. Please try again.");
        setLoading(false);
        return;
      }

      // Store token
      localStorage.setItem(`project_${project.id}_token`, data.data.token);
      localStorage.setItem(`project_${project.id}_user`, JSON.stringify(data.data.user));
      
      // Also store project ID for easy access
      localStorage.setItem('currentProjectId', project.id.toString());

      console.log(`[AUTH] Login successful. User role: ${data.data.user?.role}, Redirecting...`);

      // Reset checking flags to allow navigation
      checkingRef.current = false;
      lastCheckedSlugRef.current = null;
      globalAuthCheckInProgress.delete(projectSlug);
      globalAuthCheckInProgress.delete(`${projectSlug}_time`);

      // Small delay to ensure localStorage is written
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if user is project admin - redirect to admin panel, otherwise project home
      if (data.data.user?.role === 'project_admin') {
        console.log(`[AUTH] Redirecting to admin panel: /${projectSlug}/admin`);
        window.location.href = `/${projectSlug}/admin`;
      } else {
        console.log(`[AUTH] Redirecting to project home: /${projectSlug}`);
        window.location.href = `/${projectSlug}`;
      }
    } catch (err: any) {
      console.error(`[AUTH] Login error:`, err);
      setError(err.message || "Login failed. Please check if the backend server is running.");
      setLoading(false);
    }
  };

  // Show loading if checking auth or project not loaded yet
  // But if we have an error and not checking, show the error
  // Also show login form if we've been checking for more than 3 seconds (fallback)
  const [showLoginAnyway, setShowLoginAnyway] = useState(false);
  
  useEffect(() => {
    if (checkingAuth) {
      const timer = setTimeout(() => {
        console.warn(`[AUTH] Showing login form anyway after 3 seconds`);
        setShowLoginAnyway(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowLoginAnyway(false);
    }
  }, [checkingAuth]);

  if ((checkingAuth && !showLoginAnyway) || (!currentProject && !error && !showLoginAnyway)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-700">
        <Loader />
      </div>
    );
  }

  // If we have an error and no project, show error page
  if (error && !currentProject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-700 text-white">
        <div className="w-full max-w-md px-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 border border-white/20">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Error</h1>
              <p className="text-sm opacity-80">{error}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If we don't have project but showLoginAnyway is true, show login with generic title
  const projectName = currentProject?.name || projectSlug || "Project";
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-700 text-white">
      <div className="w-full max-w-md px-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">
              {projectName} Login
            </h1>
            <p className="text-sm opacity-80">
              Enter your credentials to access this project
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-300 bg-white/20 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-300 bg-white/20 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm opacity-60">
            <p>
              Admin credentials are set by the master dashboard administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}



