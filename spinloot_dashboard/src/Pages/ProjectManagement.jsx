import { useState } from 'react'
import { 
  createProject, 
  getProjectData, 
  projectExists, 
  generateProjectId,
  deriveProjectPDA 
} from '../lib/projectService'
import { connection } from '../lib/solana'
import { PublicKey } from '@solana/web3.js'

export default function ProjectManagement() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    projectId: '',
    feeAmount: '1000000', // 0.001 SOL in lamports
  })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [walletAddress, setWalletAddress] = useState('')
  const [wallet, setWallet] = useState(null)

  // Connect wallet (simplified - you may want to use a wallet adapter)
  const handleConnectWallet = async () => {
    if (typeof window !== 'undefined' && window.solana) {
      try {
        const resp = await window.solana.connect()
        setWalletAddress(resp.publicKey.toString())
        setWallet({
          publicKey: new PublicKey(resp.publicKey),
          signTransaction: async (tx) => {
            return await window.solana.signTransaction(tx)
          },
        })
      } catch (err) {
        setError('Failed to connect wallet: ' + err.message)
      }
    } else {
      setError('Solana wallet not found. Please install Phantom or Solflare.')
    }
  }

  // Create project handler
  const handleCreateProject = async () => {
    if (!wallet) {
      setError('Please connect your wallet first')
      return
    }

    if (!formData.name || !formData.description) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const projectId = formData.projectId 
        ? parseInt(formData.projectId)
        : generateProjectId()

      const result = await createProject(
        wallet,
        projectId,
        formData.name,
        formData.description,
        new PublicKey('So11111111111111111111111111111111111111112'), // SOL mint
        parseInt(formData.feeAmount)
      )

      setSuccess(
        `Project created successfully!\n` +
        `PDA: ${result.projectPDA}\n` +
        `Transaction: ${result.signature}\n` +
        `Project ID: ${result.projectId}`
      )
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        projectId: '',
        feeAmount: '1000000',
      })
    } catch (err) {
      setError(err.message || 'Failed to create project')
      console.error('Error creating project:', err)
    } finally {
      setLoading(false)
    }
  }

  // View project handler
  const handleViewProject = async () => {
    if (!formData.projectId) {
      setError('Please enter a project ID')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const projectData = await getProjectData(formData.projectId)
      setSuccess(
        `Project Found!\n` +
        `PDA: ${projectData.pda}\n` +
        `Bump: ${projectData.bump}\n` +
        `Data Length: ${projectData.dataLength} bytes\n` +
        `Owner: ${projectData.owner}`
      )
    } catch (err) {
      setError(err.message || 'Failed to fetch project')
      console.error('Error fetching project:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Project Management
      </h1>

      {/* Wallet Connection */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        {!wallet ? (
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Connect your wallet to create projects
            </p>
            <button
              onClick={handleConnectWallet}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Connected: <span className="font-mono text-xs">{walletAddress}</span>
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 border border-green-400 text-green-700 dark:text-green-200 rounded whitespace-pre-line">
          {success}
        </div>
      )}

      {/* Form */}
      <div className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Project Name (max 50 chars)
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            maxLength={50}
            placeholder="My Awesome Project"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description (max 100 chars)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            maxLength={100}
            rows={3}
            placeholder="Project description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Project ID (optional - auto-generated if empty)
          </label>
          <input
            type="text"
            value={formData.projectId}
            onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Leave empty for auto-generation"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Fee Amount (lamports, default: 1000000 = 0.001 SOL)
          </label>
          <input
            type="text"
            value={formData.feeAmount}
            onChange={(e) => setFormData({ ...formData, feeAmount: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="1000000"
          />
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleCreateProject}
            disabled={loading || !wallet}
            className="flex-1 px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>

          <button
            onClick={handleViewProject}
            disabled={loading || !formData.projectId}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
          >
            {loading ? 'Loading...' : 'View Project'}
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
          How it works:
        </h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <li>Each project gets a unique Project ID and PDA (Program Derived Address)</li>
          <li>Projects are stored on-chain and can be viewed on Solana Explorer</li>
          <li>You can create multiple projects under the same program</li>
          <li>Project ID can be auto-generated (timestamp) or manually specified</li>
        </ul>
      </div>
    </div>
  )
}


