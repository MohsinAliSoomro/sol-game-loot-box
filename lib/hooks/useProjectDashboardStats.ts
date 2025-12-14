"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/service/supabase';
import { useProject } from '@/lib/project-context';

export const useProjectDashboardStats = () => {
  const { getProjectId } = useProject();
  const projectId = getProjectId();
  
  const [stats, setStats] = useState({
    totalOGXSpent: 0,
    totalSOLSpent: 0,
    totalOGXWithdrawn: 0,
    totalSOLWithdrawn: 0,
    totalUsers: 0,
    totalSpins: 0,
    ticketsSold: 0,
    walletBalance: 0,
    loading: true,
    error: null as string | null
  });

  useEffect(() => {
    if (!projectId) {
      setStats(prev => ({ ...prev, loading: false, error: 'No project ID' }));
      return;
    }

    const fetchDashboardStats = async () => {
      try {
        setStats(prev => ({ ...prev, loading: true, error: null }));

        // Fetch all stats in parallel - ALL FILTERED BY project_id
        // For sub-projects, use project_users table (not legacy user table)
        const [
          transactionResult,
          withdrawResult,
          usersResult,
          spinsResult,
          ticketsResult
        ] = await Promise.all([
          // Total OGX spent from transaction table
          supabase
            .from('transaction')
            .select('ogx, apes')
            .eq('project_id', projectId),
          
          // Total OGX withdrawn from withdraw table
          supabase
            .from('withdraw')
            .select('ogx, apes')
            .eq('project_id', projectId),
          
          // Total Users - Use project_users table for sub-projects (has project_id)
          supabase
            .from('project_users')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId),
          
          // Total Spins (from prizeWin table)
          supabase
            .from('prizeWin')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId),
          
          // Tickets Sold (from jackpot_tickets)
          supabase
            .from('jackpot_tickets')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId)
        ]);

        // Check for errors in any query
        if (transactionResult.error) {
          console.warn('Transaction query error:', transactionResult.error);
        }
        if (withdrawResult.error) {
          console.warn('Withdraw query error:', withdrawResult.error);
        }
        if (usersResult.error) {
          console.warn('Users query error:', usersResult.error);
        }
        if (spinsResult.error) {
          console.warn('Spins query error:', spinsResult.error);
        }
        if (ticketsResult.error) {
          console.warn('Tickets query error:', ticketsResult.error);
        }

        // Calculate total project token spent from transaction table
        // Note: 'ogx' field stores project token amount (for backward compatibility)
        const totalOGXSpent = transactionResult.data?.reduce((sum, item) => {
          const tokenAmount = parseFloat(item.ogx || 0) + parseFloat(item.apes || 0);
          return sum + tokenAmount;
        }, 0) || 0;

        // Calculate total project token withdrawn from withdraw table
        // Note: 'ogx' field stores project token amount (for backward compatibility)
        const totalOGXWithdrawn = withdrawResult.data?.reduce((sum, item) => {
          const tokenAmount = parseFloat(item.ogx || 0) + parseFloat(item.apes || 0);
          return sum + tokenAmount;
        }, 0) || 0;

        // Convert project token to SOL (default: 1000 tokens = 1 SOL, but can be configured per project)
        const totalSOLSpent = totalOGXSpent / 1000;
        const totalSOLWithdrawn = totalOGXWithdrawn / 1000;

        const totalUsers = usersResult.count || 0;
        const totalSpins = spinsResult.count || 0;
        const ticketsSold = ticketsResult.count || 0;

        setStats({
          totalOGXSpent,
          totalSOLSpent,
          totalOGXWithdrawn,
          totalSOLWithdrawn,
          totalUsers,
          totalSpins,
          ticketsSold,
          walletBalance: 0, // TODO: Add Solana balance check if needed
          loading: false,
          error: null
        });

      } catch (error: any) {
        console.error('Error fetching dashboard stats:', error);
        // Even on error, set loading to false so UI doesn't stay stuck
        setStats(prev => ({
          ...prev,
          loading: false,
          error: error?.message || 'Failed to load dashboard stats'
        }));
      }
    };

    fetchDashboardStats();
  }, [projectId]);

  return stats;
};

export const useProjectRecentActivity = () => {
  const { getProjectId } = useProject();
  const projectId = getProjectId();
  
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const fetchRecentActivity = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch recent transactions and users - ALL FILTERED BY project_id
        // For sub-projects, use project_users table (not legacy user table)
        const [transactionsResult, prizeWinResult, usersResult] = await Promise.all([
          supabase
            .from('transaction')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(3),
          
          supabase
            .from('prizeWin')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(2),
          
          supabase
            .from('project_users')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(5)
        ]);

        // Combine and format activities
        const activities: any[] = [];
        
        // Add user registrations first (most important)
        usersResult.data?.forEach((user: any) => {
          const userName = user.full_name || user.email?.split('@')[0] || 'New User';
          const userEmail = user.email || 'No email';
          activities.push({
            id: `user-${user.uid || user.id}`,
            type: 'user',
            title: 'New user registered',
            description: `${userName} joined the platform`,
            subtitle: userEmail,
            timestamp: user.created_at,
            icon: 'user'
          });
        });

        // Add transactions
        transactionsResult.data?.forEach((transaction: any) => {
          activities.push({
            id: `transaction-${transaction.transactionId || transaction.id}`,
            type: 'transaction',
            title: 'OGX Transaction',
            description: `${transaction.ogx || transaction.apes || 0} tokens spent`,
            subtitle: `User ID: ${transaction.userId}`,
            timestamp: transaction.created_at,
            icon: 'deposit'
          });
        });

        // Add prize wins (spins)
        prizeWinResult.data?.forEach((prize: any) => {
          activities.push({
            id: `spin-${prize.id}`,
            type: 'spin',
            title: 'New spin completed',
            description: `User spun and won ${prize.reward || 'nothing'}`,
            subtitle: 'Lootbox activity',
            timestamp: prize.created_at,
            icon: 'spin'
          });
        });

        // Sort by timestamp and take the most recent 5
        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setActivities(activities.slice(0, 5));

      } catch (error: any) {
        console.error('Error fetching recent activity:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentActivity();
  }, [projectId]);

  return { activities, loading, error };
};

