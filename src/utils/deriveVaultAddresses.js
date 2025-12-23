// Helper script to derive Solana Program Derived Addresses (PDAs)
// Run this in your browser console or Node.js to find vault addresses

import { PublicKey } from '@solana/web3.js'

/**
 * Derive a Program Derived Address (PDA)
 * @param {string} programId - Your Solana program's public key
 * @param {string[]} seeds - Array of seed strings used in your program
 * @returns {Promise<string>} - The derived PDA address
 */
export const derivePDA = async (programId, seeds) => {
  try {
    const programKey = new PublicKey(programId)
    const seedBuffers = seeds.map(seed => Buffer.from(seed))
    
    const [pda, bump] = await PublicKey.findProgramAddress(seedBuffers, programKey)
    
    console.log('Program ID:', programId)
    console.log('Seeds:', seeds)
    console.log('Derived PDA:', pda.toBase58())
    console.log('Bump:', bump)
    
    return pda.toBase58()
  } catch (error) {
    console.error('Error deriving PDA:', error)
    throw error
  }
}

/**
 * Common vault PDA patterns
 * Replace with your actual program ID and seeds
 */
export const commonVaultPatterns = {
  // Example patterns - replace with your actual values
  treasury: {
    programId: 'YOUR_PROGRAM_ID_HERE',
    seeds: ['treasury']
  },
  
  vault: {
    programId: 'YOUR_PROGRAM_ID_HERE', 
    seeds: ['vault']
  },
  
  lootboxVault: {
    programId: 'YOUR_PROGRAM_ID_HERE',
    seeds: ['lootbox', 'vault']
  },
  
  jackpotVault: {
    programId: 'YOUR_PROGRAM_ID_HERE',
    seeds: ['jackpot', 'vault']
  }
}

/**
 * Derive multiple common vault patterns
 */
export const deriveCommonVaults = async () => {
  const results = {}
  
  for (const [name, config] of Object.entries(commonVaultPatterns)) {
    try {
      if (config.programId !== 'YOUR_PROGRAM_ID_HERE') {
        const pda = await derivePDA(config.programId, config.seeds)
        results[name] = pda
      }
    } catch (error) {
      console.error(`Error deriving ${name}:`, error)
      results[name] = null
    }
  }
  
  return results
}

// Example usage:
// 1. Replace 'YOUR_PROGRAM_ID_HERE' with your actual program ID
// 2. Update the seeds array with your program's actual seeds
// 3. Run: derivePDA('YourProgramId', ['vault', 'seed'])
// 4. Or run: deriveCommonVaults() to try common patterns

