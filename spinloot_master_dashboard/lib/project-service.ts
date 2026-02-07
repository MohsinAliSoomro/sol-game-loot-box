/**
 * Project Management Service
 * Handles creating and managing Project accounts on Solana
 * 
 * NOTE: This is a copy from spinloot_latest_safe/lib/project-service.ts
 * You can maintain a single source by using a shared lib folder or monorepo setup
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

// Program ID - update this to match your program
const PROGRAM_ID_STRING = "BkwbgssSuWQS46MtNRcq5RCnUgYq1H1LJpKhCGUtdGaH";
export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);

// You'll need to import your IDL here
// For now, we'll use the instruction discriminator directly
const INITIALIZE_PROJECT_DISCRIMINATOR = Buffer.from([69, 126, 215, 37, 20, 60, 73, 235]);
const UPDATE_PROJECT_FEE_DISCRIMINATOR = Buffer.from([152, 182, 179, 116, 137, 145, 129, 10]); // sha256("global:update_project_fee")[0..8]

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
 * Works with Solana wallet adapter's sendTransaction method
 */
export async function createProject(
  connection: Connection,
  wallet: {
    publicKey: PublicKey;
    sendTransaction: (tx: Transaction, connection: Connection, options?: any) => Promise<string>;
  },
  projectId: BN | number | string,
  name: string,
  description: string,
  mint: PublicKey = new PublicKey('So11111111111111111111111111111111111111112'), // SOL
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

  // Build instruction data manually
  const instructionDiscriminator = INITIALIZE_PROJECT_DISCRIMINATOR;
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

  // Create transaction
  const transaction = new Transaction().add(instruction);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  // Send transaction using wallet adapter (it handles signing and sending)
  const signature = await wallet.sendTransaction(transaction, connection, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  // Wait for confirmation
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  }, 'confirmed');

  return {
    signature,
    projectPDA,
    projectId: finalProjectId,
  };
}

/**
 * Update Project Fee
 */
export async function updateProjectFee(
  connection: Connection,
  wallet: {
    publicKey: PublicKey;
    sendTransaction: (tx: Transaction, connection: Connection, options?: any) => Promise<string>;
  },
  projectId: BN | number | string,
  newFeeAmount: BN | number
): Promise<{ signature: string }> {

  const finalProjectId = typeof projectId === 'string' || typeof projectId === 'number'
    ? new BN(projectId)
    : projectId;

  const finalFeeAmount = typeof newFeeAmount === 'number'
    ? new BN(newFeeAmount)
    : newFeeAmount;

  // Derive Project PDA
  const [projectPDA] = deriveProjectPDA(finalProjectId, PROGRAM_ID);

  // Build instruction data manually
  const instructionDiscriminator = UPDATE_PROJECT_FEE_DISCRIMINATOR;

  const projectIdBuffer = Buffer.allocUnsafe(8);
  finalProjectId.toArrayLike(Buffer, 'le', 8).copy(projectIdBuffer);

  const feeAmountBuffer = Buffer.allocUnsafe(8);
  finalFeeAmount.toArrayLike(Buffer, 'le', 8).copy(feeAmountBuffer);

  const instructionData = Buffer.concat([
    instructionDiscriminator,
    projectIdBuffer,
    feeAmountBuffer
  ]);

  // Create instruction
  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // admin
      { pubkey: projectPDA, isSigner: false, isWritable: true }, // project
    ],
    data: instructionData,
  });

  // Create transaction
  const transaction = new Transaction().add(instruction);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  // Send transaction
  const signature = await wallet.sendTransaction(transaction, connection, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  // Wait for confirmation
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  }, 'confirmed');

  return { signature };
}

