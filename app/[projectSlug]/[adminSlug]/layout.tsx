"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useProject } from "@/lib/project-context";
import Loader from "@/app/Components/Loader";

// Ensure BACKEND_API_URL includes /api if not already present
const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || '';
const BACKEND_API_URL = BACKEND_BASE_URL.endsWith('/api') 
  ? BACKEND_BASE_URL 
  : BACKEND_BASE_URL.endsWith('/') 
    ? `${BACKEND_BASE_URL}api` 
    : `${BACKEND_BASE_URL}/api`;

// Global cache to track completed auth checks - survives re-renders and component remounts
// Key: slugKey, Value: { completed: boolean, timestamp: number, adminUser: any }
const authCheckCache = new Map<string, { completed: boolean; timestamp: number; adminUser: any; error: string | null }>();
const AUTH_CACHE_TTL = 2 * 60 * 1000; // 2 minutes cache (reduced to avoid stale errors)

// Global flag to prevent multiple simultaneous checks
const globalCheckInProgress = new Map<string, boolean>();

// Helper to persist cache to sessionStorage (survives page reloads)
const CACHE_STORAGE_KEY = 'admin_auth_cache';
const saveCacheToStorage = () => {
  try {
    const cacheData: Record<string, { completed: boolean; timestamp: number; adminUser: any; error: string | null }> = {};
    authCheckCache.forEach((value, key) => {
      cacheData[key] = value;
    });
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheData));
    }
  } catch (e) {
    console.warn('[ADMIN LAYOUT] Failed to save cache to storage:', e);
  }
};

const loadCacheFromStorage = () => {
  try {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(CACHE_STORAGE_KEY);
      if (stored) {
        const cacheData = JSON.parse(stored);
        Object.entries(cacheData).forEach(([key, value]: [string, any]) => {
          // Only load if not expired
          if (Date.now() - value.timestamp < AUTH_CACHE_TTL) {
            authCheckCache.set(key, value);
          }
        });
        console.log(`[ADMIN LAYOUT] Loaded ${authCheckCache.size} cache entries from storage`);
      }
    }
  } catch (e) {
    console.warn('[ADMIN LAYOUT] Failed to load cache from storage:', e);
  }
};

// Load cache on module init
if (typeof window !== 'undefined') {
  loadCacheFromStorage();
}

// Helper to check if cached entry is valid (not a JS error, not expired)
const isCacheEntryValid = (entry: { completed: boolean; timestamp: number; adminUser: any; error: string | null } | undefined): boolean => {
  if (!entry) return false;
  if (Date.now() - entry.timestamp >= AUTH_CACHE_TTL) return false;
  // Invalidate cache if it contains a JS error (programming bug, not auth error)
  if (entry.error && (entry.error.includes('ReferenceError') || entry.error.includes('TypeError') || entry.error.includes('undefined'))) {
    return false;
  }
  return entry.completed;
};

