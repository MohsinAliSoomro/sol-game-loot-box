import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const useUsers = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalUsers, setTotalUsers] = useState(0)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch users with count
      const { data, error: fetchError, count } = await supabase
        .from('user')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      setUsers(data || [])
      setTotalUsers(count || 0)

    } catch (error) {
      console.error('Error fetching users:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const formatUserData = (user) => {
    return {
      id: user.uid,
      name: user.full_name || 'Unknown User',
      email: user.email || 'No email',
      uid: user.uid,
      created_at: user.created_at,
      status: 'Active', // You can add status logic based on your requirements
      lastLogin: user.created_at ? new Date(user.created_at).toLocaleString() : 'Never',
      avatar: user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'
    }
  }

  const formattedUsers = users.map(formatUserData)

  return {
    users: formattedUsers,
    totalUsers,
    loading,
    error,
    refetch: fetchUsers
  }
}
