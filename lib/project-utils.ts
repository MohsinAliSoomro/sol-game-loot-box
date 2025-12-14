/**
 * Project Utilities
 * Helper functions for project-scoped data operations
 */

import { supabase } from "@/service/supabase";
import { useProject } from "./project-context";

/**
 * Get current project ID from context or localStorage
 */
export function getCurrentProjectId(): number | null {
  if (typeof window === "undefined") return null;
  
  const savedProjectId = localStorage.getItem("currentProjectId");
  return savedProjectId ? parseInt(savedProjectId) : null;
}

/**
 * Add project_id filter to Supabase query
 */
export function withProjectFilter(query: any, projectId: number | null) {
  if (projectId) {
    return query.eq("project_id", projectId);
  }
  return query;
}

/**
 * Insert data with project_id
 */
export async function insertWithProject(table: string, data: any, projectId: number | null) {
  const insertData = projectId ? { ...data, project_id: projectId } : data;
  const { data: result, error } = await supabase
    .from(table)
    .insert(insertData)
    .select()
    .single();
  
  if (error) throw error;
  return result;
}

/**
 * Update data with project_id filter
 */
export async function updateWithProject(
  table: string,
  data: any,
  id: any,
  projectId: number | null
) {
  let query = supabase.from(table).update(data).eq("id", id);
  
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  
  const { data: result, error } = await query.select().single();
  if (error) throw error;
  return result;
}

/**
 * Select data with project_id filter
 */
export async function selectWithProject(
  table: string,
  filters?: any,
  projectId?: number | null
) {
  const currentProjectId = projectId ?? getCurrentProjectId();
  let query = supabase.from(table).select("*");
  
  if (currentProjectId) {
    query = query.eq("project_id", currentProjectId);
  }
  
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Delete data with project_id filter
 */
export async function deleteWithProject(
  table: string,
  id: any,
  projectId?: number | null
) {
  const currentProjectId = projectId ?? getCurrentProjectId();
  let query = supabase.from(table).delete().eq("id", id);
  
  if (currentProjectId) {
    query = query.eq("project_id", currentProjectId);
  }
  
  const { error } = await query;
  if (error) throw error;
}


