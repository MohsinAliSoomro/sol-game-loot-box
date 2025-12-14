"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/service/supabase';
import { useProject } from '@/lib/project-context';

export const useProjectUsers = () => {
  const { getProjectId, currentProject } = useProject();
  const projectId = getProjectId();
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);

  const fetchUsers = useCallback(async () => {
    const activeProjectId = currentProject?.id || projectId;
    if (!activeProjectId) {
      console.log(`[USERS] No active project ID, clearing data`);
      setUsers([]);
      setLoading(false);
      return;
    }

    console.log(`[USERS] Fetching users for project ID: ${activeProjectId}`);

    try {
      setLoading(true);
      setError(null);

      // For sub-projects, use project_users table (has project_id column)
      // This is the correct table for multi-tenant user data
      const { data, error: fetchError, count } = await supabase
        .from('project_users')
        .select('*', { count: 'exact' })
        .eq('project_id', activeProjectId)
        .order('created_at', { ascending: false });

        if (fetchError) {
        console.error('[USERS] Error fetching project_users:', fetchError);
        // If project_users query fails, try fallback to transaction-based filtering
        console.log('[USERS] Falling back to transaction-based filtering');
        
        const { data: transactionUsers } = await supabase
          .from('transaction')
          .select('userId')
          .eq('project_id', activeProjectId);

        const projectUserIds = new Set(
          transactionUsers?.map(t => t.userId).filter(Boolean) || []
        );

        // Fetch from project_users using the user IDs from transactions
        if (projectUserIds.size > 0) {
          const { data: projectUsers } = await supabase
            .from('project_users')
          .select('*')
            .in('id', Array.from(projectUserIds))
            .eq('project_id', activeProjectId)
          .order('created_at', { ascending: false });

          setUsers(projectUsers || []);
          setTotalUsers(projectUsers?.length || 0);
        } else {
          // No users found
          setUsers([]);
          setTotalUsers(0);
      }
        return;
      }

      // Successfully fetched from project_users
      setUsers(data || []);
      setTotalUsers(count || 0);

    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id, projectId]);

  useEffect(() => {
    // Clear data immediately when project changes
    if (!projectId || !currentProject) {
      console.log(`[USERS] No project ID or currentProject, clearing data`);
      setUsers([]);
      setTotalUsers(0);
      setLoading(false);
      return;
    }
    
    // Double-check: Ensure we're using the correct project ID
    if (currentProject.id !== projectId) {
      console.warn(`[USERS] Project ID mismatch! currentProject.id=${currentProject.id}, projectId=${projectId}`);
      setUsers([]);
      setTotalUsers(0);
      setLoading(false);
      return;
    }
    
    console.log(`[USERS] Fetching users for project: ${projectId} (${currentProject.slug})`);
    // Fetch users for the current project
    fetchUsers();
  }, [projectId, currentProject?.id, currentProject?.slug, fetchUsers]);

  const formatUserData = (user: any) => {
    // project_users table uses 'id' (UUID) instead of 'uid'
    // Map project_users structure to expected format
    return {
      id: user.id || user.uid,
      name: user.full_name || 'Unknown User',
      email: user.email || 'No email',
      uid: user.id || user.uid, // project_users uses 'id' as primary key
      created_at: user.created_at,
      status: 'Active',
      lastLogin: user.created_at ? new Date(user.created_at).toLocaleString() : 'Never',
      avatar: user.full_name ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'U',
      wallet_address: user.wallet_address || '',
      apes: user.apes || 0
    };
  };

  const formattedUsers = users.map(formatUserData);

  return {
    users: formattedUsers,
    totalUsers,
    loading,
    error,
    refetch: fetchUsers
  };
};

