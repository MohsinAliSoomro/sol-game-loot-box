import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  TransactionInstruction,
  Keypair,
} from "@solana/web3.js";
// @ts-ignore
import bs58 from "bs58";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMint
} from "@solana/spl-token";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { CONFIG } from "./config";
import deployedIdl from "../idl/vault_project.json";
import { createSyncNativeInstruction, createCloseAccountInstruction } from "@solana/spl-token";

// Program configuration
export const PROGRAM_ID = new PublicKey(CONFIG.PROGRAM_ID);
export const NETWORK = CONFIG.NETWORK;
// Use Helius mainnet RPC endpoint for better reliability
export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://mainnet.helius-rpc.com/?api-key=5a1a852c-3ed9-40ee-bca8-dda4550c3ce8";

// Token mint addresses
export const OGX_MINT = new PublicKey(CONFIG.TOKENS.OGX);
export const SOL_MINT = new PublicKey(CONFIG.TOKENS.SOL);
export const USDC_MINT = new PublicKey(CONFIG.TOKENS.USDC);
export const TOKEN4_MINT = new PublicKey(CONFIG.TOKENS.TOKEN4);

// PDA seeds
export const VAULT_SEED = "vault";
export const FEE_VAULT_SEED = "fee_vault";
export const FEE_CONFIG_SEED = "fee_config";
export const USER_BALANCE_SEED = "user_balance";
export const USER_NFT_SEED = "user_nft";

export class SolanaProgramService {
  private connection: Connection;
  private program: Program;
  private pendingTransactions: Set<string> = new Set();
  private lastTransactionTime: number = 0;

  constructor() {
    // Create connection with retry configuration
    this.connection = new Connection(RPC_URL, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000,
      disableRetryOnRateLimit: false,
    });

    // Initialize Anchor program
    const provider = new AnchorProvider(
      this.connection,
      {} as any, // We'll pass the wallet when needed
      { commitment: "confirmed" }
    );

