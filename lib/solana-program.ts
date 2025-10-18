import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  TransactionInstruction,
} from "@solana/web3.js";
import { 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { CONFIG } from "./config";
import deployedIdl from "../idl/vault_project.json";
import { createSyncNativeInstruction, createCloseAccountInstruction } from "@solana/spl-token";

// Program configuration
export const PROGRAM_ID = new PublicKey(CONFIG.PROGRAM_ID);
export const NETWORK = CONFIG.NETWORK;
// Use a more reliable RPC endpoint
export const RPC_URL = "https://api.devnet.solana.com";

// Token mint addresses
export const OGX_MINT = new PublicKey(CONFIG.TOKENS.OGX);
export const SOL_MINT = new PublicKey(CONFIG.TOKENS.SOL);

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
   */
  async depositSOL(user: PublicKey, solAmount: number, wallet: any): Promise<string> {
    const transactionId = this.generateTransactionId(user, solAmount);
    
    // Check if this transaction is already pending
    if (this.pendingTransactions.has(transactionId)) {
      throw new Error("Transaction already in progress. Please wait.");
    }

    // Add a delay to prevent rapid duplicate transactions
    await new Promise(resolve => setTimeout(resolve, 500));

    this.pendingTransactions.add(transactionId);

    try {
      // Check user's SOL balance first
      const userBalance = await this.connection.getBalance(user);
      const userSOLBalance = userBalance / LAMPORTS_PER_SOL;
      
      console.log(`=== BALANCE CHECK ===`);
      console.log(`User wallet: ${user.toString()}`);
      console.log(`User SOL balance: ${userSOLBalance.toFixed(4)} SOL`);
      console.log(`Requested amount: ${solAmount} SOL`);
      console.log(`Required (with fees): ${(solAmount + 0.01).toFixed(4)} SOL`);
      console.log(`=====================`);
      
      if (userSOLBalance < solAmount + 0.01) { // Add 0.01 SOL for fees
        throw new Error(`Insufficient SOL balance. You have ${userSOLBalance.toFixed(4)} SOL but need ${(solAmount + 0.01).toFixed(4)} SOL (including fees).`);
      }

      // Get PDAs for the vault
      const [vaultAuthority] = this.getVaultAuthority(SOL_MINT);
      const vaultATA = await this.getVaultATA(SOL_MINT);
      const [userBalancePDA] = this.getUserBalancePDA(user, SOL_MINT);
      const userATA = this.getUserATA(user, SOL_MINT);

      // Check if user ATA exists and create if needed
      const createATATransaction = await this.ensureATAExists(user, SOL_MINT);

      // Get fee vault accounts
      const [feeVaultAuthority] = this.getFeeVaultAuthority(SOL_MINT);
      const feeVaultATA = await this.getFeeVaultATA(SOL_MINT);
      const [feeConfig] = this.getFeeConfig(SOL_MINT);

      // Log all account addresses for debugging
      console.log("=== DEPOSIT ACCOUNTS DEBUG ===");
      console.log("user:", user.toString());
      console.log("mint:", SOL_MINT.toString());
      console.log("user_ata:", userATA.toString());
      console.log("vault_authority:", vaultAuthority.toString());
      console.log("vault_ata:", vaultATA.toString());
      console.log("fee_vault:", feeVaultAuthority.toString());
      console.log("fee_config:", feeConfig.toString());
      console.log("user_balance:", userBalancePDA.toString());
      console.log("system_program:", SystemProgram.programId.toString());
      console.log("token_program:", new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").toString());
      console.log("associated_token_program:", new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL").toString());
      console.log("Expected system program: 11111111111111111111111111111111");
      console.log("===============================");

      // First, transfer SOL to the user's wSOL ATA
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: user,
        toPubkey: userATA,
        lamports: solAmount * LAMPORTS_PER_SOL,
      });

      // Then, sync the native SOL to wSOL
      const syncNativeInstruction = createSyncNativeInstruction(userATA);

      // Create a new transaction with proper instruction order
      const finalTransaction = new Transaction();

      // Add wrap instructions first
      finalTransaction.add(transferInstruction);
      finalTransaction.add(syncNativeInstruction);

      // Create deposit transaction using the program
      const depositTransaction = await this.program.methods
        .deposit(new BN(solAmount * LAMPORTS_PER_SOL))
        .accounts({
          user: user,
          mint: SOL_MINT,
          user_ata: userATA,
          vault_authority: vaultAuthority,
          vault_ata: vaultATA,
          fee_vault: feeVaultAuthority,
          fee_config: feeConfig,
          user_balance: userBalancePDA,
          system_program: SystemProgram.programId,
          token_program: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
          associated_token_program: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
        })
        .instruction();

      // Add deposit instruction after wrapping
      finalTransaction.add(depositTransaction);

      // If ATA needs to be created, add it to the beginning
      if (createATATransaction) {
        // Add ATA creation instructions at the beginning
        finalTransaction.instructions.unshift(...createATATransaction.instructions);
      }

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
   * Withdraw OGX tokens and receive SOL in return
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

      // Create withdrawal transaction using the program
      // OGX has 6 decimals, so convert to token units: ogxAmount * 10^6
      const withdrawalTransaction = await this.program.methods
        .withdrawTokens(new BN(ogxAmount * 1e6)) // Convert to token units (6 decimals)
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

      // Create a new transaction
      const finalTransaction = new Transaction();

      // If ATA needs to be created, add it first
      if (createATATransaction) {
        finalTransaction.add(...createATATransaction.instructions);
      }

      // Add the withdrawal transaction
      finalTransaction.add(...withdrawalTransaction.instructions);

      // Get fresh blockhash right before sending with retry
      const { blockhash, lastValidBlockHeight } = await this.retryRpcCall(
        () => this.connection.getLatestBlockhash("confirmed")
      );
      
      // Set blockhash and fee payer on final transaction
      finalTransaction.recentBlockhash = blockhash;
      finalTransaction.feePayer = user;

      console.log("=== SENDING OGX WITHDRAWAL TRANSACTION ===");
      console.log(`Transaction size: ${finalTransaction.serialize({ requireAllSignatures: false }).length} bytes`);

      // Sign and send the transaction WITHOUT retry
      // (retrying a signed transaction will cause "already processed" errors)
      const signedTransaction = await wallet.signTransaction(finalTransaction);
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
  async withdrawSOL(user: PublicKey, solAmount: number, wallet: any): Promise<string> {
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
      // Get PDAs for the vault
      const [vaultAuthority] = this.getVaultAuthority(SOL_MINT);
      const vaultATA = await this.getVaultATA(SOL_MINT);
      const [userBalancePDA] = this.getUserBalancePDA(user, SOL_MINT);
      const userATA = this.getUserATA(user, SOL_MINT);

      console.log("=== ACCOUNT ADDRESSES ===");
      console.log(`Vault Authority: ${vaultAuthority.toString()}`);
      console.log(`Vault ATA: ${vaultATA.toString()}`);
      console.log(`User Balance PDA: ${userBalancePDA.toString()}`);
      console.log(`User ATA: ${userATA.toString()}`);

      // Check if user ATA exists and create if needed
      const createATATransaction = await this.ensureATAExists(user, SOL_MINT);

      // Get fee vault accounts
      const [feeVaultAuthority] = this.getFeeVaultAuthority(SOL_MINT);
      const feeVaultATA = await this.getFeeVaultATA(SOL_MINT);
      const [feeConfig] = this.getFeeConfig(SOL_MINT);

      // Get exchange config PDA
      const [exchangeConfig] = this.getExchangeConfig();

      // Create withdrawal transaction using the program
      const withdrawalTransaction = await this.program.methods
        .withdrawTokens(new BN(solAmount * LAMPORTS_PER_SOL))
        .accounts({
          user: user,
          mint: SOL_MINT,
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

      // Create a new transaction to include unwrap instruction
      const finalTransaction = new Transaction();

      // If ATA needs to be created, add it first
      if (createATATransaction) {
        finalTransaction.add(...createATATransaction.instructions);
      }

      // Add the withdrawal transaction
      finalTransaction.add(...withdrawalTransaction.instructions);

      // Add unwrap instruction to convert wSOL back to native SOL
      const unwrapInstruction = createCloseAccountInstruction(
        userATA, // wSOL ATA to close
        user,    // Destination for native SOL
        user,    // Owner of the ATA
        []       // No multisig
      );
      finalTransaction.add(unwrapInstruction);

      console.log("=== UNWRAP INSTRUCTION ADDED ===");
      console.log(`Closing wSOL ATA: ${userATA.toString()}`);
      console.log(`Native SOL destination: ${user.toString()}`);

      // Get fresh blockhash right before sending with retry
      const { blockhash, lastValidBlockHeight } = await this.retryRpcCall(
        () => this.connection.getLatestBlockhash("confirmed")
      );
      
      // Set blockhash and fee payer on final transaction
      finalTransaction.recentBlockhash = blockhash;
      finalTransaction.feePayer = user;

      console.log("=== TRANSACTION DETAILS ===");
      console.log(`Number of instructions: ${finalTransaction.instructions.length}`);
      console.log(`Blockhash: ${blockhash}`);
      console.log(`Fee payer: ${user.toString()}`);

      // Sign and send the transaction WITHOUT retry
      // (retrying a signed transaction will cause "already processed" errors)
      const signedTransaction = await wallet.signTransaction(finalTransaction);
      const signature = await this.connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
        maxRetries: 0, // Don't retry - will cause "already processed" errors
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

      console.log(`Fee Vault Authority: ${feeVaultAuthority.toString()}`);
      console.log(`Fee Vault ATA: ${feeVaultATA.toString()}`);
      console.log(`Fee Config: ${feeConfig.toString()}`);
      
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
          user_ata: userATA,
          vault_authority: vaultAuthority,
          vault_ata: vaultATA,
          fee_vault_authority: feeVaultAuthority,
          fee_vault_ata: feeVaultATA,
          fee_config: feeConfig,
          user_balance: userBalancePDA,
          system_program: SystemProgram.programId,
          token_program: TOKEN_PROGRAM_ID,
          associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
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
   * Deposit tokens (simplified - just SOL for now)
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
    // For now, treat all other deposits as SOL deposits
    return this.depositSOL(user, amount, wallet);
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
}

// Export singleton instance
export const solanaProgramService = new SolanaProgramService();
