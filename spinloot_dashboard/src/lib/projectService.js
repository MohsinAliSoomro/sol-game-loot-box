/**
 * Project Management Service for Dashboard
 * Handles creating and managing Project accounts on Solana
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js'
import { connection } from './solana'
import { SOLANA_CONFIG } from './solanaConfig'

// Program ID (same as vault_project)
const PROGRAM_ID = new PublicKey('BkwbgssSuWQS46MtNRcq5RCnUgYq1H1LJpKhCGUtdGaH')

/**
 * Convert number to BN-like buffer (little-endian u64)
 */
function numberToU64Buffer(value) {
  const buffer = Buffer.allocUnsafe(8)
  // Handle both number and string
  const num = typeof value === 'string' ? BigInt(value) : BigInt(value)
  for (let i = 0; i < 8; i++) {
    buffer[i] = Number((num >> BigInt(i * 8)) & BigInt(0xff))
  }
  return buffer
}

/**
 * Derive Project PDA address
 */
export function deriveProjectPDA(projectId, programId = PROGRAM_ID) {
  const projectIdNum = typeof projectId === 'string' ? parseInt(projectId) : projectId
  const projectIdBytes = numberToU64Buffer(projectIdNum)
  
  const seeds = [
    Buffer.from('project'),
    projectIdBytes
  ]
  
  return PublicKey.findProgramAddressSync(seeds, programId)
}

/**
 * Generate a unique project ID (timestamp-based)
 */
export function generateProjectId() {
  return Date.now()
}

/**
 * Create a new Project account
 */
export async function createProject(
  wallet,
  projectId,
  name,
  description,
  mint = new PublicKey('So11111111111111111111111111111111111111112'), // SOL mint
  feeAmount = 1_000_000 // 0.001 SOL default
) {
  // Validate inputs
  if (name.length > 50) {
    throw new Error('Project name must be 50 characters or less')
  }
  if (description.length > 100) {
    throw new Error('Project description must be 100 characters or less')
  }

  const finalProjectId = typeof projectId === 'string' ? parseInt(projectId) : projectId
  const finalFeeAmount = typeof feeAmount === 'string' ? parseInt(feeAmount) : feeAmount

  // Derive Project PDA
  const [projectPDA, bump] = deriveProjectPDA(finalProjectId, PROGRAM_ID)

  // Check if project already exists
  const accountInfo = await connection.getAccountInfo(projectPDA)
  if (accountInfo) {
    throw new Error(
      `Project with ID ${finalProjectId} already exists at PDA ${projectPDA.toString()}`
    )
  }

  // Build instruction data manually
  const instructionDiscriminator = Buffer.from([69, 126, 215, 37, 20, 60, 73, 235])
  const projectIdBuffer = numberToU64Buffer(finalProjectId)
  
  const nameBuffer = Buffer.from(name, 'utf8')
  const nameLengthBuffer = Buffer.allocUnsafe(4)
  nameLengthBuffer.writeUInt32LE(nameBuffer.length, 0)
  
  const descBuffer = Buffer.from(description, 'utf8')
  const descLengthBuffer = Buffer.allocUnsafe(4)
  descLengthBuffer.writeUInt32LE(descBuffer.length, 0)
  
  const feeAmountBuffer = numberToU64Buffer(finalFeeAmount)
  
  const instructionData = Buffer.concat([
    instructionDiscriminator,
    projectIdBuffer,
    nameLengthBuffer,
    nameBuffer,
    descLengthBuffer,
    descBuffer,
    feeAmountBuffer
  ])

  // Create instruction
  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // admin
      { pubkey: mint, isSigner: false, isWritable: false }, // mint
      { pubkey: projectPDA, isSigner: false, isWritable: true }, // project
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    data: instructionData,
  })

  // Create and send transaction
  const transaction = new Transaction().add(instruction)
  const { blockhash } = await connection.getLatestBlockhash('confirmed')
  transaction.recentBlockhash = blockhash
  transaction.feePayer = wallet.publicKey

  // Sign and send (wallet should have signTransaction method)
  const signedTx = await wallet.signTransaction(transaction)
  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })

  // Wait for confirmation
  await connection.confirmTransaction(signature, 'confirmed')

  return {
    signature,
    projectPDA: projectPDA.toString(),
    projectId: finalProjectId,
  }
}

/**
 * Fetch Project account data
 */
export async function getProjectData(projectId, programId = PROGRAM_ID) {
  // For now, return basic info - full decoding would require Anchor's BorshAccountsCoder
  // which isn't available in the dashboard. You can enhance this later.
  const projectIdNum = typeof projectId === 'string' ? parseInt(projectId) : projectId
  const [projectPDA, bump] = deriveProjectPDA(projectIdNum, programId)
  
  const accountInfo = await connection.getAccountInfo(projectPDA)
  if (!accountInfo) {
    throw new Error(`Project account does not exist at PDA ${projectPDA.toString()}`)
  }

  return {
    projectId: projectIdNum.toString(),
    pda: projectPDA.toString(),
    bump,
    exists: true,
    dataLength: accountInfo.data.length,
    owner: accountInfo.owner.toString(),
  }
}

/**
 * Check if a project exists
 */
export async function projectExists(projectId, programId = PROGRAM_ID) {
  try {
    const projectIdNum = typeof projectId === 'string' ? parseInt(projectId) : projectId
    const [projectPDA] = deriveProjectPDA(projectIdNum, programId)
    const accountInfo = await connection.getAccountInfo(projectPDA)
    return accountInfo !== null
  } catch {
    return false
  }
}


