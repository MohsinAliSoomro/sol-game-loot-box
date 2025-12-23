import React, { useState } from 'react'
import { useDashboardStats, useRecentActivity } from '../hooks/useDashboardStats'
import { usePlatformSOLBalance, useFeeCollection } from '../hooks/usePlatformBalance'
import VaultAddressFinder from '../components/VaultAddressFinder'

function Dashboard() {
  const stats = useDashboardStats()
  const { activities, loading: activitiesLoading, error: activitiesError } = useRecentActivity()
  const platformSOL = usePlatformSOLBalance()
  const feeCollection = useFeeCollection()
  const [showVaultFinder, setShowVaultFinder] = useState(false)

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const getActivityIcon = (iconType) => {
    const iconClass = "w-5 h-5"
    switch (iconType) {
      case 'deposit':
        return (
          <svg className={`${iconClass} text-green-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'withdraw':
        return (
          <svg className={`${iconClass} text-red-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'spin':
        return (
          <svg className={`${iconClass} text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-4.991-2.691L7.98 12.01M16.023 9.348L12.014 5.34m-4.028 0v4.992m0 0h4.992m-4.993 0l3.181-3.183a8.25 8.25 0 0111.664 0l3.181 3.183" />
          </svg>
        )
      case 'user':
        return (
          <svg className={`${iconClass} text-purple-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )
      default:
        return (
          <svg className={`${iconClass} text-gray-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const getActivityBgColor = (iconType) => {
    switch (iconType) {
      case 'deposit':
        return 'bg-green-100'
      case 'withdraw':
        return 'bg-red-100'
      case 'spin':
        return 'bg-blue-100'
      case 'user':
        return 'bg-purple-100'
      default:
        return 'bg-gray-100'
    }
  }

  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now - time) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
  }

  if (stats.loading) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-800">Welcome to Dashboard</h1>
          <p className="text-gray-600 mt-1">Loading dashboard data...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (stats.error) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-800">Welcome to Dashboard</h1>
          <p className="text-red-600 mt-1">Error loading dashboard: {stats.error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Welcome to Dashboard</h1>
            <p className="text-gray-600 mt-1">Here's what's happening with your lootbox platform today.</p>
          </div>
          <button
            onClick={() => setShowVaultFinder(!showVaultFinder)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            {showVaultFinder ? 'Hide' : 'Find'} Vault Addresses
          </button>
        </div>
      </div>

      {/* Vault Address Finder */}
      {showVaultFinder && (
        <div className="mb-8">
          <VaultAddressFinder />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 mb-8">
        {/* Total OGX Spent Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total OGX Spent</p>
              <h3 className="text-2xl font-semibold text-gray-800 mt-1">{formatNumber(stats.totalOGXSpent)}</h3>
              <p className="text-orange-500 text-sm mt-1">All users combined</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total SOL Equivalent Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">SOL Equivalent</p>
              <h3 className="text-2xl font-semibold text-gray-800 mt-1">{formatCurrency(stats.totalSOLSpent)}</h3>
              <p className="text-blue-500 text-sm mt-1">1000 OGX = 1 SOL</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total OGX Withdrawn Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total OGX Withdrawn</p>
              <h3 className="text-2xl font-semibold text-gray-800 mt-1">{formatNumber(stats.totalOGXWithdrawn)}</h3>
              <p className="text-red-500 text-sm mt-1">From withdraw table</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414-.336.75-.75.75h-.75m0-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-15c-.621 0-1.125-.504-1.125-1.125V6.375c0-.621.504-1.125 1.125-1.125h.375m15-3.75V5.625c0 .621-.504 1.125-1.125 1.125h-15c-.621 0-1.125-.504-1.125-1.125V3.375m15 0a1.125 1.125 0 00-1.125-1.125h-15A1.125 1.125 0 002.25 3.375m15 0c.621 0 1.125.504 1.125 1.125v15a1.125 1.125 0 01-1.125 1.125h-15a1.125 1.125 0 01-1.125-1.125v-15c0-.621.504-1.125 1.125-1.125h15z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total SOL Withdrawn Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">SOL Withdrawn</p>
              <h3 className="text-2xl font-semibold text-gray-800 mt-1">{formatCurrency(stats.totalSOLWithdrawn)}</h3>
              <p className="text-red-500 text-sm mt-1">1000 OGX = 1 SOL</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414-.336.75-.75.75h-.75m0-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-15c-.621 0-1.125-.504-1.125-1.125V6.375c0-.621.504-1.125 1.125-1.125h.375m15-3.75V5.625c0 .621-.504 1.125-1.125 1.125h-15c-.621 0-1.125-.504-1.125-1.125V3.375m15 0a1.125 1.125 0 00-1.125-1.125h-15A1.125 1.125 0 002.25 3.375m15 0c.621 0 1.125.504 1.125 1.125v15a1.125 1.125 0 01-1.125 1.125h-15a1.125 1.125 0 01-1.125-1.125v-15c0-.621.504-1.125 1.125-1.125h15z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Users Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <h3 className="text-2xl font-semibold text-gray-800 mt-1">{formatNumber(stats.totalUsers)}</h3>
              <p className="text-green-500 text-sm mt-1">Live data from database</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Spins Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Spins</p>
              <h3 className="text-2xl font-semibold text-gray-800 mt-1">{formatNumber(stats.totalSpins)}</h3>
              <p className="text-green-500 text-sm mt-1">Live data from database</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-4.991-2.691L7.98 12.01M16.023 9.348L12.014 5.34m-4.028 0v4.992m0 0h4.992m-4.993 0l3.181-3.183a8.25 8.25 0 0111.664 0l3.181 3.183" />
              </svg>
            </div>
          </div>
        </div>

        {/* Tickets Sold Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tickets Sold</p>
              <h3 className="text-2xl font-semibold text-gray-800 mt-1">{formatNumber(stats.ticketsSold)}</h3>
              <p className="text-green-500 text-sm mt-1">Live data from database</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-4.991-2.691L7.98 12.01M16.023 9.348L12.014 5.34m-4.028 0v4.992m0 0h4.992m-4.993 0l3.181-3.183a8.25 8.25 0 0111.664 0l3.181 3.183" />
              </svg>
            </div>
          </div>
        </div>

        {/* Platform SOL Balance Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Platform SOL Balance</p>
              <h3 className="text-2xl font-semibold text-gray-800 mt-1">
                {platformSOL.loading ? 'Loading...' : platformSOL.formattedBalance}
              </h3>
              <p className="text-blue-500 text-sm mt-1">Where deposits go</p>
              <div className="flex space-x-2 mt-1">
                <button
                  onClick={platformSOL.refresh}
                  className="text-xs text-blue-500 hover:text-blue-700"
                >
                  🔄 Refresh Balance
                </button>
                <span className="text-xs text-gray-400">
                  {platformSOL.wallet ? `${platformSOL.wallet.slice(0, 8)}...` : ''}
                </span>
              </div>
              {platformSOL.error && (
                <p className="text-xs text-red-500 mt-1">{platformSOL.error}</p>
              )}
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Fee Collection Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-600">Collected Fees</p>
              <h3 className="text-2xl font-semibold text-gray-800 mt-1">
                {feeCollection.loading ? 'Loading...' : `${feeCollection.totalFees.toFixed(6)} SOL`}
              </h3>
              <p className="text-green-500 text-sm mt-1">
                Total fees collected from deposits
              </p>
              <div className="flex flex-col space-y-1 mt-2">
                {feeCollection.feeWallet && (
                  <span className="text-xs text-gray-500 font-mono">
                    {/* Wallet: {feeCollection.feeWallet} */}
                  </span>
                )}
                <div className="flex space-x-2">
                  <button
                    onClick={feeCollection.refresh}
                    className="text-xs text-green-500 hover:text-green-700 font-medium"
                  >
                    🔄 Refresh
                  </button>
                  {feeCollection.lastUpdated && (
                    <span className="text-xs text-gray-400">
                      Updated: {new Date(feeCollection.lastUpdated).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
              {feeCollection.error && (
                <p className="text-xs text-red-500 mt-1">{feeCollection.error}</p>
              )}
              {feeCollection.note && (
                <p className="text-xs text-blue-500 mt-1">{feeCollection.note}</p>
              )}
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
        {activitiesLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-200 p-2 rounded-lg w-9 h-9"></div>
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                  </div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : activitiesError ? (
          <div className="text-center py-8">
            <p className="text-red-500">Error loading recent activity: {activitiesError}</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No recent activity found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center space-x-4">
                  <div className={`${getActivityBgColor(activity.icon)} p-2 rounded-lg`}>
                    {getActivityIcon(activity.icon)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{activity.title}</p>
                    <p className="text-xs text-gray-500">{activity.description}</p>
                    {activity.subtitle && (
                      <p className="text-xs text-gray-400 mt-1">{activity.subtitle}</p>
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-500 whitespace-nowrap ml-4">{formatTimeAgo(activity.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard

  