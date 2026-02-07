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
import * as anchor from '@coral-xyz/anchor';

/**
 * Calculate Anchor instruction discriminator
 */
async function getInstructionDiscriminator(instructionName: string): Promise<Buffer> {
  const namespace = "global";
  const preimage = `${namespace}:${instructionName}`;
  
  // Use Web Crypto API for browser compatibility
  const encoder = new TextEncoder();
  const data = encoder.encode(preimage);
  // Create a new ArrayBuffer to ensure type compatibility
  const dataBuffer = new Uint8Array(data).buffer;
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return Buffer.from(hashArray.slice(0, 8));
}

/**
 * Encode u64 to little-endian bytes
 */
function encodeU64(value: bigint): Buffer {
  const buffer = Buffer.allocUnsafe(8);
  let val = value;
  for (let i = 0; i < 8; i++) {
    buffer[i] = Number(val & BigInt(0xff));
    val = val >> BigInt(8);
  }
  return buffer;
}

/**
 * Find PDA using seeds
 */
function findPDA(seeds: Buffer[], programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(seeds, programId);
}

/**
 * Initialize SOL fee config
 * NOTE: Requires PROGRAM_DEPLOYER (program_authority_signer) to sign
 */
export async function initSolFeeConfig(
  connection: Connection,
  owner: PublicKey,
  solMint: PublicKey,
  feeAmount: bigint,
  programId: PublicKey
): Promise<Transaction> {
  // Find PDAs
  const [solFeeConfigPda, bump] = findPDA(
    [Buffer.from('sol_fee_config')],
    programId
  );
  
  const [programAuthorityPda] = findPDA(
    [Buffer.from('program_authority')],
    programId
  );

  // PROGRAM_DEPLOYER must sign - this is Hmj9dY7nJJ6hNBrd1dnkwEPzoESdpjuKfEvhDKyqHvrK on mainnet
  // The program_authority_signer must be the PROGRAM_DEPLOYER
  // For now, we'll use owner as the signer, but it must match PROGRAM_DEPLOYER
  const programAuthoritySigner = owner;

  // Get instruction discriminator
  const discriminator = await getInstructionDiscriminator('init_sol_fee_config');

  // Encode argument
  const encodedArg = encodeU64(feeAmount);

  // Build instruction data
  const instructionData = Buffer.concat([Buffer.from(discriminator), encodedArg]);

  // Build instruction
  const instruction = new TransactionInstruction({
    programId: programId,
    keys: [
      {
        pubkey: owner,
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: solMint,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: programAuthorityPda,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: programAuthoritySigner,
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: solFeeConfigPda,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: SystemProgram.programId,
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
 * Set SOL fee amount
 */
export async function setSolFeeAmount(
  connection: Connection,
  owner: PublicKey,
  solMint: PublicKey,
  feeAmount: bigint,
  programId: PublicKey
): Promise<Transaction> {
  // Find sol_fee_config PDA
  const [solFeeConfigPda] = findPDA(
    [Buffer.from('sol_fee_config')],
    programId
  );

  // Get instruction discriminator
  const discriminator = await getInstructionDiscriminator('set_sol_fee_amount');

  // Encode argument
  const encodedArg = encodeU64(feeAmount);

  // Build instruction data
  const instructionData = Buffer.concat([Buffer.from(discriminator), encodedArg]);

  // Build instruction
  const instruction = new TransactionInstruction({
    programId: programId,
    keys: [
      {
        pubkey: owner,
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: solMint,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: solFeeConfigPda,
        isSigner: false,
        isWritable: true,
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
 * Collect fees from fee vault
 */
export async function collectFees(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  programId: PublicKey
): Promise<Transaction> {
  // Find PDAs
  const [feeVaultAuthority] = findPDA(
    [Buffer.from('fee_vault'), mint.toBuffer()],
    programId
  );

  const feeVaultATA = await getAssociatedTokenAddress(
    mint,
    feeVaultAuthority,
    true,
    TOKEN_PROGRAM_ID
  );

  // For SOL, use sol_fee_config; for other tokens, use fee_config
  const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
  const feeConfigPda = mint.equals(SOL_MINT)
    ? findPDA([Buffer.from('sol_fee_config')], programId)[0]
    : findPDA([Buffer.from('fee_config'), mint.toBuffer()], programId)[0];

  // Get instruction discriminator
  const discriminator = await getInstructionDiscriminator('collect_fees');

  // Build instruction data (no args for collect_fees)
  const instructionData = Buffer.from(discriminator);

  // Build instruction
  const instruction = new TransactionInstruction({
    programId: programId,
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
        pubkey: destination,
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
        pubkey: feeConfigPda,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
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
 * Check if SOL fee config exists
 */
export async function checkSolFeeConfigExists(
  connection: Connection,
  programId: PublicKey
): Promise<boolean> {
  try {
    const [solFeeConfigPda] = findPDA(
      [Buffer.from('sol_fee_config')],
      programId
    );
    const accountInfo = await connection.getAccountInfo(solFeeConfigPda);
    return accountInfo !== null;
  } catch {
    return false;
  }
}

/**
 * Get current SOL fee amount from fee config
 */
export async function getFeeConfig(
  connection: Connection,
  mint: PublicKey,
  programId: PublicKey
): Promise<number> {
  // For SOL, use sol_fee_config PDA
  const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
  
  if (mint.equals(SOL_MINT)) {
    const [solFeeConfigPda] = findPDA(
      [Buffer.from('sol_fee_config')],
      programId
    );

    const accountInfo = await connection.getAccountInfo(solFeeConfigPda);
    if (!accountInfo) {
      console.log('SolFeeConfig account does not exist at:', solFeeConfigPda.toBase58());
      return 0; // Return 0 if not initialized
    }

    console.log('SolFeeConfig account found. Data length:', accountInfo.data.length);
    console.log('SolFeeConfig account data (hex):', accountInfo.data.toString('hex'));

    // SolFeeConfig struct: discriminator (8) + mint (32) + owner (32) + fee_amount (8)
    // Total: 8 + 32 + 32 + 8 = 80 bytes
    if (accountInfo.data.length < 80) {
      console.error('SolFeeConfig account data too short:', accountInfo.data.length);
      return 0;
    }

    const feeAmountBytes = accountInfo.data.slice(72, 80);
    const feeAmount = Number(feeAmountBytes.readBigUInt64LE(0));
    console.log('Fee amount extracted (lamports):', feeAmount);

    return feeAmount;
  } else {
    // For other tokens
    const [feeConfigPda] = findPDA(
      [Buffer.from('fee_config'), mint.toBuffer()],
      programId
    );

    const accountInfo = await connection.getAccountInfo(feeConfigPda);
    if (!accountInfo) {
      return 0;
    }

    // FeeConfig struct: mint (32) + owner (32) + fee_amount (8)
    const feeAmountBytes = accountInfo.data.slice(64, 72);
    const feeAmount = Number(feeAmountBytes.readBigUInt64LE(0));

    return feeAmount;
  }
}

/**
 * Get fee vault balance
 */
export async function getFeeVaultBalance(
  connection: Connection,
  mint: PublicKey,
  programId: PublicKey
): Promise<number> {
  // For SOL, use native account balance (fee_wallet PDA)
  const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
  
  if (mint.equals(SOL_MINT)) {
    // SOL fees are stored in a native SOL account (SystemAccount)
    const [feeWalletPda] = findPDA(
      [Buffer.from('fee_wallet')],
      programId
    );

    try {
      const balance = await connection.getBalance(feeWalletPda);
      return balance;
    } catch {
      return 0;
    }
  } else {
    // For other tokens, use token account balance
    const [feeVaultAuthority] = findPDA(
      [Buffer.from('fee_vault'), mint.toBuffer()],
      programId
    );

    const feeVaultATA = await getAssociatedTokenAddress(
      mint,
      feeVaultAuthority,
      true,
      TOKEN_PROGRAM_ID
    );

    try {
      const tokenAccount = await connection.getTokenAccountBalance(feeVaultATA);
      return tokenAccount.value.amount ? parseInt(tokenAccount.value.amount) : 0;
    } catch {
      return 0;
    }
  }
}

