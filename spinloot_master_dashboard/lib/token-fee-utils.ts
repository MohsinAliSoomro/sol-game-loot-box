import { 
  Connection, 
  PublicKey, 
  Transaction, 
  TransactionInstruction,
  SystemProgram 
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress 
} from '@solana/spl-token';

const PROGRAM_ID = new PublicKey('BkwbgssSuWQS46MtNRcq5RCnUgYq1H1LJpKhCGUtdGaH');

/**
 * Find PDA using seeds
 */
function findPDA(seeds: Buffer[], programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(seeds, programId);
}

/**
 * Initialize fee config for a token (non-SOL)
 */
export async function initTokenFeeConfig(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  feeAmount: bigint,
  decimals: number
): Promise<Transaction> {
  // Find PDAs
  const [feeConfigPda] = findPDA(
    [Buffer.from('fee_config'), mint.toBuffer()],
    PROGRAM_ID
  );

  const [feeVaultAuthority] = findPDA(
    [Buffer.from('fee_vault'), mint.toBuffer()],
    PROGRAM_ID
  );

  const feeVaultATA = await getAssociatedTokenAddress(
    mint,
    feeVaultAuthority,
    true,
    TOKEN_PROGRAM_ID
  );

  // The instruction discriminator for init_fee_config from IDL
  const discriminator = Buffer.from([212, 138, 200, 114, 73, 176, 7, 197]);
  
  // Encode fee_amount as u64 (little-endian)
  const feeAmountBuffer = Buffer.allocUnsafe(8);
  feeAmountBuffer.writeBigUInt64LE(feeAmount, 0);

  // Build instruction data
  const instructionData = Buffer.concat([discriminator, feeAmountBuffer]);

  // Build instruction
  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      {
        pubkey: owner,
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: mint,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: feeConfigPda,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: feeVaultAuthority,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: feeVaultATA,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
    ],
    data: instructionData,
  });

  const transaction = new Transaction();
  transaction.add(instruction);

  const { blockhash } = await connection.getLatestBlockhash('finalized');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = owner;

  return transaction;
}

/**
 * Check if fee config exists for a token
 */
export async function checkTokenFeeConfigExists(
  connection: Connection,
  mint: PublicKey
): Promise<boolean> {
  try {
    const [feeConfigPda] = findPDA(
      [Buffer.from('fee_config'), mint.toBuffer()],
      PROGRAM_ID
    );
    const accountInfo = await connection.getAccountInfo(feeConfigPda);
    return accountInfo !== null;
  } catch {
    return false;
  }
}

/**
 * Get current fee amount from fee config for a token
 */
export async function getTokenFeeConfig(
  connection: Connection,
  mint: PublicKey,
  decimals: number
): Promise<number | null> {
  try {
    const [feeConfigPda] = findPDA(
      [Buffer.from('fee_config'), mint.toBuffer()],
      PROGRAM_ID
    );

    const accountInfo = await connection.getAccountInfo(feeConfigPda);
    if (!accountInfo) {
      return null;
    }

    // FeeConfig struct: discriminator (8) + mint (32) + owner (32) + fee_amount (8)
    const feeAmountBytes = accountInfo.data.slice(72, 80);
    const feeAmount = Number(feeAmountBytes.readBigUInt64LE(0));

    return feeAmount / Math.pow(10, decimals);
  } catch {
    return null;
  }
}

