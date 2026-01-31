/**
 * Project Management Service
 * Handles creating and managing Project accounts on Solana
 */

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { CONFIG } from "./config";
import deployedIdl from "../idl/vault_project.json";

// Program ID from config
export const PROGRAM_ID = new PublicKey(CONFIG.PROGRAM_ID);
export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://mainnet.helius-rpc.com/?api-key=5a1a852c-3ed9-40ee-bca8-dda4550c3ce8";

/**
 * Derive Project PDA address
 */
export function deriveProjectPDA(
  projectId: BN | number | string,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  const projectIdBN = typeof projectId === 'string' || typeof projectId === 'number'
    ? new BN(projectId)
    : projectId;
  
  const projectIdBytes = Buffer.allocUnsafe(8);
  projectIdBN.toArrayLike(Buffer, 'le', 8).copy(projectIdBytes);
  
  const seeds = [
    Buffer.from('project'),
    projectIdBytes
  ];
  
  return PublicKey.findProgramAddressSync(seeds, programId);
}

/**
 * Generate a unique project ID (timestamp-based)
 */
export function generateProjectId(): BN {
  return new BN(Date.now());
}

/**
 * Create a new Project account
 */
export async function createProject(
  connection: Connection,
  wallet: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> },
  projectId: BN | number | string,
  name: string,
  description: string,
  mint: PublicKey = new PublicKey(CONFIG.TOKENS.SOL),
  feeAmount: BN | number = new BN(1_000_000) // 0.001 SOL default
): Promise<{ signature: string; projectPDA: PublicKey; projectId: BN }> {
  
  // Validate inputs
  if (name.length > 50) {
    throw new Error('Project name must be 50 characters or less');
  }
  if (description.length > 100) {
    throw new Error('Project description must be 100 characters or less');
  }

  const finalProjectId = typeof projectId === 'string' || typeof projectId === 'number'
    ? new BN(projectId)
    : projectId;
  
  const finalFeeAmount = typeof feeAmount === 'number'
    ? new BN(feeAmount)
    : feeAmount;

  // Derive Project PDA
  const [projectPDA, bump] = deriveProjectPDA(finalProjectId, PROGRAM_ID);

  // Check if project already exists
  const accountInfo = await connection.getAccountInfo(projectPDA);
  if (accountInfo) {
    throw new Error(
      `Project with ID ${finalProjectId.toString()} already exists at PDA ${projectPDA.toString()}`
    );
  }

  // Build instruction data manually (same approach as create_project.ts script)
  const instructionDiscriminator = Buffer.from([69, 126, 215, 37, 20, 60, 73, 235]);
  const projectIdBuffer = Buffer.allocUnsafe(8);
  finalProjectId.toArrayLike(Buffer, 'le', 8).copy(projectIdBuffer);
  
  const nameBuffer = Buffer.from(name, 'utf8');
  const nameLengthBuffer = Buffer.allocUnsafe(4);
  nameLengthBuffer.writeUInt32LE(nameBuffer.length, 0);
  
  const descBuffer = Buffer.from(description, 'utf8');
  const descLengthBuffer = Buffer.allocUnsafe(4);
  descLengthBuffer.writeUInt32LE(descBuffer.length, 0);
  
  const feeAmountBuffer = Buffer.allocUnsafe(8);
  finalFeeAmount.toArrayLike(Buffer, 'le', 8).copy(feeAmountBuffer);
  
  const instructionData = Buffer.concat([
    instructionDiscriminator,
    projectIdBuffer,
    nameLengthBuffer,
    nameBuffer,
    descLengthBuffer,
    descBuffer,
    feeAmountBuffer
  ]);

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
  });

  // Create and send transaction
  const transaction = new Transaction().add(instruction);
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  // Sign and send
  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  // Wait for confirmation
  await connection.confirmTransaction(signature, 'confirmed');

  return {
    signature,
    projectPDA,
    projectId: finalProjectId,
  };
}

/**
 * Fetch Project account data
 */
export async function getProjectData(
  connection: Connection,
  projectId: BN | number | string,
  programId: PublicKey = PROGRAM_ID
): Promise<{
  projectId: string;
  name: string;
  description: string;
  admin: string;
  mint: string;
  feeAmount: string;
  createdAt: string;
  pda: string;
  bump: number;
}> {
  const { BorshAccountsCoder } = await import('@coral-xyz/anchor');
  
  const projectIdBN = typeof projectId === 'string' || typeof projectId === 'number'
    ? new BN(projectId)
    : projectId;
  
  const [projectPDA, bump] = deriveProjectPDA(projectIdBN, programId);
  
  const accountInfo = await connection.getAccountInfo(projectPDA);
  if (!accountInfo) {
    throw new Error(`Project account does not exist at PDA ${projectPDA.toString()}`);
  }

  // Decode account data
  const coder = new BorshAccountsCoder(deployedIdl as any);
  const projectAccount = coder.decode('Project', accountInfo.data);
  
  // Handle BN objects and PublicKeys
  const projectIdValue = projectAccount.projectId instanceof BN 
    ? projectAccount.projectId 
    : new BN(projectAccount.projectId);
  const admin = projectAccount.admin instanceof PublicKey
    ? projectAccount.admin
    : new PublicKey(projectAccount.admin);
  const mint = projectAccount.mint instanceof PublicKey
    ? projectAccount.mint
    : new PublicKey(projectAccount.mint);
  const feeAmount = projectAccount.feeAmount instanceof BN
    ? projectAccount.feeAmount
    : new BN(projectAccount.feeAmount);
  const createdAt = projectAccount.createdAt instanceof BN
    ? projectAccount.createdAt
    : new BN(projectAccount.createdAt);

  return {
    projectId: projectIdValue.toString(),
    name: projectAccount.name,
    description: projectAccount.description,
    admin: admin.toString(),
    mint: mint.toString(),
    feeAmount: feeAmount.toString(),
    createdAt: createdAt.toString(),
    pda: projectPDA.toString(),
    bump,
  };
}

/**
 * Check if a project exists
 */
export async function projectExists(
  connection: Connection,
  projectId: BN | number | string,
  programId: PublicKey = PROGRAM_ID
): Promise<boolean> {
  try {
    const projectIdBN = typeof projectId === 'string' || typeof projectId === 'number'
      ? new BN(projectId)
      : projectId;
    const [projectPDA] = deriveProjectPDA(projectIdBN, programId);
    const accountInfo = await connection.getAccountInfo(projectPDA);
    return accountInfo !== null;
  } catch {
    return false;
  }
}


