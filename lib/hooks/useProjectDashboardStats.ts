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
    totalOGXDeposited: 0,
    totalSOLDeposited: 0,
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
    const fetchDashboardStats = async () => {
      try {
        setStats(prev => ({ ...prev, loading: true, error: null }));

        // Determine if this is the main project (projectId is null)
        const isMainProject = !projectId;
        
        console.log('[DASHBOARD STATS] Fetching stats:', {
          projectId,
          isMainProject
        });
        
        // Diagnostic: Check if there's ANY data in transaction/withdraw tables
        // Note: transaction table uses 'transactionId' not 'id', and only has 'ogx' column (not 'apes')
        const [allTransactionsCheck, allWithdrawalsCheck] = await Promise.all([
          supabase.from('transaction').select('transactionId, ogx, project_id, userId, t_status').limit(10),
          supabase.from('withdraw').select('*').limit(10) // Select all columns for withdraw
        ]);
        
        console.log('[DASHBOARD STATS] Diagnostic - All data check:', {
          allTransactions: allTransactionsCheck.data?.length || 0,
          allWithdrawals: allWithdrawalsCheck.data?.length || 0,
          sampleTransaction: allTransactionsCheck.data?.[0],
          sampleWithdraw: allWithdrawalsCheck.data?.[0],
          transactionError: allTransactionsCheck.error?.message,
          withdrawError: allWithdrawalsCheck.error?.message,
          transactionColumns: allTransactionsCheck.data?.[0] ? Object.keys(allTransactionsCheck.data[0]) : [],
          withdrawColumns: allWithdrawalsCheck.data?.[0] ? Object.keys(allWithdrawalsCheck.data[0]) : []
        });
        
        // Also check total counts
        const [transactionCount, withdrawCount] = await Promise.all([
          supabase.from('transaction').select('transactionId', { count: 'exact', head: true }),
          supabase.from('withdraw').select('*', { count: 'exact', head: true })
        ]);
        
        console.log('[DASHBOARD STATS] Total counts in database:', {
          totalTransactions: transactionCount.count || 0,
          totalWithdrawals: withdrawCount.count || 0,
          transactionCountError: transactionCount.error?.message,
          withdrawCountError: withdrawCount.error?.message
        });
        
        // Check what project_id values actually exist in the data
        const [projectIdCheck, withdrawProjectIdCheck] = await Promise.all([
          supabase
            .from('transaction')
            .select('project_id')
            .limit(100),
          supabase
            .from('withdraw')
            .select('project_id')
            .limit(100)
        ]);
        
        // Get unique project_id values
        const transactionProjectIds = [...new Set((projectIdCheck.data || []).map(t => t.project_id))];
        const withdrawProjectIds = [...new Set((withdrawProjectIdCheck.data || []).map(w => w.project_id))];
        
        console.log('[DASHBOARD STATS] Project ID analysis:', {
          currentProjectId: projectId,
          isMainProject,
          uniqueTransactionProjectIds: transactionProjectIds,
          uniqueWithdrawProjectIds: withdrawProjectIds,
          transactionProjectIdCounts: transactionProjectIds.map(id => ({
            project_id: id,
            count: (projectIdCheck.data || []).filter(t => t.project_id === id).length
          })),
          withdrawProjectIdCounts: withdrawProjectIds.map(id => ({
            project_id: id,
            count: (withdrawProjectIdCheck.data || []).filter(w => w.project_id === id).length
          }))
        });

        // Fetch all stats in parallel - FILTERED BY PROJECT_ID
        // Each project's admin panel shows only its own project's stats
        // Main project: project_id IS NULL
        // Sub-projects: project_id = projectId
        const [
          transactionResult,
          depositResult,
          withdrawResult,
          usersResult,
          spinsResult,
          ticketsResult
        ] = await Promise.all([
          // Total tokens spent from transaction table - FILTERED BY PROJECT_ID
          // Note: transaction table only has 'ogx' column, not 'apes'
          isMainProject
            ? supabase
                .from('transaction')
                .select('ogx')
                .is('project_id', null) // Main project: project_id IS NULL
            : supabase
                .from('transaction')
                .select('ogx')
                .eq('project_id', projectId!), // Sub-project: project_id = projectId
          
          // Total tokens deposited (purchases) from transaction table - FILTERED BY PROJECT_ID
          // Note: transaction table only has 'ogx' column, not 'apes'
          isMainProject
            ? supabase
                .from('transaction')
                .select('ogx')
                .is('project_id', null)
                .eq('t_status', 'purchase') // Deposits are purchases
            : supabase
            .from('transaction')
                .select('ogx')
                .eq('project_id', projectId!)
                .eq('t_status', 'purchase'), // Deposits are purchases
          
          // Total tokens withdrawn from withdraw table - FILTERED BY PROJECT_ID
          // Note: withdraw table only has 'ogx' column, not 'apes'
          isMainProject
            ? supabase
                .from('withdraw')
                .select('ogx')
                .is('project_id', null) // Main project: project_id IS NULL
            : supabase
                .from('withdraw')
                .select('ogx')
                .eq('project_id', projectId!), // Sub-project: project_id = projectId
          
          // Total Users
          isMainProject
            ? supabase
                .from('user')
                .select('uid', { count: 'exact' }) // Main project: legacy user table
            : supabase
            .from('project_users')
            .select('id', { count: 'exact', head: true })
                .eq('project_id', projectId!), // Sub-project: project_users table
          
          // Total Spins
          isMainProject
            ? supabase
                .from('spins')
                .select('id', { count: 'exact' }) // Main project: legacy spins table
            : supabase
            .from('prizeWin')
            .select('id', { count: 'exact', head: true })
                .eq('project_id', projectId!), // Sub-project: prizeWin table
          
          // Tickets Sold
          isMainProject
            ? supabase
                .from('tickets')
                .select('id', { count: 'exact' }) // Main project: legacy tickets table
            : supabase
            .from('jackpot_tickets')
            .select('id', { count: 'exact', head: true })
                .eq('project_id', projectId!) // Sub-project: jackpot_tickets table
        ]);

        // Check for errors in any query
        if (transactionResult.error) {
          console.warn('Transaction query error:', transactionResult.error);
        }
        if (depositResult.error) {
          console.warn('Deposit query error:', depositResult.error);
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
        const transactions = transactionResult.data || [];
        
        console.log('[DASHBOARD STATS] Transaction data:', {
          projectId,
          isMainProject,
          transactionCount: transactions.length,
          sampleTransaction: transactions[0]
        });
        
        const totalOGXSpent = transactions.reduce((sum, item) => {
          if (!item) return sum;
          const ogxAmount = parseFloat(item.ogx || '0') || 0;
          return sum + ogxAmount;
        }, 0) || 0;

        // Calculate total project token deposited (purchases) from transaction table
        // Note: 'ogx' field stores project token amount (for backward compatibility)
        const deposits = depositResult?.data || [];
        
        console.log('[DASHBOARD STATS] Deposit data:', {
          projectId,
          isMainProject,
          depositCount: deposits.length,
          sampleDeposit: deposits[0],
          depositResultError: depositResult?.error,
          depositResultData: depositResult?.data
        });
        
        const totalOGXDeposited = deposits.reduce((sum, item) => {
          if (!item) return sum;
          const ogxAmount = parseFloat(item.ogx || '0') || 0;
          return sum + ogxAmount;
        }, 0) || 0;

        // Calculate total project token withdrawn from withdraw table
        // Note: 'ogx' field stores project token amount (for backward compatibility)
        const withdrawals = withdrawResult.data || [];
        
        console.log('[DASHBOARD STATS] Withdraw data:', {
          projectId,
          isMainProject,
          withdrawalCount: withdrawals.length,
          sampleWithdraw: withdrawals[0]
        });
        
        const totalOGXWithdrawn = withdrawals.reduce((sum, item) => {
          if (!item) return sum;
          const ogxAmount = parseFloat(item.ogx || '0') || 0;
          return sum + ogxAmount;
        }, 0) || 0;

        // Convert project token to SOL (default: 1000 tokens = 1 SOL, but can be configured per project)
        const totalSOLSpent = (totalOGXSpent || 0) / 1000;
        const totalSOLDeposited = (totalOGXDeposited || 0) / 1000;
        const totalSOLWithdrawn = (totalOGXWithdrawn || 0) / 1000;
        
        console.log('[DASHBOARD STATS] Calculated totals:', {
          totalOGXSpent: totalOGXSpent || 0,
          totalOGXDeposited: totalOGXDeposited || 0,
          totalOGXWithdrawn: totalOGXWithdrawn || 0,
          totalSOLSpent: totalSOLSpent || 0,
          totalSOLDeposited: totalSOLDeposited || 0,
          totalSOLWithdrawn: totalSOLWithdrawn || 0
        });

        const totalUsers = usersResult.count || 0;
        const totalSpins = spinsResult.count || 0;
        const ticketsSold = ticketsResult.count || 0;

        setStats({
          totalOGXSpent,
          totalSOLSpent,
          totalOGXDeposited,
          totalSOLDeposited,
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
    const fetchRecentActivity = async () => {
      try {
        setLoading(true);
        setError(null);

        // Determine if this is the main project (projectId is null)
        const isMainProject = !projectId;

        // Fetch recent transactions and users
        // Main project: query legacy tables with project_id IS NULL
        // Sub-project: query new tables with project_id = projectId
        const [transactionsResult, prizeWinResult, usersResult] = await Promise.all([
          // Transactions
          isMainProject
            ? supabase
                .from('transaction')
                .select('*')
                .is('project_id', null) // Main project: legacy data
                .order('created_at', { ascending: false })
                .limit(3)
            : supabase
            .from('transaction')
            .select('*')
                .eq('project_id', projectId!) // Sub-project: filtered by project_id
            .order('created_at', { ascending: false })
            .limit(3),
          
          // Spins/Prize Wins
          isMainProject
            ? supabase
                .from('spins')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(2) // Main project: legacy spins table
            : supabase
            .from('prizeWin')
            .select('*')
                .eq('project_id', projectId!) // Sub-project: prizeWin table
            .order('created_at', { ascending: false })
            .limit(2),
          
          // Users
          isMainProject
            ? supabase
                .from('user')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5) // Main project: legacy user table
            : supabase
            .from('project_users')
            .select('*')
                .eq('project_id', projectId!) // Sub-project: project_users table
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
            title: 'Token Transaction',
            description: `${transaction.ogx} tokens spent`,
            subtitle: `User ID: ${transaction.userId}`,
            timestamp: transaction.created_at,
            icon: 'deposit'
          });
        });

        // Add prize wins (spins)
        prizeWinResult.data?.forEach((prize: any) => {
          // Handle both legacy spins table and prizeWin table
          const reward = prize.reward || prize.prize || 'nothing';
          activities.push({
            id: `spin-${prize.id}`,
            type: 'spin',
            title: 'New spin completed',
            description: `User spun and won ${reward}`,
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

