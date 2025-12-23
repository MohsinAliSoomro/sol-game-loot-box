import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useSolanaVaultBalance } from './useSolanaBalance'

export const useDashboardStats = () => {
  // Get Solana vault balance
  const vaultBalance = useSolanaVaultBalance()
  
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
    error: null
  })

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setStats(prev => ({ ...prev, loading: true, error: null }))

        // Wait for vault balance to load if it's still loading
        if (vaultBalance.loading) {
          console.log('Waiting for vault balance to load...')
          return
        }

        // Fetch all stats in parallel
        // MAIN PROJECT ONLY: Filter for data where project_id IS NULL (legacy main project data)
        // This isolates the main project from sub-projects
        const [
          transactionResult,
          withdrawResult,
          usersResult,
          spinsResult,
          ticketsResult
        ] = await Promise.all([
          // Total OGX spent from transaction table (main project only)
          supabase
            .from('transaction')
            .select('ogx')
            .is('project_id', null),
          
          // Total OGX withdrawn from withdraw table (main project only)
          supabase
            .from('withdraw')
            .select('ogx')
            .is('project_id', null),
          
          // Total Users (main project - legacy user table has no project_id)
          supabase
            .from('user')
            .select('uid', { count: 'exact' }),
          
          // Total Spins (main project only)
          supabase
            .from('spins')
            .select('id', { count: 'exact' }),
          
          // Tickets Sold (main project only)
          supabase
            .from('tickets')
            .select('id', { count: 'exact' })
        ])

        // Calculate total OGX spent from transaction table
        const totalOGXSpent = transactionResult.data?.reduce((sum, item) => {
          const ogxAmount = parseFloat(item.ogx) || 0
          return sum + ogxAmount
        }, 0) || 0

        // Calculate total OGX withdrawn from withdraw table
        const totalOGXWithdrawn = withdrawResult.data?.reduce((sum, item) => {
          const ogxAmount = parseFloat(item.ogx) || 0
          return sum + ogxAmount
        }, 0) || 0

        // Convert OGX to SOL (1000 OGX = 1 SOL)
        const totalSOLSpent = totalOGXSpent / 1000
        const totalSOLWithdrawn = totalOGXWithdrawn / 1000

        const totalUsers = usersResult.count || 0
        const totalSpins = spinsResult.count || 0
        const ticketsSold = ticketsResult.count || 0
        
        // Use Solana vault balance instead of database balance
        const walletBalance = vaultBalance.totalBalance || 0

        setStats({
          totalOGXSpent,
          totalSOLSpent,
          totalOGXWithdrawn,
          totalSOLWithdrawn,
          totalUsers,
          totalSpins,
          ticketsSold,
          walletBalance,
          loading: false,
          error: vaultBalance.error || null
        })

      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
        setStats(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }))
      }
    }

    fetchDashboardStats()
  }, [vaultBalance.loading, vaultBalance.totalBalance, vaultBalance.error])

  return stats
}

export const useRecentActivity = () => {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchRecentActivity = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch recent transactions and users
        // MAIN PROJECT ONLY: Filter for data where project_id IS NULL (legacy main project data)
        const [transactionsResult, spinsResult, usersResult] = await Promise.all([
          supabase
            .from('transaction')
            .select('*')
            .is('project_id', null) // Main project only
            .order('created_at', { ascending: false })
            .limit(3),
          
          supabase
            .from('spins')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(2),
          
          supabase
            .from('user')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5)
        ])

        // Combine and format activities
        const activities = []
        
        // Add user registrations first (most important)
        usersResult.data?.forEach(user => {
          const userName = user.full_name || user.email?.split('@')[0] || 'New User'
          const userEmail = user.email || 'No email'
          activities.push({
            id: `user-${user.uid}`,
            type: 'user',
            title: 'New user registered',
            description: `${userName} joined the platform`,
            subtitle: userEmail,
            timestamp: user.created_at,
            icon: 'user'
          })
        })

        // Add transactions
        transactionsResult.data?.forEach(transaction => {
          activities.push({
            id: `transaction-${transaction.transactionId}`,
            type: 'transaction',
            title: 'OGX Transaction',
            description: `${transaction.ogx} OGX spent`,
            subtitle: `User ID: ${transaction.userId}`,
            timestamp: transaction.created_at,
            icon: 'deposit'
          })
        })

        // Add spins
        spinsResult.data?.forEach(spin => {
          activities.push({
            id: `spin-${spin.id}`,
            type: 'spin',
            title: 'New spin completed',
            description: `User spun and won ${spin.reward || 'nothing'}`,
            subtitle: 'Lootbox activity',
            timestamp: spin.created_at,
            icon: 'spin'
          })
        })

        // Sort by timestamp and take the most recent 5
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        setActivities(activities.slice(0, 5))

      } catch (error) {
        console.error('Error fetching recent activity:', error)
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchRecentActivity()
  }, [])

  return { activities, loading, error }
}