export default function ProjectAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { currentProject, loadProjectBySlug } = useProject();
  const projectSlug = params?.projectSlug as string;
  const adminSlug = "admin"; // Fixed admin slug

  // Create slug key for caching
  const slugKey = `${projectSlug}-${adminSlug}`;

  // Check cache for existing auth state - do this on EVERY render
  const cachedAuth = authCheckCache.get(slugKey);
  const isCacheValid = isCacheEntryValid(cachedAuth);
  
  // Debug logging
  console.log(`[ADMIN LAYOUT] Rendering for ${slugKey}, cache valid: ${isCacheValid}, cached:`, cachedAuth);

  // Initialize state - but also sync from cache if cache becomes valid
  const [loading, setLoading] = useState(!isCacheValid);
  const [error, setError] = useState(isCacheValid ? (cachedAuth?.error || "") : "");
  const [adminUser, setAdminUser] = useState<any>(isCacheValid ? cachedAuth?.adminUser : null);

  // Force re-render when cache updates by using a state trigger
  const [cacheVersion, setCacheVersion] = useState(0);
  
  // Load cache from storage on mount
  useEffect(() => {
    loadCacheFromStorage();
    const cached = authCheckCache.get(slugKey);
    if (isCacheEntryValid(cached) && cached) {
      console.log(`[ADMIN LAYOUT] Found valid cache in storage for ${slugKey}`);
      setAdminUser(cached.adminUser);
      setError(cached.error || "");
      setLoading(false);
    }
  }, [slugKey]);
  
  // Sync state from cache - run on every render to catch cache updates
  useEffect(() => {
    const cached = authCheckCache.get(slugKey);
    if (isCacheEntryValid(cached) && cached) {
      console.log(`[ADMIN LAYOUT] Syncing state from cache for ${slugKey}`);
      setAdminUser(cached.adminUser);
      setError(cached.error || "");
      setLoading(false);
      // Force a re-render by updating cache version
      if (cacheVersion === 0) {
        setCacheVersion(1);
      }
    }
  });
  
  // Use cache value directly for render decision if state hasn't synced yet
  const renderCached = authCheckCache.get(slugKey);
  const renderCacheValid = isCacheEntryValid(renderCached);
  
  // Debug cache state - always log to see what's happening
  console.log(`[ADMIN LAYOUT] Cache check for ${slugKey}:`, {
    hasCache: !!renderCached,
    cacheSize: authCheckCache.size,
    allKeys: Array.from(authCheckCache.keys()),
    cached: renderCached ? {
      completed: renderCached.completed,
      timestamp: renderCached.timestamp,
      age: Date.now() - renderCached.timestamp,
      ageSeconds: Math.floor((Date.now() - renderCached.timestamp) / 1000),
      isValid: renderCacheValid,
      hasUser: !!renderCached.adminUser,
      error: renderCached.error
    } : null
  });
  
  // If cache is valid but state isn't, use cache values directly
  const effectiveLoading = renderCacheValid ? false : loading;
  const effectiveAdminUser = renderCacheValid ? (renderCached?.adminUser || adminUser) : adminUser;
  const effectiveError = renderCacheValid ? (renderCached?.error || error || "") : error;
  
  // If cache is valid, immediately sync state (this will trigger a re-render)
  useEffect(() => {
    if (renderCacheValid && renderCached && (!adminUser || loading)) {
      console.log(`[ADMIN LAYOUT] Force syncing from valid cache for ${slugKey}`);
      setAdminUser(renderCached.adminUser);
      setError(renderCached.error || "");
      setLoading(false);
    }
  }, [renderCacheValid, slugKey, adminUser, loading]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openSettings, setOpenSettings] = useState(
    pathname?.includes("/settings") || 
    pathname?.includes("/jackpot-settings") || 
    pathname?.includes("/website-settings") || 
    pathname?.includes("/token-management")
  );

  // Ref to prevent multiple simultaneous requests
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasStartedCheck = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    // Cleanup on unmount - abort any pending requests
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    // Early return if slugs are not valid
    if (!projectSlug || !adminSlug) {
      return;
    }

    // Check if we have valid cached auth for this slug
    const cached = authCheckCache.get(slugKey);
    if (isCacheEntryValid(cached) && cached) {
      // Use cached data
      if (mountedRef.current) {
        setAdminUser(cached.adminUser);
        setError(cached.error || "");
        setLoading(false);
      }
      return;
    }
    
    // Check if already in progress (globally)
    if (globalCheckInProgress.get(slugKey)) {
      return;
    }

    // Check if this specific instance already started the check
    if (hasStartedCheck.current) {
      return;
    }

    // Mark as in progress
    hasStartedCheck.current = true;
    globalCheckInProgress.set(slugKey, true);
    console.log(`[ADMIN LAYOUT] Starting auth check for ${slugKey}`);

    const checkAccess = async () => {
      // Helper to cache and set final state
      const finishCheck = (userData: any, errorMsg: string | null) => {
        console.log(`[ADMIN LAYOUT] Finishing check for ${slugKey}:`, { userData: !!userData, error: errorMsg });
        const cacheEntry = {
          completed: true,
          timestamp: Date.now(),
          adminUser: userData,
          error: errorMsg
        };
        authCheckCache.set(slugKey, cacheEntry);
        saveCacheToStorage(); // Persist to sessionStorage
        console.log(`[ADMIN LAYOUT] Cache set for ${slugKey}:`, { 
          cacheSize: authCheckCache.size, 
          hasKey: authCheckCache.has(slugKey),
          isValid: isCacheEntryValid(cacheEntry),
          timestamp: cacheEntry.timestamp
        });
        globalCheckInProgress.set(slugKey, false);
        // Always update state - even if component appears unmounted, it might just be re-rendering
        // The cache will ensure the state is correct on next render
        console.log(`[ADMIN LAYOUT] Updating state for ${slugKey}`);
        // Update all state at once to trigger a single re-render
        setAdminUser(userData);
        setError(errorMsg || "");
        setLoading(false);
        // Force cache version update to trigger re-render
        setCacheVersion(prev => prev + 1);
      };

      try {
        console.log(`[ADMIN LAYOUT] Loading project for slug: ${projectSlug}`);
        // Always reload project to ensure we have the correct one
        const project = await loadProjectBySlug(projectSlug);
        console.log(`[ADMIN LAYOUT] Project loaded:`, project?.id, project?.slug);
        
        if (!project) {
          finishCheck(null, "Project not found");
          return;
        }
        
        // Verify the loaded project matches the slug
        if (project.slug !== projectSlug) {
          finishCheck(null, "Project mismatch");
          return;
        }

        // Check authentication
        const token = localStorage.getItem(`project_${project.id}_token`);
        console.log(`[ADMIN LAYOUT] Token check for project ${project.id}:`, token ? 'FOUND' : 'NOT FOUND');
        if (!token) {
          console.log(`[ADMIN LAYOUT] No token, redirecting to auth...`);
          globalCheckInProgress.set(slugKey, false);
          // Keep loading=true while redirecting to prevent flash of empty content
          // Use window.location for more reliable redirect
          window.location.href = `/${projectSlug}/auth`;
          return;
        }

        // Verify token with timeout
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(`${BACKEND_API_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          abortControllerRef.current = null;

          // Handle non-OK responses
          if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
              localStorage.removeItem(`project_${project.id}_token`);
              localStorage.removeItem(`project_${project.id}_user`);
              globalCheckInProgress.set(slugKey, false);
              // Keep loading=true while redirecting
              window.location.href = `/${projectSlug}/auth`;
              return;
            }
            const errorText = await response.text();
            finishCheck(null, `Authentication failed: ${errorText || response.statusText}`);
            return;
          }

          // Parse response
          let data;
          try {
            data = await response.json();
          } catch (parseError) {
            console.error("Failed to parse JSON:", parseError);
            finishCheck(null, "Invalid response from server");
            return;
          }

          if (!data.success) {
            finishCheck(null, data.error || "Authentication failed");
            return;
          }

          const userData = data.data?.user || data.data;
          
          if (!userData) {
            finishCheck(null, "Invalid user data");
            return;
          }

          if (userData.role !== "project_admin") {
            finishCheck(null, "Access denied. Admin access required.");
            return;
          }

          if (userData.project_id && userData.project_id !== project.id) {
            finishCheck(null, "Access denied. You don't have access to this project.");
          return;
          }

          // Success!
          finishCheck(userData, null);
          
        } catch (err: any) {
          clearTimeout(timeoutId);
          abortControllerRef.current = null;
          
          if (err.name === 'AbortError') {
            finishCheck(null, "Connection timeout. Please check if the backend server is running.");
          } else {
            finishCheck(null, err.message || "Failed to verify authentication");
          }
        }
      } catch (err: any) {
        console.error("Error in checkAccess:", err);
        finishCheck(null, err.message || "An error occurred");
      }
    };

    checkAccess();
    
    // Cleanup - only abort pending requests, DO NOT clear cache
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Note: Do NOT clear globalCheckInProgress or authCheckCache here
      // This prevents re-fetching when component re-renders due to context changes
    };
  }, [projectSlug, adminSlug]); // Only depend on slugs - NOT currentProject or loadProjectBySlug

  const handleLogout = () => {
    // Clear auth cache for this project
    authCheckCache.delete(slugKey);
    hasStartedCheck.current = false;
    
    if (currentProject) {
      localStorage.removeItem(`project_${currentProject.id}_token`);
      localStorage.removeItem(`project_${currentProject.id}_user`);
    }
    router.push(`/${projectSlug}/auth`);
  };

  const getPageTitle = () => {
    if (pathname?.endsWith("/users")) return "Users";
    if (pathname?.includes("/settings") && !pathname?.includes("/website-settings") && !pathname?.includes("/token-management")) return "Lootbox Settings";
    if (pathname?.includes("/jackpot-settings")) return "Jackpot Settings";
    if (pathname?.includes("/website-settings")) return "Website Settings";
    if (pathname?.includes("/token-management")) return "Token Management";
    if (pathname?.includes("/lootbox/")) return "Lootbox Rewards";
    return "Dashboard";
  };

  console.log(`[ADMIN LAYOUT] Render check - loading: ${effectiveLoading}, error: ${effectiveError}, adminUser: ${!!effectiveAdminUser}, slugKey: ${slugKey}, cacheValid: ${renderCacheValid}`);
  
  if (effectiveLoading) {
    console.log(`[ADMIN LAYOUT] Showing loader`);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader />
      </div>
    );
  }

  if (effectiveError) {
    console.log(`[ADMIN LAYOUT] Showing error: ${effectiveError}`);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">{effectiveError}</h1>
          <Link href={`/${projectSlug}`} className="text-blue-600 hover:underline">
            Go to Project Home
          </Link>
        </div>
      </div>
    );
  }
  
  console.log(`[ADMIN LAYOUT] Rendering dashboard content`);

  const navLinks = [
    { name: "Dashboard", path: `/${projectSlug}/admin`, exact: true },
    { name: "Users", path: `/${projectSlug}/admin/users` },
    {
      name: "Settings",
      subItems: [
        { name: "Lootbox Settings", path: `/${projectSlug}/admin/settings` },
        { name: "Jackpot Settings", path: `/${projectSlug}/admin/jackpot-settings` },
        { name: "Website Settings", path: `/${projectSlug}/admin/website-settings` },
        { name: "Token Management", path: `/${projectSlug}/admin/token-management` },
      ],
    },
  ];

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return pathname === path;
    }
    return pathname?.startsWith(path);
  };

  // Debug: Log when rendering the full admin layout
  console.log(`[ADMIN LAYOUT] 🎯 Rendering full admin panel for ${projectSlug}:`, { 
    adminUser: effectiveAdminUser?.email || 'null', 
    loading: effectiveLoading, 
    error: effectiveError || 'none',
    cacheValid: renderCacheValid
  });

  return (
    <div className="flex h-screen bg-gray-100" style={{ minHeight: '100vh' }}>
      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden ${
          sidebarOpen ? "block" : "hidden"
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col h-full z-30 transform md:relative md:translate-x-0 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-center border-b border-gray-100">
          <span className="text-xl font-bold text-orange-500">
            {currentProject?.name || "Project"} Admin
          </span>
        </div>
        <nav className="flex-1 py-6 px-4 overflow-y-auto">
          <ul className="space-y-2">
            {navLinks.map((link) => (
              <li key={link.name}>
                {link.subItems ? (
                  <div>
                    <button
                      onClick={() => setOpenSettings(!openSettings)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600"
                    >
                      <span>{link.name}</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${
                          openSettings ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {openSettings && (
                      <ul className="pl-4 pt-2 space-y-1">
                        {link.subItems.map((subLink) => (
                          <li key={subLink.name}>
                            <Link
                              href={subLink.path}
                              onClick={() => setSidebarOpen(false)}
                              className={`flex items-center px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                                isActive(subLink.path)
                                  ? "bg-orange-100 text-orange-600"
                                  : "text-gray-600 hover:bg-orange-50 hover:text-orange-600"
                              }`}
                            >
                              {subLink.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <Link
                    href={link.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center px-4 py-3 rounded-lg transition-colors font-medium ${
                      isActive(link.path, link.exact)
                        ? "bg-orange-100 text-orange-600"
                        : "text-gray-700 hover:bg-orange-50 hover:text-orange-600"
                    }`}
                  >
                    {link.name}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-6 border-t border-gray-100">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <span className="text-orange-600 font-semibold">
                {effectiveAdminUser?.email?.[0]?.toUpperCase() || "A"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {effectiveAdminUser?.full_name || "Admin User"}
              </p>
              <p className="text-xs text-gray-500 truncate">{effectiveAdminUser?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/${projectSlug}`}
              className="flex-1 text-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              View Site
            </Link>
            <button
              onClick={handleLogout}
              className="flex-1 px-3 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white flex items-center justify-between px-4 md:px-8 border-b border-gray-100 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-gray-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-gray-800">{getPageTitle()}</h1>
          <div className="w-6 h-6 md:hidden" />
        </header>
        {/* Page Content */}
        {/* Key prop forces re-mount when project changes, ensuring fresh data */}
        <main 
          key={`admin-${currentProject?.id || projectSlug}`}
          className="flex-1 overflow-y-auto p-4 md:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