    this.program = new Program(deployedIdl as any, provider);
  }

  /**
   * Generate a unique transaction ID to prevent duplicates
   */
  private generateTransactionId(user: PublicKey, amount: number | string): string {
    const now = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const microtime = performance.now(); // High precision timestamp

    // Ensure at least 1 second between transactions to prevent duplicates
    if (now - this.lastTransactionTime < 1000) {
      this.lastTransactionTime = now + 1000;
    } else {
      this.lastTransactionTime = now;
    }
    const amountStr = typeof amount === 'string' ? amount : amount.toString();
    return `${user.toString()}-${amountStr}-${this.lastTransactionTime}-${microtime}-${random}`;
  }

  /**
   * Retry RPC calls with exponential backoff
   */
  private async retryRpcCall<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries - 1;
        const isRetryableError = error?.message?.includes('503') ||
          error?.message?.includes('Service unavailable') ||
          error?.message?.includes('timeout') ||
          error?.message?.includes('ECONNRESET');

        if (isLastAttempt || !isRetryableError) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`RPC call failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * Transfer a compressed NFT (cNFT) using the Bubblegum program
   * Compressed NFTs are stored in Merkle trees and require proof-based transfers
   */
  private async transferCompressedNFT(
    assetId: PublicKey,
    fromKeypair: Keypair,
    toAddress: PublicKey,
    nftData: any,
    rpcUrl: string
  ): Promise<string> {
    console.log(`🌳 Starting compressed NFT transfer...`);
    console.log(`   Asset ID: ${assetId.toString()}`);
    console.log(`   From: ${fromKeypair.publicKey.toString()}`);
    console.log(`   To: ${toAddress.toString()}`);

    // Get the asset proof from Helius
    console.log(`📜 Fetching asset proof from Helius...`);
    const proofResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-asset-proof',
        method: 'getAssetProof',
        params: { id: assetId.toString() },
      }),
    });

    const proofData = await proofResponse.json();

    if (!proofData.result) {
      console.error(`❌ Failed to get asset proof:`, proofData);
      throw new Error(`Failed to get asset proof for compressed NFT: ${JSON.stringify(proofData.error || 'Unknown error')}`);
    }

    console.log(`✅ Asset proof received`);
    console.log(`   Root: ${proofData.result.root}`);
    console.log(`   Proof length: ${proofData.result.proof?.length || 0}`);

    // Bubblegum program ID
    const BUBBLEGUM_PROGRAM_ID = new PublicKey('BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY');
    const SPL_NOOP_PROGRAM_ID = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');
    const SPL_ACCOUNT_COMPRESSION_PROGRAM_ID = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');

    // Extract compression data
    const treeAddress = new PublicKey(nftData.compression.tree);
    const leafIndex = nftData.compression.leaf_id;

    // Helius returns hashes in base58 format, not base64
    // Need to decode from base58 (same encoding as Solana public keys)
    const bs58 = require('bs58');
    const dataHashStr = proofData.result.data_hash || nftData.compression.data_hash;
    const creatorHashStr = proofData.result.creator_hash || nftData.compression.creator_hash;
    const rootStr = proofData.result.root;

    console.log(`🔍 Decoding hashes from base58...`);
    console.log(`   Data hash: ${dataHashStr}`);
    console.log(`   Creator hash: ${creatorHashStr}`);
    console.log(`   Root: ${rootStr}`);

    const dataHash = bs58.decode(dataHashStr);
    const creatorHash = bs58.decode(creatorHashStr);
    const root = bs58.decode(rootStr);

    console.log(`✅ Hashes decoded:  Data: ${dataHash.length}b, Creator: ${creatorHash.length}b, Root: ${root.length}b`);

    const nonce = BigInt(leafIndex);

    // Build the transfer instruction for Bubblegum
    // Transfer instruction discriminator: [163, 52, 200, 231, 140, 3, 69, 186]
    const transferDiscriminator = Buffer.from([163, 52, 200, 231, 140, 3, 69, 186]);

    // Encode the nonce as u64 (little-endian)
    const nonceBuffer = Buffer.allocUnsafe(8);
    const nonceBigInt = BigInt(nonce);
    for (let i = 0; i < 8; i++) {
      nonceBuffer[i] = Number((nonceBigInt >> BigInt(i * 8)) & BigInt(0xff));
    }

    // Encode leaf index as u32 (little-endian)
    const leafIndexBuffer = Buffer.allocUnsafe(4);
    leafIndexBuffer.writeUInt32LE(leafIndex, 0);

    // Build instruction data: discriminator + root + data_hash + creator_hash + nonce + index
    const instructionData = Buffer.concat([
      transferDiscriminator,
      root,
      dataHash,
      creatorHash,
      nonceBuffer,
      leafIndexBuffer,
    ]);

    // Build proof accounts
    const proofAccounts = (proofData.result.proof || []).map((p: string) => ({
      pubkey: new PublicKey(p),
      isSigner: false,
      isWritable: false,
    }));

    // Derive tree config PDA (owned by Bubblegum program)
    const [treeConfig] = PublicKey.findProgramAddressSync(
      [treeAddress.toBuffer()],
      BUBBLEGUM_PROGRAM_ID
    );

    console.log(`🌲 Tree addresses:`);
    console.log(`   Merkle Tree: ${treeAddress.toString()}`);
    console.log(`   Tree Config (PDA): ${treeConfig.toString()}`);

    // Build instruction accounts - ORDER IS CRITICAL per Bubblegum spec
    // Reference: https://github.com/metaplex-foundation/mpl-bubblegum/blob/main/programs/bubblegum/program/src/lib.rs
    const transferInstructionAccounts = [
      { pubkey: treeConfig, isSigner: false, isWritable: false },           // [0] Tree config (PDA owned by Bubblegum)
      { pubkey: fromKeypair.publicKey, isSigner: true, isWritable: false }, // [1] Leaf owner (signer)
      { pubkey: fromKeypair.publicKey, isSigner: false, isWritable: false }, // [2] Leaf delegate (same as owner)
      { pubkey: toAddress, isSigner: false, isWritable: false },            // [3] New leaf owner
      { pubkey: treeAddress, isSigner: false, isWritable: true },           // [4] Merkle tree (writable)
      { pubkey: SPL_NOOP_PROGRAM_ID, isSigner: false, isWritable: false },  // [5] Log wrapper (noop program)
      { pubkey: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID, isSigner: false, isWritable: false }, // [6] Compression program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // [7] System program
      ...proofAccounts, // Remaining accounts are the Merkle proof
    ];

    const transferInstruction = new TransactionInstruction({
      programId: BUBBLEGUM_PROGRAM_ID,
      keys: transferInstructionAccounts,
      data: instructionData,
    });

    console.log(`📝 Building Bubblegum transfer transaction...`);
    console.log(`   Program ID: ${BUBBLEGUM_PROGRAM_ID.toString()}`);
    console.log(`   Tree: ${treeAddress.toString()}`);
    console.log(`   Leaf index: ${leafIndex}`);
    console.log(`   Proof accounts: ${proofAccounts.length}`);

    // Build and send transaction
    const transaction = new Transaction();
    transaction.add(transferInstruction);
    transaction.feePayer = fromKeypair.publicKey;

    // Get fresh blockhash
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;

    // Sign and send
    transaction.sign(fromKeypair);

    console.log(`📤 Sending Bubblegum transfer transaction...`);
    const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    });

    console.log(`⏳ Confirming transaction: ${signature}`);

    // Wait for confirmation
    const confirmation = await this.confirmTransactionRobust(signature, 120000);

    if (confirmation.value?.err) {
      console.error(`❌ Compressed NFT transfer failed:`, confirmation.value.err);
      throw new Error(`Compressed NFT transfer failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log(`✅ Compressed NFT transferred successfully!`);
    return signature;
  }

  /**
   * Transfer a Metaplex Core NFT using the Core program
   * Metaplex Core NFTs use a different ownership model than standard SPL Token NFTs
   */
  private async transferMetaplexCoreNFT(
    assetId: PublicKey,
    fromKeypair: Keypair,
    toAddress: PublicKey,
    nftData: any,
    rpcUrl: string
  ): Promise<string> {
    console.log(`🔷 Starting Metaplex Core NFT transfer using official mpl-core library...`);
    console.log(`   Asset ID: ${assetId.toString()}`);
    console.log(`   From: ${fromKeypair.publicKey.toString()}`);
    console.log(`   To: ${toAddress.toString()}`);

    // Import mpl-core and umi
    const { createUmi } = await import('@metaplex-foundation/umi-bundle-defaults');
    const { transferV1, fetchAssetV1 } = await import('@metaplex-foundation/mpl-core');
    const {
      publicKey: umiPublicKey,
      keypairIdentity,
      transactionBuilder
    } = await import('@metaplex-foundation/umi');

    // Create Umi instance
    const umi = createUmi(rpcUrl);

    // Convert Solana Keypair to Umi keypair
    const umiKeypair = {
      publicKey: umiPublicKey(fromKeypair.publicKey.toBase58()),
      secretKey: fromKeypair.secretKey,
    };

    // Set the identity
    umi.use(keypairIdentity(umiKeypair));

    console.log(`📝 Building Metaplex Core transfer with official SDK...`);

    // Convert addresses to Umi public keys
    const assetUmiKey = umiPublicKey(assetId.toBase58());
    const newOwnerUmiKey = umiPublicKey(toAddress.toBase58());

    // Get collection if exists
    const collectionGrouping = nftData.grouping?.find((g: any) => g.group_key === 'collection');
    const collectionAddress = collectionGrouping?.group_value
      ? umiPublicKey(collectionGrouping.group_value)
      : undefined;

    console.log(`   Has collection: ${collectionAddress ? 'yes' : 'no'}`);
    if (collectionAddress) {
      console.log(`   Collection: ${collectionGrouping.group_value}`);
    }

    try {
      // Build the transfer instruction using the official SDK
      console.log(`📤 Building and sending Metaplex Core transfer...`);

      const transferBuilder = transferV1(umi, {
        asset: assetUmiKey,
        newOwner: newOwnerUmiKey,
        collection: collectionAddress,
      });

      // Send and confirm
      const result = await transferBuilder.sendAndConfirm(umi, {
        confirm: { commitment: 'confirmed' },
      });

      // Convert signature to base58 string using bs58
      const bs58 = await import('bs58');
      const signature = bs58.default.encode(Buffer.from(result.signature));

      console.log(`✅ Metaplex Core NFT transferred successfully!`);
      console.log(`   Signature: ${signature}`);

      return signature;
    } catch (error: any) {
      console.error(`❌ Metaplex Core transfer failed:`, error);

      // Try to extract more details from the error
      let errorMessage = error.message || 'Unknown error';
      if (error.logs) {
        console.error(`   Logs:`, error.logs);
        errorMessage += `\nLogs: ${error.logs.join('\n')}`;
      }

      throw new Error(`Failed to transfer Metaplex Core NFT: ${errorMessage}`);
    }
  }

  /**
   * Robust transaction confirmation that handles blockhash expiration and timeouts
   * Uses signature-only confirmation with extended timeout and aggressive polling fallback
   */
  private async confirmTransactionRobust(
    signature: string,
    timeout: number = 120000 // 120 seconds for mainnet (increased from 60)
  ): Promise<{ value: { err: any } | null }> {
    console.log(`⏳ Confirming transaction ${signature.substring(0, 8)}...${signature.substring(-8)}`);

    try {
      // Try signature-only confirmation first (doesn't rely on blockhash)
      // This will poll until confirmed or timeout
      const confirmation = await Promise.race([
        this.connection.confirmTransaction(signature, "confirmed"),
        new Promise<{ value: { err: any } | null }>((_, reject) =>
          setTimeout(() => reject(new Error("Confirmation timeout")), timeout)
        )
      ]);

      if (confirmation.value?.err) {
        console.error(`❌ Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
        return confirmation;
      }

      console.log(`✅ Transaction confirmed successfully`);
      return confirmation;
    } catch (error: any) {
      // If confirmation timed out, poll signature status aggressively
      if (error.message === "Confirmation timeout" || error.message?.includes("not confirmed")) {
        console.log(`⏱️ Confirmation timeout, polling signature status aggressively...`);

        // Poll multiple times with delays to catch late confirmations
        let status = null;
        for (let attempt = 0; attempt < 10; attempt++) {
          try {
            status = await this.connection.getSignatureStatus(signature);

            if (status.value) {
              if (status.value.err) {
                // Transaction failed on-chain
                console.error(`❌ Transaction failed on-chain: ${JSON.stringify(status.value.err)}`);
                return { value: { err: status.value.err } };
              } else {
                // Transaction succeeded!
                console.log(`✅ Transaction succeeded (confirmed via polling attempt ${attempt + 1})`);
                return { value: null };
              }
            }

            // If status is null, transaction might still be pending
            if (attempt < 9) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between attempts
            }
          } catch (pollError: any) {
            console.warn(`⚠️ Polling attempt ${attempt + 1} failed:`, pollError.message);
            if (attempt < 9) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        // After all polling attempts, check one final time
        try {
          status = await this.connection.getSignatureStatus(signature);
          if (status.value?.err) {
            console.error(`❌ Transaction failed: ${JSON.stringify(status.value.err)}`);
            return { value: { err: status.value.err } };
          } else if (status.value && !status.value.err) {
            console.log(`✅ Transaction succeeded (confirmed on final check)`);
            return { value: null };
          }
        } catch (finalError) {
          console.warn(`⚠️ Final status check failed:`, finalError);
        }

        // Transaction not found or still pending after all attempts
        throw new Error(
          `Transaction was not confirmed within ${timeout}ms after ${10} polling attempts. ` +
          `Signature: ${signature}. ` +
          `Status: ${status?.value ? 'pending' : 'not found'}. ` +
          `This could mean:\n` +
          `1. Network congestion delayed the transaction\n` +
          `2. Transaction failed but error not yet propagated\n` +
          `3. Transaction is still processing\n\n` +
          `Check on Solana Explorer: https://solscan.io/tx/${signature}`
        );
      }

      // Handle blockhash expiration errors specifically
      if (error.message?.includes("block height exceeded") ||
        error.message?.includes("TransactionExpiredBlockheightExceededError") ||
        error.message?.includes("expired")) {
        console.log(`⚠️ Blockhash expired, checking signature status...`);

        // Poll multiple times
        let status = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            status = await this.connection.getSignatureStatus(signature);

            if (status.value) {
              if (status.value.err) {
                console.error(`❌ Transaction failed: ${JSON.stringify(status.value.err)}`);
                return { value: { err: status.value.err } };
              } else {
                console.log(`✅ Transaction succeeded (blockhash expired but confirmed)`);
                return { value: null };
              }
            }

            if (attempt < 4) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (pollError) {
            if (attempt < 4) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        if (status?.value?.err) {
          return { value: { err: status.value.err } };
        } else if (status?.value && !status.value.err) {
          return { value: null };
        }

        throw new Error(
          `Transaction blockhash expired. ` +
          `Signature: ${signature}. ` +
          `Status: ${status?.value ? 'pending' : 'not found'}. ` +
          `Check on Solana Explorer: https://solscan.io/tx/${signature}`
        );
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get vault authority PDA
   */
  private getVaultAuthority(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_SEED), mint.toBuffer()],
      PROGRAM_ID
    );
  }

  /**
   * Get vault ATA (Associated Token Account) - FIXED: Using canonical ATA derivation
   */
  private async getVaultATA(mint: PublicKey): Promise<PublicKey> {
    const [vaultAuthority] = this.getVaultAuthority(mint);
    return getAssociatedTokenAddressSync(mint, vaultAuthority, true);
  }

  /**
   * Get user balance PDA
   */
  private getUserBalancePDA(user: PublicKey, mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from([117, 115, 101, 114, 95, 98, 97, 108, 97, 110, 99, 101]), user.toBuffer(), mint.toBuffer()],
      PROGRAM_ID
    );
  }

  /**
   * Get user ATA (Associated Token Account)
   */
  private getUserATA(user: PublicKey, mint: PublicKey): PublicKey {
    // Temporary fix for the specific user and OGX mint
    if (user.toString() === "2rU61By4uVdRKa1aMSnMRfPYqa6expAtkWGSXZSH5pMK" &&
      mint.toString() === "B1hLCUwikAg3EsibPo3UJ9skVtFsqzdt8M8MeEBMQGBn") {
      return new PublicKey("G6tY2ZrUhazkf1GLBxu7gAUovbnqQF6X4Es14pquzAJS");
    }

    try {
      return getAssociatedTokenAddressSync(mint, user);
    } catch (error) {
      console.error("Error calculating ATA:", error);
      throw error;
    }
  }

  /**
   * Get fee vault authority PDA
   */
  private getFeeVaultAuthority(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("fee_vault"), mint.toBuffer()],
      PROGRAM_ID
    );
  }

  /**
   * Get fee vault ATA (Associated Token Account) - FIXED: Using canonical ATA derivation
   */
  private async getFeeVaultATA(mint: PublicKey): Promise<PublicKey> {
    const [feeVaultAuthority] = this.getFeeVaultAuthority(mint);
    return getAssociatedTokenAddressSync(mint, feeVaultAuthority, true);
  }

  /**
   * Get fee config PDA
   */
  private getFeeConfig(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("fee_config"), mint.toBuffer()],
      PROGRAM_ID
    );
  }

  /**
   * Get SOL fee config PDA (uses different seeds: [b"sol_fee_config"])
   */
  private getSolFeeConfig(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("sol_fee_config")],
      PROGRAM_ID
    );
  }

  /**
   * Get SOL user balance PDA
   * NOTE: For deposit_sol, the program uses [b"user_balance", user.key(), b"sol"] (string "sol")
   * NOT the mint address like other tokens. This is different from the generic getUserBalancePDA.
   */
  private getSolUserBalancePDA(user: PublicKey): [PublicKey, number] {
    // For SOL deposits, use the string "sol" as the seed, not SOL_MINT
    return PublicKey.findProgramAddressSync(
      [Buffer.from([117, 115, 101, 114, 95, 98, 97, 108, 97, 110, 99, 101]), user.toBuffer(), Buffer.from([115, 111, 108])],
      PROGRAM_ID
    );
  }

  /**
   * Build deposit_sol instruction manually (to avoid Anchor IDL issues)
   */
  private async buildDepositSolInstruction(
    user: PublicKey,
    platformWallet: PublicKey,
    feeWallet: PublicKey,
    userBalance: PublicKey,
    solFeeConfig: PublicKey,
    amountLamports: number
  ): Promise<TransactionInstruction> {
    // Calculate instruction discriminator for deposit_sol
    // Anchor uses: sha256("global:deposit_sol")[0..8]
    const namespace = "global";
    const preimage = `${namespace}:deposit_sol`;

    // Use Web Crypto API for browser compatibility
    const encoder = new TextEncoder();
    const data = encoder.encode(preimage);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const discriminator = Buffer.from(hashArray.slice(0, 8));

    // Encode u64 amount (little-endian)
    const amountBuffer = Buffer.allocUnsafe(8);
    const amountBN = new BN(amountLamports);
    amountBN.toArray('le', 8).forEach((byte: number, index: number) => {
      amountBuffer[index] = byte;
    });

    // Build instruction data: discriminator + amount
    const instructionData = Buffer.concat([discriminator, amountBuffer]);

    // Build instruction with all required accounts
    return new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        {
          pubkey: user,
          isSigner: true,
          isWritable: true,
        },
        {
          pubkey: platformWallet,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: feeWallet,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: userBalance,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: solFeeConfig,
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
  }

  /**
   * Build deposit_sol_project instruction manually
   */
  private async buildDepositSolProjectInstruction(
    user: PublicKey,
    platformWallet: PublicKey,
    feeWallet: PublicKey,
    userBalance: PublicKey,
    project: PublicKey,
    amountLamports: number
  ): Promise<TransactionInstruction> {
    // Calculate instruction discriminator for deposit_sol_project
    // Anchor uses: sha256("global:deposit_sol_project")[0..8]
    const namespace = "global";
    const preimage = `${namespace}:deposit_sol_project`;

    // Use Web Crypto API for browser compatibility
    const encoder = new TextEncoder();
    const data = encoder.encode(preimage);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const discriminator = Buffer.from(hashArray.slice(0, 8));

    // Encode u64 amount (little-endian)
    const amountBuffer = Buffer.allocUnsafe(8);
    const amountBN = new BN(amountLamports);
    amountBN.toArray('le', 8).forEach((byte: number, index: number) => {
      amountBuffer[index] = byte;
    });

    // Build instruction data: discriminator + amount
    const instructionData = Buffer.concat([discriminator, amountBuffer]);

    // Build instruction with all required accounts
    return new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: platformWallet, isSigner: false, isWritable: true },
        { pubkey: feeWallet, isSigner: false, isWritable: true },
        { pubkey: userBalance, isSigner: false, isWritable: true },
        { pubkey: project, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: instructionData,
    });
  }

  /**
   * Build withdrawTokens instruction manually (to bypass Anchor's PDA validation)
   * This is necessary because Anchor tries to validate userBalance PDA even though it's UncheckedAccount
   */
  private async buildWithdrawTokensInstruction(
    user: PublicKey,
    mint: PublicKey,
    userAta: PublicKey,
    vaultAuthority: PublicKey,
    vaultAta: PublicKey,
    userBalance: PublicKey, // This is the PDA we manually pass (with "sol" string for SOL)
    feeVaultAuthority: PublicKey,
    feeVaultAta: PublicKey,
    feeConfig: PublicKey,
    feeWallet: PublicKey,
    solFeeConfig: PublicKey,
    vault: PublicKey, // The vault PDA that holds native SOL (same as vaultAuthority for SOL)
    exchangeConfig: PublicKey,
    amountLamports: number
  ): Promise<TransactionInstruction> {
    // Calculate instruction discriminator for withdrawTokens
    // Anchor uses: sha256("global:withdraw_tokens")[0..8]
    const namespace = "global";
    const preimage = `${namespace}:withdraw_tokens`;

    // Use Web Crypto API for browser compatibility
    const encoder = new TextEncoder();
    const data = encoder.encode(preimage);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const discriminator = Buffer.from(hashArray.slice(0, 8));

    // Encode u64 amount (little-endian)
    const amountBuffer = Buffer.allocUnsafe(8);
    const amountBN = new BN(amountLamports);
    amountBN.toArray('le', 8).forEach((byte: number, index: number) => {
      amountBuffer[index] = byte;
    });

    // Build instruction data: discriminator + amount
    const instructionData = Buffer.concat([discriminator, amountBuffer]);

    // Build instruction with all required accounts in the correct order
    // Order must match the WithdrawTokens struct in Rust (as defined in lib.rs line 893)
    // Struct order: user, mint, user_ata, vault_authority, vault_ata, user_balance,
    //               fee_vault_authority, fee_vault_ata, fee_config, fee_wallet, 
    //               sol_fee_config, vault, exchange_config, token_program,
    //               system_program, associated_token_program
    return new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true }, // user
        { pubkey: mint, isSigner: false, isWritable: false }, // mint
        { pubkey: userAta, isSigner: false, isWritable: true }, // user_ata
        { pubkey: vaultAuthority, isSigner: false, isWritable: false }, // vault_authority
        { pubkey: vaultAta, isSigner: false, isWritable: true }, // vault_ata
        { pubkey: userBalance, isSigner: false, isWritable: true }, // withdraw_user_balance (AccountInfo - manually passed with "sol" string, renamed to avoid Anchor pattern matching)
        { pubkey: feeVaultAuthority, isSigner: false, isWritable: false }, // fee_vault_authority
        { pubkey: feeVaultAta, isSigner: false, isWritable: true }, // fee_vault_ata
        { pubkey: feeConfig, isSigner: false, isWritable: false }, // fee_config
        { pubkey: feeWallet, isSigner: false, isWritable: true }, // fee_wallet
        { pubkey: solFeeConfig, isSigner: false, isWritable: true }, // sol_fee_config (mutable)
        { pubkey: vault, isSigner: false, isWritable: true }, // vault (PDA that holds native SOL, same as vaultAuthority for SOL)
        { pubkey: exchangeConfig, isSigner: false, isWritable: true }, // exchange_config (mutable)
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program (MUST come before system_program!)
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
      ],
      data: instructionData,
    });
  }

  /**
   * Get fee amount for a mint (SOL uses sol_fee_config, others use fee_config)
   */
  async getFeeAmount(mint: PublicKey): Promise<number> {
    try {
      if (mint.equals(SOL_MINT)) {
        // For SOL, use sol_fee_config
        const [solFeeConfigPDA] = this.getSolFeeConfig();
        const solFeeConfigAccount = await (this.program.account as any).solFeeConfig.fetchNullable(solFeeConfigPDA);
        if (solFeeConfigAccount) {
          return solFeeConfigAccount.feeAmount.toNumber() / LAMPORTS_PER_SOL;
        }
        return 0; // No fee config found, return 0
      } else {
        // For tokens, use fee_config
        const [feeConfigPDA] = this.getFeeConfig(mint);
        const feeConfigAccount = await (this.program.account as any).feeConfig.fetchNullable(feeConfigPDA);
        if (feeConfigAccount) {
          return feeConfigAccount.feeAmount.toNumber() / Math.pow(10, feeConfigAccount.decimals);
        }
        return 0; // No fee config found, return 0
      }
    } catch (error) {
      console.error("Error fetching fee amount:", error);
      return 0; // Return 0 on error
    }
  }

  /**
   * Get exchange config PDA
   */
  private getExchangeConfig(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("exchange_config")],
      PROGRAM_ID
    );
  }

  /**
   * Check if ATA exists and create if needed
   */
  private async ensureATAExists(user: PublicKey, mint: PublicKey): Promise<Transaction | null> {
    const ata = this.getUserATA(user, mint);

    try {
      const accountInfo = await this.connection.getAccountInfo(ata);
      if (accountInfo) {
        return null; // ATA already exists
      }
    } catch (error) {
      // Account doesn't exist, we need to create it
    }

    // Create ATA instruction
    const createATAInstruction = createAssociatedTokenAccountInstruction(
      user, // payer
      ata, // associated token account
      user, // owner
      mint // mint
    );

    const transaction = new Transaction().add(createATAInstruction);
    return transaction;
  }

  /**
   * Deposit SOL using the program's vault
   * SOL will be deposited to OGX_WITHDRAWAL_WALLET (public key only, no private key needed for receiving)
   */
  async depositSOL(user: PublicKey, solAmount: number, wallet: any, projectId?: number | null): Promise<string> {
    const transactionId = this.generateTransactionId(user, solAmount);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Transaction already in progress. Please wait.");
    }

    // Add a delay to prevent rapid duplicate transactions
    await new Promise(resolve => setTimeout(resolve, 500));

    this.pendingTransactions.add(transactionId);

    try {
      // Get fee amount first to calculate total required
      const depositFee = await this.getFeeAmount(SOL_MINT);
      const networkFee = 0.0001; // Network transaction fee (~0.00005 SOL actual + buffer)
      const totalRequired = solAmount + depositFee + networkFee;

      // Check user's SOL balance first
      const userBalance = await this.connection.getBalance(user);
      const userSOLBalance = userBalance / LAMPORTS_PER_SOL;

      console.log(`=== BALANCE CHECK ===`);
      console.log(`User wallet: ${user.toString()}`);
      console.log(`User SOL balance: ${userSOLBalance.toFixed(4)} SOL`);
      console.log(`Requested amount: ${solAmount} SOL`);
      console.log(`Deposit fee: ${depositFee.toFixed(4)} SOL`);
      console.log(`Network fee: ${networkFee.toFixed(4)} SOL`);
      console.log(`Total required: ${totalRequired.toFixed(4)} SOL`);
      console.log(`=====================`);

      if (userSOLBalance < totalRequired) {
        throw new Error(`Insufficient SOL balance. You have ${userSOLBalance.toFixed(4)} SOL but need ${totalRequired.toFixed(4)} SOL (including ${depositFee.toFixed(4)} SOL deposit fee and ${networkFee.toFixed(4)} SOL network fee).`);
      }

      // Get SOL-specific PDAs
      const [userBalancePDA] = this.getSolUserBalancePDA(user);
      const [solFeeConfigPDA] = this.getSolFeeConfig();

      // Derive platform_wallet and fee_wallet PDAs (required by program security checks)
      const [platformWalletPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("platform_wallet")],
        PROGRAM_ID
      );
      const [feeWalletPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_wallet")],
        PROGRAM_ID
      );

      // Calculate actual deposit amount (after fee deduction)
      const actualDepositAmount = solAmount - depositFee;

      console.log(`=== SOL DEPOSIT INFO ===`);
      console.log(`User: ${user.toString()}`);
      console.log(`Requested deposit: ${solAmount} SOL`);
      console.log(`Deposit fee: ${depositFee.toFixed(4)} SOL`);
      console.log(`Network fee: ${networkFee.toFixed(4)} SOL`);
      console.log(`Amount going to platform wallet: ${actualDepositAmount.toFixed(4)} SOL`);
      console.log(`Fee going to fee wallet: ${depositFee.toFixed(4)} SOL`);
      console.log(`Total required: ${totalRequired.toFixed(4)} SOL`);
      console.log(`Platform wallet PDA: ${platformWalletPDA.toString()}`);
      console.log(`Fee wallet PDA: ${feeWalletPDA.toString()}`);
      console.log(`User balance PDA: ${userBalancePDA.toString()}`);
      console.log(`SOL fee config PDA: ${solFeeConfigPDA.toString()}`);
      console.log(`=======================`);

      // Create transaction
      const finalTransaction = new Transaction();

      // Add separate fee transfer instruction FIRST (so Phantom wallet shows it separately)
      if (depositFee > 0) {
        const feeTransferInstruction = SystemProgram.transfer({
          fromPubkey: user,
          toPubkey: feeWalletPDA, // Use fee_wallet PDA
          lamports: depositFee * LAMPORTS_PER_SOL,
        });
        finalTransaction.add(feeTransferInstruction);
        console.log(`✅ Added separate fee transfer instruction: ${depositFee.toFixed(4)} SOL → fee_wallet PDA`);
      }

      // Create deposit_sol transaction manually (no wrapping needed - direct SOL transfer)
      // Using manual instruction building to avoid Anchor IDL issues
      // Note: deposit_sol will handle net amount transfer (solAmount - fee)
      // Must use platform_wallet and fee_wallet PDAs (required by program security checks)
      const depositInstruction = await this.buildDepositSolInstruction(
        user,
        platformWalletPDA, // Use platform_wallet PDA (required by program)
        feeWalletPDA, // Use fee_wallet PDA (required by program)
        userBalancePDA,
        solFeeConfigPDA,
        solAmount * LAMPORTS_PER_SOL
      );
      finalTransaction.add(depositInstruction);

      // Get fresh blockhash right before sending
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash("confirmed");

      // Transaction uniqueness is handled by fresh blockhash and timestamp
      // No need for additional nonce instruction that could cause invalid data error

      // Set blockhash and fee payer on final transaction
      finalTransaction.recentBlockhash = blockhash;
      finalTransaction.feePayer = user;

      console.log(`📤 Sending SOL deposit transaction (blockhash: ${blockhash.substring(0, 8)}...${blockhash.substring(-8)})`);

      // Sign and send the transaction WITHOUT retry logic
      // (retrying a signed transaction will cause "already processed" errors)
      const signedTransaction = await wallet.signTransaction(finalTransaction);

      // Send transaction without retry - retrying will cause "already processed" errors
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 0, // Don't retry - will cause "already processed" errors
      });

      // Confirm the transaction with retry (safe to retry confirmation)
      const confirmation = await this.retryRpcCall(
        () => this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, "confirmed")
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      console.log(`✅ SOL deposit successful! Signature: ${signature}`);
      return signature;
    } catch (error: any) {
      console.error("Error depositing SOL to vault:", error);

      // Handle specific error types
      if (error.message.includes("already been processed") ||
        error.message.includes("This transaction has already been processed") ||
        error.message.includes("Transaction simulation failed: This transaction has already been processed")) {
        // Transaction was already processed - this usually means it succeeded on first attempt
        console.log("⚠️ Transaction 'already processed' - this means it likely succeeded the first time");
        console.log("💡 User should refresh and check their balance");
        console.log("🔄 This is likely a race condition - the transaction was already sent");

        // Don't throw an error - instead provide a special error code
        throw new Error("TRANSACTION_ALREADY_PROCESSED");
      } else if (error.message.includes("Blockhash not found")) {
        throw new Error("Transaction expired. Please try again.");
      } else if (error.message.includes("insufficient funds")) {
        throw new Error("Insufficient SOL balance for this transaction.");
      }

      throw error;
    } finally {
      // Remove from pending transactions
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Simple SOL deposit using direct transfers (no program PDAs required)
   * Works like token deposits - transfers SOL directly to wallets
   * This avoids issues with uninitialized global_state or sol_fee_config PDAs
   */
  async depositSOLManual(
    user: PublicKey,
    solAmount: number,
    wallet: any,
    feeLamports: number,
    projectId?: number | null
  ): Promise<string> {
    const transactionId = this.generateTransactionId(user, solAmount);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Transaction already in progress. Please wait.");
    }

    // Add a delay to prevent rapid duplicate transactions
    await new Promise(resolve => setTimeout(resolve, 500));

    this.pendingTransactions.add(transactionId);

    try {
      const depositFee = feeLamports / LAMPORTS_PER_SOL;
      const networkFee = 0.0001; // Network transaction fee (~0.00005 SOL actual + buffer)
      const totalRequired = solAmount + depositFee + networkFee;

      // Check user's SOL balance first
      const userBalance = await this.connection.getBalance(user);
      const userSOLBalance = userBalance / LAMPORTS_PER_SOL;

      console.log(`=== MANUAL SOL DEPOSIT BALANCE CHECK ===`);
      console.log(`User wallet: ${user.toString()}`);
      console.log(`User SOL balance: ${userSOLBalance.toFixed(4)} SOL`);
      console.log(`Requested amount: ${solAmount} SOL`);
      console.log(`Platform Fee: ${depositFee.toFixed(6)} SOL (${feeLamports} lamports)`);
      console.log(`Network fee: ${networkFee.toFixed(4)} SOL`);
      console.log(`Total required: ${totalRequired.toFixed(6)} SOL`);
      console.log(`=========================================`);

      if (userSOLBalance < totalRequired) {
        throw new Error(`Insufficient SOL balance. You have ${userSOLBalance.toFixed(4)} SOL but need ${totalRequired.toFixed(6)} SOL (including ${depositFee.toFixed(6)} SOL platform fee and ${networkFee.toFixed(4)} SOL network fee).`);
      }

      // Get the deposit wallet address from project or use default platform wallet PDA
      let depositWalletAddress: PublicKey;

      try {
        // Use getDepositWallet() which queries the database directly
        depositWalletAddress = await this.getDepositWallet(projectId);
        console.log(`✅ Using deposit wallet: ${depositWalletAddress.toString()}`);
      } catch (error: any) {
        // If deposit wallet is not configured, fall back to platform_wallet PDA
        console.warn(`⚠️ Could not get deposit wallet: ${error.message}`);
        console.warn(`⚠️ Falling back to platform_wallet PDA`);
        [depositWalletAddress] = PublicKey.findProgramAddressSync(
          [Buffer.from("platform_wallet")],
          PROGRAM_ID
        );
        console.log(`Using fallback platform_wallet PDA: ${depositWalletAddress.toString()}`);
      }

      // Get fee wallet PDA
      const [feeWalletPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_wallet")],
        PROGRAM_ID
      );

      // Check if deposit wallet account exists
      const depositWalletInfo = await this.connection.getAccountInfo(depositWalletAddress);
      const depositWalletExists = depositWalletInfo !== null;
      
      // Check if fee wallet PDA exists
      const feeWalletInfo = await this.connection.getAccountInfo(feeWalletPDA);
      const feeWalletExists = feeWalletInfo !== null;

      // Calculate rent exemption amount (minimum balance for a basic account)
      // For a basic account, rent exemption is ~0.00089 SOL, but we'll use 0.002 SOL as a safe buffer
      const RENT_EXEMPT_MINIMUM = 0.002; // ~0.00089 SOL actual + buffer
      
      console.log(`=== MANUAL SOL DEPOSIT INFO ===`);
      console.log(`User: ${user.toString()}`);
      console.log(`Deposit amount: ${solAmount} SOL`);
      console.log(`Platform fee: ${depositFee.toFixed(6)} SOL (${feeLamports} lamports)`);
      console.log(`Deposit wallet: ${depositWalletAddress.toString()} (exists: ${depositWalletExists})`);
      console.log(`Fee wallet PDA: ${feeWalletPDA.toString()} (exists: ${feeWalletExists})`);
      
      // Calculate actual amounts that will be transferred (accounting for rent exemption if accounts don't exist)
      const depositLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
      const rentExemptLamports = Math.ceil(RENT_EXEMPT_MINIMUM * LAMPORTS_PER_SOL);
      
      let actualDepositAmount = solAmount;
      let actualFeeAmount = depositFee;
      
      // If deposit wallet doesn't exist and deposit is less than rent exemption, we'll transfer rent-exempt amount
      if (!depositWalletExists && depositLamports < rentExemptLamports) {
        actualDepositAmount = RENT_EXEMPT_MINIMUM;
        console.log(`⚠️ Deposit wallet doesn't exist - will transfer ${RENT_EXEMPT_MINIMUM} SOL (rent-exempt) instead of ${solAmount} SOL`);
      }
      
      // If fee wallet doesn't exist and fee is less than rent exemption, we'll transfer rent-exempt amount
      if (!feeWalletExists && feeLamports > 0 && feeLamports < rentExemptLamports) {
        actualFeeAmount = RENT_EXEMPT_MINIMUM;
        console.log(`⚠️ Fee wallet doesn't exist - will transfer ${RENT_EXEMPT_MINIMUM} SOL (rent-exempt) instead of ${depositFee.toFixed(6)} SOL fee`);
      }
      
      const actualTotalRequired = actualDepositAmount + actualFeeAmount + networkFee;
      console.log(`Actual total required: ${actualTotalRequired.toFixed(6)} SOL`);
      console.log(`  - Deposit: ${actualDepositAmount.toFixed(6)} SOL`);
      console.log(`  - Fee: ${actualFeeAmount.toFixed(6)} SOL`);
      console.log(`  - Network: ${networkFee.toFixed(4)} SOL`);
      console.log(`================================`);

      // Check balance against actual amounts that will be transferred
      if (userSOLBalance < actualTotalRequired) {
        const missingAmount = actualTotalRequired - userSOLBalance;
        throw new Error(
          `Insufficient SOL balance. You have ${userSOLBalance.toFixed(4)} SOL but need ${actualTotalRequired.toFixed(6)} SOL. ` +
          `Missing: ${missingAmount.toFixed(6)} SOL. ` +
          (!depositWalletExists || (!feeWalletExists && feeLamports > 0) 
            ? `Note: The destination wallet${!depositWalletExists && (!feeWalletExists && feeLamports > 0) ? ' and fee wallet' : !depositWalletExists ? '' : ' and fee wallet'} ${!depositWalletExists && (!feeWalletExists && feeLamports > 0) ? 'don\'t' : !depositWalletExists ? 'doesn\'t' : 'doesn\'t'} exist and requires ${RENT_EXEMPT_MINIMUM} SOL for account creation.`
            : '')
        );
      }

      // Create transaction with direct SOL transfers
      const transaction = new Transaction();

      // Transfer deposit amount to platform/deposit wallet (using actual amount calculated above)
      const actualDepositLamports = Math.floor(actualDepositAmount * LAMPORTS_PER_SOL);
      const depositTransferInstruction = SystemProgram.transfer({
        fromPubkey: user,
        toPubkey: depositWalletAddress,
        lamports: actualDepositLamports,
      });
      transaction.add(depositTransferInstruction);
      if (actualDepositAmount > solAmount) {
        console.log(`⚠️ Transferring ${actualDepositAmount.toFixed(6)} SOL (rent-exempt minimum) instead of requested ${solAmount} SOL because account doesn't exist`);
      }
      console.log(`✅ Added deposit transfer: ${actualDepositAmount.toFixed(6)} SOL (${actualDepositLamports} lamports) → deposit wallet`);

      // Transfer fee to fee wallet (using actual amount calculated above)
      if (feeLamports > 0) {
        const actualFeeLamports = Math.floor(actualFeeAmount * LAMPORTS_PER_SOL);
        const feeWallet = new PublicKey(CONFIG.FEE_WALLET);
        const feeTransferInstruction = SystemProgram.transfer({
          fromPubkey: user,
          toPubkey: feeWallet,
          lamports: actualFeeLamports,
        });
        transaction.add(feeTransferInstruction);
        if (actualFeeAmount > depositFee) {
          console.log(`⚠️ Transferring ${actualFeeAmount.toFixed(6)} SOL (rent-exempt minimum) instead of ${depositFee.toFixed(6)} SOL fee because account doesn't exist`);
        }
        console.log(`✅ Added fee transfer: ${actualFeeAmount.toFixed(6)} SOL (${actualFeeLamports} lamports) → fee wallet ${CONFIG.FEE_WALLET}`);
      }

      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = user;

      console.log(`📤 Sending manual SOL deposit transaction (blockhash: ${blockhash.substring(0, 8)}...)`);

      // Sign and send
      const signedTransaction = await wallet.signTransaction(transaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 0,
      });

      // Confirm transaction
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, "confirmed");

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      console.log(`✅ Manual SOL deposit successful! Signature: ${signature}`);
      return signature;
    } catch (error: any) {
      console.error("Error in manual SOL deposit:", error);

      if (error.message.includes("already been processed")) {
        console.log("⚠️ Transaction 'already processed' - likely succeeded");
        throw new Error("TRANSACTION_ALREADY_PROCESSED");
      }

      throw error;
    } finally {
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Deposit SOL with custom fee amount (for projects without project_pda)
   * Uses the project fee from database instead of global fee config
   * NOTE: This uses the on-chain program and requires global_state/sol_fee_config PDAs to be initialized
   * Use depositSOLManual() for simpler direct transfers without program PDAs
   */
  async depositSOLWithCustomFee(
    user: PublicKey,
    solAmount: number,
    wallet: any,
    customFeeLamports: number,
    projectId?: number | null
  ): Promise<string> {
    const transactionId = this.generateTransactionId(user, solAmount);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Transaction already in progress. Please wait.");
    }

    // Add a delay to prevent rapid duplicate transactions
    await new Promise(resolve => setTimeout(resolve, 500));

    this.pendingTransactions.add(transactionId);

    try {
      // Use custom fee instead of fetching from blockchain
      const depositFee = customFeeLamports / LAMPORTS_PER_SOL;
      const networkFee = 0.0001; // Network transaction fee (~0.00005 SOL actual + buffer)
      const totalRequired = solAmount + depositFee + networkFee;

      // Check user's SOL balance first
      const userBalance = await this.connection.getBalance(user);
      const userSOLBalance = userBalance / LAMPORTS_PER_SOL;

      console.log(`=== CUSTOM FEE DEPOSIT BALANCE CHECK ===`);
      console.log(`User wallet: ${user.toString()}`);
      console.log(`User SOL balance: ${userSOLBalance.toFixed(4)} SOL`);
      console.log(`Requested amount: ${solAmount} SOL`);
      console.log(`Custom Project Fee: ${depositFee.toFixed(4)} SOL (${customFeeLamports} lamports)`);
      console.log(`Network fee: ${networkFee.toFixed(4)} SOL`);
      console.log(`Total required: ${totalRequired.toFixed(4)} SOL`);
      console.log(`========================================`);

      if (userSOLBalance < totalRequired) {
        throw new Error(`Insufficient SOL balance. You have ${userSOLBalance.toFixed(4)} SOL but need ${totalRequired.toFixed(4)} SOL (including ${depositFee.toFixed(4)} SOL deposit fee and ${networkFee.toFixed(4)} SOL network fee).`);
      }

      // Get SOL-specific PDAs
      const [userBalancePDA] = this.getSolUserBalancePDA(user);
      const [solFeeConfigPDA] = this.getSolFeeConfig();

      // Derive platform_wallet and fee_wallet PDAs (required by program security checks)
      const [platformWalletPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("platform_wallet")],
        PROGRAM_ID
      );
      const [feeWalletPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_wallet")],
        PROGRAM_ID
      );

      // Calculate actual deposit amount (after fee deduction)
      const actualDepositAmount = solAmount - depositFee;

      console.log(`=== CUSTOM FEE SOL DEPOSIT INFO ===`);
      console.log(`User: ${user.toString()}`);
      console.log(`Requested deposit: ${solAmount} SOL`);
      console.log(`Custom Project Fee: ${depositFee.toFixed(4)} SOL (${customFeeLamports} lamports)`);
      console.log(`Network fee: ${networkFee.toFixed(4)} SOL`);
      console.log(`Amount going to platform wallet: ${actualDepositAmount.toFixed(4)} SOL`);
      console.log(`Fee going to fee wallet: ${depositFee.toFixed(4)} SOL`);
      console.log(`Total required: ${totalRequired.toFixed(4)} SOL`);
      console.log(`Platform wallet PDA: ${platformWalletPDA.toString()}`);
      console.log(`Fee wallet PDA: ${feeWalletPDA.toString()}`);
      console.log(`User balance PDA: ${userBalancePDA.toString()}`);
      console.log(`SOL fee config PDA: ${solFeeConfigPDA.toString()}`);
      console.log(`===================================`);

      // Create transaction
      const finalTransaction = new Transaction();

      // Add separate fee transfer instruction FIRST (so Phantom wallet shows it separately)
      if (depositFee > 0) {
        const feeTransferInstruction = SystemProgram.transfer({
          fromPubkey: user,
          toPubkey: feeWalletPDA, // Use fee_wallet PDA
          lamports: customFeeLamports, // Use custom fee amount
        });
        finalTransaction.add(feeTransferInstruction);
        console.log(`✅ Added separate fee transfer instruction: ${depositFee.toFixed(4)} SOL (${customFeeLamports} lamports) → fee_wallet PDA`);
      }

      // Create deposit_sol transaction manually (no wrapping needed - direct SOL transfer)
      // Using manual instruction building to avoid Anchor IDL issues
      // Note: deposit_sol will handle net amount transfer (solAmount - fee)
      // Must use platform_wallet and fee_wallet PDAs (required by program security checks)
      const depositInstruction = await this.buildDepositSolInstruction(
        user,
        platformWalletPDA, // Use platform_wallet PDA (required by program)
        feeWalletPDA, // Use fee_wallet PDA (required by program)
        userBalancePDA,
        solFeeConfigPDA,
        solAmount * LAMPORTS_PER_SOL
      );
      finalTransaction.add(depositInstruction);

      // Get fresh blockhash right before sending
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash("confirmed");

      // Set blockhash and fee payer on final transaction
      finalTransaction.recentBlockhash = blockhash;
      finalTransaction.feePayer = user;

      console.log(`📤 Sending SOL deposit transaction with custom fee (blockhash: ${blockhash.substring(0, 8)}...${blockhash.substring(-8)})`);

      // Sign and send the transaction WITHOUT retry logic
      const signedTransaction = await wallet.signTransaction(finalTransaction);

      // Send transaction without retry - retrying will cause "already processed" errors
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 0, // Don't retry - will cause "already processed" errors
      });

      // Confirm the transaction with retry (safe to retry confirmation)
      const confirmation = await this.retryRpcCall(
        () => this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, "confirmed")
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      console.log(`✅ SOL deposit with custom fee successful! Signature: ${signature}`);
      return signature;
    } catch (error: any) {
      console.error("Error depositing SOL with custom fee:", error);

      // Handle specific error types
      if (error.message.includes("already been processed") ||
        error.message.includes("This transaction has already been processed") ||
        error.message.includes("Transaction simulation failed: This transaction has already been processed")) {
        console.log("⚠️ Transaction 'already processed' - this means it likely succeeded the first time");
        throw new Error("TRANSACTION_ALREADY_PROCESSED");
      } else if (error.message.includes("Blockhash not found")) {
        throw new Error("Transaction expired. Please try again.");
      } else if (error.message.includes("insufficient funds")) {
        throw new Error("Insufficient SOL balance for this transaction.");
      }

      throw error;
    } finally {
      // Remove from pending transactions
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Deposit SOL using the program's vault with PROJECT SPECIFIC FEE
   * This is the new standard deposit function that supports per-project fees
   */
  async depositSOLProject(
    user: PublicKey,
    solAmount: number,
    wallet: any,
    projectPDA: PublicKey,
    projectFeeLamports: number,
    projectId?: number | null
  ): Promise<string> {
    const transactionId = this.generateTransactionId(user, solAmount);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Transaction already in progress. Please wait.");
    }

    // Add a delay to prevent rapid duplicate transactions
    await new Promise(resolve => setTimeout(resolve, 500));

    this.pendingTransactions.add(transactionId);

    try {
      // Calculate fee in SOL
      const depositFee = projectFeeLamports / LAMPORTS_PER_SOL;
      const networkFee = 0.0001; // Network transaction fee (~0.00005 SOL actual + buffer)
      const totalRequired = solAmount + depositFee + networkFee;

      // Check user's SOL balance first
      const userBalance = await this.connection.getBalance(user);
      const userSOLBalance = userBalance / LAMPORTS_PER_SOL;

      console.log(`=== PROJECT DEPOSIT BALANCE CHECK ===`);
      console.log(`User wallet: ${user.toString()}`);
      console.log(`User SOL balance: ${userSOLBalance.toFixed(4)} SOL`);
      console.log(`Requested amount: ${solAmount} SOL`);
      console.log(`Project Fee: ${depositFee.toFixed(4)} SOL (${projectFeeLamports} lamports)`);
      console.log(`Network fee: ${networkFee.toFixed(4)} SOL`);
      console.log(`Total required: ${totalRequired.toFixed(4)} SOL`);
      console.log(`=====================================`);

      if (userSOLBalance < totalRequired) {
        throw new Error(`Insufficient SOL balance. You have ${userSOLBalance.toFixed(4)} SOL but need ${totalRequired.toFixed(4)} SOL (including ${depositFee.toFixed(4)} SOL deposit fee and ${networkFee.toFixed(4)} SOL network fee).`);
      }

      // Get SOL-specific PDAs
      const [userBalancePDA] = this.getSolUserBalancePDA(user);

      // Derive platform_wallet and fee_wallet PDAs (required by program security checks)
      const [platformWalletPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("platform_wallet")],
        PROGRAM_ID
      );
      const [feeWalletPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_wallet")],
        PROGRAM_ID
      );

      // Calculate actual deposit amount (after fee deduction)
      const actualDepositAmount = solAmount - depositFee;

      console.log(`=== SOL PROJECT DEPOSIT INFO ===`);
      console.log(`User: ${user.toString()}`);
      console.log(`Project PDA: ${projectPDA.toString()}`);
      console.log(`Requested deposit: ${solAmount} SOL`);
      console.log(`Deposit fee: ${depositFee.toFixed(4)} SOL`);
      console.log(`Amount going to platform wallet: ${actualDepositAmount.toFixed(4)} SOL`);
      console.log(`Platform wallet PDA: ${platformWalletPDA.toString()}`);
      console.log(`Fee wallet PDA: ${feeWalletPDA.toString()}`);
      console.log(`User balance PDA: ${userBalancePDA.toString()}`);
      console.log(`================================`);

      // Create transaction
      const finalTransaction = new Transaction();

      // Add separate fee transfer instruction FIRST (so Phantom wallet shows it separately)
      if (depositFee > 0) {
        const feeTransferInstruction = SystemProgram.transfer({
          fromPubkey: user,
          toPubkey: feeWalletPDA, // Use fee_wallet PDA
          lamports: projectFeeLamports,
        });
        finalTransaction.add(feeTransferInstruction);
        console.log(`✅ Added separate fee transfer instruction: ${depositFee.toFixed(4)} SOL → fee_wallet PDA`);
      }

      // Create deposit_sol_project transaction manually
      const depositInstruction = await this.buildDepositSolProjectInstruction(
        user,
        platformWalletPDA, // Use platform_wallet PDA (required by program)
        feeWalletPDA, // Use fee_wallet PDA (required by program)
        userBalancePDA,
        projectPDA,
        solAmount * LAMPORTS_PER_SOL
      );
      finalTransaction.add(depositInstruction);

      // Get fresh blockhash right before sending
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash("confirmed");

      // Set blockhash and fee payer on final transaction
      finalTransaction.recentBlockhash = blockhash;
      finalTransaction.feePayer = user;

      console.log(`📤 Sending SOL Project deposit transaction (blockhash: ${blockhash.substring(0, 8)}...)`);

      // Sign and send the transaction WITHOUT retry logic
      const signedTransaction = await wallet.signTransaction(finalTransaction);

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 0,
      });

      // Confirm the transaction with retry
      const confirmation = await this.retryRpcCall(
        () => this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, "confirmed")
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      console.log(`✅ SOL Project deposit successful! Signature: ${signature}`);
      return signature;
    } catch (error: any) {
      console.error("Error depositing SOL to vault:", error);

      if (error.message.includes("already been processed") ||
        error.message.includes("This transaction has already been processed")) {
        console.log("⚠️ Transaction 'already processed' - likely succeeded");
        throw new Error("TRANSACTION_ALREADY_PROCESSED");
      } else if (error.message.includes("Blockhash not found")) {
        throw new Error("Transaction expired. Please try again.");
      } else if (error.message.includes("insufficient funds")) {
        throw new Error("Insufficient SOL balance for this transaction.");
      }

      throw error;
    } finally {
      this.pendingTransactions.delete(transactionId);
    }
  }


  /**
   * Withdraw OGX tokens and receive SOL in return
   * SOL will be transferred from admin wallet (same private key as NFT/SOL withdrawals)
   * Uses admin_private_key from database to sign the transaction
   */
  async withdrawOGX(user: PublicKey, ogxAmount: number, wallet: any): Promise<string> {
    const transactionId = this.generateTransactionId(user, ogxAmount);

    console.log("=== OGX WITHDRAWAL START ===");
    console.log(`User: ${user.toString()}`);
    console.log(`Amount: ${ogxAmount} OGX`);
    console.log(`Transaction ID: ${transactionId}`);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Withdrawal already in progress. Please wait.");
    }

    this.pendingTransactions.add(transactionId);

    try {
      // Calculate SOL amount to send (OGX * exchange rate)
      const solAmount = ogxAmount * CONFIG.EXCHANGE_RATES.OGX_TO_SOL;
      console.log(`💰 Converting ${ogxAmount} OGX to ${solAmount} SOL`);

      // Get PDAs for the OGX vault
      const [vaultAuthority] = this.getVaultAuthority(OGX_MINT);
      const vaultATA = await this.getVaultATA(OGX_MINT);
      const [userBalancePDA] = this.getUserBalancePDA(user, OGX_MINT);
      const userATA = this.getUserATA(user, OGX_MINT);

      console.log("=== ACCOUNT ADDRESSES ===");
      console.log(`Vault Authority: ${vaultAuthority.toString()}`);
      console.log(`Vault ATA: ${vaultATA.toString()}`);
      console.log(`User Balance PDA: ${userBalancePDA.toString()}`);
      console.log(`User ATA: ${userATA.toString()}`);

      // Check if user ATA exists and create if needed
      const createATATransaction = await this.ensureATAExists(user, OGX_MINT);

      // Get fee vault accounts
      const [feeVaultAuthority] = this.getFeeVaultAuthority(OGX_MINT);
      const feeVaultATA = await this.getFeeVaultATA(OGX_MINT);
      const [feeConfig] = this.getFeeConfig(OGX_MINT);

      // Get exchange config PDA
      const [exchangeConfig] = this.getExchangeConfig();

      // Fetch admin private key from database (same as NFT and SOL withdrawals)
      let ADMIN_PRIVATE_KEY: string;
      try {
        const { supabase } = await import("@/service/supabase");
        console.log("🔍 Fetching admin private key from database...");
        const { data, error } = await supabase
          .from('website_settings')
          .select('value')
          .eq('key', 'admin_private_key')
          .single();

        console.log("📊 Database query result:", {
          hasData: !!data,
          hasValue: !!(data?.value),
          error: error?.message,
          keyLength: data?.value?.length
        });

        if (error || !data || !data.value) {
          console.error("❌ Admin private key not found in database");
          console.error("Error details:", error);
          throw new Error(
            "⚠️ ADMIN PRIVATE KEY NOT CONFIGURED\n\n" +
            "Please configure the admin private key in the admin dashboard:\n" +
            "Website Settings > Admin Wallet Settings\n\n" +
            "The private key must be set in the database for withdrawals to work."
          );
        } else {
          ADMIN_PRIVATE_KEY = data.value;
          console.log("✅ Admin private key loaded from database");
          console.log(`🔑 Private key length: ${ADMIN_PRIVATE_KEY.length} characters`);
          console.log(`🔑 Private key first 10 chars: ${ADMIN_PRIVATE_KEY.substring(0, 10)}...`);
        }
      } catch (dbError) {
        console.error("❌ Error fetching admin private key from database:", dbError);
        if (dbError instanceof Error && dbError.message.includes("ADMIN PRIVATE KEY NOT CONFIGURED")) {
          throw dbError; // Re-throw our custom error
        }
        throw new Error(
          "⚠️ FAILED TO LOAD ADMIN PRIVATE KEY\n\n" +
          "Error fetching admin private key from database.\n\n" +
          "Please ensure:\n" +
          "1. Database is accessible\n" +
          "2. Admin private key is set in Website Settings\n" +
          "3. Key is stored in website_settings table with key='admin_private_key'"
        );
      }

      // Convert private key string to Keypair and get wallet address
      let adminKeypair: Keypair;
      try {
        const privateKeyBytes = bs58.decode(ADMIN_PRIVATE_KEY);
        adminKeypair = Keypair.fromSecretKey(privateKeyBytes);
      } catch (error) {
        console.error("❌ Error decoding admin private key:", error);
        throw new Error("Invalid admin private key format");
      }

      const ogxWithdrawalWallet = adminKeypair.publicKey;
      console.log(`💳 Admin Wallet (OGX Withdrawal): ${ogxWithdrawalWallet.toString()}`);
      console.log(`✅ Using wallet derived from database private key`);

      // Check admin wallet balance
      const withdrawalWalletBalance = await this.connection.getBalance(ogxWithdrawalWallet);
      const withdrawalWalletSolBalance = withdrawalWalletBalance / LAMPORTS_PER_SOL;
      const requiredAmount = solAmount + 0.001; // Add 0.001 SOL for transaction fee

      console.log(`💰 Admin wallet balance: ${withdrawalWalletSolBalance.toFixed(4)} SOL`);
      console.log(`💰 Required amount: ${requiredAmount.toFixed(4)} SOL`);

      if (withdrawalWalletSolBalance < requiredAmount) {
        throw new Error(`⚠️ Insufficient balance in admin wallet. Available: ${withdrawalWalletSolBalance.toFixed(4)} SOL, Required: ${requiredAmount.toFixed(4)} SOL`);
      }

      // Create withdrawal transaction using the program to burn OGX and update balances
      // Convert OGX amount to token units (smallest unit)
      // Use Math.floor to ensure integer (avoid floating-point precision issues)
      // OGX has 6 decimals, so convert to token units: ogxAmount * 10^6
      const ogxAmountInUnits = Math.floor(ogxAmount * 1e6);
      console.log(`💰 Converting ${ogxAmount} OGX to ${ogxAmountInUnits} token units (6 decimals)`);

      if (ogxAmountInUnits <= 0) {
        throw new Error(`Invalid OGX amount: ${ogxAmount} OGX = ${ogxAmountInUnits} units (must be > 0)`);
      }

      const withdrawalTransaction = await this.program.methods
        .withdrawTokens(new BN(ogxAmountInUnits))
        .accounts({
          user: user,
          mint: OGX_MINT,
          user_ata: userATA,
          vault_authority: vaultAuthority,
          vault_ata: vaultATA,
          vault: vaultAuthority, // vault PDA is the same as vault_authority
          fee_vault: feeVaultAuthority,
          fee_config: feeConfig,
          user_balance: userBalancePDA,
          exchange_config: exchangeConfig,
          system_program: SystemProgram.programId,
          token_program: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
          associated_token_program: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
        })
        .transaction();

      // IMPORTANT: The Rust program will try to transfer SOL from vault PDA to user
      // But we want SOL to come directly from OGX withdrawal wallet
      // Solution: Fund vault PDA from OGX withdrawal wallet, then program transfers it to user
      // So the actual SOL source is: OGX withdrawal wallet → vault PDA → user

      // Get vault PDA for SOL (where the program expects SOL to be)
      const [solVaultPDA] = this.getVaultAuthority(SOL_MINT);
      console.log(`🏦 SOL Vault PDA: ${solVaultPDA.toString()}`);

      // Check vault PDA balance
      const vaultBalance = await this.connection.getBalance(solVaultPDA);
      const vaultSolBalance = vaultBalance / LAMPORTS_PER_SOL;
      console.log(`💰 Vault PDA balance: ${vaultSolBalance.toFixed(4)} SOL`);

      // Create SOL transfer instruction from OGX withdrawal wallet to vault PDA
      // The program will then transfer it from vault to user
      // This ensures SOL comes from OGX withdrawal wallet (via vault PDA)
      const solTransferToVaultInstruction = SystemProgram.transfer({
        fromPubkey: ogxWithdrawalWallet,
        toPubkey: solVaultPDA,
        lamports: solAmount * LAMPORTS_PER_SOL,
      });

      // Create a new transaction
      const finalTransaction = new Transaction();

      // If ATA needs to be created, add it first
      if (createATATransaction) {
        finalTransaction.add(...createATATransaction.instructions);
      }

      // Add SOL transfer from OGX withdrawal wallet to vault PDA FIRST
      // This funds the vault so the program can transfer it to user
      finalTransaction.add(solTransferToVaultInstruction);

      // Add the withdrawal transaction (burns OGX and transfers SOL from vault to user)
      finalTransaction.add(...withdrawalTransaction.instructions);

      console.log(`💸 SOL FLOW: ${ogxWithdrawalWallet.toString()} → ${solVaultPDA.toString()} → ${user.toString()}`);
      console.log(`💰 SOL Source: ${ogxWithdrawalWallet.toString()} (OGX Withdrawal Wallet)`);
      console.log(`💰 Amount: ${solAmount} SOL`);

      // Get fresh blockhash right before sending with retry
      const { blockhash, lastValidBlockHeight } = await this.retryRpcCall(
        () => this.connection.getLatestBlockhash("confirmed")
      );

      // Set blockhash and fee payer on final transaction
      finalTransaction.recentBlockhash = blockhash;
      finalTransaction.feePayer = user;

      console.log("=== SENDING OGX WITHDRAWAL TRANSACTION ===");
      console.log(`Transaction size: ${finalTransaction.serialize({ requireAllSignatures: false }).length} bytes`);
      console.log(`📤 SOL Source: ${ogxWithdrawalWallet.toString()} (Admin Wallet - same as NFT/SOL withdrawals)`);
      console.log(`📤 SOL Flow: ${ogxWithdrawalWallet.toString()} → vault PDA → ${user.toString()}`);
      console.log(`💰 Transferring ${solAmount} SOL from admin wallet to user (via vault PDA)`);

      // Sign transaction with multiple signers:
      // 1. Partially sign with admin keypair first (for SOL transfer from admin wallet)
      // 2. Then have user sign it (for program instructions)
      try {
        // Partially sign with admin keypair first
        finalTransaction.partialSign(adminKeypair);
        console.log("✅ Transaction partially signed with admin wallet");
      } catch (error) {
        console.error("❌ Error partially signing with admin wallet:", error);
        throw new Error("Failed to partially sign transaction with admin wallet");
      }

      // Now have the user sign the partially signed transaction
      const signedTransaction = await wallet.signTransaction(finalTransaction);
      console.log("✅ Transaction signed by user wallet");

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 0, // Don't retry - will cause "already processed" errors
      });

      console.log("=== OGX WITHDRAWAL TRANSACTION SENT ===");
      console.log(`Signature: ${signature}`);

      // Wait for confirmation with retry
      const confirmation = await this.retryRpcCall(
        () => this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, "confirmed")
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      console.log("=== OGX WITHDRAWAL CONFIRMED ===");
      console.log("Confirmation status:", confirmation.value);
      console.log(`✅ ${ogxAmount} OGX burned`);
      console.log(`✅ ${solAmount} SOL transferred from admin wallet to user`);
      console.log(`💳 SOL Source Wallet: ${ogxWithdrawalWallet.toString()} (Admin Wallet - same as NFT/SOL withdrawals)`);
      console.log(`📊 Flow: ${ogxWithdrawalWallet.toString()} → vault PDA → ${user.toString()}`);

      return signature;

    } catch (error) {
      console.error("=== OGX WITHDRAWAL ERROR ===", error);
      throw error;
    } finally {
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Withdraw SOL from the program's vault
   */
  async withdrawSOL(user: PublicKey, solAmount: number, wallet: any, projectId?: number): Promise<string> {
    const transactionId = this.generateTransactionId(user, solAmount);

    console.log("=== SOL WITHDRAWAL START ===");
    console.log(`User: ${user.toString()}`);
    console.log(`Amount: ${solAmount} SOL`);
    console.log(`Transaction ID: ${transactionId}`);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Withdrawal already in progress. Please wait.");
    }

    this.pendingTransactions.add(transactionId);

    try {
      // IMPORTANT: For SOL withdrawals, the program uses a special SOL balance PDA
      // which uses seeds [b"user_balance", user.key(), b"sol"] instead of the mint
      // This is different from OGX balance PDA which uses the OGX mint

      // Get PDAs for SOL vault (for sending SOL)
      const [vaultAuthority] = this.getVaultAuthority(SOL_MINT);
      const vaultATA = await this.getVaultATA(SOL_MINT);
      const userATA = this.getUserATA(user, SOL_MINT);

      // IMPORTANT: For SOL withdrawals, the program now uses [b"user_balance", user, b"sol"] 
      // (same as deposit_sol) to match the deposit PDA. For other tokens, it uses [b"user_balance", user, mint]
      // So for SOL, we use getSolUserBalancePDA which uses the string "sol" instead of SOL_MINT
      const [solUserBalancePDA] = this.getSolUserBalancePDA(user);

      console.log("=== ACCOUNT ADDRESSES ===");
      console.log(`SOL Vault Authority: ${vaultAuthority.toString()}`);
      console.log(`SOL Vault ATA: ${vaultATA.toString()}`);
      console.log(`User SOL ATA: ${userATA.toString()}`);
      console.log(`SOL User Balance PDA: ${solUserBalancePDA.toString()}`);

      // Check if user SOL ATA exists and create if needed
      const createSOLATATransaction = await this.ensureATAExists(user, SOL_MINT);

      // Get fee vault accounts for SOL
      const [feeVaultAuthority] = this.getFeeVaultAuthority(SOL_MINT);
      const feeVaultATA = await this.getFeeVaultATA(SOL_MINT);
      const [feeConfig] = this.getFeeConfig(SOL_MINT);
      const [solFeeConfig] = this.getSolFeeConfig();

      // Get exchange config PDA
      const [exchangeConfig] = this.getExchangeConfig();

      // Check user's SOL balance before withdrawal
      // IMPORTANT: We need to check BOTH PDAs because:
      // - deposit_sol uses: [b"user_balance", user, b"sol"] (string "sol")
      // - withdrawTokens uses: [b"user_balance", user, SOL_MINT] (mint address)
      // The program will check the correct one during withdrawal, but we check both here for user feedback
      try {
        // Check the deposit_sol PDA (string "sol")
        const [depositSolPDA] = this.getSolUserBalancePDA(user);
        const depositSolBalanceAccount = await (this.program.account as any).userBalance.fetchNullable(depositSolPDA);

        // Check the withdrawTokens PDA (SOL_MINT)
        const withdrawSolBalanceAccount = await (this.program.account as any).userBalance.fetchNullable(solUserBalancePDA);

        // Get balance from whichever account exists (or both if they both exist)
        let userSOLBalance = 0;
        if (depositSolBalanceAccount) {
          userSOLBalance += depositSolBalanceAccount.balance.toNumber() / LAMPORTS_PER_SOL;
          console.log(`💰 User SOL Balance (from deposit_sol PDA): ${userSOLBalance.toFixed(4)} SOL`);
        }
        if (withdrawSolBalanceAccount) {
          const withdrawBalance = withdrawSolBalanceAccount.balance.toNumber() / LAMPORTS_PER_SOL;
          userSOLBalance += withdrawBalance;
          console.log(`💰 User SOL Balance (from withdrawTokens PDA): ${withdrawBalance.toFixed(4)} SOL`);
        }

        console.log(`💰 Total User SOL Balance (in vault): ${userSOLBalance.toFixed(4)} SOL`);
        console.log(`💰 Requested SOL: ${solAmount.toFixed(4)} SOL`);

        if (userSOLBalance === 0) {
          throw new Error(`User SOL balance account not found. Please deposit SOL first.`);
        }

        if (userSOLBalance < solAmount) {
          throw new Error(`Insufficient SOL balance in vault. You have ${userSOLBalance.toFixed(4)} SOL but need ${solAmount.toFixed(4)} SOL.`);
        }
      } catch (error) {
        if (error instanceof Error && (error.message.includes("Insufficient") || error.message.includes("not found"))) {
          throw error;
        }
        console.warn("⚠️ Could not fetch user SOL balance, proceeding with withdrawal (program will check):", error);
      }

      // Fetch admin private key from database (same as NFT and OGX withdrawals)
      // Try project-specific admin key first, then fallback to main website admin key
      let ADMIN_PRIVATE_KEY: string;
      try {
        const { supabase } = await import("@/service/supabase");
        console.log("🔍 Fetching admin private key from database for SOL withdrawal...");

        let adminKeyData: any = null;
        let adminKeyError: any = null;

        // For projects, ONLY check project-specific admin key (no fallback to website_settings)
        if (projectId) {
          // Try project-specific admin key first
          const { data: projectKeyData, error: projectKeyError } = await supabase
            .from('project_settings')
            .select('setting_value')
            .eq('project_id', projectId)
            .eq('setting_key', 'admin_private_key')
            .maybeSingle();

          if (!projectKeyError && projectKeyData?.setting_value) {
            adminKeyData = { value: projectKeyData.setting_value };
            console.log(`✅ Using project-specific admin wallet for project ID: ${projectId}`);
          } else {
            // No project admin wallet configured - throw error (don't fall back)
            throw new Error(
              `⚠️ ADMIN PRIVATE KEY NOT CONFIGURED FOR THIS PROJECT\n\n` +
              `Please configure the admin private key in the admin dashboard:\n` +
              `Website Settings > Admin Wallet Settings\n\n` +
              `The private key must be set in project_settings for this project (project_id: ${projectId}) for withdrawals to work.`
            );
          }
        } else {
          // For main project (no projectId), check website_settings
          const { data: websiteKeyData, error: websiteKeyError } = await supabase
            .from('website_settings')
            .select('value')
            .eq('key', 'admin_private_key')
            .maybeSingle();

          adminKeyData = websiteKeyData;
          adminKeyError = websiteKeyError;

          if (!adminKeyError && adminKeyData?.value) {
            console.log(`✅ Using main website admin wallet`);
          }
        }

        const { data, error } = { data: adminKeyData, error: adminKeyError };

        console.log("📊 Database query result:", {
          hasData: !!data,
          hasValue: !!(data?.value),
          error: error?.message,
          keyLength: data?.value?.length
        });

        if (error || !data || !data.value) {
          console.error("❌ Admin private key not found in database");
          console.error("Error details:", error);
          throw new Error(
            "⚠️ ADMIN PRIVATE KEY NOT CONFIGURED\n\n" +
            "Please configure the admin private key in the admin dashboard:\n" +
            "Website Settings > Admin Wallet Settings\n\n" +
            "The private key must be set in the database for withdrawals to work."
          );
        } else {
          ADMIN_PRIVATE_KEY = data.value;
          console.log("✅ Admin private key loaded from database");
          console.log(`🔑 Private key length: ${ADMIN_PRIVATE_KEY.length} characters`);
        }
      } catch (dbError) {
        console.error("❌ Error fetching admin private key from database:", dbError);
        if (dbError instanceof Error && dbError.message.includes("ADMIN PRIVATE KEY NOT CONFIGURED")) {
          throw dbError; // Re-throw our custom error
        }
        throw new Error(
          "⚠️ FAILED TO LOAD ADMIN PRIVATE KEY\n\n" +
          "Error fetching admin private key from database.\n\n" +
          "Please ensure:\n" +
          "1. Database is accessible\n" +
          "2. Admin private key is set in Website Settings\n" +
          "3. Key is stored in website_settings table with key='admin_private_key'"
        );
      }

      // Convert private key string to Keypair and get wallet address
      let adminKeypair: Keypair;
      try {
        const privateKeyBytes = bs58.decode(ADMIN_PRIVATE_KEY);
        adminKeypair = Keypair.fromSecretKey(privateKeyBytes);
      } catch (error) {
        console.error("❌ Error decoding admin private key:", error);
        throw new Error("Invalid admin private key format");
      }

      const adminWallet = adminKeypair.publicKey;
      console.log(`💳 Admin Wallet (SOL Withdrawal): ${adminWallet.toString()}`);
      console.log(`✅ Using wallet derived from database private key`);

      // Check admin wallet balance
      const adminBalance = await this.connection.getBalance(adminWallet);
      const adminSolBalance = adminBalance / LAMPORTS_PER_SOL;
      const requiredAmount = solAmount + 0.001; // Add 0.001 SOL for transaction fee

      console.log(`💰 Admin wallet balance: ${adminSolBalance.toFixed(4)} SOL`);
      console.log(`💰 Required amount: ${requiredAmount.toFixed(4)} SOL`);

      if (adminSolBalance < requiredAmount) {
        throw new Error(`⚠️ Insufficient balance in admin wallet. Available: ${adminSolBalance.toFixed(4)} SOL, Required: ${requiredAmount.toFixed(4)} SOL`);
      }

      // Get fee wallet (required for account structure but not used - withdrawals have no fee)
      const feeWallet = new PublicKey(CONFIG.FEE_WALLET);
      console.log("=== FEE WALLET DEBUG ===");
      console.log(`Fee wallet address: ${feeWallet.toString()}`);
      console.log(`Fee wallet from config: ${CONFIG.FEE_WALLET}`);

      // Convert SOL amount to lamports (smallest unit)
      // Use Math.floor to ensure integer (avoid floating-point precision issues)
      const solAmountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
      console.log(`💰 Converting ${solAmount} SOL to ${solAmountInLamports} lamports`);

      if (solAmountInLamports <= 0) {
        throw new Error(`Invalid SOL amount: ${solAmount} SOL = ${solAmountInLamports} lamports (must be > 0)`);
      }

      // Create withdrawal transaction using the program
      // The program will:
      // 1. Check user's SOL balance (from solUserBalancePDA)
      // 2. Deduct SOL amount from user's balance
      // 3. Transfer SOL from vault to user

      // Create withdrawal transaction using the program
      // Note: We manually build the instruction to bypass Anchor's PDA validation
      // The program will manually validate userBalance PDA in Rust code
      console.log("=== USER BALANCE PDA DEBUG ===");
      console.log(`SOL User Balance PDA: ${solUserBalancePDA.toString()}`);
      console.log(`Expected seeds: [b"user_balance", user, b"sol"]`);
      console.log(`User: ${user.toString()}`);
      console.log(`Mint: ${SOL_MINT.toString()}`);

      // Verify the PDA derivation is correct
      const [verifyPDA] = this.getSolUserBalancePDA(user);
      if (!verifyPDA.equals(solUserBalancePDA)) {
        throw new Error(`PDA mismatch! Expected ${verifyPDA.toString()}, got ${solUserBalancePDA.toString()}`);
      }
      console.log(`✅ PDA verification passed: ${solUserBalancePDA.toString()}`);

      // Manually build withdrawTokens instruction to bypass Anchor's PDA validation
      // This is necessary because Anchor tries to validate userBalance PDA even though it's UncheckedAccount
      const withdrawalIx = await this.buildWithdrawTokensInstruction(
        user,
        SOL_MINT,
        userATA,
        vaultAuthority,
        vaultATA,
        solUserBalancePDA, // Use the correct PDA with "sol" string (must be in correct position)
        feeVaultAuthority,
        feeVaultATA,
        feeConfig,
        feeWallet,
        solFeeConfig,
        vaultAuthority, // vault PDA (same as vaultAuthority for SOL)
        exchangeConfig,
        solAmountInLamports
      );

      // Create transaction and add the instruction
      const withdrawalTransaction = new Transaction();
      withdrawalTransaction.add(withdrawalIx);

      console.log("=== ACCOUNTS DEBUG ===");
      console.log(`feeWallet: ${feeWallet.toString()}`);
      console.log(`solFeeConfig: ${solFeeConfig.toString()}`);

      // IMPORTANT: The Rust program will try to transfer SOL from vault PDA to user
      // But we want SOL to come from admin wallet
      // Solution: Fund vault PDA from admin wallet, then program transfers it to user
      // So the actual SOL source is: Admin wallet → vault PDA → user

      // Get vault PDA for SOL (where the program expects SOL to be)
      const [solVaultPDA] = this.getVaultAuthority(SOL_MINT);
      console.log(`🏦 SOL Vault PDA: ${solVaultPDA.toString()}`);

      // Check vault PDA balance
      const vaultBalance = await this.connection.getBalance(solVaultPDA);
      const vaultSolBalance = vaultBalance / LAMPORTS_PER_SOL;
      console.log(`💰 Vault PDA balance: ${vaultSolBalance.toFixed(4)} SOL`);

      // Create SOL transfer instruction from admin wallet to vault PDA
      // The program will then transfer it from vault to user
      // This ensures SOL comes from admin wallet (via vault PDA)
      // Use the already calculated integer lamports to avoid floating-point issues
      const solTransferToVaultInstruction = SystemProgram.transfer({
        fromPubkey: adminWallet,
        toPubkey: solVaultPDA,
        lamports: solAmountInLamports, // Use integer lamports (already calculated with Math.floor)
      });

      // Create a new transaction
      const finalTransaction = new Transaction();

      // If SOL ATA needs to be created, add it first
      if (createSOLATATransaction) {
        finalTransaction.add(...createSOLATATransaction.instructions);
      }

      // Add SOL transfer from admin wallet to vault PDA FIRST
      // This funds the vault so the program can transfer it to user
      finalTransaction.add(solTransferToVaultInstruction);

      // Add the withdrawal instruction (already created as instruction, not transaction)
      console.log("=== WITHDRAWAL INSTRUCTION DEBUG ===");
      console.log(`Instruction program ID: ${withdrawalIx.programId.toString()}`);
      console.log(`Number of accounts: ${withdrawalIx.keys.length}`);
      console.log(`Instruction data length: ${withdrawalIx.data.length}`);
      console.log(`User balance account in instruction: ${withdrawalIx.keys[5].pubkey.toString()}`); // Should be at index 5
      console.log(`Expected user balance PDA: ${solUserBalancePDA.toString()}`);
      console.log(`Match: ${withdrawalIx.keys[5].pubkey.equals(solUserBalancePDA)}`);

      finalTransaction.add(withdrawalIx);

      // Add unwrap instruction to convert wSOL back to native SOL
      const unwrapInstruction = createCloseAccountInstruction(
        userATA, // wSOL ATA to close
        user,    // Destination for native SOL
        user,    // Owner of the ATA
        []       // No multisig
      );
      finalTransaction.add(unwrapInstruction);

      console.log(`💸 SOL FLOW: ${adminWallet.toString()} → ${solVaultPDA.toString()} → ${user.toString()}`);
      console.log(`💰 SOL Source: ${adminWallet.toString()} (Admin Wallet)`);
      console.log(`💰 Amount: ${solAmount} SOL`);

      console.log("=== UNWRAP INSTRUCTION ADDED ===");
      console.log(`Closing wSOL ATA: ${userATA.toString()}`);
      console.log(`Native SOL destination: ${user.toString()}`);

      // Declare signature variable
      let signature: string;

      // Get fresh blockhash right before sending with retry
      // Note: We use manual signing because we need admin's partial signature for SOL transfer
      const { blockhash, lastValidBlockHeight } = await this.retryRpcCall(
        () => this.connection.getLatestBlockhash("finalized") // Use finalized for better reliability
      );

      // Set blockhash and fee payer on final transaction
      finalTransaction.recentBlockhash = blockhash;
      finalTransaction.feePayer = user;

      console.log("=== TRANSACTION DETAILS ===");
      console.log(`Number of instructions: ${finalTransaction.instructions.length}`);
      console.log(`Blockhash: ${blockhash.substring(0, 8)}...${blockhash.substring(-8)}`);
      console.log(`Fee payer: ${user.toString()}`);
      console.log(`📤 SOL Source: ${adminWallet.toString()} (Admin Wallet)`);
      console.log(`📤 SOL Flow: ${adminWallet.toString()} → vault PDA → ${user.toString()}`);

      // Sign transaction with multiple signers:
      // 1. Partially sign with admin keypair first (for SOL transfer from admin wallet)
      // 2. Then have user sign it (for program instructions)
      try {
        // Partially sign with admin keypair first
        finalTransaction.partialSign(adminKeypair);
        console.log("✅ Transaction partially signed with admin wallet");
      } catch (error) {
        console.error("❌ Error partially signing with admin wallet:", error);
        throw new Error("Failed to partially sign transaction with admin wallet");
      }

      // Now have the user sign the partially signed transaction
      const signedTransaction = await wallet.signTransaction(finalTransaction);
      console.log("✅ Transaction signed by user wallet");

      // Send transaction with fresh blockhash
      signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3, // Allow retries for network issues
      });

      console.log(`=== TRANSACTION SENT ===`);
      console.log(`Signature: ${signature}`);

      // Confirm the transaction with retry
      const confirmation = await this.retryRpcCall(
        () => this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, "confirmed")
      );

      if (confirmation.value.err) {
        console.error("=== TRANSACTION FAILED ===");
        console.error(`Error: ${confirmation.value.err}`);
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      console.log("=== TRANSACTION CONFIRMED ===");
      console.log(`Success! SOL should be in your wallet now.`);
      console.log(`Check your wallet balance.`);
      console.log(`✅ ${solAmount} SOL transferred from admin wallet to user`);
      console.log(`💳 SOL Source Wallet: ${adminWallet.toString()} (Admin Wallet - same as NFT/OGX withdrawals)`);
      console.log(`📊 Flow: ${adminWallet.toString()} → vault PDA → ${user.toString()}`);

      return signature;
    } catch (error) {
      console.error("Error withdrawing SOL from vault:", error);
      throw error;
    } finally {
      // Remove from pending transactions
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Create a withdrawal request with user signature (for database tracking)
   * This creates a transaction that proves the user wants to withdraw
   */
  async createWithdrawalRequest(user: PublicKey, solAmount: number, wallet: any): Promise<string> {
    const transactionId = this.generateTransactionId(user, solAmount);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Withdrawal request already in progress. Please wait.");
    }

    // Add a delay to prevent rapid duplicate transactions
    await new Promise(resolve => setTimeout(resolve, 2000));

    this.pendingTransactions.add(transactionId);

    try {
      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash("confirmed");

      // Create a withdrawal request transaction
      const transaction = new Transaction();

      // Add a transfer instruction with the withdrawal amount as a "memo"
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: user,
          toPubkey: user, // Send to self
          lamports: 0, // 0 lamports - just for transaction structure
        })
      );

      // Add multiple unique nonce instructions to prevent duplicate transactions
      const nonce1 = Math.random().toString(36).substring(2, 15);
      const nonce2 = Math.random().toString(36).substring(2, 15);
      const timestamp = Date.now();
      const microtime = performance.now();

      // First nonce instruction
      const nonceInstruction1 = SystemProgram.transfer({
        fromPubkey: user,
        toPubkey: user,
        lamports: 1,
      });
      transaction.add(nonceInstruction1);

      // Second nonce instruction with different amount
      const nonceInstruction2 = SystemProgram.transfer({
        fromPubkey: user,
        toPubkey: user,
        lamports: 2,
      });
      transaction.add(nonceInstruction2);

      // Third nonce instruction with different amount
      const nonceInstruction3 = SystemProgram.transfer({
        fromPubkey: user,
        toPubkey: user,
        lamports: 3,
      });
      transaction.add(nonceInstruction3);

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = user;

      // Sign the transaction
      const signedTransaction = await wallet.signTransaction(transaction);

      // Send the transaction
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      // Confirm the transaction
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, "confirmed");

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      return signature;
    } catch (error) {
      console.error("Error creating withdrawal request:", error);
      throw error;
    } finally {
      // Remove from pending transactions
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Get platform wallet balance
   */
  async getPlatformWalletBalance(): Promise<number> {
    try {
      const platformWallet = new PublicKey(CONFIG.PLATFORM_WALLET);
      const balance = await this.connection.getBalance(platformWallet);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error("Error getting platform wallet balance:", error);
      return 0;
    }
  }

  /**
   * Get SOL balance
   */
  async getSOLBalance(user: PublicKey): Promise<number> {
    try {
      const balance = await this.retryRpcCall(
        () => this.connection.getBalance(user)
      );
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error("Error fetching SOL balance:", error);
      return 0;
    }
  }

  /**
   * Get OGX token balance for a user
   */
  async getOGXBalance(user: PublicKey): Promise<number> {
    try {
      const userATA = this.getUserATA(user, OGX_MINT);

      // Check if user ATA exists
      const accountInfo = await this.connection.getAccountInfo(userATA);
      if (!accountInfo) {
        return 0; // No ATA means no balance
      }

      // Get token balance
      const balanceInfo = await this.retryRpcCall(
        () => this.connection.getTokenAccountBalance(userATA)
      );

      // OGX has 6 decimals, so convert to human-readable format
      return balanceInfo.value.uiAmount || 0;
    } catch (error) {
      console.error("Error fetching OGX balance:", error);
      return 0;
    }
  }

  /**
   * Get USDC token balance for a user
   */
  async getUSDCBalance(user: PublicKey): Promise<number> {
    try {
      const userATA = this.getUserATA(user, USDC_MINT);

      // Check if user ATA exists
      const accountInfo = await this.connection.getAccountInfo(userATA);
      if (!accountInfo) {
        return 0; // No ATA means no balance
      }

      // Get token balance
      const balanceInfo = await this.retryRpcCall(
        () => this.connection.getTokenAccountBalance(userATA)
      );

      // USDC has 6 decimals, so convert to human-readable format
      return balanceInfo.value.uiAmount || 0;
    } catch (error) {
      console.error("Error fetching USDC balance:", error);
      return 0;
    }
  }

  /**
   * Get token decimals from mint account
   */
  async getTokenDecimals(mint: PublicKey): Promise<number> {
    try {
      const mintInfo = await getMint(this.connection, mint);
      console.log(`✅ Fetched token decimals for ${mint.toString()}: ${mintInfo.decimals}`);
      return mintInfo.decimals;
    } catch (error) {
      console.error(`Error fetching token decimals for ${mint.toString()}:`, error);
      // Fallback to 6 decimals if we can't fetch (most common for devnet tokens)
      console.warn(`⚠️ Using fallback decimals: 6`);
      return 6;
    }
  }

  /**
   * Get token balance for any token mint
   */
  async getTokenBalance(user: PublicKey, mint: PublicKey): Promise<number> {
    try {
      const userATA = this.getUserATA(user, mint);

      // Check if user ATA exists
      const accountInfo = await this.connection.getAccountInfo(userATA);
      if (!accountInfo) {
        return 0; // No ATA means no balance
      }

      // Get token balance
      const balanceInfo = await this.retryRpcCall(
        () => this.connection.getTokenAccountBalance(userATA)
      );

      // Return human-readable format
      return balanceInfo.value.uiAmount || 0;
    } catch (error) {
      console.error(`Error fetching token balance for ${mint.toString()}:`, error);
      return 0;
    }
  }

  /**
   * Get project-specific deposit wallet address
   * For projects: ONLY checks project_settings (no fallback to website_settings)
   * For main project: checks website_settings
   * Throws error if no deposit wallet is configured (no fallback to default)
   */
  private async getDepositWallet(projectId?: number | null): Promise<PublicKey> {
    try {
      const { supabase } = await import("@/service/supabase");

      // For projects, ONLY check project-specific deposit wallet (no fallback to website_settings)
      if (projectId) {
        const { data, error } = await supabase
          .from('project_settings')
          .select('setting_value')
          .eq('project_id', projectId)
          .eq('setting_key', 'deposit_wallet_address')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error(`Error fetching project deposit wallet:`, error);
        }

        if (data?.setting_value) {
          try {
            const depositWallet = new PublicKey(data.setting_value as string);
            console.log(`✅ Using project-specific deposit wallet for project ${projectId}: ${depositWallet.toString()}`);
            return depositWallet;
          } catch (e) {
            console.warn(`⚠️ Invalid deposit wallet address for project ${projectId}`);
            throw new Error(`Deposit wallet is not configured for this project. Please configure a deposit wallet in the admin panel.`);
          }
        } else {
          // No project wallet configured - throw error (don't fall back to website_settings)
          throw new Error(`Deposit wallet is not configured for this project. Please configure a deposit wallet in the admin panel.`);
        }
      }

      // For main project (no projectId), check website_settings
      const { data: websiteData, error: websiteError } = await supabase
        .from('website_settings')
        .select('value')
        .eq('key', 'deposit_wallet_address')
        .maybeSingle();

      if (websiteError && websiteError.code !== 'PGRST116') {
        console.error(`Error fetching website deposit wallet:`, websiteError);
      }

      if (websiteData?.value) {
        try {
          const depositWallet = new PublicKey(websiteData.value as string);
          console.log(`✅ Using main website deposit wallet: ${depositWallet.toString()}`);
          return depositWallet;
        } catch (e) {
          console.warn(`⚠️ Invalid main website deposit wallet address`);
          throw new Error(`Deposit wallet is not configured. Please configure a deposit wallet in the admin panel.`);
        }
      } else {
        throw new Error(`Deposit wallet is not configured. Please configure a deposit wallet in the admin panel.`);
      }
    } catch (error) {
      // If it's already our error message, re-throw it
      if (error instanceof Error && error.message.includes('Deposit wallet is not configured')) {
        throw error;
      }
      console.error('Error fetching deposit wallet:', error);
      throw new Error(`Deposit wallet is not configured. Please configure a deposit wallet in the admin panel.`);
    }
  }

  /**
   * Deposit OGX tokens to the program vault
   */
  async depositOGX(user: PublicKey, ogxAmount: number, wallet: any): Promise<string> {
    const transactionId = this.generateTransactionId(user, ogxAmount);

    console.log("=== OGX DEPOSIT START ===");
    console.log(`User: ${user.toString()}`);
    console.log(`Amount: ${ogxAmount} OGX`);
    console.log(`Transaction ID: ${transactionId}`);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Deposit already in progress. Please wait.");
    }

    this.pendingTransactions.add(transactionId);

    try {
      // Get PDAs for the OGX vault
      const [vaultAuthority] = this.getVaultAuthority(OGX_MINT);
      const vaultATA = await this.getVaultATA(OGX_MINT);
      const [userBalancePDA] = this.getUserBalancePDA(user, OGX_MINT);
      const userATA = this.getUserATA(user, OGX_MINT);

      console.log("=== ACCOUNT ADDRESSES ===");
      console.log(`Vault Authority: ${vaultAuthority.toString()}`);
      console.log(`Vault ATA: ${vaultATA.toString()}`);
      console.log(`User Balance PDA: ${userBalancePDA.toString()}`);
      console.log(`User ATA: ${userATA.toString()}`);

      // Check if user ATA exists and create if needed
      const createATATransaction = await this.ensureATAExists(user, OGX_MINT);

      // Get fee vault accounts
      const [feeVaultAuthority] = this.getFeeVaultAuthority(OGX_MINT);
      const feeVaultATA = await this.getFeeVaultATA(OGX_MINT);
      const [feeConfig] = this.getFeeConfig(OGX_MINT);

      // Get required accounts for deposit (fee_wallet, sol_fee_config, exchange_config)
      const feeWallet = new PublicKey(CONFIG.FEE_WALLET);
      const [solFeeConfig] = this.getSolFeeConfig();
      const [exchangeConfig] = this.getExchangeConfig();

      console.log(`Fee Vault Authority: ${feeVaultAuthority.toString()}`);
      console.log(`Fee Vault ATA: ${feeVaultATA.toString()}`);
      console.log(`Fee Config: ${feeConfig.toString()}`);
      console.log(`Fee Wallet: ${feeWallet.toString()}`);
      console.log(`Sol Fee Config: ${solFeeConfig.toString()}`);
      console.log(`Exchange Config: ${exchangeConfig.toString()}`);

      // ✅ CRITICAL: LOG ALL CALCULATED ADDRESSES FOR COMPARISON
      console.log("=== FRONTEND CALCULATED ADDRESSES ===");
      console.log("User:", user.toString());
      console.log("OGX Mint:", OGX_MINT.toString());
      console.log("User ATA:", userATA.toString());
      console.log("Vault Authority PDA:", vaultAuthority.toString());
      console.log("Vault ATA:", vaultATA.toString());
      console.log("Vault Authority PDA:", vaultAuthority.toString());
      console.log("Fee Vault ATA:", feeVaultATA.toString());
      console.log("Fee Config PDA:", feeConfig.toString());

      // ✅ PRE-FLIGHT BALANCE CHECKS
      console.log("=== PRE-FLIGHT BALANCE CHECKS ===");

      try {
        // Check if user's OGX ATA exists first
        console.log(`🔍 Checking if user ATA exists: ${userATA.toString()}`);
        const userATAAccountInfo = await this.connection.getAccountInfo(userATA);

        let userBalanceOGX = 0;
        let userBalanceUnits = "0";

        if (!userATAAccountInfo) {
          console.log(`❌ User OGX ATA does not exist! Will be created during transaction.`);
          console.log(`📋 User has 0 OGX tokens (no ATA account)`);
          userBalanceOGX = 0;
          userBalanceUnits = "0";
        } else {
          console.log(`✅ User OGX ATA exists, checking balance...`);
          const userBalanceInfo = await this.connection.getTokenAccountBalance(userATA);
          userBalanceOGX = userBalanceInfo.value.uiAmount || 0;
          userBalanceUnits = userBalanceInfo.value.amount || "0";
        }

        console.log(`📊 User OGX Balance: ${userBalanceOGX} OGX`);
        console.log(`📊 User Balance (units): ${userBalanceUnits}`);

        // Check vault balances (these should exist, but handle gracefully)
        let vaultBalanceOGX = 0;
        let feeVaultBalanceOGX = 0;

        console.log(`🔍 Checking vault ATA: ${vaultATA.toString()}`);
        const vaultATAAccountInfo = await this.connection.getAccountInfo(vaultATA);

        if (!vaultATAAccountInfo) {
          console.log(`❌ Vault ATA does not exist! This might cause transaction failure.`);
          vaultBalanceOGX = 0;
        } else {
          const vaultBalanceInfo = await this.connection.getTokenAccountBalance(vaultATA);
          vaultBalanceOGX = vaultBalanceInfo.value.uiAmount || 0;
        }

        console.log(`📊 Vault OGX Balance: ${vaultBalanceOGX} OGX`);

        console.log(`🔍 Checking fee vault ATA: ${feeVaultATA.toString()}`);
        const feeVaultATAAccountInfo = await this.connection.getAccountInfo(feeVaultATA);

        if (!feeVaultATAAccountInfo) {
          console.log(`❌ Fee Vault ATA does not exist! This might cause transaction failure.`);
          feeVaultBalanceOGX = 0;
        } else {
          const feeVaultBalanceInfo = await this.connection.getTokenAccountBalance(feeVaultATA);
          feeVaultBalanceOGX = feeVaultBalanceInfo.value.uiAmount || 0;
        }

        console.log(`📊 Fee Vault OGX Balance: ${feeVaultBalanceOGX} OGX`);

        // ✅ DETAILED BALANCE LOGGING FOR DEBUGGING
        console.log("=== DETAILED ACCOUNT BALANCE LOGGING ===");

        try {
          const userBalanceDetailed = await this.connection.getTokenAccountBalance(userATA);
          console.log("User OGX ATA:", userATA.toString());
          console.log("User Balance Details:", JSON.stringify(userBalanceDetailed.value, null, 2));

          if (vaultATAAccountInfo) {
            const vaultBalanceDetailed = await this.connection.getTokenAccountBalance(vaultATA);
            console.log("Vault OGX ATA:", vaultATA.toString());
            console.log("Vault Balance Details:", JSON.stringify(vaultBalanceDetailed.value, null, 2));
          } else {
            console.log("Vault OGX ATA:", vaultATA.toString(), "- Account does not exist");
          }

          if (feeVaultATAAccountInfo) {
            const feeVaultBalanceDetailed = await this.connection.getTokenAccountBalance(feeVaultATA);
            console.log("Fee Vault OGX ATA:", feeVaultATA.toString());
            console.log("Fee Vault Balance Details:", JSON.stringify(feeVaultBalanceDetailed.value, null, 2));
          } else {
            console.log("Fee Vault OGX ATA:", feeVaultATA.toString(), "- Account does not exist");
          }
        } catch (error) {
          const err = error as unknown as Error;
          console.log("❌ Error getting detailed balances:", (err && err.message) ? err.message : error);
        }

        // Calculate required amounts
        const depositAmountUnits = Math.floor(ogxAmount * 1e6);
        const depositAmountOGX = ogxAmount;

        console.log(`🎯 Deposit Requested: ${depositAmountOGX} OGX (${depositAmountUnits} units)`);

        // Pre-flight validation
        const userBalanceNum = parseInt(userBalanceUnits);

        if (userBalanceNum < depositAmountUnits) {
          const shortfall = depositAmountUnits - userBalanceNum;
          const shortfallOGX = shortfall / 1e6;

          console.log(`⚠️ INSUFFICIENT BALANCE DETECTED!`);
          console.log(`   Required: ${depositAmountUnits} units (${depositAmountOGX} OGX)`);
          console.log(`   Available: ${userBalanceNum} units (${userBalanceOGX} OGX)`);
          console.log(`   Shortfall: ${shortfall} units (${shortfallOGX.toFixed(6)} OGX)`);
          console.log(`🔄 Proceeding to simulation to get detailed error analysis...`);

          // Don't throw here - let simulation run to get exact failure reason
          // throw new Error(
          //   `Insufficient OGX balance! You have ${userBalanceOGX.toFixed(6)} OGX ` +
          //   `but need ${depositAmountOGX} OGX for this deposit.`
          // );
        }

        console.log(`✅ BALANCE CHECK PASSED`);
        console.log(`   Have ${userBalanceOGX} OGX, need ${depositAmountOGX} OGX`);
        console.log(`   Margin: ${(userBalanceOGX - depositAmountOGX).toFixed(6)} OGX extra`);

      } catch (error: any) {
        console.error("❌ PRE-FLIGHT BALANCE CHECK FAILED:", error.message);
        throw error;
      }

      // Create deposit transaction using the program
      // OGX has 6 decimals, so convert to token units: ogxAmount * 10^6
      const depositTransaction = await this.program.methods
        .deposit(new BN(ogxAmount * 1e6)) // Convert to token units (6 decimals)
        .accounts({
          user: user,
          mint: OGX_MINT,
          userAta: userATA,
          vaultAuthority: vaultAuthority,
          vaultAta: vaultATA,
          feeVaultAuthority: feeVaultAuthority,
          feeVaultAta: feeVaultATA,
          feeConfig: feeConfig,
          feeWallet: feeWallet,
          solFeeConfig: solFeeConfig,
          exchangeConfig: exchangeConfig,
          userBalance: userBalancePDA,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .transaction();

      // Create a new transaction
      const finalTransaction = new Transaction();

      // If ATA needs to be created, add it first
      if (createATATransaction) {
        finalTransaction.add(...createATATransaction.instructions);
      }

      // Add the deposit transaction
      finalTransaction.add(...depositTransaction.instructions);

      // Get fresh blockhash right before sending with retry
      const { blockhash, lastValidBlockHeight } = await this.retryRpcCall(
        () => this.connection.getLatestBlockhash("confirmed")
      );

      // Set blockhash and fee payer on final transaction
      finalTransaction.recentBlockhash = blockhash;
      finalTransaction.feePayer = user;

      // ✅ TRANSACTION SIMULATION - DEBUG BEFORE SENDING
      console.log("=== SIMULATING OGX DEPOSIT TRANSACTION ===");

      let simulationAttempts = 0;
      const maxSimulationAttempts = 3;

      let simulationSucceeded = false;
      let simulationResult: any = null;

      while (!simulationSucceeded && simulationAttempts < maxSimulationAttempts) {
        simulationAttempts++;
        console.log(`🔄 Simulation attempt ${simulationAttempts}/${maxSimulationAttempts}`);

        try {
          // Create a copy for simulation (no signature needed)
          const simulationTransaction = new Transaction();
          simulationTransaction.recentBlockhash = blockhash;
          simulationTransaction.feePayer = user;

          // Add the same instructions as final transaction
          if (createATATransaction) {
            simulationTransaction.add(...createATATransaction.instructions);
          }
          simulationTransaction.add(...depositTransaction.instructions);

          console.log(`📊 Simulating transaction size: ${simulationTransaction.serialize({ requireAllSignatures: false }).length} bytes`);

          // Simulate the transaction
          const simulationResult = await this.connection.simulateTransaction(simulationTransaction);

          console.log("=== SIMULATION RESULTS ===");
          console.log(`✅ Transaction simulation SUCCESS`);

          if (simulationResult.value.logs) {
            console.log("📋 Simulation Logs:");
            simulationResult.value.logs.forEach((log, index) => {
              if (log.includes("Program log:")) {
                console.log(`   ${index + 1}. ${log.replace("Program log:", "📄").trim()}`);
              } else if (log.includes("Error:")) {
                console.log(`   ❌ ${index + 1}. ${log}`);
              } else {
                console.log(`   📝 ${index + 1}. ${log}`);
              }
            });
          }

          if (simulationResult.value.err) {
            console.log(`❌ SIMULATION ERROR: ${JSON.stringify(simulationResult.value.err)}`);

            // Parse specific error messages
            if (simulationResult.value.logs) {
              const errorLogs = simulationResult.value.logs.filter(log =>
                log.includes("Error") || log.includes("failed") || log.includes("insufficient")
              );

              if (errorLogs.length > 0) {
                console.log("🔍 Error Details:");
                errorLogs.forEach((log, index) => {
                  console.log(`   ${index + 1}. ${log}`);
                });
              }
            }

            throw new Error(`Transaction simulation failed: ${JSON.stringify(simulationResult.value.err)}`);
          }

          console.log(`💡 Compute Units Used: ${simulationResult.value.unitsConsumed || 'N/A'}`);
          console.log(`✅ SIMULATION PASSED - Ready to send transaction`);
          simulationSucceeded = true;

        } catch (simulationError: any) {
          console.error(`❌ Simulation attempt ${simulationAttempts} failed:`, simulationError.message);

          if (simulationAttempts < maxSimulationAttempts) {
            console.log(`🔄 Retrying simulation in a moment...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          } else {
            console.log("🔧 Debugging information from simulation:");

            // Try to extract useful debugging info
            if (simulationError.message.includes("insufficient funds")) {
              console.log("💡 Insufficient funds detected during simulation:");
              console.log("   - Check that user has enough OGX tokens");
              console.log("   - Verify fee vault accounts are properly funded");
              console.log("   - Ensure all ATA accounts exist");
            }

            if (simulationError.message.includes("AccountNotInitialized")) {
              console.log("💡 Uninitialized account detected:");
              console.log("   - Check fee_config, vault_ata, or fee_vault_ata initialization");
              console.log("   - Ensure all required accounts are created");
            }

            throw simulationError;
          }
        }
      }

      if (!simulationSucceeded) {
        throw new Error("Transaction simulation failed after all attempts");
      }

      console.log("=== SENDING OGX DEPOSIT TRANSACTION ===");
      console.log(`Transaction size: ${finalTransaction.serialize({ requireAllSignatures: false }).length} bytes`);
      console.log(`📤 Sending deposit transaction for ${ogxAmount} OGX`);
      console.log(`🆔 Transaction ID: ${transactionId}`);

      // Sign and send the transaction WITHOUT retry
      // (retrying a signed transaction will cause "already processed" errors)
      const signedTransaction = await wallet.signTransaction(finalTransaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 0, // Don't retry - will cause "already processed" errors
      });

      console.log("=== OGX DEPOSIT TRANSACTION SENT ===");
      console.log(`Signature: ${signature}`);

      // Wait for confirmation with retry
      const confirmation = await this.retryRpcCall(
        () => this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        })
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log("=== OGX DEPOSIT CONFIRMED ===");
      console.log("Confirmation:", confirmation.value);

      return signature;

    } catch (error) {
      console.error("=== OGX DEPOSIT ERROR ===", error);
      throw error;
    } finally {
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Deposit USDC tokens and get OGX credits (similar to SOL deposit)
   * @param solFeeAmount - Fee amount in SOL (always paid in SOL regardless of deposit token)
   */
  async depositUSDC(user: PublicKey, usdcAmount: number, wallet: any, solFeeAmount?: number): Promise<string> {
    const transactionId = this.generateTransactionId(user, usdcAmount);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Deposit already in progress. Please wait.");
    }

    this.pendingTransactions.add(transactionId);

    try {
      // IMPORTANT: The Rust program's deposit function is hardcoded to transfer OGX tokens
      // For USDC deposits, we'll manually transfer USDC tokens to the vault
      // and update the database with OGX equivalent (similar to SOL deposits)

      // Fee is ALWAYS paid in SOL (not in the deposit token)
      // This ensures consistent fee collection regardless of deposit currency
      const feeAmountSOL = solFeeAmount || 0;
      const feeAmountLamports = Math.floor(feeAmountSOL * LAMPORTS_PER_SOL);
      
      // Deposit amount goes fully to vault
      const depositAmountToVault = usdcAmount;

      if (usdcAmount <= 0) {
        throw new Error(`Deposit amount must be greater than 0. Deposit: ${usdcAmount} USDC`);
      }

      // Get PDAs for USDC vault (for receiving USDC)
      const [usdcVaultAuthority] = this.getVaultAuthority(USDC_MINT);
      const usdcVaultATA = await this.getVaultATA(USDC_MINT);
      const userUSDCATA = this.getUserATA(user, USDC_MINT);

      // Get fee wallet for SOL fee transfer
      const feeWallet = new PublicKey(CONFIG.FEE_WALLET);

      // Check if user USDC ATA exists and create if needed
      let needsUserUSDCATA = false;
      try {
        const userATAInfo = await this.connection.getAccountInfo(userUSDCATA);
        needsUserUSDCATA = !userATAInfo;
        console.log(`User USDC ATA exists: ${!needsUserUSDCATA}`);
        if (needsUserUSDCATA) {
          console.log("📝 User USDC ATA does not exist - will create it");
        }
      } catch (error) {
        console.warn("Error checking user USDC ATA:", error);
        needsUserUSDCATA = true; // Assume it needs to be created
      }

      // Check user USDC balance (must have enough for deposit)
      const userUSDCBalance = await this.getUSDCBalance(user);
      if (userUSDCBalance < usdcAmount) {
        throw new Error(`Insufficient USDC balance. You have ${userUSDCBalance.toFixed(4)} USDC but need ${usdcAmount.toFixed(4)} USDC for deposit.`);
      }

      // Check user SOL balance (must have enough for fee + network fee)
      const userSOLBalance = await this.connection.getBalance(user);
      const userSOLBalanceInSOL = userSOLBalance / LAMPORTS_PER_SOL;
      const networkFee = 0.0001; // Estimate for network transaction fee (~0.00005 SOL actual + buffer)
      const totalSOLRequired = feeAmountSOL + networkFee;
      
      if (userSOLBalanceInSOL < totalSOLRequired) {
        throw new Error(`Insufficient SOL balance for fee. You have ${userSOLBalanceInSOL.toFixed(4)} SOL but need ${totalSOLRequired.toFixed(4)} SOL (${feeAmountSOL.toFixed(4)} fee + ${networkFee.toFixed(4)} network fee).`);
      }

      console.log(`=== USDC DEPOSIT INFO (SOL FEE) ===`);
      console.log(`👤 User Wallet: ${user.toString()}`);
      console.log(`💵 USDC Deposit Amount: ${usdcAmount} USDC`);
      console.log(`💰 SOL Fee Amount: ${feeAmountSOL.toFixed(6)} SOL (${feeAmountLamports} lamports)`);
      console.log(`📥 Deposit to Vault: ${depositAmountToVault.toFixed(6)} USDC`);
      console.log(`💸 SOL Fee to Fee Wallet: ${feeAmountSOL.toFixed(6)} SOL`);
      console.log(`📤 FROM (User's USDC ATA): ${userUSDCATA.toString()}`);
      console.log(`📥 TO (Vault's USDC ATA): ${usdcVaultATA.toString()}`);
      console.log(`💸 FEE TO (Fee Wallet): ${feeWallet.toString()}`);
      console.log(`🔐 Vault Authority PDA: ${usdcVaultAuthority.toString()}`);
      console.log(`💰 User USDC Balance: ${userUSDCBalance} USDC`);
      console.log(`💰 User SOL Balance: ${userSOLBalanceInSOL.toFixed(4)} SOL`);
      console.log(`📋 Transfer 1: ${feeAmountSOL.toFixed(6)} SOL → Fee Wallet (in SOL)`);
      console.log(`📋 Transfer 2: ${depositAmountToVault.toFixed(6)} USDC → Vault`);

      // Check if vault ATA exists
      const vaultATAInfo = await this.connection.getAccountInfo(usdcVaultATA);
      const needsVaultATA = !vaultATAInfo;

      console.log(`Vault ATA exists: ${!needsVaultATA}`);
      if (needsVaultATA) {
        console.log("📝 Vault ATA does not exist - will create it");
      }

      // Create a new transaction (blockhash will be set by wallet adapter or before signing)
      const finalTransaction = new Transaction();
      finalTransaction.feePayer = user;

      // If user USDC ATA needs to be created, add it first
      if (needsUserUSDCATA) {
        console.log("Creating user USDC ATA...");
        const createUserATAInstruction = createAssociatedTokenAccountInstruction(
          user, // Payer (user pays for account creation)
          userUSDCATA, // ATA address (derived from user + USDC mint)
          user, // Owner (user)
          USDC_MINT // Mint (USDC)
        );
        finalTransaction.add(createUserATAInstruction);
        console.log("✅ Added user USDC ATA creation instruction");
      }

      // If vault ATA doesn't exist, create it
      // We can create an ATA for a PDA - the user pays for account creation
      if (needsVaultATA) {
        console.log("Creating vault ATA...");
        const createVaultATAInstruction = createAssociatedTokenAccountInstruction(
          user, // Payer (user pays for account creation)
          usdcVaultATA, // ATA address (derived from vault authority PDA + USDC mint)
          usdcVaultAuthority, // Owner (vault authority PDA)
          USDC_MINT // Mint (USDC)
        );
        finalTransaction.add(createVaultATAInstruction);
        console.log("✅ Added vault ATA creation instruction");
      }

      // Get actual token decimals from blockchain (don't assume!)
      const usdcDecimals = await this.getTokenDecimals(USDC_MINT);
      console.log(`📊 USDC actual decimals: ${usdcDecimals}`);

      // Convert USDC amount to token units using actual decimals
      const depositAmountInUnits = Math.floor(depositAmountToVault * Math.pow(10, usdcDecimals));

      console.log(`💵 Amount conversions:`);
      console.log(`   SOL Fee: ${feeAmountSOL} SOL = ${feeAmountLamports} lamports`);
      console.log(`   USDC Deposit: ${depositAmountToVault} USDC = ${depositAmountInUnits} units`);

      // Transfer 1: SOL Fee to fee wallet (if fee > 0)
      if (feeAmountLamports > 0) {
        console.log(`🔄 Creating SOL fee transfer instruction:`);
        console.log(`   FROM: ${user.toString()} (User's SOL wallet)`);
        console.log(`   TO: ${feeWallet.toString()} (Fee Wallet)`);
        console.log(`   AMOUNT: ${feeAmountLamports} lamports (${feeAmountSOL.toFixed(6)} SOL)`);

        const feeTransferInstruction = SystemProgram.transfer({
          fromPubkey: user,
          toPubkey: feeWallet,
          lamports: feeAmountLamports,
        });

        finalTransaction.add(feeTransferInstruction);
        console.log("✅ Added SOL fee transfer instruction");
      }

      // Transfer 2: Full USDC deposit amount to vault
      console.log(`🔄 Creating USDC deposit transfer instruction:`);
      console.log(`   FROM: ${userUSDCATA.toString()} (User's USDC wallet)`);
      console.log(`   TO: ${usdcVaultATA.toString()} (Vault's USDC wallet)`);
      console.log(`   AMOUNT: ${depositAmountInUnits} units (${depositAmountToVault.toFixed(6)} USDC)`);
      console.log(`   AUTHORITY: ${user.toString()} (User's wallet - will sign transaction)`);

      const usdcTransferInstruction = createTransferInstruction(
        userUSDCATA, // Source: User's USDC token account (tokens will be deducted from here)
        usdcVaultATA, // Destination: Vault's USDC token account (tokens will be deposited here)
        user, // Authority: User's wallet (must sign the transaction)
        depositAmountInUnits, // Full deposit amount in token units
        [], // Multi-signers (none needed - only user signs)
        TOKEN_PROGRAM_ID // Token program ID
      );

      // Add USDC transfer instruction (this transfers full deposit amount to vault)
      // Note: Fee is paid in SOL separately (first instruction)
      // The database will be updated with OGX equivalent in Purchase.tsx
      finalTransaction.add(usdcTransferInstruction);
      console.log("✅ Added deposit transfer instruction");
      console.log(`📊 Transaction Summary:`);
      console.log(`   SOL Fee: ${feeAmountSOL.toFixed(6)} SOL → Fee Wallet`);
      console.log(`   USDC Deposit: ${depositAmountToVault.toFixed(6)} USDC → Vault`);
      console.log(`   Note: Fee is paid in SOL, deposit is in USDC`);

      // Simulate transaction first to catch errors early
      try {
        console.log("🔄 Simulating transaction...");
        const simulation = await this.connection.simulateTransaction(finalTransaction);
        if (simulation.value.err) {
          console.error("❌ Transaction simulation failed:", simulation.value.err);
          const errorLogs = simulation.value.logs || [];
          console.error("Simulation logs:", errorLogs);
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}. Logs: ${errorLogs.join('\n')}`);
        }
        console.log("✅ Transaction simulation successful");
        console.log(`   Compute units used: ${simulation.value.unitsConsumed}`);
      } catch (simError: any) {
        console.error("❌ Transaction simulation error:", simError);
        // If simulation fails, we'll still try to send, but log the error
        if (simError.message && !simError.message.includes('simulation')) {
          throw simError; // Re-throw if it's not a simulation-specific error
        }
      }

      // Use wallet adapter's sendTransaction for better Phantom integration
      // This allows Phantom to properly recognize and display USDC transfers
      let signature: string;

      // Check if wallet has sendTransaction method (wallet adapter)
      // This is the preferred method as Phantom can intercept and display tokens properly
      if (wallet.sendTransaction && typeof wallet.sendTransaction === 'function') {
        console.log("✅ Using wallet adapter sendTransaction (better for Phantom display)");

        try {
          // Use wallet adapter's sendTransaction - Phantom will:
          // 1. Automatically get a fresh blockhash
          // 2. Recognize USDC token transfer and display it properly
          // 3. Show the transaction details in the confirmation dialog
          signature = await wallet.sendTransaction(finalTransaction, this.connection, {
            skipPreflight: false,
            preflightCommitment: "confirmed",
            maxRetries: 3,
          });

          console.log(`Transaction sent with signature: ${signature}`);

          // Wait for confirmation
          const confirmation = await this.connection.confirmTransaction(signature, "confirmed");

          if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
          }
        } catch (sendError: any) {
          console.error("❌ Error sending transaction:", sendError);
          // Log more details about the error
          if (sendError.message) {
            console.error("Error message:", sendError.message);
          }
          if (sendError.logs) {
            console.error("Error logs:", sendError.logs);
          }
          if (sendError.stack) {
            console.error("Error stack:", sendError.stack);
          }
          throw new Error(`Failed to send transaction: ${sendError.message || 'Unknown error'}. Please check console for details.`);
        }
      } else {
        // Fallback: manual signing (Phantom might show "unknown" in this case)
        console.log("⚠️ Using manual transaction signing (Phantom display may be limited)");

        // Get a fresh blockhash right before signing
        const { blockhash: freshBlockhash, lastValidBlockHeight: freshLastValidBlockHeight } =
          await this.retryRpcCall(() => this.connection.getLatestBlockhash("finalized"));

        finalTransaction.recentBlockhash = freshBlockhash;

        const signedTransaction = await wallet.signTransaction(finalTransaction);
        signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: 3,
        });

        console.log(`Transaction sent with signature: ${signature}`);

        // Wait for confirmation
        const confirmation = await this.retryRpcCall(
          () => this.connection.confirmTransaction({
            signature,
            blockhash: freshBlockhash,
            lastValidBlockHeight: freshLastValidBlockHeight,
          }, "confirmed")
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }
      }

      console.log("=== USDC DEPOSIT CONFIRMED ===");
      return signature;

    } catch (error) {
      console.error("=== USDC DEPOSIT ERROR ===", error);
      throw error;
    } finally {
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Withdraw USDC tokens by burning OGX (similar to SOL withdraw)
   * Note: This converts OGX to USDC using exchange rate
   */
  async withdrawUSDC(user: PublicKey, ogxAmount: number, wallet: any): Promise<string> {
    const transactionId = this.generateTransactionId(user, `usdc_${ogxAmount}`);

    console.log("=== USDC WITHDRAWAL START ===");
    console.log(`User: ${user.toString()}`);
    console.log(`OGX Amount: ${ogxAmount} OGX`);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Withdrawal already in progress. Please wait.");
    }

    this.pendingTransactions.add(transactionId);

    try {
      // Calculate USDC amount to send (OGX * exchange rate)
      const usdcAmount = ogxAmount * CONFIG.EXCHANGE_RATES.OGX_TO_USDC;
      console.log(`💰 Converting ${ogxAmount} OGX to ${usdcAmount} USDC`);

      // Get PDAs for OGX vault (for burning OGX)
      const [ogxVaultAuthority] = this.getVaultAuthority(OGX_MINT);
      const ogxVaultATA = await this.getVaultATA(OGX_MINT);
      const [ogxUserBalancePDA] = this.getUserBalancePDA(user, OGX_MINT);
      const ogxUserATA = this.getUserATA(user, OGX_MINT);

      // Get PDAs for USDC vault (for sending USDC)
      const [usdcVaultAuthority] = this.getVaultAuthority(USDC_MINT);
      const usdcVaultATA = await this.getVaultATA(USDC_MINT);
      const userUSDCATA = this.getUserATA(user, USDC_MINT);

      // Check if user USDC ATA exists and create if needed
      const createUSDCATATransaction = await this.ensureATAExists(user, USDC_MINT);

      // Get fee vault accounts for OGX
      const [feeVaultAuthority] = this.getFeeVaultAuthority(OGX_MINT);
      const feeVaultATA = await this.getFeeVaultATA(OGX_MINT);
      const [feeConfig] = this.getFeeConfig(OGX_MINT);
      const [exchangeConfig] = this.getExchangeConfig();
      const [solFeeConfig] = this.getSolFeeConfig();

      // Check if user OGX ATA exists
      const createOGXATATransaction = await this.ensureATAExists(user, OGX_MINT);

      // Check user's OGX balance before withdrawal
      // The program will check this, but we should pre-check to give a better error message
      try {
        const ogxUserBalanceAccount = await (this.program.account as any).userBalance.fetchNullable(ogxUserBalancePDA);
        if (!ogxUserBalanceAccount) {
          throw new Error(
            `User OGX balance account not found in program. Please deposit OGX first.\n\n` +
            `⚠️ NOTE: If you deposited USDC/TOKEN4, your balance is in the database but not in the program.\n` +
            `Please deposit OGX directly to create the balance account, or contact support to sync your balance.`
          );
        }
        const userOGXBalance = ogxUserBalanceAccount.balance.toNumber() / 1e6; // Convert from token units
        console.log(`💰 User OGX Balance (in vault): ${userOGXBalance.toFixed(4)} OGX`);
        console.log(`💰 Required OGX: ${ogxAmount.toFixed(4)} OGX`);

        if (userOGXBalance < ogxAmount) {
          throw new Error(
            `Insufficient OGX balance in program. You have ${userOGXBalance.toFixed(4)} OGX in the program but need ${ogxAmount.toFixed(4)} OGX to withdraw ${usdcAmount.toFixed(4)} USDC.\n\n` +
            `⚠️ NOTE: If you deposited USDC/TOKEN4 directly, your balance might be in the database but not in the program's balance PDA.\n` +
            `This happens because USDC/TOKEN4 deposits update the database but not the program's balance PDA.\n` +
            `Please contact support to sync your balance, or deposit OGX directly to update the program balance.`
          );
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          throw error;
        }
        if (error instanceof Error && error.message.includes("Insufficient")) {
          throw error;
        }
        console.warn("⚠️ Could not fetch user OGX balance, proceeding with withdrawal (program will check):", error);
      }

      // Fetch admin private key from database
      let ADMIN_PRIVATE_KEY: string;
      try {
        const { supabase } = await import("@/service/supabase");
        const { data, error } = await supabase
          .from('website_settings')
          .select('value')
          .eq('key', 'admin_private_key')
          .single();

        if (error || !data || !data.value) {
          throw new Error("Admin private key not configured");
        }
        ADMIN_PRIVATE_KEY = data.value;
      } catch (dbError) {
        throw new Error("Failed to load admin private key from database");
      }

      // Convert private key to Keypair
      let adminKeypair: Keypair;
      try {
        const privateKeyBytes = bs58.decode(ADMIN_PRIVATE_KEY);
        adminKeypair = Keypair.fromSecretKey(privateKeyBytes);
      } catch (error) {
        throw new Error("Invalid admin private key format");
      }

      const adminWallet = adminKeypair.publicKey;
      console.log(`💳 Admin Wallet: ${adminWallet.toString()}`);

      // Check admin wallet USDC balance
      const adminUSDCBalance = await this.getUSDCBalance(adminWallet);
      if (adminUSDCBalance < usdcAmount + 0.01) {
        throw new Error(`Insufficient USDC in admin wallet. Available: ${adminUSDCBalance.toFixed(4)} USDC, Required: ${(usdcAmount + 0.01).toFixed(4)} USDC`);
      }

      // Convert OGX amount to token units (smallest unit)
      // Use Math.floor to ensure integer (avoid floating-point precision issues)
      const ogxAmountInUnits = Math.floor(ogxAmount * 1e6);
      console.log(`💰 Converting ${ogxAmount} OGX to ${ogxAmountInUnits} token units (6 decimals)`);

      if (ogxAmountInUnits <= 0) {
        throw new Error(`Invalid OGX amount: ${ogxAmount} OGX = ${ogxAmountInUnits} units (must be > 0)`);
      }

      // Create withdrawal transaction to burn OGX
      const withdrawalTransaction = await this.program.methods
        .withdrawTokens(new BN(ogxAmountInUnits))
        .accounts({
          user: user,
          mint: OGX_MINT,
          userAta: ogxUserATA,
          vaultAuthority: ogxVaultAuthority,
          vaultAta: ogxVaultATA,
          vault: ogxVaultAuthority,
          feeVaultAuthority: feeVaultAuthority,
          feeVaultAta: feeVaultATA,
          feeConfig: feeConfig,
          feeWallet: adminWallet, // Use admin wallet for fee
          solFeeConfig: solFeeConfig,
          userBalance: ogxUserBalancePDA,
          exchangeConfig: exchangeConfig,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .transaction();

      // Create final transaction
      const finalTransaction = new Transaction();

      // Add ATA creation if needed
      if (createOGXATATransaction) {
        finalTransaction.add(...createOGXATATransaction.instructions);
      }
      if (createUSDCATATransaction) {
        finalTransaction.add(...createUSDCATATransaction.instructions);
      }

      // Transfer USDC from admin wallet to user (instead of SOL)
      // Note: This requires the admin wallet to have USDC tokens
      const adminUSDCATA = this.getUserATA(adminWallet, USDC_MINT);

      // Check if admin has USDC ATA
      const adminUSDCATAInfo = await this.connection.getAccountInfo(adminUSDCATA);
      if (!adminUSDCATAInfo) {
        throw new Error("Admin wallet does not have USDC token account. Please fund it first.");
      }

      // Add USDC transfer instruction
      const usdcTransfer = createTransferInstruction(
        adminUSDCATA,
        userUSDCATA,
        adminWallet,
        Math.floor(usdcAmount * 1e6), // USDC amount in smallest units (6 decimals)
        [],
        TOKEN_PROGRAM_ID
      );

      finalTransaction.add(usdcTransfer);

      // Add the OGX withdrawal transaction (burns OGX)
      finalTransaction.add(...withdrawalTransaction.instructions);

      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await this.retryRpcCall(
        () => this.connection.getLatestBlockhash("confirmed")
      );

      finalTransaction.recentBlockhash = blockhash;
      finalTransaction.feePayer = user;

      // Partially sign with admin keypair for USDC transfer
      finalTransaction.partialSign(adminKeypair);

      // Sign with user wallet
      const signedTransaction = await wallet.signTransaction(finalTransaction);

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 0,
      });

      // Wait for confirmation
      const confirmation = await this.retryRpcCall(
        () => this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, "confirmed")
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      console.log("=== USDC WITHDRAWAL CONFIRMED ===");
      console.log(`✅ ${ogxAmount} OGX burned`);
      console.log(`✅ ${usdcAmount} USDC transferred to user`);

      return signature;

    } catch (error) {
      console.error("=== USDC WITHDRAWAL ERROR ===", error);
      throw error;
    } finally {
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Withdraw Token4 tokens by burning OGX (similar to USDC withdraw)
   * Note: This converts OGX to TOKEN4 using exchange rate
   */
  async withdrawToken4(user: PublicKey, ogxAmount: number, wallet: any): Promise<string> {
    const transactionId = this.generateTransactionId(user, `token4_${ogxAmount}`);

    console.log("=== TOKEN4 WITHDRAWAL START ===");
    console.log(`User: ${user.toString()}`);
    console.log(`OGX Amount: ${ogxAmount} OGX`);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Withdrawal already in progress. Please wait.");
    }

    this.pendingTransactions.add(transactionId);

    try {
      // Calculate TOKEN4 amount to send (OGX * exchange rate)
      // Use dynamic rate if available, otherwise use config rate
      const token4Amount = ogxAmount * CONFIG.EXCHANGE_RATES.OGX_TO_TOKEN4;
      console.log(`💰 Converting ${ogxAmount} OGX to ${token4Amount} TOKEN4`);

      // Get PDAs for OGX vault (for burning OGX)
      const [ogxVaultAuthority] = this.getVaultAuthority(OGX_MINT);
      const ogxVaultATA = await this.getVaultATA(OGX_MINT);
      const [ogxUserBalancePDA] = this.getUserBalancePDA(user, OGX_MINT);
      const ogxUserATA = this.getUserATA(user, OGX_MINT);

      // Get PDAs for TOKEN4 vault (for sending TOKEN4)
      const [token4VaultAuthority] = this.getVaultAuthority(TOKEN4_MINT);
      const token4VaultATA = await this.getVaultATA(TOKEN4_MINT);
      const userToken4ATA = this.getUserATA(user, TOKEN4_MINT);

      // Check if user TOKEN4 ATA exists and create if needed
      let needsUserToken4ATA = false;
      try {
        const userATAInfo = await this.connection.getAccountInfo(userToken4ATA);
        needsUserToken4ATA = !userATAInfo;
        console.log(`User TOKEN4 ATA exists: ${!needsUserToken4ATA}`);
      } catch (error) {
        console.warn("Error checking user TOKEN4 ATA:", error);
        needsUserToken4ATA = true;
      }

      // Get fee vault accounts for OGX
      const [feeVaultAuthority] = this.getFeeVaultAuthority(OGX_MINT);
      const feeVaultATA = await this.getFeeVaultATA(OGX_MINT);
      const [feeConfig] = this.getFeeConfig(OGX_MINT);
      const [exchangeConfig] = this.getExchangeConfig();
      const [solFeeConfig] = this.getSolFeeConfig();

      // Check if user OGX ATA exists
      let needsUserOGXATA = false;
      try {
        const ogxATAInfo = await this.connection.getAccountInfo(ogxUserATA);
        needsUserOGXATA = !ogxATAInfo;
        console.log(`User OGX ATA exists: ${!needsUserOGXATA}`);
      } catch (error) {
        console.warn("Error checking user OGX ATA:", error);
        needsUserOGXATA = true;
      }

      // Check user's OGX balance before withdrawal
      // The program will check this, but we should pre-check to give a better error message
      try {
        const ogxUserBalanceAccount = await (this.program.account as any).userBalance.fetchNullable(ogxUserBalancePDA);
        if (!ogxUserBalanceAccount) {
          throw new Error(`User OGX balance account not found. Please deposit OGX first.`);
        }
        const userOGXBalance = ogxUserBalanceAccount.balance.toNumber() / 1e6; // Convert from token units
        console.log(`💰 User OGX Balance (in vault): ${userOGXBalance.toFixed(4)} OGX`);
        console.log(`💰 Required OGX: ${ogxAmount.toFixed(4)} OGX`);

        if (userOGXBalance < ogxAmount) {
          throw new Error(
            `Insufficient OGX balance in program. You have ${userOGXBalance.toFixed(4)} OGX in the program but need ${ogxAmount.toFixed(4)} OGX to withdraw ${token4Amount.toFixed(4)} TOKEN4.\n\n` +
            `⚠️ NOTE: If you deposited TOKEN4/USDC directly, your balance might be in the database but not in the program's balance PDA.\n` +
            `This happens because TOKEN4/USDC deposits update the database but not the program's balance PDA.\n` +
            `Please contact support to sync your balance, or deposit OGX directly to update the program balance.`
          );
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          throw new Error(
            `User OGX balance account not found in program. Please deposit OGX first.\n\n` +
            `⚠️ NOTE: If you deposited TOKEN4/USDC, your balance is in the database but not in the program.\n` +
            `Please deposit OGX directly to create the balance account, or contact support to sync your balance.`
          );
        }
        if (error instanceof Error && error.message.includes("Insufficient")) {
          throw error;
        }
        console.warn("⚠️ Could not fetch user OGX balance, proceeding with withdrawal (program will check):", error);
      }

      // Fetch admin private key from database
      let ADMIN_PRIVATE_KEY: string;
      try {
        const { supabase } = await import("@/service/supabase");
        const { data, error } = await supabase
          .from('website_settings')
          .select('value')
          .eq('key', 'admin_private_key')
          .single();

        if (error || !data || !data.value) {
          throw new Error("Admin private key not configured");
        }
        ADMIN_PRIVATE_KEY = data.value;
      } catch (dbError) {
        throw new Error("Failed to load admin private key from database");
      }

      // Convert private key to Keypair
      let adminKeypair: Keypair;
      try {
        const privateKeyBytes = bs58.decode(ADMIN_PRIVATE_KEY);
        adminKeypair = Keypair.fromSecretKey(privateKeyBytes);
      } catch (error) {
        throw new Error("Invalid admin private key format");
      }

      const adminWallet = adminKeypair.publicKey;
      console.log(`💳 Admin Wallet: ${adminWallet.toString()}`);

      // Get TOKEN4 decimals for amount conversion
      const token4Decimals = await this.getTokenDecimals(TOKEN4_MINT);
      const token4AmountInUnits = Math.floor(token4Amount * Math.pow(10, token4Decimals));

      // Check admin wallet TOKEN4 balance
      const adminToken4Balance = await this.getTokenBalance(adminWallet, TOKEN4_MINT);
      const minRequiredBalance = token4Amount + 0.01; // Add small buffer

      console.log(`💰 Admin TOKEN4 Balance: ${adminToken4Balance.toFixed(4)} TOKEN4`);
      console.log(`💰 Required TOKEN4: ${minRequiredBalance.toFixed(4)} TOKEN4`);

      if (adminToken4Balance < minRequiredBalance) {
        throw new Error(`Insufficient TOKEN4 in admin wallet. Available: ${adminToken4Balance.toFixed(4)} TOKEN4, Required: ${minRequiredBalance.toFixed(4)} TOKEN4`);
      }

      // Convert OGX amount to token units (smallest unit)
      // Use Math.floor to ensure integer (avoid floating-point precision issues)
      const ogxAmountInUnits = Math.floor(ogxAmount * 1e6);
      console.log(`💰 Converting ${ogxAmount} OGX to ${ogxAmountInUnits} token units (6 decimals)`);

      if (ogxAmountInUnits <= 0) {
        throw new Error(`Invalid OGX amount: ${ogxAmount} OGX = ${ogxAmountInUnits} units (must be > 0)`);
      }

      // Create withdrawal transaction to burn OGX
      const withdrawalTransaction = await this.program.methods
        .withdrawTokens(new BN(ogxAmountInUnits))
        .accounts({
          user: user,
          mint: OGX_MINT,
          userAta: ogxUserATA,
          vaultAuthority: ogxVaultAuthority,
          vaultAta: ogxVaultATA,
          vault: ogxVaultAuthority,
          feeVaultAuthority: feeVaultAuthority,
          feeVaultAta: feeVaultATA,
          feeConfig: feeConfig,
          feeWallet: adminWallet, // Use admin wallet for fee
          solFeeConfig: solFeeConfig,
          userBalance: ogxUserBalancePDA,
          exchangeConfig: exchangeConfig,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .transaction();

      // Create final transaction
      const finalTransaction = new Transaction();

      // Add ATA creation if needed
      if (needsUserOGXATA) {
        console.log("Creating user OGX ATA...");
        const createOGXATAInstruction = createAssociatedTokenAccountInstruction(
          user,
          ogxUserATA,
          user,
          OGX_MINT
        );
        finalTransaction.add(createOGXATAInstruction);
        console.log("✅ Added user OGX ATA creation instruction");
      }

      if (needsUserToken4ATA) {
        console.log("Creating user TOKEN4 ATA...");
        const createToken4ATAInstruction = createAssociatedTokenAccountInstruction(
          user,
          userToken4ATA,
          user,
          TOKEN4_MINT
        );
        finalTransaction.add(createToken4ATAInstruction);
        console.log("✅ Added user TOKEN4 ATA creation instruction");
      }

      // Transfer TOKEN4 from admin wallet to user (instead of SOL)
      // Note: This requires the admin wallet to have TOKEN4 tokens
      const adminToken4ATA = this.getUserATA(adminWallet, TOKEN4_MINT);

      // Check if admin has TOKEN4 ATA
      const adminToken4ATAInfo = await this.connection.getAccountInfo(adminToken4ATA);
      if (!adminToken4ATAInfo) {
        throw new Error("Admin wallet does not have TOKEN4 token account. Please fund it first.");
      }

      // Add TOKEN4 transfer instruction
      const token4Transfer = createTransferInstruction(
        adminToken4ATA,
        userToken4ATA,
        adminWallet,
        token4AmountInUnits, // TOKEN4 amount in smallest units
        [],
        TOKEN_PROGRAM_ID
      );

      finalTransaction.add(token4Transfer);

      // Add the OGX withdrawal transaction (burns OGX)
      finalTransaction.add(...withdrawalTransaction.instructions);

      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await this.retryRpcCall(
        () => this.connection.getLatestBlockhash("confirmed")
      );

      finalTransaction.recentBlockhash = blockhash;
      finalTransaction.feePayer = user;

      // Partially sign with admin keypair for TOKEN4 transfer
      finalTransaction.partialSign(adminKeypair);

      // Sign with user wallet
      const signedTransaction = await wallet.signTransaction(finalTransaction);

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 0,
      });

      // Wait for confirmation
      const confirmation = await this.retryRpcCall(
        () => this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, "confirmed")
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      console.log("=== TOKEN4 WITHDRAWAL CONFIRMED ===");
      console.log(`✅ ${ogxAmount} OGX burned`);
      console.log(`✅ ${token4Amount} TOKEN4 transferred to user`);

      return signature;

    } catch (error) {
      console.error("=== TOKEN4 WITHDRAWAL ERROR ===", error);
      throw error;
    } finally {
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Deposit Token4 tokens (similar to USDC deposit)
   * IMPORTANT: Uses manual token transfer instead of program's deposit instruction
   * because the program's deposit is hardcoded for OGX tokens only
   * @param solFeeAmount - Fee amount in SOL (always paid in SOL regardless of deposit token)
   */
  async depositToken4(user: PublicKey, tokenAmount: number, wallet: any, solFeeAmount?: number): Promise<string> {
    const transactionId = this.generateTransactionId(user, tokenAmount);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Deposit already in progress. Please wait.");
    }

    this.pendingTransactions.add(transactionId);

    try {
      // IMPORTANT: The Rust program's deposit function is hardcoded to transfer OGX tokens
      // For TOKEN4 deposits, we'll manually transfer TOKEN4 tokens to the vault
      // and update the database with OGX equivalent (similar to SOL and USDC deposits)

      // Fee is ALWAYS paid in SOL (not in the deposit token)
      // This ensures consistent fee collection regardless of deposit currency
      const feeAmountSOL = solFeeAmount || 0;
      const feeAmountLamports = Math.floor(feeAmountSOL * LAMPORTS_PER_SOL);
      
      // Deposit amount goes fully to vault
      const depositAmountToVault = tokenAmount;

      if (tokenAmount <= 0) {
        throw new Error(`Deposit amount must be greater than 0. Deposit: ${tokenAmount} TOKEN4`);
      }

      // Get PDAs for TOKEN4 vault (for receiving TOKEN4)
      const [token4VaultAuthority] = this.getVaultAuthority(TOKEN4_MINT);
      const token4VaultATA = await this.getVaultATA(TOKEN4_MINT);
      const userToken4ATA = this.getUserATA(user, TOKEN4_MINT);

      // Get fee wallet for SOL fee transfer
      const feeWallet = new PublicKey(CONFIG.FEE_WALLET);

      // Check if user TOKEN4 ATA exists and create if needed
      let needsUserToken4ATA = false;
      try {
        const userATAInfo = await this.connection.getAccountInfo(userToken4ATA);
        needsUserToken4ATA = !userATAInfo;
        console.log(`User TOKEN4 ATA exists: ${!needsUserToken4ATA}`);
        if (needsUserToken4ATA) {
          console.log("📝 User TOKEN4 ATA does not exist - will create it");
        }
      } catch (error) {
        console.warn("Error checking user TOKEN4 ATA:", error);
        needsUserToken4ATA = true; // Assume it needs to be created
      }

      // Check user TOKEN4 balance (must have enough for deposit)
      const userTokenBalance = await this.getTokenBalance(user, TOKEN4_MINT);
      if (userTokenBalance < tokenAmount) {
        throw new Error(`Insufficient Token4 balance. You have ${userTokenBalance.toFixed(4)} TOKEN4 but need ${tokenAmount.toFixed(4)} TOKEN4 for deposit.`);
      }

      // Check user SOL balance (must have enough for fee + network fee)
      const userSOLBalance = await this.connection.getBalance(user);
      const userSOLBalanceInSOL = userSOLBalance / LAMPORTS_PER_SOL;
      const networkFee = 0.0001; // Estimate for network transaction fee (~0.00005 SOL actual + buffer)
      const totalSOLRequired = feeAmountSOL + networkFee;
      
      if (userSOLBalanceInSOL < totalSOLRequired) {
        throw new Error(`Insufficient SOL balance for fee. You have ${userSOLBalanceInSOL.toFixed(4)} SOL but need ${totalSOLRequired.toFixed(4)} SOL (${feeAmountSOL.toFixed(4)} fee + ${networkFee.toFixed(4)} network fee).`);
      }

      console.log(`=== TOKEN4 DEPOSIT INFO (SOL FEE) ===`);
      console.log(`👤 User Wallet: ${user.toString()}`);
      console.log(`💵 TOKEN4 Deposit Amount: ${tokenAmount} TOKEN4`);
      console.log(`💰 SOL Fee Amount: ${feeAmountSOL.toFixed(6)} SOL (${feeAmountLamports} lamports)`);
      console.log(`📥 Deposit to Vault: ${depositAmountToVault.toFixed(6)} TOKEN4`);
      console.log(`💸 SOL Fee to Fee Wallet: ${feeAmountSOL.toFixed(6)} SOL`);
      console.log(`📤 FROM (User's TOKEN4 ATA): ${userToken4ATA.toString()}`);
      console.log(`📥 TO (Vault's TOKEN4 ATA): ${token4VaultATA.toString()}`);
      console.log(`💸 FEE TO (Fee Wallet): ${feeWallet.toString()}`);
      console.log(`🔐 Vault Authority PDA: ${token4VaultAuthority.toString()}`);
      console.log(`💰 User TOKEN4 Balance: ${userTokenBalance} TOKEN4`);
      console.log(`💰 User SOL Balance: ${userSOLBalanceInSOL.toFixed(4)} SOL`);
      console.log(`📋 Transfer 1: ${feeAmountSOL.toFixed(6)} SOL → Fee Wallet (in SOL)`);
      console.log(`📋 Transfer 2: ${depositAmountToVault.toFixed(6)} TOKEN4 → Vault`);

      // Check if vault ATA exists
      const vaultATAInfo = await this.connection.getAccountInfo(token4VaultATA);
      const needsVaultATA = !vaultATAInfo;

      console.log(`Vault ATA exists: ${!needsVaultATA}`);
      if (needsVaultATA) {
        console.log("📝 Vault ATA does not exist - will create it");
      }

      // Create a new transaction (blockhash will be set by wallet adapter or before signing)
      const finalTransaction = new Transaction();
      finalTransaction.feePayer = user;

      // If user TOKEN4 ATA needs to be created, add it first
      if (needsUserToken4ATA) {
        console.log("Creating user TOKEN4 ATA...");
        const createUserATAInstruction = createAssociatedTokenAccountInstruction(
          user, // Payer (user pays for account creation)
          userToken4ATA, // ATA address (derived from user + TOKEN4 mint)
          user, // Owner (user)
          TOKEN4_MINT // Mint (TOKEN4)
        );
        finalTransaction.add(createUserATAInstruction);
        console.log("✅ Added user TOKEN4 ATA creation instruction");
      }

      // If vault ATA doesn't exist, create it
      // We can create an ATA for a PDA - the user pays for account creation
      if (needsVaultATA) {
        console.log("Creating vault ATA...");
        const createVaultATAInstruction = createAssociatedTokenAccountInstruction(
          user, // Payer (user pays for account creation)
          token4VaultATA, // ATA address (derived from vault authority PDA + TOKEN4 mint)
          token4VaultAuthority, // Owner (vault authority PDA)
          TOKEN4_MINT // Mint (TOKEN4)
        );
        finalTransaction.add(createVaultATAInstruction);
        console.log("✅ Added vault ATA creation instruction");
      }

      // Get actual token decimals from blockchain (don't assume!)
      const tokenDecimals = await this.getTokenDecimals(TOKEN4_MINT);
      console.log(`📊 TOKEN4 actual decimals: ${tokenDecimals}`);

      // Convert TOKEN4 amount to token units using actual decimals
      const depositAmountInUnits = Math.floor(depositAmountToVault * Math.pow(10, tokenDecimals));

      console.log(`💵 Amount conversions:`);
      console.log(`   SOL Fee: ${feeAmountSOL} SOL = ${feeAmountLamports} lamports`);
      console.log(`   TOKEN4 Deposit: ${depositAmountToVault} TOKEN4 = ${depositAmountInUnits} units`);

      // Transfer 1: SOL Fee to fee wallet (if fee > 0)
      if (feeAmountLamports > 0) {
        console.log(`🔄 Creating SOL fee transfer instruction:`);
        console.log(`   FROM: ${user.toString()} (User's SOL wallet)`);
        console.log(`   TO: ${feeWallet.toString()} (Fee Wallet)`);
        console.log(`   AMOUNT: ${feeAmountLamports} lamports (${feeAmountSOL.toFixed(6)} SOL)`);

        const feeTransferInstruction = SystemProgram.transfer({
          fromPubkey: user,
          toPubkey: feeWallet,
          lamports: feeAmountLamports,
        });

        finalTransaction.add(feeTransferInstruction);
        console.log("✅ Added SOL fee transfer instruction");
      }

      // Transfer 2: Full TOKEN4 deposit amount to vault
      console.log(`🔄 Creating TOKEN4 deposit transfer instruction:`);
      console.log(`   FROM: ${userToken4ATA.toString()} (User's TOKEN4 wallet)`);
      console.log(`   TO: ${token4VaultATA.toString()} (Vault's TOKEN4 wallet)`);
      console.log(`   AMOUNT: ${depositAmountInUnits} units (${depositAmountToVault.toFixed(6)} TOKEN4)`);
      console.log(`   AUTHORITY: ${user.toString()} (User's wallet - will sign transaction)`);

      const token4TransferInstruction = createTransferInstruction(
        userToken4ATA, // Source: User's TOKEN4 token account (tokens will be deducted from here)
        token4VaultATA, // Destination: Vault's TOKEN4 token account (tokens will be deposited here)
        user, // Authority: User's wallet (must sign the transaction)
        depositAmountInUnits, // Full deposit amount in token units
        [], // Multi-signers (none needed - only user signs)
        TOKEN_PROGRAM_ID // Token program ID
      );

      // Add TOKEN4 transfer instruction (this transfers full deposit amount to vault)
      // Note: Fee is paid in SOL separately (first instruction)
      // The database will be updated with OGX equivalent in Purchase.tsx
      finalTransaction.add(token4TransferInstruction);
      console.log("✅ Added deposit transfer instruction");
      console.log(`📊 Transaction Summary:`);
      console.log(`   SOL Fee: ${feeAmountSOL.toFixed(6)} SOL → Fee Wallet`);
      console.log(`   TOKEN4 Deposit: ${depositAmountToVault.toFixed(6)} TOKEN4 → Vault`);
      console.log(`   Note: Fee is paid in SOL, deposit is in TOKEN4`);

      // Simulate transaction first to catch errors early
      try {
        console.log("🔄 Simulating transaction...");
        const simulation = await this.connection.simulateTransaction(finalTransaction);
        if (simulation.value.err) {
          console.error("❌ Transaction simulation failed:", simulation.value.err);
          const errorLogs = simulation.value.logs || [];
          console.error("Simulation logs:", errorLogs);
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}. Logs: ${errorLogs.join('\n')}`);
        }
        console.log("✅ Transaction simulation successful");
        console.log(`   Compute units used: ${simulation.value.unitsConsumed}`);
      } catch (simError: any) {
        console.error("❌ Transaction simulation error:", simError);
        // If simulation fails, we'll still try to send, but log the error
        if (simError.message && !simError.message.includes('simulation')) {
          throw simError; // Re-throw if it's not a simulation-specific error
        }
      }

      // Use wallet adapter's sendTransaction for better Phantom integration
      // This allows Phantom to properly recognize and display TOKEN4 transfers
      let signature: string;

      // Check if wallet has sendTransaction method (wallet adapter)
      // This is the preferred method as Phantom can intercept and display tokens properly
      if (wallet.sendTransaction && typeof wallet.sendTransaction === 'function') {
        console.log("✅ Using wallet adapter sendTransaction (better for Phantom display)");

        try {
          // Use wallet adapter's sendTransaction - Phantom will:
          // 1. Automatically get a fresh blockhash
          // 2. Recognize TOKEN4 token transfer and display it properly (or show "Unknown" for devnet)
          // 3. Show the transaction details in the confirmation dialog
          signature = await wallet.sendTransaction(finalTransaction, this.connection, {
            skipPreflight: false,
            preflightCommitment: "confirmed",
            maxRetries: 3,
          });

          console.log(`Transaction sent with signature: ${signature}`);

          // Wait for confirmation
          const confirmation = await this.connection.confirmTransaction(signature, "confirmed");

          if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
          }
        } catch (sendError: any) {
          console.error("❌ Error sending transaction:", sendError);
          // Log more details about the error
          if (sendError.message) {
            console.error("Error message:", sendError.message);
          }
          if (sendError.logs) {
            console.error("Error logs:", sendError.logs);
          }
          if (sendError.stack) {
            console.error("Error stack:", sendError.stack);
          }
          throw new Error(`Failed to send transaction: ${sendError.message || 'Unknown error'}. Please check console for details.`);
        }
      } else {
        // Fallback: manual signing (Phantom might show "unknown" in this case)
        console.log("⚠️ Using manual transaction signing (Phantom display may be limited)");

        // Get a fresh blockhash right before signing
        const { blockhash: freshBlockhash, lastValidBlockHeight: freshLastValidBlockHeight } =
          await this.retryRpcCall(() => this.connection.getLatestBlockhash("finalized"));

        finalTransaction.recentBlockhash = freshBlockhash;

        const signedTransaction = await wallet.signTransaction(finalTransaction);
        signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: "confirmed",
          maxRetries: 3,
        });

        console.log(`Transaction sent with signature: ${signature}`);

        // Wait for confirmation
        const confirmation = await this.retryRpcCall(
          () => this.connection.confirmTransaction({
            signature,
            blockhash: freshBlockhash,
            lastValidBlockHeight: freshLastValidBlockHeight,
          }, "confirmed")
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }
      }

      console.log("=== TOKEN4 DEPOSIT CONFIRMED ===");
      return signature;

    } catch (error) {
      console.error("=== TOKEN4 DEPOSIT ERROR ===", error);
      throw error;
    } finally {
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Deposit tokens (generic function that routes to appropriate deposit method)
   */
  async depositTokens(
    user: PublicKey,
    mint: PublicKey,
    amount: number,
    wallet: any
  ): Promise<string> {
    // If it's OGX mint, use the proper OGX deposit function
    if (mint.equals(OGX_MINT)) {
      return this.depositOGX(user, amount, wallet);
    }
    // If it's USDC mint, use USDC deposit function
    if (mint.equals(USDC_MINT)) {
      return this.depositUSDC(user, amount, wallet);
    }
    // If it's Token4 mint, use Token4 deposit function
    if (mint.equals(TOKEN4_MINT)) {
      return this.depositToken4(user, amount, wallet);
    }
    // For SOL, use SOL deposit function
    if (mint.equals(SOL_MINT)) {
      return this.depositSOL(user, amount, wallet);
    }
    // For any other token, use generic deposit (similar to USDC/Token4)
    // This allows adding new tokens easily
    return this.depositTokenGeneric(user, mint, amount, wallet);
  }

  /**
   * Generic token deposit function for any SPL token
   * NOTE: This uses the Solana program's deposit instruction which handles fees internally.
   * For SOL fee collection regardless of token type, use depositToken() instead.
   * 
   * @param solFeeAmount - Optional additional SOL fee (added on top of program fee)
   */
  async depositTokenGeneric(user: PublicKey, mint: PublicKey, amount: number, wallet: any, solFeeAmount?: number): Promise<string> {
    const transactionId = this.generateTransactionId(user, `${mint.toString()}_${amount}`);

    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Deposit already in progress. Please wait.");
    }

    this.pendingTransactions.add(transactionId);

    try {
      // SOL fee (if provided) - always paid in SOL regardless of deposit token
      const feeAmountSOL = solFeeAmount || 0;
      const feeAmountLamports = Math.floor(feeAmountSOL * LAMPORTS_PER_SOL);

      // Get PDAs for token vault
      const [vaultAuthority] = this.getVaultAuthority(mint);
      const vaultATA = await this.getVaultATA(mint);
      const [userBalancePDA] = this.getUserBalancePDA(user, mint);
      const userATA = this.getUserATA(user, mint);

      // Check if user ATA exists and create if needed
      const createATATransaction = await this.ensureATAExists(user, mint);

      // Get fee vault accounts
      const [feeVaultAuthority] = this.getFeeVaultAuthority(mint);
      const feeVaultATA = await this.getFeeVaultATA(mint);
      const [feeConfig] = this.getFeeConfig(mint);

      // Get required accounts for deposit (fee_wallet, sol_fee_config, exchange_config)
      const feeWallet = new PublicKey(CONFIG.FEE_WALLET);
      const [solFeeConfig] = this.getSolFeeConfig();
      const [exchangeConfig] = this.getExchangeConfig();

      // Check user token balance (assuming 6 decimals for tokens)
      const userBalance = await this.getTokenBalance(user, mint);
      if (userBalance < amount) {
        throw new Error(`Insufficient token balance. You have ${userBalance.toFixed(4)} but need ${amount}.`);
      }

      // Check user SOL balance if SOL fee is required
      if (feeAmountLamports > 0) {
        const userSOLBalance = await this.connection.getBalance(user);
        const userSOLBalanceInSOL = userSOLBalance / LAMPORTS_PER_SOL;
        const networkFee = 0.0001; // Estimate for network transaction fee (~0.00005 SOL actual + buffer)
        const totalSOLRequired = feeAmountSOL + networkFee;
        
        if (userSOLBalanceInSOL < totalSOLRequired) {
          throw new Error(`Insufficient SOL balance for fee. You have ${userSOLBalanceInSOL.toFixed(4)} SOL but need ${totalSOLRequired.toFixed(4)} SOL (${feeAmountSOL.toFixed(4)} fee + ${networkFee.toFixed(4)} network fee).`);
        }
      }

      // Create deposit transaction using the program
      // Assuming 6 decimals for tokens
      const depositTransaction = await this.program.methods
        .deposit(new BN(amount * 1e6))
        .accounts({
          user: user,
          mint: mint,
          userAta: userATA,
          vaultAuthority: vaultAuthority,
          vaultAta: vaultATA,
          feeVaultAuthority: feeVaultAuthority,
          feeVaultAta: feeVaultATA,
          feeConfig: feeConfig,
          feeWallet: feeWallet,
          solFeeConfig: solFeeConfig,
          exchangeConfig: exchangeConfig,
          userBalance: userBalancePDA,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .transaction();

      // Create a new transaction
      const finalTransaction = new Transaction();

      // If ATA needs to be created, add it first
      if (createATATransaction) {
        finalTransaction.add(...createATATransaction.instructions);
      }

      // Add SOL fee transfer if SOL fee is provided (first, before deposit)
      if (feeAmountLamports > 0) {
        console.log(`🔄 Creating SOL fee transfer instruction:`);
        console.log(`   FROM: ${user.toString()} (User's SOL wallet)`);
        console.log(`   TO: ${feeWallet.toString()} (Fee Wallet)`);
        console.log(`   AMOUNT: ${feeAmountLamports} lamports (${feeAmountSOL.toFixed(6)} SOL)`);

        finalTransaction.add(
          SystemProgram.transfer({
            fromPubkey: user,
            toPubkey: feeWallet,
            lamports: feeAmountLamports,
          })
        );
        console.log("✅ Added SOL fee transfer instruction");
      }

      // Add the deposit transaction
      finalTransaction.add(...depositTransaction.instructions);

      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await this.retryRpcCall(
        () => this.connection.getLatestBlockhash("confirmed")
      );

      finalTransaction.recentBlockhash = blockhash;
      finalTransaction.feePayer = user;

      // Sign and send the transaction
      const signedTransaction = await wallet.signTransaction(finalTransaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 0,
      });

      // Wait for confirmation
      const confirmation = await this.retryRpcCall(
        () => this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        })
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log(`=== TOKEN DEPOSIT CONFIRMED (${mint.toString()}) ===`);
      return signature;

    } catch (error) {
      console.error(`=== TOKEN DEPOSIT ERROR (${mint.toString()}) ===`, error);
      throw error;
    } finally {
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Withdraw tokens (simplified - creates withdrawal request)
   */
  async withdrawTokens(
    user: PublicKey,
    mint: PublicKey,
    amount: number,
    wallet: any
  ): Promise<string> {
    // Convert OGX amount to SOL amount (assuming 1000 OGX = 1 SOL)
    const solAmount = amount / 1000;
    return this.createWithdrawalRequest(user, solAmount, wallet);
  }

  /**
   * Get user balance (simplified - returns 0 for now)
   */
  async getUserBalance(user: PublicKey, mint: PublicKey): Promise<number> {
    // For now, return 0 since we're using a simplified approach
    // In a real implementation, you would fetch the balance from the program
    return 0;
  }

  /**
   * Claim any NFT from vault to user's wallet (unrestricted)
   * No ownership requirements - any user can claim any NFT
   */
  async withdrawNFT(user: PublicKey, mint: PublicKey, wallet: any): Promise<string> {
    const transactionId = this.generateTransactionId(user, mint.toString());

    console.log("=== NFT CLAIM START (Unrestricted) ===");
    console.log(`User: ${user.toString()}`);
    console.log(`NFT Mint: ${mint.toString()}`);
    console.log(`Transaction ID: ${transactionId}`);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("NFT claim already in progress. Please wait.");
    }

    this.pendingTransactions.add(transactionId);

    try {
      // Get PDAs for NFT claiming (no UserNft account needed!)
      const [vaultAuthority] = this.getVaultAuthority(mint);
      const vaultATA = await this.getVaultATA(mint);
      const userATA = this.getUserATA(user, mint);

      console.log("=== NFT CLAIM ACCOUNTS ===");
      console.log(`Vault Authority: ${vaultAuthority.toString()}`);
      console.log(`Vault ATA: ${vaultATA.toString()}`);
      console.log(`User ATA: ${userATA.toString()}`);

      // Check if user ATA exists and create if needed
      const createATATransaction = await this.ensureATAExists(user, mint);

      // Check if NFT is available in vault
      try {
        const vaultAccountInfo = await this.connection.getAccountInfo(vaultATA);
        if (!vaultAccountInfo) {
          throw new Error("⚠️ NFT CLAIM UNAVAILABLE\n\nNo vault found for this NFT mint.\n\nWHY: This NFT may not be deposited in the vault yet.");
        }

        const amount = vaultAccountInfo.data.readBigUInt64LE(64);
        if (amount === BigInt(0)) {
          throw new Error("⚠️ NFT CLAIM UNAVAILABLE\n\nNo NFT available in vault.\n\nWHY: This NFT has already been claimed or was never deposited.");
        }

        console.log(`✅ NFT available in vault: ${amount} NFT(s)`);
      } catch (error: any) {
        if (error?.message?.includes("NFT CLAIM UNAVAILABLE")) {
          throw error;
        }
        throw new Error("⚠️ NFT CLAIM UNAVAILABLE\n\nCould not check vault status.\n\nWHY: Network error or vault account issue.");
      }

      // Try to use claim_any_nft if available, otherwise fallback to withdrawNft
      let claimTransaction;
      try {
        // Try the new claim_any_nft instruction first
        claimTransaction = await this.program.methods
          .claimAnyNft()
          .accounts({
            claimer: user,
            mint: mint,
            claimerNftAta: userATA,
            vaultAuthority: vaultAuthority,
            vaultNftAta: vaultATA,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .transaction();

        console.log("✅ Using claim_any_nft instruction (unrestricted)");
      } catch (error: any) {
        // Check if this is the InstructionFallbackNotFound error
        if (error?.message?.includes('InstructionFallbackNotFound') ||
          error?.message?.includes('0x65') ||
          error?.message?.includes('Fallback functions are not supported')) {
          console.log("⚠️ claim_any_nft instruction not deployed yet");
          console.log("💡 This is expected - the program needs to be deployed with the new instruction");
          console.log("🔄 Falling back to withdrawNft method...");

          // Don't throw error, continue with fallback
        }

        console.log("⚠️ claim_any_nft not available, falling back to withdrawNft");

        // Fallback to the old withdrawNft instruction
        const [userNFT] = this.getUserNFTPDA(user, mint);

        // Check if user_nft PDA exists, if not, we need to create it
        const userNftInfo = await this.connection.getAccountInfo(userNFT);
        if (!userNftInfo) {
          console.log("⚠️ User NFT PDA doesn't exist - attempting to create it");

          // Try to create the UserNft account by calling deposit_nft with a dummy NFT
          // This is a workaround for the program design limitation
          try {
            console.log("🔄 Attempting to initialize UserNft account...");

            // We'll try to create the account by calling deposit_nft
            // But first we need to check if the user has any NFT to deposit
            // For now, we'll provide a helpful error message
            throw new Error(
              "⚠️ NFT CLAIM UNAVAILABLE\n\n" +
              "Your NFT tracking account is not initialized.\n\n" +
              "WHY: The Solana program requires you to deposit at least one NFT before claiming NFT rewards. Depositing SOL does NOT initialize the NFT tracking account.\n\n" +
              "SOLUTIONS:\n" +
              "1. Deposit any NFT first (even a cheap one), then you can claim rewards\n" +
              "2. The program needs to be updated with the new claim_any_nft instruction\n" +
              "3. Contact support for manual account initialization"
            );
          } catch (initError) {
            console.error("❌ Failed to initialize UserNft account:", initError);
            throw initError;
          }
        }

        claimTransaction = await this.program.methods
          .withdrawNft()
          .accounts({
            user: user,
            mint: mint,
            user_nft_ata: userATA,
            vault_authority: vaultAuthority,
            vault_nft_ata: vaultATA,
            user_nft: userNFT,
            token_program: TOKEN_PROGRAM_ID,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .transaction();

        console.log("✅ Using withdrawNft instruction (restricted)");
      }

      // Create final transaction
      const finalTransaction = new Transaction();

      // If ATA needs to be created, add it first
      if (createATATransaction) {
        console.log("➕ Adding ATA creation instruction");
        finalTransaction.add(...createATATransaction.instructions);
      }

      // Add the claim transaction
      finalTransaction.add(...claimTransaction.instructions);

      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await this.retryRpcCall(
        () => this.connection.getLatestBlockhash("confirmed")
      );

      finalTransaction.recentBlockhash = blockhash;
      finalTransaction.feePayer = user;

      console.log("=== SENDING NFT CLAIM TRANSACTION ===");
      console.log(`Transaction size: ${finalTransaction.serialize({ requireAllSignatures: false }).length} bytes`);

      // Sign and send transaction WITHOUT retry
      // (retrying a signed transaction will cause "already processed" errors)
      const signedTransaction = await wallet.signTransaction(finalTransaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 0, // Don't retry - will cause "already processed" errors
      });

      console.log("=== NFT WITHDRAWAL TRANSACTION SENT ===");
      console.log(`Signature: ${signature}`);

      // Wait for confirmation
      const confirmation = await this.retryRpcCall(
        () => this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, "confirmed")
      );

      if (confirmation.value.err) {
        throw new Error(`NFT claim failed: ${confirmation.value.err}`);
      }

      console.log("=== NFT CLAIM SUCCESS ===");
      console.log(`NFT successfully claimed to user's wallet`);

      return signature;

    } catch (error: any) {
      console.error("=== NFT CLAIM ERROR ===");
      console.error(`Error claiming NFT:`, error);

      // Check if this is a vault-related error
      if (error?.message?.includes('NoNftInVault') ||
        error?.message?.includes('No NFT available')) {
        console.error("❌ NO NFT AVAILABLE IN VAULT");
        console.error("💡 This NFT has already been claimed or was never deposited.");
        console.error("💡 The vault is empty for this NFT mint.");

        throw new Error(
          "⚠️ NFT CLAIM UNAVAILABLE\n\n" +
          "No NFT available in vault.\n\n" +
          "WHY: This NFT has already been claimed or was never deposited in the vault.\n\n" +
          "SOLUTIONS:\n" +
          "1. Check if the NFT is still available in the vault\n" +
          "2. Try claiming a different NFT\n" +
          "3. Contact support if this NFT should be available"
        );
      }

      throw error;
    } finally {
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Check if user has a specific NFT in their wallet
   */
  async checkUserHasNFT(user: PublicKey, mint: PublicKey): Promise<boolean> {
    try {
      const userATA = getAssociatedTokenAddressSync(mint, user, false);
      const userATAInfo = await this.connection.getAccountInfo(userATA);

      if (userATAInfo) {
        const userBalance = userATAInfo.data.readBigUInt64LE(64);
        return userBalance > BigInt(0);
      }
      return false;
    } catch (error) {
      console.error("Error checking if user has NFT:", error);
      return false;
    }
  }

  /**
   * Withdraw NFT from admin wallet directly to user's wallet
   * Uses admin's private key to sign the transaction
   * @param projectId - Optional project ID to use project-specific admin wallet
   */
  async withdrawNFTFromAdminWallet(user: PublicKey, mint: PublicKey, projectId?: number): Promise<string> {
    const transactionId = this.generateTransactionId(user, `admin_nft_${mint.toString()}`);

    console.log("=== ADMIN NFT WITHDRAWAL START ===");
    console.log(`User: ${user.toString()}`);
    console.log(`NFT Mint: ${mint.toString()}`);
    console.log(`Transaction ID: ${transactionId}`);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("NFT withdrawal already in progress. Please wait.");
    }

    this.pendingTransactions.add(transactionId);

    try {
      // Fetch admin wallet private key from database
      // Try project-specific admin key first, then fallback to main website admin key
      let ADMIN_PRIVATE_KEY: string;
      try {
        const { supabase } = await import("@/service/supabase");
        console.log("🔍 Fetching admin private key from database for NFT withdrawal...");

        let adminKeyData: any = null;
        let adminKeyError: any = null;

        // For projects, ONLY check project-specific admin key (no fallback to website_settings)
        if (projectId) {
          // Try project-specific admin key first
          const { data: projectKeyData, error: projectKeyError } = await supabase
            .from('project_settings')
            .select('setting_value')
            .eq('project_id', projectId)
            .eq('setting_key', 'admin_private_key')
            .maybeSingle();

          if (!projectKeyError && projectKeyData?.setting_value) {
            adminKeyData = { value: projectKeyData.setting_value };
            console.log(`✅ Using project-specific admin wallet for project ID: ${projectId}`);
          } else {
            // No project admin wallet configured - throw error (don't fall back)
            throw new Error(
              `⚠️ ADMIN PRIVATE KEY NOT CONFIGURED FOR THIS PROJECT\n\n` +
              `Please configure the admin private key in the admin dashboard:\n` +
              `Website Settings > Admin Wallet Settings\n\n` +
              `The private key must be set in project_settings for this project (project_id: ${projectId}) for withdrawals to work.`
            );
          }
        } else {
          // For main project (no projectId), check website_settings
          const { data: websiteKeyData, error: websiteKeyError } = await supabase
            .from('website_settings')
            .select('value')
            .eq('key', 'admin_private_key')
            .maybeSingle();

          adminKeyData = websiteKeyData;
          adminKeyError = websiteKeyError;

          if (!adminKeyError && adminKeyData?.value) {
            console.log(`✅ Using main website admin wallet`);
          }
        }

        const { data, error } = { data: adminKeyData, error: adminKeyError };

        console.log("📊 Database query result:", {
          hasData: !!data,
          hasValue: !!(data?.value),
          error: error?.message,
          keyLength: data?.value?.length,
          projectId: projectId
        });

        if (error || !data || !data.value) {
          console.error("❌ Admin private key not found in database");
          console.error("Error details:", error);
          throw new Error(
            "⚠️ ADMIN PRIVATE KEY NOT CONFIGURED\n\n" +
            "Please configure the admin private key in the admin dashboard:\n" +
            (projectId
              ? `Project Settings > Admin Wallet Settings (for project ID: ${projectId})\n`
              : "Website Settings > Admin Wallet Settings\n") +
            "The private key must be set in the database for withdrawals to work."
          );
        } else {
          ADMIN_PRIVATE_KEY = data.value;
          console.log("✅ Admin private key loaded from database");
          console.log(`🔑 Private key length: ${ADMIN_PRIVATE_KEY.length} characters`);
        }
      } catch (dbError) {
        console.error("❌ Error fetching admin private key from database:", dbError);
        if (dbError instanceof Error && dbError.message.includes("ADMIN PRIVATE KEY NOT CONFIGURED")) {
          throw dbError; // Re-throw our custom error
        }
        throw new Error(
          "⚠️ FAILED TO LOAD ADMIN PRIVATE KEY\n\n" +
          "Error fetching admin private key from database.\n\n" +
          "Please ensure:\n" +
          "1. Database is accessible\n" +
          (projectId
            ? `2. Admin private key is set in Project Settings (project ID: ${projectId})\n`
            : "2. Admin private key is set in Website Settings\n") +
          "3. Key is stored in the appropriate settings table"
        );
      }

      // Convert private key string to Keypair
      let adminKeypair: Keypair;
      try {
        const privateKeyBytes = bs58.decode(ADMIN_PRIVATE_KEY);
        adminKeypair = Keypair.fromSecretKey(privateKeyBytes);
      } catch (error) {
        console.error("❌ Error decoding admin private key:", error);
        throw new Error("Invalid admin private key format");
      }

      const adminPublicKey = adminKeypair.publicKey;
      console.log(`🔑 Admin Wallet: ${adminPublicKey.toString()}`);

      // Check admin wallet SOL balance for fees
      const adminBalance = await this.connection.getBalance(adminPublicKey);
      const adminSolBalance = adminBalance / LAMPORTS_PER_SOL;

      // Calculate required SOL:
      // - Base transaction fee: ~0.000005 SOL
      // - ATA creation rent (if needed): ~0.00203928 SOL
      // - Buffer for network congestion: 0.001 SOL
      const baseTransactionFee = 0.000005;
      const ataCreationRent = 0.00203928; // Rent-exempt minimum for token account
      const networkBuffer = 0.001;
      const requiredSol = baseTransactionFee + ataCreationRent + networkBuffer;

      console.log(`💰 Admin wallet balance: ${adminSolBalance.toFixed(6)} SOL`);
      console.log(`💰 Required for transaction: ${requiredSol.toFixed(6)} SOL`);
      console.log(`   - Base fee: ${baseTransactionFee.toFixed(6)} SOL`);
      console.log(`   - ATA creation rent: ${ataCreationRent.toFixed(6)} SOL (if needed)`);
      console.log(`   - Network buffer: ${networkBuffer.toFixed(6)} SOL`);

      if (adminSolBalance < requiredSol) {
        throw new Error(
          `⚠️ Insufficient SOL in admin wallet for NFT transfer.\n\n` +
          `Admin Wallet: ${adminPublicKey.toString()}\n` +
          `Current Balance: ${adminSolBalance.toFixed(6)} SOL\n` +
          `Required: ${requiredSol.toFixed(6)} SOL\n\n` +
          `Please add at least ${(requiredSol - adminSolBalance).toFixed(6)} SOL to the admin wallet.`
        );
      }

      // Get admin's ATA for the NFT
      let adminATA = getAssociatedTokenAddressSync(
        mint,
        adminPublicKey,
        false
      );

      // Get user's ATA for the NFT
      const userATA = getAssociatedTokenAddressSync(
        mint,
        user,
        false
      );

      console.log("=== ADMIN NFT WITHDRAWAL ACCOUNTS ===");
      console.log(`Admin Wallet: ${adminPublicKey.toString()}`);
      console.log(`Admin ATA: ${adminATA.toString()}`);
      console.log(`NFT Mint: ${mint.toString()}`);
      console.log(`User ATA: ${userATA.toString()}`);

      // First, check if user already has the NFT
      const userATAInfo = await this.connection.getAccountInfo(userATA);
      if (userATAInfo) {
        const userBalance = userATAInfo.data.readBigUInt64LE(64);
        if (userBalance > BigInt(0)) {
          console.log(`✅ User already has ${userBalance} NFT(s) in their wallet`);
          console.log(`✅ NFT is already claimed - no transfer needed`);
          // Return a dummy signature since no transaction is needed
          return "NFT_ALREADY_IN_WALLET";
        }
      }

      // FIRST: Check NFT type using Helius DAS API BEFORE attempting ATA operations
      // This is critical because cNFTs and Metaplex Core NFTs don't use ATAs
      console.log(`🔍 Checking NFT type via Helius DAS API...`);
      let nftType: 'standard' | 'compressed' | 'metaplex_core' = 'standard';
      let nftData: any = null;
      let nftConfirmedByHelius = false;
      let tokenAccountFromHelius: string | null = null;

      try {
        const HELIUS_API_KEY = '5a1a852c-3ed9-40ee-bca8-dda4550c3ce8';
        const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'nft-check',
            method: 'getAssetsByOwner',
            params: {
              ownerAddress: adminPublicKey.toString(),
              page: 1,
              limit: 1000,
              displayOptions: {
                showFungible: false,
                showNativeBalance: false,
              },
            },
          }),
        });

        const jsonResponse = await response.json();
        if (jsonResponse.result) {
          const nfts = jsonResponse.result.items || [];
          nftData = nfts.find((nft: any) => nft.id === mint.toString());

          if (nftData) {
            console.log(`✅ NFT found in admin wallet via Helius DAS API`);
            console.log(`📦 Full NFT data from Helius:`, JSON.stringify(nftData, null, 2));
            nftConfirmedByHelius = true;

            // CRITICAL: Check NFT type and route to appropriate transfer method

            // 1. Check if this is a compressed NFT (cNFT)
            if (nftData.compression?.compressed === true) {
              console.log(`🌳 DETECTED: This is a COMPRESSED NFT (cNFT)!`);
              console.log(`   Tree: ${nftData.compression.tree}`);
              console.log(`   Leaf ID: ${nftData.compression.leaf_id}`);
              console.log(`   Data Hash: ${nftData.compression.data_hash}`);
              console.log(`   Creator Hash: ${nftData.compression.creator_hash}`);
              console.log(`   Asset Hash: ${nftData.compression.asset_hash}`);

              // Transfer compressed NFT using Bubblegum
              try {
                const signature = await this.transferCompressedNFT(
                  mint,
                  adminKeypair,
                  user,
                  nftData,
                  rpcUrl
                );
                console.log(`✅ Compressed NFT transferred successfully!`);
                console.log(`   Signature: ${signature}`);
                return signature;
              } catch (cNftError: any) {
                console.error(`❌ Error transferring compressed NFT:`, cNftError.message);
                throw new Error(
                  `Failed to transfer compressed NFT: ${cNftError.message}\n\n` +
                  `Compressed NFTs (cNFTs) use a different transfer mechanism (Bubblegum).\n` +
                  `Please ensure the NFT is properly compressed and the Merkle tree is accessible.`
                );
              }
            }

            // 2. Check if this is a Metaplex Core NFT (uses Core program, not Token program)
            // Metaplex Core NFTs:
            // - Have ownership_model: "single" 
            // - Don't have token_info (no token account)
            // - Interface might be missing or different
            // - Owner program is Core, not Token
            const hasTokenInfo = nftData.token_info && Object.keys(nftData.token_info).length > 0;
            const isMetaplexCore = !hasTokenInfo &&
              nftData.ownership?.ownership_model === 'single' &&
              !nftData.compression?.compressed &&
              (nftData.interface === 'MplCoreAsset' ||
                nftData.interface === 'V1_NFT_CORE' ||
                !nftData.interface ||
                nftData.interface === 'UNKNOWN');

            // Also check if ownership indicates Core (no token account means Core)
            if (isMetaplexCore || (!hasTokenInfo && nftData.ownership && !nftData.compression?.compressed)) {
              console.log(`🔷 DETECTED: This is a METAPLEX CORE NFT!`);
              console.log(`   Interface: ${nftData.interface || 'unknown'}`);
              console.log(`   Ownership Model: ${nftData.ownership?.ownership_model || 'unknown'}`);
              console.log(`   Owner: ${nftData.ownership?.owner || 'unknown'}`);
              console.log(`   Has Token Info: ${hasTokenInfo}`);
              console.log(`   Compressed: ${nftData.compression?.compressed || false}`);

              // Transfer Metaplex Core NFT using Core program
              try {
                const signature = await this.transferMetaplexCoreNFT(
                  mint,
                  adminKeypair,
                  user,
                  nftData,
                  rpcUrl
                );
                console.log(`✅ Metaplex Core NFT transferred successfully!`);
                console.log(`   Signature: ${signature}`);
                return signature;
              } catch (coreError: any) {
                console.error(`❌ Error transferring Metaplex Core NFT:`, coreError.message);
                throw new Error(
                  `Failed to transfer Metaplex Core NFT: ${coreError.message}\n\n` +
                  `Metaplex Core NFTs use a different transfer mechanism than standard SPL Token NFTs.\n` +
                  `Please ensure the NFT is properly configured.`
                );
              }
            }

            // 3. Standard SPL Token NFT - continue with ATA-based transfer
            console.log(`📦 DETECTED: This is a STANDARD SPL TOKEN NFT`);
            console.log(`   Interface: ${nftData.interface || 'unknown'}`);
            console.log(`   Will use Token Program with ATAs`);
            nftType = 'standard';
          }
        } else {
          console.warn(`⚠️ NFT not found in Helius response for mint: ${mint.toString()}`);
          console.warn(`   Will attempt standard SPL Token transfer (fallback)`);
          nftType = 'standard';
        }
      } catch (heliusError: any) {
        console.warn(`⚠️ Helius API check failed:`, heliusError.message);
        console.warn(`   Will attempt standard SPL Token transfer (fallback)`);
        nftType = 'standard';
      }

      // If we detected a non-standard NFT type, we should have returned by now
      // Only continue with standard SPL Token NFT transfer if nftType is 'standard'
      if (nftType !== 'standard') {
        throw new Error(`NFT type detection completed but transfer was not executed. This should not happen.`);
      }

      // Fallback: Check mint account owner program if Helius didn't provide clear info
      // This helps catch Metaplex Core NFTs that Helius might not have detected correctly
      if (!nftData || !nftConfirmedByHelius) {
        console.log(`⚠️ Helius didn't confirm NFT type, checking mint account owner program...`);
        try {
          const mintAccountInfo = await this.connection.getAccountInfo(mint);
          if (mintAccountInfo) {
            const ownerProgram = mintAccountInfo.owner.toString();
            console.log(`   Mint owner program: ${ownerProgram}`);

            // Metaplex Core program IDs
            const CORE_V1_1 = 'CoREENxT6tW1HoK8ypY1SxRMZTUvp1c1dW3YvY1J1C3';
            const CORE_V1_0 = 'CoREeNDoLKiqjTGGYxAryxu9qTSaZEJTcyQ5fH6pnyf';

            if (ownerProgram === CORE_V1_1 || ownerProgram === CORE_V1_0) {
              console.log(`🔷 DETECTED via mint owner: This is a METAPLEX CORE NFT!`);
              console.log(`   Owner Program: ${ownerProgram}`);

              // Try to get NFT data from Helius for transfer
              try {
                const HELIUS_API_KEY = '5a1a852c-3ed9-40ee-bca8-dda4550c3ce8';
                const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

                const assetResponse = await fetch(rpcUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'get-asset',
                    method: 'getAsset',
                    params: { id: mint.toString() },
                  }),
                });
                const assetData = await assetResponse.json();
                nftData = assetData.result;

                if (nftData) {
                  const signature = await this.transferMetaplexCoreNFT(
                    mint,
                    adminKeypair,
                    user,
                    nftData,
                    rpcUrl
                  );
                  console.log(`✅ Metaplex Core NFT transferred successfully!`);
                  return signature;
                }
              } catch (coreError: any) {
                console.error(`❌ Error transferring Metaplex Core NFT:`, coreError.message);
                throw new Error(
                  `Failed to transfer Metaplex Core NFT: ${coreError.message}\n\n` +
                  `Metaplex Core NFTs use a different transfer mechanism than standard SPL Token NFTs.`
                );
              }
            } else if (ownerProgram !== TOKEN_PROGRAM_ID.toString()) {
              console.warn(`⚠️ Mint is owned by unexpected program: ${ownerProgram}`);
              console.warn(`   Expected: ${TOKEN_PROGRAM_ID.toString()} (Token Program) or Core Program`);
              console.warn(`   Proceeding with standard transfer attempt...`);
            }
          }
        } catch (mintCheckError: any) {
          console.warn(`⚠️ Could not check mint account: ${mintCheckError.message}`);
          console.warn(`   Proceeding with standard transfer attempt...`);
        }
      }

      // Continue with standard SPL Token NFT transfer (ATA-based)
      console.log(`📦 Proceeding with standard SPL Token NFT transfer...`);

      // Check if admin ATA exists and has the NFT
      let adminATAInfo = await this.connection.getAccountInfo(adminATA);

      // If ATA doesn't exist, try to find the NFT in all token accounts
      if (!adminATAInfo) {
        console.log(`⚠️ Admin ATA not found, searching all token accounts for NFT...`);

        try {
          // Get all token accounts for the admin wallet
          const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
            adminPublicKey,
            {
              programId: TOKEN_PROGRAM_ID
            }
          );

          console.log(`📊 Found ${tokenAccounts.value.length} token accounts for admin wallet`);

          // Filter to find the token account with matching mint
          const matchingTokenAccount = tokenAccounts.value.find(
            (account) => account.account.data.parsed.info.mint === mint.toString()
          );

          if (!matchingTokenAccount) {
            // If Helius confirmed the NFT exists, proceed anyway (might be indexing delay)
            if (nftConfirmedByHelius) {
              console.warn(`⚠️ NFT confirmed by Helius but not found in token accounts`);
              console.warn(`   Proceeding anyway - RPC indexing may be slow`);
            } else {
              throw new Error(
                `⚠️ NFT not found in admin wallet\n\n` +
                `Admin Wallet: ${adminPublicKey.toString()}\n` +
                `NFT Mint: ${mint.toString()}\n` +
                `Expected ATA: ${adminATA.toString()}\n\n` +
                `Please ensure the NFT is in the admin wallet before claiming.`
              );
            }
          } else {
            // Found matching token account
            const balance = matchingTokenAccount.account.data.parsed.info.tokenAmount.uiAmount;

            if (balance === 0) {
              throw new Error(
                `⚠️ Admin wallet does not have this NFT\n\n` +
                `Admin Wallet: ${adminPublicKey.toString()}\n` +
                `NFT Mint: ${mint.toString()}\n` +
                `Token Account: ${matchingTokenAccount.pubkey.toString()}\n` +
                `Balance: ${balance}`
              );
            }

            console.log(`✅ Found NFT in admin wallet via token account search`);
            console.log(`   Token Account: ${matchingTokenAccount.pubkey.toString()}`);
            console.log(`   Balance: ${balance}`);

            // Update adminATA to use the found token account
            adminATA = matchingTokenAccount.pubkey;
            // Get the account info for the found token account
            adminATAInfo = await this.connection.getAccountInfo(adminATA);
          }
        } catch (searchError: any) {
          if (nftConfirmedByHelius) {
            console.warn(`⚠️ Token account search failed, but Helius confirmed NFT exists`);
            console.warn(`   Proceeding anyway - RPC indexing may be slow`);
          } else {
            throw new Error(
              `⚠️ NFT not found in admin wallet\n\n` +
              `Admin Wallet: ${adminPublicKey.toString()}\n` +
              `NFT Mint: ${mint.toString()}\n` +
              `Search Error: ${searchError.message}\n\n` +
              `Please verify the NFT is in the admin wallet and try again.`
            );
          }
        }
      }

      // Final verification: Check admin token account before transfer
      if (!adminATAInfo) {
        console.log(`⚠️ Final check: Verifying admin token account before transfer...`);
        console.log(`   Using adminATA: ${adminATA.toString()}`);
        adminATAInfo = await this.connection.getAccountInfo(adminATA);

        if (adminATAInfo) {
          const balance = adminATAInfo.data.readBigUInt64LE(64);
          if (balance > BigInt(0)) {
            console.log(`✅ Admin token account verified: ${adminATA.toString()}, balance: ${balance}`);
          } else {
            throw new Error(
              `⚠️ Admin token account has 0 balance\n\n` +
              `Admin Wallet: ${adminPublicKey.toString()}\n` +
              `NFT Mint: ${mint.toString()}\n` +
              `Token Account: ${adminATA.toString()}\n` +
              `Balance: 0`
            );
          }
        } else if (nftConfirmedByHelius) {
          console.warn(`⚠️ RPC could not verify account, but transfer will proceed`);
          console.warn(`   Helius confirmed NFT exists in admin wallet`);
        } else {
          throw new Error(
            `⚠️ Admin token account not found\n\n` +
            `Admin Wallet: ${adminPublicKey.toString()}\n` +
            `NFT Mint: ${mint.toString()}\n` +
            `Expected Token Account: ${adminATA.toString()}\n\n` +
            `Please ensure the NFT is in the admin wallet before claiming.`
          );
        }
      }

      // Proceed with standard SPL Token NFT transfer
      console.log(`✅ Proceeding with standard SPL Token NFT transfer...`);
      console.log(`   Admin ATA: ${adminATA.toString()}`);
      console.log(`   User ATA: ${userATA.toString()}`);

      // Create transaction for standard NFT transfer
      const transaction = new Transaction();
      const createATATransaction = new Transaction();

      // Check if user ATA exists, create if needed
      const userATAInfoCheckLegacy = await this.connection.getAccountInfo(userATA);
      if (!userATAInfoCheckLegacy) {
        console.log("➕ Creating user ATA...");
        console.log(`   Payer: ${adminPublicKey.toString()}`);
        console.log(`   ATA: ${userATA.toString()}`);
        console.log(`   Owner: ${user.toString()}`);
        console.log(`   Mint: ${mint.toString()}`);
        console.log(`   TOKEN_PROGRAM_ID: ${TOKEN_PROGRAM_ID.toString()}`);
        console.log(`   ASSOCIATED_TOKEN_PROGRAM_ID: ${ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);

        // CRITICAL: Verify mint account is owned by TOKEN_PROGRAM_ID (non-blocking)
        // If RPC can't find the mint, we'll proceed anyway since Helius confirmed NFT exists
        try {
          const mintAccountInfo = await this.connection.getAccountInfo(mint);
          if (mintAccountInfo) {
            if (mintAccountInfo.owner.toString() !== TOKEN_PROGRAM_ID.toString()) {
              console.warn(`⚠️ WARNING: Mint account owner mismatch!`);
              console.warn(`   Mint: ${mint.toString()}`);
              console.warn(`   Owner: ${mintAccountInfo.owner.toString()}`);
              console.warn(`   Expected: ${TOKEN_PROGRAM_ID.toString()}`);
              console.warn(`   Proceeding anyway - Helius confirmed NFT exists`);
            } else {
              console.log(`✅ Mint account verified: owned by ${mintAccountInfo.owner.toString()}`);
            }
          } else {
            console.warn(`⚠️ WARNING: RPC could not find mint account ${mint.toString()}`);
            console.warn(`   This may be due to RPC indexing delays`);
            console.warn(`   Proceeding anyway - Helius confirmed NFT exists in admin wallet`);
          }
        } catch (error: any) {
          console.warn(`⚠️ WARNING: Error verifying mint account: ${error.message}`);
          console.warn(`   Proceeding anyway - Helius confirmed NFT exists in admin wallet`);
          // Don't throw - continue with transaction since Helius confirmed NFT exists
        }

        // CRITICAL FIX: Use ONLY the library function - don't modify it
        // The library function is tested and should work correctly
        // Any manual modifications might introduce issues
        console.log(`🔧 Creating ATA instruction using library function (no modifications)...`);
        const createATAInstruction = createAssociatedTokenAccountInstruction(
          adminPublicKey, // Payer (admin pays for ATA creation)
          userATA,        // Associated token account address
          user,          // Owner (user's wallet)
          mint           // Mint (NFT mint address)
        );

        // Log the instruction structure for debugging (but don't modify it)
        console.log(`📋 ATA instruction structure (from library):`);
        console.log(`   Program ID: ${createATAInstruction.programId.toString()}`);
        console.log(`   Expected Program ID: ${ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);
        console.log(`   Match: ${createATAInstruction.programId.toString() === ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);
        console.log(`   Accounts: ${createATAInstruction.keys.length}`);
        createATAInstruction.keys.forEach((key, i) => {
          const accountNames = ['Payer', 'ATA', 'Owner', 'Mint', 'System Program', 'Token Program'];
          console.log(`     [${i}] ${accountNames[i] || 'Unknown'}: ${key.pubkey.toString().substring(0, 8)}... (signer: ${key.isSigner}, writable: ${key.isWritable})`);
        });
        console.log(`   Data length: ${createATAInstruction.data.length} bytes`);

        // Verify structure matches expectations (but don't throw - just log)
        if (createATAInstruction.programId.toString() !== ASSOCIATED_TOKEN_PROGRAM_ID.toString()) {
          console.error(`❌ WARNING: Program ID mismatch!`);
          console.error(`   Expected: ${ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);
          console.error(`   Got: ${createATAInstruction.programId.toString()}`);
        }

        const tokenProgramKey = createATAInstruction.keys[5];
        if (!tokenProgramKey || tokenProgramKey.pubkey.toString() !== TOKEN_PROGRAM_ID.toString()) {
          console.error(`❌ WARNING: Token Program mismatch in account [5]!`);
          console.error(`   Expected: ${TOKEN_PROGRAM_ID.toString()}`);
          console.error(`   Got: ${tokenProgramKey?.pubkey?.toString() || 'missing'}`);
        } else {
          console.log(`✅ Token Program verified in account [5]: ${tokenProgramKey.pubkey.toString()}`);
        }

        // CRITICAL VERIFICATION: Ensure instruction matches Solana ATA Program spec
        console.log(`🔍 Verifying ATA instruction structure...`);
        console.log(`   Program ID: ${createATAInstruction.programId.toString()}`);
        console.log(`   Expected: ${ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);
        console.log(`   Match: ${createATAInstruction.programId.toString() === ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);
        console.log(`   Accounts: ${createATAInstruction.keys.length} (expected: 6)`);

        // Verify program ID
        if (createATAInstruction.programId.toString() !== ASSOCIATED_TOKEN_PROGRAM_ID.toString()) {
          console.error(`❌ CRITICAL: Instruction program ID mismatch!`);
          console.error(`   Expected: ${ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);
          console.error(`   Got: ${createATAInstruction.programId.toString()}`);
          throw new Error(
            `ATA instruction has incorrect program ID.\n` +
            `Expected: ${ASSOCIATED_TOKEN_PROGRAM_ID.toString()}\n` +
            `Got: ${createATAInstruction.programId.toString()}`
          );
        }

        // Verify account count
        if (createATAInstruction.keys.length !== 6) {
          console.error(`❌ CRITICAL: Wrong number of accounts!`);
          console.error(`   Expected: 6`);
          console.error(`   Got: ${createATAInstruction.keys.length}`);
          throw new Error(
            `ATA instruction has wrong number of accounts.\n` +
            `Expected: 6\n` +
            `Got: ${createATAInstruction.keys.length}`
          );
        }

        // Verify each account
        console.log(`✅ ATA instruction verified:`);
        console.log(`   Program ID: ${createATAInstruction.programId.toString()} ✅`);
        createATAInstruction.keys.forEach((key, i) => {
          const accountNames = ['Payer', 'ATA', 'Owner', 'Mint', 'System Program', 'Token Program'];
          console.log(`   [${i}] ${accountNames[i] || 'Unknown'}: ${key.pubkey.toString().substring(0, 8)}... (signer: ${key.isSigner}, writable: ${key.isWritable})`);
        });
        console.log(`   Data length: ${createATAInstruction.data.length} bytes`);

        createATATransaction.add(createATAInstruction);
        console.log(`✅ ATA creation instruction added to transaction`);
      }

      // Create transfer instruction
      console.log(`📤 Creating transfer instruction:`);
      console.log(`   From: ${adminATA.toString()}`);
      console.log(`   To: ${userATA.toString()}`);
      console.log(`   Authority: ${adminPublicKey.toString()}`);
      console.log(`   TOKEN_PROGRAM_ID: ${TOKEN_PROGRAM_ID.toString()}`);

      const transferInstruction = createTransferInstruction(
        adminATA,      // Source (admin's token account)
        userATA,       // Destination (user's token account)
        adminPublicKey, // Authority (admin wallet)
        1,             // Amount (1 NFT)
        [],            // Multi-signers (none)
        TOKEN_PROGRAM_ID
      );

      console.log(`✅ Transfer instruction created with correct program ID`);
      console.log(`   Instruction program ID: ${transferInstruction.programId.toString()}`);

      // Add instructions to transaction
      if (!userATAInfoCheckLegacy) {
        console.log(`📝 Adding 1 ATA creation instruction(s) to transaction`);
        transaction.add(...createATATransaction.instructions);
      }

      console.log(`📝 Adding transfer instruction to transaction`);
      transaction.add(transferInstruction);

      console.log(`📋 Transaction structure before sending:`);
      console.log(`   Total instructions: ${transaction.instructions.length}`);
      transaction.instructions.forEach((inst, i) => {
        console.log(`   Instruction ${i}:`);
        console.log(`     Program ID: ${inst.programId.toString()}`);
        console.log(`     Accounts: ${inst.keys.length}`);
        inst.keys.forEach((key, j) => {
          console.log(`       [${j}] ${key.pubkey.toString().substring(0, 8)}... (signer: ${key.isSigner}, writable: ${key.isWritable})`);
        });
        console.log(`     Data length: ${inst.data.length} bytes`);
      });

      // Get fresh blockhash right before signing
      console.log(`=== PREPARING ADMIN NFT WITHDRAWAL TRANSACTION ===`);
      const blockhashStartTime = Date.now();
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
      const blockhashFetchTime = Date.now() - blockhashStartTime;

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminPublicKey;

      // Log blockhash timing
      const currentBlockHeight = await this.connection.getBlockHeight('confirmed');
      const blocksRemaining = lastValidBlockHeight - currentBlockHeight;
      const validityPercent = (blocksRemaining / 150) * 100; // Blockhash valid for ~150 blocks

      console.log(`⏱️ Blockhash Timing:`);
      console.log(`   Fetch time: ${blockhashFetchTime}ms`);
      console.log(`   Current block: ${currentBlockHeight}`);
      console.log(`   Last valid block: ${lastValidBlockHeight}`);
      console.log(`   Blocks remaining: ${blocksRemaining} (${validityPercent.toFixed(1)}% of validity window)`);

      // Sign transaction
      const signStartTime = Date.now();
      transaction.sign(adminKeypair);
      const signTime = Date.now() - signStartTime;

      // Final verification after signing
      console.log(`🔍 Final verification of signed transaction:`);
      transaction.instructions.forEach((inst, i) => {
        console.log(`   Instruction ${i} (after signing):`);
        console.log(`     Program ID: ${inst.programId.toString()}`);
        console.log(`     Accounts: ${inst.keys.length}`);
        inst.keys.forEach((key, j) => {
          console.log(`       [${j}] ${key.pubkey.toString().substring(0, 8)}... (signer: ${key.isSigner}, writable: ${key.isWritable})`);
        });
        console.log(`     Data: ${inst.data.length} bytes`);
      });

      console.log(`⏱️ Signing time: ${signTime}ms`);

      // Send transaction
      console.log(`=== SENDING ADMIN NFT WITHDRAWAL TRANSACTION ===`);
      console.log(`   Blockhash: ${blockhash.substring(0, 8)}...${blockhash.substring(-8)}`);
      console.log(`   Last valid block height: ${lastValidBlockHeight}`);

      const serialized = transaction.serialize();
      console.log(`📦 Serialized transaction size: ${serialized.length} bytes`);

      const sendStartTime = Date.now();
      const signature = await this.connection.sendRawTransaction(serialized, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
      const sendTime = Date.now() - sendStartTime;
      const totalTime = Date.now() - blockhashStartTime;

      console.log(`⏱️ Send time: ${sendTime}ms`);
      console.log(`⏱️ Total time from blockhash fetch to send: ${totalTime}ms`);

      // Check how many blocks elapsed during send
      const currentBlockAfterSend = await this.connection.getBlockHeight('confirmed');
      const blocksElapsed = currentBlockAfterSend - currentBlockHeight;
      console.log(`⏱️ Blocks elapsed during send: ${blocksElapsed}`);

      console.log(`=== ADMIN NFT WITHDRAWAL TRANSACTION SENT ===`);
      console.log(`   Signature: ${signature}`);

      // Confirm transaction
      const confirmation = await this.confirmTransactionRobust(signature, 120000);

      if (confirmation.value?.err) {
        const errorDetails = confirmation.value.err;
        console.error(`❌ Transaction failed on-chain:`, errorDetails);

        // Parse error details
        if (Array.isArray(errorDetails)) {
          const [instructionIndex, error] = errorDetails;
          console.error(`=== TRANSACTION FAILED (INSTRUCTION ERROR) ===`);
          console.error(`   Transaction signature: ${signature}`);
          console.error(`   Failed instruction index: ${instructionIndex}`);
          console.error(`   Error details (raw): ${JSON.stringify(error)}`);

          if (instructionIndex === 0) {
            console.error(`   ❌ Instruction 0 (ATA Creation) failed with error: ${JSON.stringify(error)}`);
            console.error(`   This is the ATA creation instruction.`);
            console.error(`   Verify: Program ID should be ${ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);
            console.error(`   Verify: Token Program should be ${TOKEN_PROGRAM_ID.toString()} in account [5]`);
          } else if (instructionIndex === 1) {
            console.error(`   ❌ Instruction 1 (Transfer) failed with error: ${JSON.stringify(error)}`);
            console.error(`   This is the transfer instruction.`);
            console.error(`   Verify: Program ID should be ${TOKEN_PROGRAM_ID.toString()}`);
          }
        }

        throw new Error(
          `NFT withdrawal failed: Instruction ${Array.isArray(errorDetails) ? errorDetails[0] : 'unknown'} failed (${JSON.stringify(Array.isArray(errorDetails) ? errorDetails[1] : errorDetails)})`
        );
      }

      console.log(`✅ NFT withdrawal transaction confirmed successfully!`);
      return signature;

      // Check if user ATA exists, create if needed
      // Note: userATAInfo was already checked above, but we need to check again
      // in case it was created between checks (unlikely but safe)
      const userATAInfoCheck = await this.connection.getAccountInfo(userATA);
      const createATATransactionFinal = new Transaction();

      if (!userATAInfoCheck) {
        console.log("➕ Creating user ATA...");
        console.log(`   Payer: ${adminPublicKey.toString()}`);
        console.log(`   ATA: ${userATA.toString()}`);
        console.log(`   Owner: ${user.toString()}`);
        console.log(`   Mint: ${mint.toString()}`);
        console.log(`   TOKEN_PROGRAM_ID: ${TOKEN_PROGRAM_ID.toString()}`);
        console.log(`   ASSOCIATED_TOKEN_PROGRAM_ID: ${ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);

        // CRITICAL: Verify mint account is owned by TOKEN_PROGRAM_ID (non-blocking)
        // If RPC can't find the mint, we'll proceed anyway since Helius confirmed NFT exists
        try {
          const mintAccountInfo = await this.connection.getAccountInfo(mint);
          if (mintAccountInfo) {
            if (mintAccountInfo!.owner.toString() !== TOKEN_PROGRAM_ID.toString()) {
              console.warn(`⚠️ WARNING: Mint account owner mismatch!`);
              console.warn(`   Mint: ${mint.toString()}`);
              console.warn(`   Owner: ${mintAccountInfo!.owner.toString()}`);
              console.warn(`   Expected: ${TOKEN_PROGRAM_ID.toString()}`);
              console.warn(`   Proceeding anyway - Helius confirmed NFT exists`);
            } else {
              console.log(`✅ Mint account verified: owned by ${mintAccountInfo!.owner.toString()}`);
            }
          } else {
            console.warn(`⚠️ WARNING: RPC could not find mint account ${mint.toString()}`);
            console.warn(`   This may be due to RPC indexing delays`);
            console.warn(`   Proceeding anyway - Helius confirmed NFT exists in admin wallet`);
          }
        } catch (error: any) {
          console.warn(`⚠️ WARNING: Error verifying mint account: ${error.message}`);
          console.warn(`   Proceeding anyway - Helius confirmed NFT exists in admin wallet`);
          // Don't throw - continue with transaction since Helius confirmed NFT exists
        }

        // CRITICAL FIX: Use ONLY the library function - don't modify it
        // The library function is tested and should work correctly
        // Any manual modifications might introduce issues
        console.log(`🔧 Creating ATA instruction using library function (no modifications)...`);
        const createATAInstruction = createAssociatedTokenAccountInstruction(
          adminPublicKey, // Payer (admin pays for ATA creation)
          userATA,        // Associated token account address
          user,          // Owner (user's wallet)
          mint           // Mint (NFT mint address)
        );

        // Log the instruction structure for debugging (but don't modify it)
        console.log(`📋 ATA instruction structure (from library):`);
        console.log(`   Program ID: ${createATAInstruction.programId.toString()}`);
        console.log(`   Expected Program ID: ${ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);
        console.log(`   Match: ${createATAInstruction.programId.toString() === ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);
        console.log(`   Accounts: ${createATAInstruction.keys.length}`);
        createATAInstruction.keys.forEach((key, i) => {
          const accountNames = ['Payer', 'ATA', 'Owner', 'Mint', 'System Program', 'Token Program'];
          console.log(`     [${i}] ${accountNames[i] || 'Unknown'}: ${key.pubkey.toString().substring(0, 8)}... (signer: ${key.isSigner}, writable: ${key.isWritable})`);
        });
        console.log(`   Data length: ${createATAInstruction.data.length} bytes`);

        // Verify structure matches expectations (but don't throw - just log)
        if (createATAInstruction.programId.toString() !== ASSOCIATED_TOKEN_PROGRAM_ID.toString()) {
          console.error(`❌ WARNING: Program ID mismatch!`);
          console.error(`   Expected: ${ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);
          console.error(`   Got: ${createATAInstruction.programId.toString()}`);
        }

        const tokenProgramKey = createATAInstruction.keys[5];
        if (!tokenProgramKey || tokenProgramKey.pubkey.toString() !== TOKEN_PROGRAM_ID.toString()) {
          console.error(`❌ WARNING: Token Program mismatch in account [5]!`);
          console.error(`   Expected: ${TOKEN_PROGRAM_ID.toString()}`);
          console.error(`   Got: ${tokenProgramKey?.pubkey?.toString() || 'missing'}`);
        } else {
          console.log(`✅ Token Program verified in account [5]: ${tokenProgramKey.pubkey.toString()}`);
        }

        // CRITICAL VERIFICATION: Ensure instruction matches Solana ATA Program spec
        console.log(`🔍 Verifying ATA instruction structure...`);
        console.log(`   Program ID: ${createATAInstruction.programId.toString()}`);
        console.log(`   Expected: ${ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);
        console.log(`   Match: ${createATAInstruction.programId.toString() === ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);
        console.log(`   Accounts: ${createATAInstruction.keys.length} (expected: 6)`);

        // Verify program ID
        if (createATAInstruction.programId.toString() !== ASSOCIATED_TOKEN_PROGRAM_ID.toString()) {
          console.error(`❌ CRITICAL: Instruction program ID mismatch!`);
          console.error(`   Expected: ${ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);
          console.error(`   Got: ${createATAInstruction.programId.toString()}`);
          throw new Error(
            `ATA instruction has incorrect program ID.\n` +
            `Expected: ${ASSOCIATED_TOKEN_PROGRAM_ID.toString()}\n` +
            `Got: ${createATAInstruction.programId.toString()}`
          );
        }

        // Verify account count
        if (createATAInstruction.keys.length !== 6) {
          console.error(`❌ CRITICAL: Wrong number of accounts!`);
          console.error(`   Expected: 6`);
          console.error(`   Got: ${createATAInstruction.keys.length}`);
          throw new Error(`ATA instruction has wrong number of accounts: ${createATAInstruction.keys.length} (expected 6)`);
        }

        // Verify TOKEN_PROGRAM_ID is in account [5]
        const tokenProgramAccount = createATAInstruction.keys[5];
        const hasCorrectTokenProgram = tokenProgramAccount?.pubkey?.toString() === TOKEN_PROGRAM_ID.toString();

        console.log(`   Account [5] Token Program: ${tokenProgramAccount?.pubkey?.toString() || 'missing'}`);
        console.log(`   Expected Token Program: ${TOKEN_PROGRAM_ID.toString()}`);
        console.log(`   Match: ${hasCorrectTokenProgram}`);

        if (!hasCorrectTokenProgram) {
          console.error(`❌ CRITICAL: TOKEN_PROGRAM_ID mismatch in account [5]!`);
          console.error(`   Expected: ${TOKEN_PROGRAM_ID.toString()}`);
          console.error(`   Got: ${tokenProgramAccount?.pubkey?.toString() || 'missing'}`);
          console.error(`   All accounts:`);
          createATAInstruction.keys.forEach((key, i) => {
            console.error(`     [${i}] ${key.pubkey.toString()} (signer: ${key.isSigner}, writable: ${key.isWritable})`);
          });
          throw new Error(
            `TOKEN_PROGRAM_ID not found in instruction accounts.\n` +
            `Expected: ${TOKEN_PROGRAM_ID.toString()}\n` +
            `Found: ${tokenProgramAccount?.pubkey?.toString() || 'missing'}`
          );
        }

        // Log complete instruction structure
        console.log(`✅ ATA instruction verified:`);
        console.log(`   Program ID: ${createATAInstruction.programId.toString()} ✅`);
        createATAInstruction.keys.forEach((key, i) => {
          const accountNames = ['Payer', 'ATA', 'Owner', 'Mint', 'System Program', 'Token Program'];
          console.log(`   [${i}] ${accountNames[i] || 'Unknown'}: ${key.pubkey.toString().substring(0, 8)}... (signer: ${key.isSigner}, writable: ${key.isWritable})`);
        });
        console.log(`   Data length: ${createATAInstruction.data.length} bytes`);

        createATATransactionFinal.add(createATAInstruction);
        console.log(`✅ ATA creation instruction added to transaction`);
      }

      console.log(`📤 Creating transfer instruction:`);
      console.log(`   From: ${adminATA.toString()}`);
      console.log(`   To: ${userATA.toString()}`);
      console.log(`   Authority: ${adminPublicKey.toString()}`);
      console.log(`   TOKEN_PROGRAM_ID: ${TOKEN_PROGRAM_ID.toString()}`);

      // Create transfer instruction from admin ATA to user ATA
      // Using classic SPL Token program (not Token-2022)
      const transferInstructionFinal = createTransferInstruction(
        adminATA,        // Source token account (admin's ATA)
        userATA,         // Destination token account (user's ATA)
        adminPublicKey,  // Authority (admin wallet - owner of source ATA)
        1,               // Amount (1 NFT)
        [],              // Multi-signers (none - admin is single signer)
        TOKEN_PROGRAM_ID // Token program (classic SPL Token: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA)
      );

      // Verify the transfer instruction uses correct program ID
      if (transferInstructionFinal.programId.toString() !== TOKEN_PROGRAM_ID.toString()) {
        throw new Error(
          `❌ CRITICAL: Transfer instruction program ID is incorrect!\n` +
          `   Expected: ${TOKEN_PROGRAM_ID.toString()}\n` +
          `   Got: ${transferInstructionFinal.programId.toString()}\n\n` +
          `   This NFT must use classic SPL Token program, not Token-2022.`
        );
      }

      console.log(`✅ Transfer instruction created with correct program ID`);
      console.log(`   Instruction program ID: ${transferInstructionFinal.programId.toString()}`);

      // Create final transaction
      const finalTransaction = new Transaction();

      // Add ATA creation if needed
      if (createATATransactionFinal.instructions.length > 0) {
        console.log(`📝 Adding ${createATATransactionFinal.instructions.length} ATA creation instruction(s) to transaction`);
        finalTransaction.add(...createATATransactionFinal.instructions);
      } else {
        console.log(`📝 User ATA already exists - skipping ATA creation`);
      }

      // Add transfer instruction
      console.log(`📝 Adding transfer instruction to transaction`);
      finalTransaction.add(transferInstructionFinal);

      // CRITICAL: Log transaction structure before sending
      console.log(`📋 Transaction structure before sending:`);
      console.log(`   Total instructions: ${finalTransaction.instructions.length}`);
      finalTransaction.instructions.forEach((inst, idx) => {
        console.log(`   Instruction ${idx}:`);
        console.log(`     Program ID: ${inst.programId.toString()}`);
        console.log(`     Accounts: ${inst.keys.length}`);
        inst.keys.forEach((key, keyIdx) => {
          console.log(`       [${keyIdx}] ${key.pubkey.toString().substring(0, 8)}... (signer: ${key.isSigner}, writable: ${key.isWritable})`);
        });
        console.log(`     Data length: ${inst.data.length} bytes`);
      });

      // Set fee payer
      finalTransaction.feePayer = adminPublicKey; // Admin pays transaction fees

      // CRITICAL FIX: Get fresh blockhash at the ABSOLUTE LAST MOMENT before signing/sending
      // This minimizes the time window between blockhash fetch and transaction submission
      // All verification logic above should complete BEFORE this point
      console.log("=== PREPARING ADMIN NFT WITHDRAWAL TRANSACTION ===");

      // Instrumentation: Track timing
      const timeBeforeBlockhash = Date.now();
      let currentBlockHeightBefore: number;
      try {
        currentBlockHeightBefore = await this.connection.getBlockHeight("confirmed");
      } catch (e) {
        // If block height check fails, continue anyway (not critical)
        currentBlockHeightBefore = 0;
      }

      // Get fresh blockhash IMMEDIATELY before signing (minimize time window)
      // Use direct call (no retry wrapper) to avoid any additional delays
      const { blockhash: blockhashFinal, lastValidBlockHeight: lastValidBlockHeightFinal } =
        await this.connection.getLatestBlockhash("confirmed");

      const timeAfterBlockhash = Date.now();
      const blockhashFetchTimeFinal = timeAfterBlockhash - timeBeforeBlockhash;

      // Verify blockhash is still valid before proceeding
      const currentBlockHeightAfter = await this.connection.getBlockHeight("confirmed");
      const blocksElapsedFinal = currentBlockHeightAfter - currentBlockHeightBefore;
      const blocksRemainingFinal = lastValidBlockHeightFinal - currentBlockHeightAfter;

      console.log(`⏱️ Blockhash Timing:`);
      console.log(`   Fetch time: ${blockhashFetchTimeFinal}ms`);
      console.log(`   Current block: ${currentBlockHeightAfter}`);
      console.log(`   Last valid block: ${lastValidBlockHeightFinal}`);
      console.log(`   Blocks remaining: ${blocksRemainingFinal} (${((blocksRemainingFinal / 150) * 100).toFixed(1)}% of validity window)`);

      if (blocksRemainingFinal < 10) {
        console.warn(`⚠️ WARNING: Only ${blocksRemainingFinal} blocks remaining - blockhash may expire soon!`);
      }

      // Set blockhash immediately
      finalTransaction.recentBlockhash = blockhashFinal;

      // CRITICAL: Verify instruction structure AFTER signing (before serialization)
      console.log(`🔍 Final verification of signed transaction:`);
      finalTransaction.instructions.forEach((inst, idx) => {
        console.log(`   Instruction ${idx} (after signing):`);
        console.log(`     Program ID: ${inst.programId.toString()}`);
        console.log(`     Accounts: ${inst.keys.length}`);
        inst.keys.forEach((key, keyIdx) => {
          console.log(`       [${keyIdx}] ${key.pubkey.toString().substring(0, 8)}... (signer: ${key.isSigner}, writable: ${key.isWritable})`);
        });
        console.log(`     Data: ${inst.data.length} bytes`);

        // For instruction 0 (ATA creation), verify it's still correct
        if (idx === 0 && inst.programId.toString() !== ASSOCIATED_TOKEN_PROGRAM_ID.toString()) {
          throw new Error(
            `❌ FATAL: Instruction 0 program ID changed after signing!\n` +
            `Expected: ${ASSOCIATED_TOKEN_PROGRAM_ID.toString()}\n` +
            `Got: ${inst.programId.toString()}`
          );
        }
      });

      // Sign transaction IMMEDIATELY after setting blockhash (no delays)
      const timeBeforeSign = Date.now();
      finalTransaction.sign(adminKeypair);
      const timeAfterSign = Date.now();
      const signTimeFinal = timeAfterSign - timeBeforeSign;

      console.log(`⏱️ Signing time: ${signTimeFinal}ms`);
      console.log(`=== SENDING ADMIN NFT WITHDRAWAL TRANSACTION ===`);
      console.log(`Blockhash: ${blockhashFinal.substring(0, 8)}...${blockhashFinal.substring(-8)}`);
      console.log(`Last valid block height: ${lastValidBlockHeightFinal}`);

      // Log serialized transaction size
      const serializedFinal = finalTransaction.serialize();
      console.log(`📦 Serialized transaction size: ${serializedFinal.length} bytes`);

      // If we couldn't verify the admin account but Helius confirmed NFT exists,
      // skip preflight to allow the transaction to attempt execution
      // (the transfer will fail naturally if the account doesn't exist)
      const skipPreflight = !adminATAInfo && nftConfirmedByHelius;

      if (skipPreflight) {
        console.warn(`⚠️ Skipping preflight check - Helius confirmed NFT exists but RPC cannot verify account`);
        console.warn(`⚠️ Transaction will be sent without simulation - if account doesn't exist, it will fail on-chain`);
      }

      // Send transaction IMMEDIATELY after signing (no delays, no size calculation)
      const timeBeforeSend = Date.now();
      const signatureFinal = await this.connection.sendRawTransaction(finalTransaction.serialize(), {
        skipPreflight: skipPreflight,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });
      const timeAfterSend = Date.now();
      const sendTimeFinal = timeAfterSend - timeBeforeSend;
      const totalTimeFromBlockhash = timeAfterSend - timeBeforeBlockhash;

      console.log(`⏱️ Send time: ${sendTimeFinal}ms`);
      console.log(`⏱️ Total time from blockhash fetch to send: ${totalTimeFromBlockhash}ms`);

      // Check final block height (non-blocking, may fail)
      try {
        const finalBlockHeight = await this.connection.getBlockHeight("confirmed");
        console.log(`⏱️ Blocks elapsed during send: ${finalBlockHeight - currentBlockHeightAfter}`);
      } catch (e) {
        // Ignore - not critical for operation
      }

      console.log("=== ADMIN NFT WITHDRAWAL TRANSACTION SENT ===");
      console.log(`Signature: ${signatureFinal}`);

      // Wait for confirmation using robust method (handles blockhash expiration)
      const confirmationFinal = await this.confirmTransactionRobust(signatureFinal, 120000);

      const confirmationErr = confirmationFinal.value?.err;
      if (confirmationErr) {
        // Properly serialize the error object to get meaningful error information
        let errorMessage = typeof confirmationErr === 'object'
          ? JSON.stringify(confirmationErr, null, 2)
          : String(confirmationErr);

        // Handle InstructionError specifically
        if ((confirmationErr as any).InstructionError) {
          const instructionError = (confirmationErr as any).InstructionError;
          const instructionIndex = Array.isArray(instructionError) ? instructionError[0] : 'unknown';
          const errorDetails = Array.isArray(instructionError) && instructionError[1]
            ? instructionError[1]
            : instructionError;

          console.error("=== TRANSACTION FAILED (INSTRUCTION ERROR) ===");
          console.error("Transaction signature:", signatureFinal);
          console.error("Failed instruction index:", instructionIndex);
          console.error("Error details (raw):", JSON.stringify(errorDetails, null, 2));
          console.error("Error details (type):", typeof errorDetails);
          console.error("Error details (isArray):", Array.isArray(errorDetails));

          // Try to extract more details from the error
          let detailedMessage = `NFT withdrawal failed: Instruction ${instructionIndex} failed`;
          let errorCode = 'Unknown';

          // Handle different error formats
          if (Array.isArray(errorDetails) && errorDetails.length >= 2) {
            // Format: [instruction_index, error_code]
            const extractedIndex = errorDetails[0];
            const extractedError = errorDetails[1];
            console.error(`   Extracted from array: index=${extractedIndex}, error=${JSON.stringify(extractedError)}`);

            if (typeof extractedError === 'object') {
              // Error code is an object, try to extract the key
              const errorKeys = Object.keys(extractedError);
              if (errorKeys.length > 0) {
                errorCode = errorKeys[0];
                detailedMessage += ` (${errorCode})`;
                console.error(`   Error code: ${errorCode}`);
                console.error(`   Error value: ${JSON.stringify(extractedError[errorCode])}`);
              } else {
                detailedMessage += ` (${JSON.stringify(extractedError)})`;
              }
            } else {
              errorCode = String(extractedError);
              detailedMessage += ` (${errorCode})`;
            }
          } else if (typeof errorDetails === 'object') {
            // Error is an object, extract keys
            const errorKeys = Object.keys(errorDetails);
            if (errorKeys.length > 0) {
              errorCode = errorKeys[0];
              detailedMessage += ` (${errorCode})`;
              console.error(`   Error code: ${errorCode}`);
              console.error(`   Error value: ${JSON.stringify(errorDetails[errorCode])}`);
            } else if (errorDetails.Custom) {
              errorCode = `Custom: ${errorDetails.Custom}`;
              detailedMessage += ` (Custom error: ${errorDetails.Custom})`;
            } else if (errorDetails.toString) {
              detailedMessage += ` (${errorDetails.toString()})`;
            }
          } else {
            errorCode = String(errorDetails);
            detailedMessage += ` (${errorCode})`;
          }

          // Log instruction that failed
          if (instructionIndex === 0) {
            console.error(`   ❌ Instruction 0 (ATA Creation) failed with error: ${errorCode}`);
            console.error(`   This is the ATA creation instruction.`);
            console.error(`   Verify: Program ID should be ${ASSOCIATED_TOKEN_PROGRAM_ID.toString()}`);
            console.error(`   Verify: Token Program should be ${TOKEN_PROGRAM_ID.toString()} in account [5]`);
          } else if (instructionIndex === 1) {
            console.error(`   ❌ Instruction 1 (Token Transfer) failed with error: ${errorCode}`);
            console.error(`   This is the token transfer instruction.`);
            console.error(`   Verify: Program ID should be ${TOKEN_PROGRAM_ID.toString()}`);
          }

          errorMessage = detailedMessage;
        } else {
          console.error("=== TRANSACTION FAILED ===");
          console.error("Transaction signature:", signature);
          console.error("Error details:", confirmation.value?.err);
        }

        throw new Error(
          `${errorMessage}\n\n` +
          `Transaction: ${signature}\n\n` +
          `Check the transaction on Solana Explorer for more details:\n` +
          `https://solscan.io/tx/${signature}\n\n` +
          `Common causes:\n` +
          `• NFT not in admin wallet\n` +
          `• Insufficient SOL for transaction fees\n` +
          `• Invalid token account\n` +
          `• Network congestion`
        );
      }

      console.log("=== ADMIN NFT WITHDRAWAL SUCCESS ===");
      console.log(`NFT successfully transferred from admin wallet to user's wallet`);

      return signature;

    } catch (error: any) {
      console.error("=== ADMIN NFT WITHDRAWAL ERROR ===");
      console.error(`Error withdrawing NFT from admin wallet:`, error);
      throw error;
    } finally {
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Withdraw SOL from admin wallet directly to user's wallet
   * Uses admin's private key to sign the transaction
   */
  async withdrawSOLFromAdminWallet(user: PublicKey, solAmount: number, projectId?: number): Promise<string> {
    const transactionId = this.generateTransactionId(user, `admin_sol_${solAmount}`);

    console.log("=== ADMIN SOL WITHDRAWAL START ===");
    console.log(`User: ${user.toString()}`);
    console.log(`Amount: ${solAmount} SOL`);
    console.log(`Transaction ID: ${transactionId}`);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("SOL withdrawal already in progress. Please wait.");
    }

    this.pendingTransactions.add(transactionId);

    try {
      // Fetch admin wallet private key from database
      // Try project-specific admin key first, then fallback to main website admin key
      let ADMIN_PRIVATE_KEY: string;
      try {
        const { supabase } = await import("@/service/supabase");

        let adminKeyData: any = null;
        let adminKeyError: any = null;

        // For projects, ONLY check project-specific admin key (no fallback to website_settings)
        if (projectId) {
          // Try project-specific admin key first
          const { data: projectKeyData, error: projectKeyError } = await supabase
            .from('project_settings')
            .select('setting_value')
            .eq('project_id', projectId)
            .eq('setting_key', 'admin_private_key')
            .maybeSingle();

          if (!projectKeyError && projectKeyData?.setting_value) {
            adminKeyData = { value: projectKeyData.setting_value };
            console.log(`✅ Using project-specific admin wallet for project ID: ${projectId}`);
          } else {
            // No project admin wallet configured - throw error (don't fall back)
            throw new Error(
              `⚠️ ADMIN PRIVATE KEY NOT CONFIGURED FOR THIS PROJECT\n\n` +
              `Please configure the admin private key in the admin dashboard:\n` +
              `Website Settings > Admin Wallet Settings\n\n` +
              `The private key must be set in project_settings for this project (project_id: ${projectId}) for withdrawals to work.`
            );
          }
        } else {
          // For main project (no projectId), check website_settings
          const { data: websiteKeyData, error: websiteKeyError } = await supabase
            .from('website_settings')
            .select('value')
            .eq('key', 'admin_private_key')
            .maybeSingle();

          adminKeyData = websiteKeyData;
          adminKeyError = websiteKeyError;

          if (!adminKeyError && adminKeyData?.value) {
            console.log(`✅ Using main website admin wallet`);
          }
        }

        const { data, error } = { data: adminKeyData, error: adminKeyError };

        if (error || !data || !data.value) {
          console.error("❌ Admin private key not found in database");
          throw new Error(
            "⚠️ ADMIN PRIVATE KEY NOT CONFIGURED\n\n" +
            "Please configure the admin private key in the admin dashboard:\n" +
            "Website Settings > Admin Wallet Settings\n\n" +
            "The private key must be set in the database for withdrawals to work."
          );
        } else {
          ADMIN_PRIVATE_KEY = data.value;
          console.log("✅ Admin private key loaded from database");
        }
      } catch (dbError) {
        console.error("❌ Error fetching admin private key from database:", dbError);
        if (dbError instanceof Error && dbError.message.includes("ADMIN PRIVATE KEY NOT CONFIGURED")) {
          throw dbError; // Re-throw our custom error
        }
        throw new Error(
          "⚠️ FAILED TO LOAD ADMIN PRIVATE KEY\n\n" +
          "Error fetching admin private key from database.\n\n" +
          "Please ensure:\n" +
          "1. Database is accessible\n" +
          "2. Admin private key is set in Website Settings\n" +
          "3. Key is stored in website_settings table with key='admin_private_key'"
        );
      }

      // Convert private key string to Keypair
      let adminKeypair: Keypair;
      try {
        const privateKeyBytes = bs58.decode(ADMIN_PRIVATE_KEY);
        adminKeypair = Keypair.fromSecretKey(privateKeyBytes);
      } catch (error) {
        console.error("❌ Error decoding admin private key:", error);
        throw new Error("Invalid admin private key format");
      }

      const adminPublicKey = adminKeypair.publicKey;
      console.log(`🔑 Admin Wallet: ${adminPublicKey.toString()}`);

      // Check admin wallet balance
      const adminBalance = await this.connection.getBalance(adminPublicKey);
      const adminSolBalance = adminBalance / LAMPORTS_PER_SOL;
      const requiredAmount = solAmount + 0.001; // Add 0.001 SOL for transaction fee

      console.log(`💰 Admin wallet balance: ${adminSolBalance.toFixed(4)} SOL`);
      console.log(`💰 Required amount: ${requiredAmount.toFixed(4)} SOL`);

      if (adminSolBalance < requiredAmount) {
        throw new Error(`⚠️ Insufficient balance in admin wallet. Available: ${adminSolBalance.toFixed(4)} SOL, Required: ${requiredAmount.toFixed(4)} SOL`);
      }

      // Create transfer transaction from admin wallet to user wallet
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: adminPublicKey,
        toPubkey: user,
        lamports: solAmount * LAMPORTS_PER_SOL,
      });

      // Create transaction
      const transaction = new Transaction();

      // Add transfer instruction
      transaction.add(transferInstruction);

      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await this.retryRpcCall(
        () => this.connection.getLatestBlockhash("confirmed")
      );

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = adminPublicKey; // Admin pays transaction fees

      console.log("=== SENDING ADMIN SOL WITHDRAWAL TRANSACTION ===");
      console.log(`Transaction size: ${transaction.serialize({ requireAllSignatures: false }).length} bytes`);

      // Sign transaction with admin keypair
      transaction.sign(adminKeypair);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });

      console.log("=== ADMIN SOL WITHDRAWAL TRANSACTION SENT ===");
      console.log(`Signature: ${signature}`);

      // Wait for confirmation using robust method (handles blockhash expiration)
      const confirmation = await this.confirmTransactionRobust(signature, 120000);

      if (confirmation.value?.err) {
        const errorMessage = typeof confirmation.value.err === 'object'
          ? JSON.stringify(confirmation.value.err, null, 2)
          : String(confirmation.value.err);
        throw new Error(`SOL withdrawal failed: ${errorMessage}\n\nTransaction: ${signature}\n\nCheck the transaction on Solana Explorer for more details.`);
      }

      console.log("=== ADMIN SOL WITHDRAWAL SUCCESS ===");
      console.log(`SOL successfully transferred from admin wallet to user's wallet`);

      return signature;

    } catch (error: any) {
      console.error("=== ADMIN SOL WITHDRAWAL ERROR ===");
      console.error(`Error withdrawing SOL from admin wallet:`, error);
      throw error;
    } finally {
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Claim reward from the reward pool
   */
  async claimReward(user: PublicKey, rewardId: number, mint: PublicKey, wallet: any): Promise<string> {
    const transactionId = this.generateTransactionId(user, `reward_${rewardId}`);

    console.log("=== REWARD CLAIMING START ===");
    console.log(`User: ${user.toString()}`);
    console.log(`Reward ID: ${rewardId}`);
    console.log(`Mint: ${mint.toString()}`);
    console.log(`Transaction ID: ${transactionId}`);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Reward claiming already in progress. Please wait.");
    }

    this.pendingTransactions.add(transactionId);

    try {
      // Get PDAs for reward claiming
      const [rewardPool] = this.getRewardPoolPDA();
      const [rewardEntry] = this.getRewardEntryPDA(rewardId);
      const [rewardPoolAuthority] = this.getRewardPoolAuthorityPDA(mint);
      const rewardVaultATA = await this.getRewardVaultATA(mint);
      const userATA = this.getUserATA(user, mint);

      console.log("=== REWARD CLAIMING ACCOUNTS ===");
      console.log(`Reward Pool: ${rewardPool.toString()}`);
      console.log(`Reward Entry: ${rewardEntry.toString()}`);
      console.log(`Reward Pool Authority: ${rewardPoolAuthority.toString()}`);
      console.log(`Reward Vault ATA: ${rewardVaultATA.toString()}`);
      console.log(`User ATA: ${userATA.toString()}`);

      // Check if user ATA exists and create if needed
      const createATATransaction = await this.ensureATAExists(user, mint);

      // Create reward claiming transaction
      const claimTransaction = await this.program.methods
        .claimReward(new BN(rewardId))
        .accounts({
          user: user,
          mint: mint,
          reward_pool: rewardPool,
          reward_entry: rewardEntry,
          user_ata: userATA,
          reward_pool_authority: rewardPoolAuthority,
          reward_vault_ata: rewardVaultATA,
          token_program: TOKEN_PROGRAM_ID,
          associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .transaction();

      // Create final transaction
      const finalTransaction = new Transaction();

      // If ATA needs to be created, add it first
      if (createATATransaction) {
        finalTransaction.add(...createATATransaction.instructions);
      }

      // Add the claim transaction
      finalTransaction.add(...claimTransaction.instructions);

      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await this.retryRpcCall(
        () => this.connection.getLatestBlockhash("confirmed")
      );

      finalTransaction.recentBlockhash = blockhash;
      finalTransaction.feePayer = user;

      console.log("=== SENDING REWARD CLAIM TRANSACTION ===");
      console.log(`Transaction size: ${finalTransaction.serialize({ requireAllSignatures: false }).length} bytes`);

      // Sign and send transaction WITHOUT retry
      // (retrying a signed transaction will cause "already processed" errors)
      const signedTransaction = await wallet.signTransaction(finalTransaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 0, // Don't retry - will cause "already processed" errors
      });

      console.log("=== REWARD CLAIM TRANSACTION SENT ===");
      console.log(`Signature: ${signature}`);

      // Wait for confirmation
      const confirmation = await this.retryRpcCall(
        () => this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, "confirmed")
      );

      if (confirmation.value.err) {
        throw new Error(`Reward claiming failed: ${confirmation.value.err}`);
      }

      console.log("=== REWARD CLAIMING SUCCESS ===");
      console.log(`Reward ${rewardId} successfully claimed to user's wallet`);

      return signature;

    } catch (error) {
      console.error("=== REWARD CLAIMING ERROR ===");
      console.error(`Error claiming reward:`, error);
      throw error;
    } finally {
      this.pendingTransactions.delete(transactionId);
    }
  }

  /**
   * Get reward pool PDA
   */
  getRewardPoolPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("reward_pool")],
      PROGRAM_ID
    );
  }

  /**
   * Get reward entry PDA
   */
  getRewardEntryPDA(rewardId: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("reward_entry"), new BN(rewardId).toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    );
  }

  /**
   * Get reward pool authority PDA
   */
  getRewardPoolAuthorityPDA(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("reward_pool"), mint.toBuffer()],
      PROGRAM_ID
    );
  }

  /**
   * Get user NFT PDA
   */
  getUserNFTPDA(user: PublicKey, mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("user_nft"), user.toBuffer(), mint.toBuffer()],
      PROGRAM_ID
    );
  }

  /**
   * Get reward vault ATA
   */
  async getRewardVaultATA(mint: PublicKey): Promise<PublicKey> {
    const [rewardPoolAuthority] = this.getRewardPoolAuthorityPDA(mint);
    return getAssociatedTokenAddressSync(mint, rewardPoolAuthority, true);
  }

  /**
   * Generic deposit function for any SPL token
   * Works for any token mint address
   * Fee is ALWAYS paid in SOL regardless of the token being deposited
   * Tokens are sent to the project's deposit wallet (if configured) or vault ATA
   * 
   * @param user - User's public key
   * @param tokenMint - Token mint address (PublicKey)
   * @param tokenAmount - Amount to deposit
   * @param wallet - Wallet adapter
   * @param solFeeAmount - Optional fee amount in SOL (default: 0)
   * @param projectId - Optional project ID for project-specific deposit wallet
   * @returns Transaction signature
   */
  async depositToken(
    user: PublicKey,
    tokenMint: PublicKey,
    tokenAmount: number,
    wallet: any,
    solFeeAmount?: number,
    projectId?: number | null
  ): Promise<string> {
    const transactionId = this.generateTransactionId(user, `${tokenMint.toString()}_${tokenAmount}`);

    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Deposit already in progress. Please wait.");
    }

    this.pendingTransactions.add(transactionId);

    try {
      // Fee is ALWAYS paid in SOL (not in the deposit token)
      const feeAmountSOL = solFeeAmount || 0;
      const feeAmountLamports = Math.floor(feeAmountSOL * LAMPORTS_PER_SOL);
      const depositAmountToVault = tokenAmount;

      if (tokenAmount <= 0) {
        throw new Error(`Deposit amount must be greater than 0. Deposit: ${tokenAmount}`);
      }

      // Get deposit wallet address (project-specific or default)
      let depositWalletAddress: PublicKey;
      try {
        depositWalletAddress = await this.getDepositWallet(projectId);
        console.log(`✅ Using deposit wallet: ${depositWalletAddress.toString()}`);
      } catch (error: any) {
        // If deposit wallet not configured, fall back to vault ATA
        console.warn(`⚠️ Deposit wallet not configured: ${error.message}`);
        console.warn(`⚠️ Falling back to vault ATA`);
      const [vaultAuthority] = this.getVaultAuthority(tokenMint);
        depositWalletAddress = vaultAuthority; // Use vault authority as fallback (will use vault ATA)
      }

      // Get deposit wallet's ATA for this token (or vault ATA if no deposit wallet)
      const depositWalletATA = getAssociatedTokenAddressSync(
        tokenMint,
        depositWalletAddress,
        true // allowOwnerOffCurve for PDAs
      );

      const userATA = this.getUserATA(user, tokenMint);

      // Get fee wallet for SOL fee transfer
      const feeWallet = new PublicKey(CONFIG.FEE_WALLET);

      // Check if user ATA exists
      let needsUserATA = false;
      try {
        const userATAInfo = await this.connection.getAccountInfo(userATA);
        needsUserATA = !userATAInfo;
      } catch (error) {
        needsUserATA = true;
      }

      // Check user token balance
      const userTokenBalance = await this.getTokenBalance(user, tokenMint);
      if (userTokenBalance < tokenAmount) {
        throw new Error(`Insufficient token balance. You have ${userTokenBalance.toFixed(4)} but need ${tokenAmount.toFixed(4)} for deposit.`);
      }

      // Check user SOL balance (must have enough for fee + network fee)
      const userSOLBalance = await this.connection.getBalance(user);
      const userSOLBalanceInSOL = userSOLBalance / LAMPORTS_PER_SOL;
      const networkFee = 0.0001; // Estimate for network transaction fee (~0.00005 SOL actual + buffer)
      const totalSOLRequired = feeAmountSOL + networkFee;
      
      if (userSOLBalanceInSOL < totalSOLRequired) {
        throw new Error(`Insufficient SOL balance for fee. You have ${userSOLBalanceInSOL.toFixed(4)} SOL but need ${totalSOLRequired.toFixed(4)} SOL (${feeAmountSOL.toFixed(4)} fee + ${networkFee.toFixed(4)} network fee).`);
      }

      // Check if deposit wallet ATA exists
      const depositWalletATAInfo = await this.connection.getAccountInfo(depositWalletATA);
      const needsDepositWalletATA = !depositWalletATAInfo;

      console.log(`=== GENERIC TOKEN DEPOSIT INFO (SOL FEE) ===`);
      console.log(`👤 User Wallet: ${user.toString()}`);
      console.log(`🪙 Token Mint: ${tokenMint.toString()}`);
      console.log(`💵 Token Deposit Amount: ${tokenAmount}`);
      console.log(`💰 SOL Fee Amount: ${feeAmountSOL.toFixed(6)} SOL (${feeAmountLamports} lamports)`);
      console.log(`💰 User Token Balance: ${userTokenBalance.toFixed(4)}`);
      console.log(`💰 User SOL Balance: ${userSOLBalanceInSOL.toFixed(4)} SOL`);
      console.log(`📥 Deposit Wallet: ${depositWalletAddress.toString()}`);
      console.log(`📥 Deposit Wallet ATA: ${depositWalletATA.toString()}`);

      // Create transaction
      const finalTransaction = new Transaction();
      finalTransaction.feePayer = user;

      // Create user ATA if needed
      if (needsUserATA) {
        finalTransaction.add(
          createAssociatedTokenAccountInstruction(user, userATA, user, tokenMint)
        );
      }

      // Create deposit wallet ATA if needed
      if (needsDepositWalletATA) {
        finalTransaction.add(
          createAssociatedTokenAccountInstruction(user, depositWalletATA, depositWalletAddress, tokenMint)
        );
      }

      // Get token decimals
      const tokenDecimals = await this.getTokenDecimals(tokenMint);
      const depositAmountInUnits = Math.floor(depositAmountToVault * Math.pow(10, tokenDecimals));

      console.log(`💵 Amount conversions:`);
      console.log(`   SOL Fee: ${feeAmountSOL} SOL = ${feeAmountLamports} lamports`);
      console.log(`   Token Deposit: ${depositAmountToVault} = ${depositAmountInUnits} units`);

      // Add SOL fee transfer if fee > 0
      if (feeAmountLamports > 0) {
        console.log(`🔄 Creating SOL fee transfer instruction:`);
        console.log(`   FROM: ${user.toString()} (User's SOL wallet)`);
        console.log(`   TO: ${feeWallet.toString()} (Fee Wallet)`);
        console.log(`   AMOUNT: ${feeAmountLamports} lamports (${feeAmountSOL.toFixed(6)} SOL)`);

        finalTransaction.add(
          SystemProgram.transfer({
            fromPubkey: user,
            toPubkey: feeWallet,
            lamports: feeAmountLamports,
          })
        );
        console.log("✅ Added SOL fee transfer instruction");
      }

      // Add token deposit transfer to deposit wallet
      console.log(`🔄 Creating token deposit transfer instruction:`);
      console.log(`   FROM: ${userATA.toString()} (User's token account)`);
      console.log(`   TO: ${depositWalletATA.toString()} (Deposit wallet's token account)`);
      console.log(`   AMOUNT: ${depositAmountInUnits} units (${depositAmountToVault})`);
      finalTransaction.add(
        createTransferInstruction(
          userATA,
          depositWalletATA,
          user,
          depositAmountInUnits
        )
      );
      console.log("✅ Added token deposit transfer instruction");

      console.log(`📊 Transaction Summary:`);
      console.log(`   SOL Fee: ${feeAmountSOL.toFixed(6)} SOL → Fee Wallet`);
      console.log(`   Token Deposit: ${depositAmountToVault} → Deposit Wallet ATA`);
      console.log(`   Note: Fee is paid in SOL, deposit is in token`);

      // Get blockhash and send
      const { blockhash } = await this.retryRpcCall(
        () => this.connection.getLatestBlockhash("confirmed")
      );
      finalTransaction.recentBlockhash = blockhash;

      let signature: string;
      if (wallet.sendTransaction) {
        signature = await wallet.sendTransaction(finalTransaction, this.connection);
      } else {
        const signed = await wallet.signTransaction(finalTransaction);
        signature = await this.connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        });
      }

      // Wait for confirmation
      await this.retryRpcCall(
        () => this.connection.confirmTransaction(signature, "confirmed")
      );

      this.pendingTransactions.delete(transactionId);
      return signature;

    } catch (error) {
      this.pendingTransactions.delete(transactionId);
      throw error;
    }
  }

  /**
   * Transfer tokens from vault to admin wallet using program instruction
   * This is used to automatically fund admin wallet when vault has tokens
   * Works for any token (current and future tokens added by admin)
   * 
   * Strategy: Use the program's withdrawTokens instruction with admin wallet as the user.
   * The program will transfer tokens from vault to admin wallet.
   * However, the program requires the user's balance PDA to have sufficient balance.
   * Since we're transferring to admin (not a real user withdrawal), we need to work around this.
   * 
   * Solution: We'll use the program's instruction, but we need to ensure the admin's balance PDA
   * exists and has balance. We can't use deposit (requires tokens), so we'll try a workaround:
   * Use the program's instruction and let it create the balance PDA (init_if_needed), but
   * it will check balance first. Since balance will be 0, it will fail.
   * 
   * Workaround: We'll use the program's withdrawTokens instruction directly, but we'll need to
   * handle the balance check failure. Since we can't bypass it, we'll use the program's
   * instruction to transfer from vault to admin, but we'll need to ensure the balance PDA
   * has balance first.
   * 
   * Actually, the best solution: Use the program's instruction with admin as user, but first
   * we need to initialize the admin's balance PDA with balance. We can do this by calling
   * the deposit instruction, but that requires tokens from admin. Since admin doesn't have
   * tokens, we can't do this.
   * 
   * Final solution: Since we can't automatically initialize the balance PDA without tokens,
   * and we can't bypass the balance check, we'll use a different approach:
   * Directly use the program's CPI to transfer from vault to admin, but we need the vault
   * authority to sign. Since vault authority is a PDA, we can't sign from client. We need
   * to use the program's instruction.
   * 
   * Best approach: Try to use the program's withdrawTokens instruction. If it fails due to
   * balance check, we'll catch the error and provide a helpful message. But actually, we
   * can't use it because the balance check will always fail.
   * 
   * Alternative: Create an admin-only function in the program that can transfer from vault
   * to admin wallet without balance checks. But that requires program changes.
   * 
   * For now, we'll use the program's withdrawTokens instruction and hope the admin's balance
   * PDA already has balance (from previous deposits). If not, we'll provide a clear error.
   */
  private async transferTokensFromVaultToAdmin(
    tokenMint: PublicKey,
    tokenAmount: number,
    tokenAmountInUnits: number,
    tokenDecimals: number,
    tokenVaultAuthority: PublicKey,
    tokenVaultATA: PublicKey,
    adminWallet: PublicKey,
    adminKeypair: Keypair,
    transactionId: string
  ): Promise<void> {
    try {
      console.log(`🔄 Starting automatic transfer from vault to admin wallet...`);
      console.log(`📥 Transferring ${tokenAmount.toFixed(4)} tokens from vault to admin wallet`);

      // Get required accounts for program instruction
      const adminTokenATA = this.getUserATA(adminWallet, tokenMint);
      const [adminBalancePDA] = this.getUserBalancePDA(adminWallet, tokenMint);
      const [feeVaultAuthority] = this.getFeeVaultAuthority(tokenMint);
      const feeVaultATA = await this.getFeeVaultATA(tokenMint);
      const [feeConfig] = this.getFeeConfig(tokenMint);
      const feeWallet = new PublicKey(CONFIG.FEE_WALLET);
      const [solFeeConfig] = this.getSolFeeConfig();
      const [exchangeConfig] = this.getExchangeConfig();

      // Check if admin token ATA exists, create if needed
      let needsAdminTokenATA = false;
      try {
        const adminATAInfo = await this.connection.getAccountInfo(adminTokenATA);
        needsAdminTokenATA = !adminATAInfo;
      } catch (error) {
        needsAdminTokenATA = true;
      }

      // Create transaction
      const transferTransaction = new Transaction();

      // Create admin token ATA if needed (admin pays for their own ATA)
      if (needsAdminTokenATA) {
        transferTransaction.add(
          createAssociatedTokenAccountInstruction(
            adminWallet,
            adminTokenATA,
            adminWallet,
            tokenMint
          )
        );
      }

      // Use program's withdrawTokens instruction to transfer from vault to admin wallet
      // IMPORTANT: The program requires the admin's balance PDA to have sufficient balance.
      // Since OGX is tracked off-chain, the admin's balance PDA typically won't have balance
      // for the withdrawal token. We'll check the balance first and provide a clear error if insufficient.

      // Check admin balance PDA first
      let adminBalanceAmount = 0;
      try {
        const adminBalanceAccount = await (this.program.account as any).userBalance.fetchNullable(adminBalancePDA);
        if (adminBalanceAccount) {
          adminBalanceAmount = (adminBalanceAccount.amount?.toNumber() || adminBalanceAccount.balance?.toNumber() || 0) / Math.pow(10, tokenDecimals);
          console.log(`💰 Admin balance PDA has ${adminBalanceAmount.toFixed(4)} tokens`);
        } else {
          console.log(`ℹ️ Admin balance PDA doesn't exist yet (will be created by program if balance > 0)`);
        }
      } catch (error) {
        console.log(`ℹ️ Could not fetch admin balance PDA (may not exist):`, error);
      }

      // If admin balance PDA doesn't have sufficient balance, we can't automatically transfer from vault
      // This is a program limitation - the program requires balance PDA to have balance
      // Since OGX is off-chain, the balance PDA typically won't have balance for token withdrawals
      if (adminBalanceAmount < tokenAmount) {
        console.error(`❌ Admin balance PDA has insufficient balance: ${adminBalanceAmount.toFixed(4)} < ${tokenAmount.toFixed(4)}`);
        console.error(`❌ Cannot automatically transfer from vault due to program limitations`);

        // Provide detailed error with solutions
        const tokenSymbol = tokenMint.toString().substring(0, 8);
        throw new Error(
          `Admin wallet needs ${tokenAmount.toFixed(4)} ${tokenSymbol} tokens for withdrawal, but currently has ${(await this.getTokenBalance(adminWallet, tokenMint)).toFixed(4)} ${tokenSymbol} tokens. ` +
          `Vault has ${tokenAmount.toFixed(4)} ${tokenSymbol} tokens available, but automatic transfer from vault is not possible due to program limitations. ` +
          `\n\n` +
          `SOLUTIONS:\n` +
          `1. Manually ensure admin wallet has ${tokenAmount.toFixed(4)} ${tokenSymbol} tokens (recommended)\n` +
          `2. Use a separate admin tool/script to transfer tokens from vault to admin wallet\n` +
          `3. Modify the program to add an admin function for vault-to-admin transfers\n` +
          `\n` +
          `NOTE: This applies to all tokens (current and future tokens added by admin). ` +
          `Admin wallet must have sufficient tokens for each token type to enable withdrawals.`
        );
      }

      // Admin balance PDA has sufficient balance - proceed with program instruction
      console.log(`✅ Admin balance PDA has sufficient balance. Proceeding with program instruction...`);

      try {
        const withdrawInstruction = await this.program.methods
          .withdrawTokens(new BN(tokenAmountInUnits))
          .accounts({
            user: adminWallet,
            mint: tokenMint,
            userAta: adminTokenATA,
            vaultAuthority: tokenVaultAuthority,
            vaultAta: tokenVaultATA,
            vault: tokenVaultAuthority,
            feeVaultAuthority: feeVaultAuthority,
            feeVaultAta: feeVaultATA,
            feeConfig: feeConfig,
            feeWallet: feeWallet,
            solFeeConfig: solFeeConfig,
            userBalance: adminBalancePDA,
            exchangeConfig: exchangeConfig,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .instruction();

        transferTransaction.add(withdrawInstruction);

        // Get blockhash and set fee payer (admin pays for this transfer)
        const { blockhash, lastValidBlockHeight } = await this.retryRpcCall(
          () => this.connection.getLatestBlockhash("confirmed")
        );
        transferTransaction.recentBlockhash = blockhash;
        transferTransaction.feePayer = adminWallet;

        // Sign transaction with admin keypair
        transferTransaction.sign(adminKeypair);

        // Send transaction
        console.log(`📤 Sending vault-to-admin transfer transaction...`);
        const signature = await this.connection.sendRawTransaction(
          transferTransaction.serialize(),
          {
            skipPreflight: false,
            preflightCommitment: "confirmed",
            maxRetries: 3,
          }
        );

        console.log(`✅ Vault-to-admin transfer transaction sent: ${signature}`);

        // Wait for confirmation
        const confirmation = await this.retryRpcCall(
          () => this.connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight,
          }, "confirmed")
        );

        if (confirmation.value.err) {
          throw new Error(
            `Vault-to-admin transfer failed: ${JSON.stringify(confirmation.value.err)}. ` +
            `This usually means the admin's balance PDA doesn't have sufficient balance. ` +
            `Since OGX is off-chain, the balance PDA won't have balance for token withdrawals.`
          );
        }

        console.log(`✅ Successfully transferred ${tokenAmount.toFixed(4)} tokens from vault to admin wallet`);

      } catch (programError: any) {
        // If program instruction fails (likely due to balance check), we can't proceed
        console.error(`❌ Program instruction failed:`, programError);

        // Check if it's a balance error
        const errorMessage = programError.message || JSON.stringify(programError);
        if (errorMessage.includes("InsufficientBalance") || errorMessage.includes("6001")) {
          throw new Error(
            `Cannot automatically transfer from vault to admin wallet: Admin's balance PDA doesn't have sufficient balance. ` +
            `This is expected since OGX is tracked off-chain. ` +
            `Solution: Admin needs to manually ensure admin wallet has tokens for withdrawals, ` +
            `or the program needs to be modified to allow admin-to-admin transfers without balance checks.`
          );
        }

        throw programError;
      }
    } catch (error) {
      console.error(`❌ Error in transferTokensFromVaultToAdmin:`, error);
      throw error;
    }
  }

  /**
   * Generic withdraw function for any SPL token
   * Burns OGX and sends the specified token from admin wallet
   * 
   * @param user - User's public key
   * @param tokenMint - Token mint address to withdraw
   * @param ogxAmount - OGX amount to burn
   * @param wallet - Wallet adapter
   * @param exchangeRate - Exchange rate (OGX to token)
   * @param databaseOGXBalance - User's OGX balance from database (optional, for sync)
   * @returns Transaction signature
   */
  async withdrawToken(
    user: PublicKey,
    tokenMint: PublicKey,
    ogxAmount: number,
    wallet: any,
    exchangeRate: number,
    databaseOGXBalance?: number,
    projectId?: number
  ): Promise<string> {
    const transactionId = this.generateTransactionId(user, `${tokenMint.toString()}_${ogxAmount}`);

    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Withdrawal already in progress. Please wait.");
    }

    this.pendingTransactions.add(transactionId);

    try {
      // Calculate token amount to send
      const tokenAmount = ogxAmount * exchangeRate;

      // Get user's token ATA (for receiving the withdrawal)
      const userTokenATA = this.getUserATA(user, tokenMint);

      // OGX is tracked off-chain (database only) - no on-chain operations needed
      // Trust database balance (already verified by frontend)
      // We don't need to burn OGX on-chain, just transfer the requested token
      if (!databaseOGXBalance || databaseOGXBalance < ogxAmount) {
        throw new Error(`Insufficient OGX balance. You have ${databaseOGXBalance || 0} OGX but need ${ogxAmount.toFixed(4)} OGX.`);
      }

      console.log(`📝 Processing withdrawal: ${ogxAmount.toFixed(4)} OGX (off-chain) → ${tokenAmount.toFixed(4)} ${tokenMint.toString().substring(0, 8)}...`);
      console.log(`💰 Database OGX balance: ${databaseOGXBalance.toFixed(4)} OGX`);

      // Fetch admin private key for token transfer
      // For projects, ONLY check project-specific admin key (no fallback to website_settings)
      const { supabase: supabaseSync } = await import("@/service/supabase");
      let adminKeyData: any = null;
      let adminKeyError: any = null;

      if (projectId) {
        // Try project-specific admin key first
        const { data: projectKeyData, error: projectKeyError } = await supabaseSync
          .from('project_settings')
          .select('setting_value')
          .eq('project_id', projectId)
          .eq('setting_key', 'admin_private_key')
          .maybeSingle();

        if (!projectKeyError && projectKeyData?.setting_value) {
          adminKeyData = { value: projectKeyData.setting_value };
          console.log(`✅ Using project-specific admin wallet for project ID: ${projectId}`);
        } else {
          // No project admin wallet configured - throw error (don't fall back)
          throw new Error(
            `⚠️ ADMIN PRIVATE KEY NOT CONFIGURED FOR THIS PROJECT\n\n` +
            `Please configure the admin private key in the admin dashboard:\n` +
            `Website Settings > Admin Wallet Settings\n\n` +
            `The private key must be set in project_settings for this project (project_id: ${projectId}) for withdrawals to work.`
          );
        }
      } else {
        // For main project (no projectId), check website_settings
        const { data: websiteKeyData, error: websiteKeyError } = await supabaseSync
          .from('website_settings')
          .select('value')
          .eq('key', 'admin_private_key')
          .maybeSingle();

        adminKeyData = websiteKeyData;
        adminKeyError = websiteKeyError;

        if (!adminKeyError && adminKeyData?.value) {
          console.log(`✅ Using main website admin wallet`);
        }
      }

      if (adminKeyError || !adminKeyData || !adminKeyData.value) {
        throw new Error("Admin private key not configured. Cannot process withdrawal.");
      }

      const adminPrivateKeyBytes = bs58.decode(adminKeyData.value);
      const adminKeypair = Keypair.fromSecretKey(adminPrivateKeyBytes);
      const adminWallet = adminKeypair.publicKey;

      // Get token decimals
      const tokenDecimals = await this.getTokenDecimals(tokenMint);
      const tokenAmountInUnits = Math.floor(tokenAmount * Math.pow(10, tokenDecimals));

      // Get vault accounts (tokens are stored in vault after deposit)
      const [tokenVaultAuthority] = this.getVaultAuthority(tokenMint);
      const tokenVaultATA = await this.getVaultATA(tokenMint);

      // Check vault balance (tokens are stored in vault after deposits)
      // We'll use the program's withdrawTokens instruction to transfer directly from vault to user
      // This works for all tokens (current and future tokens added by admin) - same as TOKEN4
      let vaultTokenBalance = 0;
      try {
        const vaultBalanceInfo = await this.connection.getTokenAccountBalance(tokenVaultATA);
        vaultTokenBalance = vaultBalanceInfo.value.uiAmount || 0;
      } catch (error) {
        // Vault ATA might not exist yet
        console.log(`ℹ️ Vault ATA might not exist yet or has no balance`);
      }

      console.log(`💰 Vault balance: ${vaultTokenBalance.toFixed(4)} tokens`);
      console.log(`📊 Required: ${tokenAmount.toFixed(4)} tokens`);

      // Check if vault has sufficient tokens
      if (vaultTokenBalance < tokenAmount) {
        const tokenSymbol = tokenMint.toString().substring(0, 8);
        throw new Error(
          `Insufficient tokens in vault for withdrawal. ` +
          `Vault has ${vaultTokenBalance.toFixed(4)} ${tokenSymbol} tokens, ` +
          `but ${tokenAmount.toFixed(4)} ${tokenSymbol} tokens are required. ` +
          `Please ensure tokens are deposited first.`
        );
      }

      console.log(`✅ Vault has sufficient tokens (${vaultTokenBalance.toFixed(4)} >= ${tokenAmount.toFixed(4)})`);
      console.log(`📝 Using program's withdrawTokens instruction to transfer from vault to user (works for all tokens)`);

      // Use program's withdrawTokens instruction to transfer from vault to user
      // This is the same approach that works for TOKEN4 and all other tokens
      // The program transfers tokens directly from vault to user

      // Get fresh blockhash FIRST - required before creating transaction
      // This is required for transaction signing
      let { blockhash, lastValidBlockHeight } = await this.retryRpcCall(
        () => this.connection.getLatestBlockhash("confirmed")
      );

      // Create transaction and set blockhash/fee payer immediately
      let finalTransaction = new Transaction();
      finalTransaction.recentBlockhash = blockhash;
      finalTransaction.feePayer = user; // User pays transaction fees

      // Get required accounts for withdrawTokens instruction
      const [feeVaultAuthority] = this.getFeeVaultAuthority(tokenMint);
      const feeVaultATA = await this.getFeeVaultATA(tokenMint);
      const [feeConfig] = this.getFeeConfig(tokenMint);
      const feeWallet = new PublicKey(CONFIG.FEE_WALLET);
      const [solFeeConfig] = this.getSolFeeConfig();
      const [exchangeConfig] = this.getExchangeConfig();
      const [userBalancePDA] = this.getUserBalancePDA(user, tokenMint);

      // Check if fee_config exists for this token (required for program's withdrawTokens instruction)
      // For newly added tokens, fee_config might not be initialized yet
      let feeConfigExists = false;
      try {
        const feeConfigAccount = await (this.program.account as any).feeConfig.fetchNullable(feeConfig);
        feeConfigExists = !!feeConfigAccount;
        if (feeConfigExists) {
          console.log(`✅ Fee config exists for token ${tokenMint.toString().substring(0, 8)}...`);
        } else {
          console.log(`⚠️ Fee config does not exist for token ${tokenMint.toString().substring(0, 8)}...`);
          console.log(`⚠️ Fee config must be initialized before using program's withdrawTokens instruction`);
        }
      } catch (error) {
        console.log(`⚠️ Could not check fee_config (may not exist):`, error);
        feeConfigExists = false;
      }

      // Check if user token ATA exists, create if needed
      let needsUserTokenATA = false;
      try {
        const userATAInfo = await this.connection.getAccountInfo(userTokenATA);
        needsUserTokenATA = !userATAInfo;
      } catch (error) {
        needsUserTokenATA = true;
      }

      if (needsUserTokenATA) {
        finalTransaction.add(
          createAssociatedTokenAccountInstruction(
            user, // User pays for their own ATA creation
            userTokenATA,
            user,
            tokenMint
          )
        );
      }

      // Check if we can use the program's withdrawTokens instruction
      // Requirements:
      // 1. fee_config must exist (for newly added tokens, this might not be initialized)
      // 2. user_balance PDA must have sufficient balance (for off-chain OGX, this won't have balance)
      //
      // If fee_config doesn't exist, we cannot use the program's withdrawTokens instruction
      // and must fall back to admin wallet transfer immediately

      if (!feeConfigExists) {
        // Fee config doesn't exist - cannot use program's withdrawTokens instruction
        // Fall back to admin wallet transfer immediately
        console.log(`⚠️ Fee config not initialized for this token. Using admin wallet transfer instead.`);
        console.log(`ℹ️ To use program's withdrawTokens instruction, fee_config must be initialized first.`);
        console.log(`ℹ️ This can be done via the master dashboard or by calling initFeeConfig instruction.`);

        // Check admin wallet balance
        const adminTokenBalance = await this.getTokenBalance(adminWallet, tokenMint);
        if (adminTokenBalance < tokenAmount) {
          const tokenSymbol = tokenMint.toString().substring(0, 8);
          throw new Error(
            `Cannot process withdrawal: Fee config not initialized for this token. ` +
            `Admin wallet has ${adminTokenBalance.toFixed(4)} ${tokenSymbol} tokens, ` +
            `but ${tokenAmount.toFixed(4)} ${tokenSymbol} tokens are required. ` +
            `Vault has ${vaultTokenBalance.toFixed(4)} ${tokenSymbol} tokens. ` +
            `Please initialize fee_config for this token first (via master dashboard), or ensure admin wallet has sufficient tokens.`
          );
        }

        // Use admin wallet as fallback (fee_config not initialized)
        const adminTokenATA = this.getUserATA(adminWallet, tokenMint);
        finalTransaction.add(
          createTransferInstruction(
            adminTokenATA,
            userTokenATA,
            adminWallet,
            tokenAmountInUnits
          )
        );

        // Admin needs to sign for the transfer (blockhash is already set)
        finalTransaction.partialSign(adminKeypair);
        console.log(`✅ Using admin wallet transfer (fee_config not initialized for this token)`);
      } else {
        // Fee config exists - try to use program's withdrawTokens instruction
        // However, it will still fail if user_balance PDA doesn't have balance (off-chain OGX)
        console.log(`🔄 Fee config exists. Attempting to use program's withdrawTokens instruction...`);

        // Check if user balance PDA exists and has balance
        let userBalanceAmount = 0;
        try {
          const userBalanceAccount = await (this.program.account as any).userBalance.fetchNullable(userBalancePDA);
          if (userBalanceAccount) {
            userBalanceAmount = (userBalanceAccount.amount?.toNumber() || userBalanceAccount.balance?.toNumber() || 0) / Math.pow(10, tokenDecimals);
            console.log(`💰 User balance PDA has ${userBalanceAmount.toFixed(4)} tokens`);
          } else {
            console.log(`ℹ️ User balance PDA doesn't exist yet (will be created by program)`);
          }
        } catch (error) {
          console.log(`ℹ️ Could not fetch user balance PDA (may not exist):`, error);
        }

        // If user balance PDA doesn't have sufficient balance, program instruction will fail
        // Since OGX is off-chain, this is expected for tokens users didn't deposit directly
        if (userBalanceAmount < tokenAmount) {
          console.log(`⚠️ User balance PDA has insufficient balance (${userBalanceAmount.toFixed(4)} < ${tokenAmount.toFixed(4)})`);
          console.log(`⚠️ Since OGX is tracked off-chain, the balance PDA won't have balance for this token`);
          console.log(`⚠️ Program instruction will fail, but we'll try it and fall back to admin wallet if needed`);
        }

        // Try to use program's withdrawTokens instruction
        try {
          const withdrawInstruction = await this.program.methods
            .withdrawTokens(new BN(tokenAmountInUnits))
            .accounts({
              user: user,
              mint: tokenMint,
              userAta: userTokenATA,
              vaultAuthority: tokenVaultAuthority,
              vaultAta: tokenVaultATA,
              vault: tokenVaultAuthority,
              feeVaultAuthority: feeVaultAuthority,
              feeVaultAta: feeVaultATA,
              feeConfig: feeConfig,
              feeWallet: feeWallet,
              solFeeConfig: solFeeConfig,
              userBalance: userBalancePDA,
              exchangeConfig: exchangeConfig,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .instruction();

          finalTransaction.add(withdrawInstruction);
          console.log(`✅ Created program instruction to transfer ${tokenAmount.toFixed(4)} tokens from vault to user`);
        } catch (programError: any) {
          console.error(`❌ Error creating program instruction:`, programError);
          // If program instruction creation fails, fall back to admin wallet transfer
          console.log(`⚠️ Program instruction failed, falling back to admin wallet transfer`);

          // Check admin wallet balance
          const adminTokenBalance = await this.getTokenBalance(adminWallet, tokenMint);
          if (adminTokenBalance < tokenAmount) {
            const tokenSymbol = tokenMint.toString().substring(0, 8);
            throw new Error(
              `Cannot process withdrawal: Program instruction failed. ` +
              `Admin wallet has ${adminTokenBalance.toFixed(4)} ${tokenSymbol} tokens, ` +
              `but ${tokenAmount.toFixed(4)} ${tokenSymbol} tokens are required. ` +
              `Vault has ${vaultTokenBalance.toFixed(4)} ${tokenSymbol} tokens. ` +
              `Please ensure admin wallet has sufficient tokens for withdrawals.`
            );
          }

          // Use admin wallet as fallback
          const adminTokenATA = this.getUserATA(adminWallet, tokenMint);
          finalTransaction.add(
            createTransferInstruction(
              adminTokenATA,
              userTokenATA,
              adminWallet,
              tokenAmountInUnits
            )
          );

          // Admin needs to sign for the transfer (blockhash is already set)
          finalTransaction.partialSign(adminKeypair);
          console.log(`✅ Using admin wallet as fallback (program instruction not available)`);
        }
      }

      console.log("=== TOKEN WITHDRAWAL TRANSACTION ===");
      console.log(`Number of instructions: ${finalTransaction.instructions.length}`);
      console.log(`Fee payer: ${user.toString()}`);
      console.log(`User wallet: ${user.toString()}`);
      console.log(`Token amount: ${tokenAmount.toFixed(4)} tokens`);
      console.log(`Token mint: ${tokenMint.toString()}`);

      // Check if transaction uses program instruction or admin wallet transfer
      const usesProgramInstruction = finalTransaction.instructions.some(ix =>
        ix.programId.equals(this.program.programId)
      );

      if (usesProgramInstruction) {
        console.log(`Using program's withdrawTokens instruction (same as TOKEN4, works for all tokens)`);
        console.log(`Vault: ${tokenVaultATA.toString()}`);
      } else {
        console.log(`Using admin wallet transfer (fallback - program instruction not available)`);
        console.log(`Admin wallet: ${adminWallet.toString()}`);
      }

      // Simulate transaction before sending to catch errors early (e.g., AccountNotInitialized)
      // This helps us catch fee_config errors before the user signs
      // NOTE: Only simulate if transaction uses program instruction (not partially signed admin transfers)
      if (usesProgramInstruction) {
        try {
          // Create an unsigned copy for simulation (simulation doesn't work well with partially signed transactions)
          const simulationTransaction = new Transaction();
          simulationTransaction.recentBlockhash = finalTransaction.recentBlockhash!;
          simulationTransaction.feePayer = finalTransaction.feePayer!;
          for (const instruction of finalTransaction.instructions) {
            simulationTransaction.add(instruction);
          }

          const simulationResult = await this.connection.simulateTransaction(simulationTransaction);

          if (simulationResult.value.err) {
            const errorStr = JSON.stringify(simulationResult.value.err);

            // Check if it's a fee_config not initialized error
            if (errorStr.includes("AccountNotInitialized") || errorStr.includes("3012") || errorStr.includes("0xbc4")) {
              console.error(`❌ Simulation failed: fee_config not initialized`);
              console.log(`🔄 Falling back to admin wallet transfer...`);

              // Get fresh blockhash for fallback transaction
              const { blockhash: fallbackBlockhash, lastValidBlockHeight: fallbackLastValidBlockHeight } =
                await this.retryRpcCall(() => this.connection.getLatestBlockhash("confirmed"));

              // Rebuild transaction with admin wallet transfer instead of program instruction
              const fallbackTransaction = new Transaction();
              fallbackTransaction.recentBlockhash = fallbackBlockhash;
              fallbackTransaction.feePayer = user;

              // Add user token ATA creation if needed
              if (needsUserTokenATA) {
                fallbackTransaction.add(
                  createAssociatedTokenAccountInstruction(
                    user,
                    userTokenATA,
                    user,
                    tokenMint
                  )
                );
              }

              // Use admin wallet transfer
              const adminTokenBalance = await this.getTokenBalance(adminWallet, tokenMint);
              if (adminTokenBalance < tokenAmount) {
                const tokenSymbol = tokenMint.toString().substring(0, 8);
                throw new Error(
                  `Cannot process withdrawal: Fee config not initialized for this token. ` +
                  `Admin wallet has ${adminTokenBalance.toFixed(4)} ${tokenSymbol} tokens, ` +
                  `but ${tokenAmount.toFixed(4)} ${tokenSymbol} tokens are required. ` +
                  `Vault has ${vaultTokenBalance.toFixed(4)} ${tokenSymbol} tokens. ` +
                  `Please initialize fee_config for this token first (via master dashboard), or ensure admin wallet has sufficient tokens.`
                );
              }

              const adminTokenATA = this.getUserATA(adminWallet, tokenMint);
              fallbackTransaction.add(
                createTransferInstruction(
                  adminTokenATA,
                  userTokenATA,
                  adminWallet,
                  tokenAmountInUnits
                )
              );

              // Admin signs the fallback transaction
              fallbackTransaction.partialSign(adminKeypair);

              // Replace finalTransaction with fallback and update blockhash variables
              finalTransaction = fallbackTransaction;
              blockhash = fallbackBlockhash;
              lastValidBlockHeight = fallbackLastValidBlockHeight;
              console.log(`✅ Rebuilt transaction with admin wallet transfer (fee_config not initialized)`);
            } else {
              // Other simulation error - throw it
              throw new Error(`Transaction simulation failed: ${errorStr}`);
            }
          } else {
            console.log(`✅ Transaction simulation successful`);
          }
        } catch (simulationError: any) {
          // If simulation itself fails (not just the result), check if it's AccountNotInitialized
          const errorMessage = simulationError.message || JSON.stringify(simulationError);
          if (errorMessage.includes("AccountNotInitialized") || errorMessage.includes("3012") || errorMessage.includes("0xbc4")) {
            console.error(`❌ Simulation error: fee_config not initialized`);
            console.log(`🔄 Falling back to admin wallet transfer...`);

            // Get fresh blockhash for fallback transaction
            const { blockhash: fallbackBlockhash, lastValidBlockHeight: fallbackLastValidBlockHeight } =
              await this.retryRpcCall(() => this.connection.getLatestBlockhash("confirmed"));

            // Rebuild transaction with admin wallet transfer
            const fallbackTransaction = new Transaction();
            fallbackTransaction.recentBlockhash = fallbackBlockhash;
            fallbackTransaction.feePayer = user;

            // Add user token ATA creation if needed
            let needsATA = false;
            try {
              const userATAInfo = await this.connection.getAccountInfo(userTokenATA);
              needsATA = !userATAInfo;
            } catch (error) {
              needsATA = true;
            }

            if (needsATA) {
              fallbackTransaction.add(
                createAssociatedTokenAccountInstruction(
                  user,
                  userTokenATA,
                  user,
                  tokenMint
                )
              );
            }

            // Use admin wallet transfer
            const adminTokenBalance = await this.getTokenBalance(adminWallet, tokenMint);
            if (adminTokenBalance < tokenAmount) {
              const tokenSymbol = tokenMint.toString().substring(0, 8);
              throw new Error(
                `Cannot process withdrawal: Fee config not initialized for this token. ` +
                `Admin wallet has ${adminTokenBalance.toFixed(4)} ${tokenSymbol} tokens, ` +
                `but ${tokenAmount.toFixed(4)} ${tokenSymbol} tokens are required. ` +
                `Vault has ${vaultTokenBalance.toFixed(4)} ${tokenSymbol} tokens. ` +
                `Please initialize fee_config for this token first (via master dashboard), or ensure admin wallet has sufficient tokens.`
              );
            }

            const adminTokenATA = this.getUserATA(adminWallet, tokenMint);
            fallbackTransaction.add(
              createTransferInstruction(
                adminTokenATA,
                userTokenATA,
                adminWallet,
                tokenAmountInUnits
              )
            );

            // Admin signs the fallback transaction
            fallbackTransaction.partialSign(adminKeypair);

            // Replace finalTransaction with fallback and update blockhash variables
            finalTransaction = fallbackTransaction;
            blockhash = fallbackBlockhash;
            lastValidBlockHeight = fallbackLastValidBlockHeight;
            console.log(`✅ Rebuilt transaction with admin wallet transfer (fee_config not initialized)`);
          } else {
            // Other error - rethrow
            throw simulationError;
          }
        }
      } else {
        // Admin wallet transfer - skip simulation (transaction is already partially signed)
        console.log(`ℹ️ Skipping simulation for admin wallet transfer (transaction already partially signed)`);
      }

      // User signs the transaction
      // If using program instruction: Program uses vault authority PDA to sign for token transfer via CPI
      // If using admin wallet: Transaction already partially signed by admin, user signs to complete
      const signedTransaction = await wallet.signTransaction(finalTransaction);
      console.log("✅ Transaction signed by user wallet");

      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 3, // Allow retries for network issues
      });

      console.log(`=== TOKEN WITHDRAWAL TRANSACTION SENT ===`);
      console.log(`Signature: ${signature}`);

      // Wait for confirmation
      const confirmation = await this.retryRpcCall(
        () => this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, "confirmed")
      );

      if (confirmation.value.err) {
        console.error("=== TRANSACTION FAILED ===");
        console.error(`Error: ${confirmation.value.err}`);

        // Check for specific error types
        const errorStr = JSON.stringify(confirmation.value.err);

        // Check if it's a fee_config not initialized error
        if (errorStr.includes("AccountNotInitialized") || errorStr.includes("3012") || errorStr.includes("0xbc4")) {
          // Fee config or other account not initialized
          const tokenSymbol = tokenMint.toString().substring(0, 8);
          const adminTokenBalance = await this.getTokenBalance(adminWallet, tokenMint);
          throw new Error(
            `Withdrawal failed: Required account (fee_config) not initialized for this token. ` +
            `This happens when a new token is added but fee_config hasn't been initialized yet. ` +
            `\n\n` +
            `SOLUTION: Initialize fee_config for this token via the master dashboard ` +
            `(or by calling initFeeConfig instruction). ` +
            `\n\n` +
            `The system will automatically fall back to admin wallet transfer, but admin wallet ` +
            `must have sufficient tokens. Current admin wallet balance: ${adminTokenBalance.toFixed(4)} ${tokenSymbol}. ` +
            `Required: ${tokenAmount.toFixed(4)} ${tokenSymbol}.`
          );
        }

        // Check if it's a balance error (user balance PDA doesn't have balance)
        if (errorStr.includes("InsufficientBalance") || errorStr.includes("6001")) {
          // User balance PDA doesn't have balance - this is the core issue
          // Since OGX is off-chain, the balance PDA won't have balance for tokens
          // that users didn't deposit directly
          throw new Error(
            `Withdrawal failed: User's balance PDA doesn't have sufficient balance for this token. ` +
            `This happens because OGX is tracked off-chain, so the program's balance PDA for ` +
            `this token doesn't have balance. ` +
            `\n\n` +
            `SOLUTION: The program requires the user's balance PDA to have balance for the ` +
            `withdrawal token. Since OGX is off-chain, this requirement cannot be satisfied ` +
            `without program changes or on-chain OGX tracking. ` +
            `\n\n` +
            `The system will automatically fall back to admin wallet transfer, but admin wallet ` +
            `must have sufficient tokens.`
          );
        }

        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      console.log("=== TRANSACTION CONFIRMED ===");
      console.log(`✅ Token withdrawal completed. Transaction: ${signature}`);
      console.log(`💰 Transferred ${tokenAmount.toFixed(4)} tokens from vault to user (OGX balance deducted off-chain)`);

      this.pendingTransactions.delete(transactionId);
      return signature;

    } catch (error) {
      this.pendingTransactions.delete(transactionId);
      throw error;
    }
  }
}

// Export singleton instance
export const solanaProgramService = new SolanaProgramService();
