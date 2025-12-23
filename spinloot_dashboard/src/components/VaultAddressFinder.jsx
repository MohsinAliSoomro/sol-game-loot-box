import React, { useState } from 'react'
import { derivePDA } from '../utils/deriveVaultAddresses'

function VaultAddressFinder() {
  const [programId, setProgramId] = useState('')
  const [seeds, setSeeds] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDerive = async () => {
    if (!programId || !seeds) {
      setError('Please enter both Program ID and Seeds')
      return
    }

    setLoading(true)
    setError('')
    setResult('')

    try {
      // Parse seeds (comma-separated)
      const seedArray = seeds.split(',').map(s => s.trim()).filter(s => s)
      
      const pda = await derivePDA(programId, seedArray)
      setResult(pda)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const commonSeeds = [
    'vault',
    'treasury', 
    'lootbox',
    'jackpot',
    'pool',
    'fund'
  ]

  const addSeed = (seed) => {
    const currentSeeds = seeds ? seeds.split(',').map(s => s.trim()) : []
    if (!currentSeeds.includes(seed)) {
      setSeeds([...currentSeeds, seed].join(', '))
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Find Your Solana Vault Address</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Program ID
          </label>
          <input
            type="text"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            placeholder="Enter your Solana program ID (e.g., 11111111111111111111111111111112)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seeds (comma-separated)
          </label>
          <input
            type="text"
            value={seeds}
            onChange={(e) => setSeeds(e.target.value)}
            placeholder="Enter seeds separated by commas (e.g., vault, treasury)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          <div className="mt-2">
            <p className="text-sm text-gray-600 mb-2">Common seeds:</p>
            <div className="flex flex-wrap gap-2">
              {commonSeeds.map(seed => (
                <button
                  key={seed}
                  onClick={() => addSeed(seed)}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
                >
                  + {seed}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleDerive}
          disabled={loading}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Deriving PDA...' : 'Find Vault Address'}
        </button>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {result && (
          <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
            <p className="font-medium">Vault Address Found:</p>
            <p className="font-mono text-sm break-all">{result}</p>
            <button
              onClick={() => navigator.clipboard.writeText(result)}
              className="mt-2 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
            >
              Copy Address
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-md">
        <h3 className="font-medium mb-2">How to find your Program ID and Seeds:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Program ID:</strong> Found in your program's deployment logs or Solana Explorer</li>
          <li>• <strong>Seeds:</strong> Defined in your Rust program code when creating PDAs</li>
          <li>• <strong>Common patterns:</strong> vault, treasury, lootbox, jackpot, pool</li>
          <li>• <strong>Check your code:</strong> Look for <code>find_program_address</code> calls</li>
        </ul>
      </div>
    </div>
  )
}

export default VaultAddressFinder

