/**
 * Project Context Provider
 * Manages the current active project for multi-tenant isolation
 */

"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/service/supabase";

interface ProjectToken {
  id: number;
  name: string;
  symbol: string;
  mint_address: string;
  decimals: number;
  is_default: boolean;
  is_active: boolean;
  exchange_rate_to_sol?: number;
}

interface Project {
  id: number;
  project_id: string; // On-chain project ID
  project_pda: string;
  name: string;
  description: string;
  client_name: string;
  client_email?: string;
  admin_wallet: string;
  mint_address: string;
  fee_amount: string;
  is_active: boolean;
  slug?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  theme?: string;
  default_token_id?: number;
  token_symbol?: string;
  max_lootboxes?: number | null; // Maximum number of lootboxes allowed (null = unlimited)
  max_jackpots?: number | null; // Maximum number of jackpots allowed (null = unlimited)
}

interface ProjectContextType {
  currentProject: Project | null;
  projects: Project[];
  loading: boolean;
  projectToken: ProjectToken | null;
  setCurrentProject: (project: Project | null) => void;
  refreshProjects: () => Promise<void>;
  getProjectId: () => number | null;
  getProjectToken: () => ProjectToken | null;
  getProjectTokenSymbol: () => string;
  loadProjectBySlug: (slug: string) => Promise<Project | null>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectToken, setProjectToken] = useState<ProjectToken | null>(null);

  // Note: Project loading is now handled by the [projectSlug] layout
  // This useEffect is kept for backward compatibility but won't auto-load
  useEffect(() => {
    // Only load projects list, not a specific project
    // Project will be loaded by slug from URL
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      // Always set loading to false after attempting to load projects
      // Main project works independently and doesn't need projects list
      setLoading(false);
    }
  };

  const loadProject = async (projectId: number) => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      if (data) {
        setCurrentProjectState(data);
        localStorage.setItem("currentProjectId", projectId.toString());
      }
    } catch (error) {
      console.error("Error loading project:", error);
      loadDefaultProject();
    } finally {
      setLoading(false);
    }
  };

  const loadDefaultProject = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      
      if (data) {
        setCurrentProjectState(data);
        localStorage.setItem("currentProjectId", data.id.toString());
      }
    } catch (error) {
      console.error("Error loading default project:", error);
    } finally {
      setLoading(false);
    }
  };

  const setCurrentProject = (project: Project | null) => {
    setCurrentProjectState(project);
    if (project) {
      localStorage.setItem("currentProjectId", project.id.toString());
    } else {
      localStorage.removeItem("currentProjectId");
    }
  };

  const refreshProjects = async () => {
    await loadProjects();
    if (currentProject) {
      await loadProject(currentProject.id);
    }
  };

  const getProjectId = (): number | null => {
    return currentProject?.id || null;
  };

  /**
   * Load project's default token
   */
  const loadProjectToken = async (projectId: number) => {
    try {
      // First try to get token by default_token_id from projects table
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('default_token_id')
        .eq('id', projectId)
        .single();

      if (projectError) {
        console.error('Error loading project:', projectError);
      }

      let token = null;
      if (project?.default_token_id) {
        // Get token by ID
        const { data: tokenData, error: tokenError } = await supabase
          .from('project_tokens')
          .select('*')
          .eq('id', project.default_token_id)
          .eq('is_active', true)
          .single();
        
        if (!tokenError && tokenData) {
          token = tokenData;
        }
      }

      // Fallback: get default token by is_default flag
      if (!token) {
        const { data: tokenData, error: tokenError } = await supabase
          .from('project_tokens')
          .select('*')
          .eq('project_id', projectId)
          .eq('is_default', true)
          .eq('is_active', true)
          .single();
        
        if (tokenError && tokenError.code !== 'PGRST116') {
          console.warn('Error loading default token:', tokenError);
        }
        
        if (!tokenError && tokenData) {
          token = tokenData;
        }
      }

      if (token) {
        setProjectToken(token);
        return token;
      }
      
      // No token found
      setProjectToken(null);
      return null;
    } catch (error) {
      console.error('Error loading project token:', error);
      setProjectToken(null);
      return null;
    }
  };

  /**
   * Get project token
   */
  const getProjectToken = (): ProjectToken | null => {
    return projectToken;
  };

  /**
   * Get project token symbol (fallback to 'TOKEN' if no token)
   */
  const getProjectTokenSymbol = (): string => {
    return projectToken?.symbol || currentProject?.token_symbol || 'TOKEN';
  };

  /**
   * Load project by slug
   * This is the primary method for loading projects in the multi-tenant system
   * Memoized with useCallback to prevent infinite loops
   */
  const loadProjectBySlug = useCallback(async (slug: string): Promise<Project | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No project found
          setCurrentProjectState(null);
          return null;
        }
        throw error;
      }

      if (data) {
        setCurrentProjectState(data);
        localStorage.setItem("currentProjectId", data.id.toString());
        localStorage.setItem("currentProjectSlug", slug);
        
        // Load project token if default_token_id exists
        if (data.default_token_id) {
          await loadProjectToken(data.id);
        } else {
          setProjectToken(null);
        }
        
        return data;
      }
      return null;
    } catch (error) {
      console.error("Error loading project by slug:", error);
      setCurrentProjectState(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array - function never changes

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        projects,
        loading,
        projectToken,
        setCurrentProject,
        refreshProjects,
        getProjectId,
        getProjectToken,
        getProjectTokenSymbol,
        loadProjectBySlug,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}

