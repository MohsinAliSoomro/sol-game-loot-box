import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, getAccount, getMint } from '@solana/spl-token';
import bs58 from 'bs58';
import { supabase } from '@/service/supabase';

// Initialize Solana connection (default to mainnet for OGX and other mainnet tokens)
// Use http endpoint to avoid websocket issues, or configure websocket separately
const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(rpcUrl, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 30000,
  disableRetryOnRateLimit: false,
  // Use http for RPC calls to avoid websocket bufferutil issues
  // Websockets are only needed for subscriptions, which we'll handle separately
});

export async function POST(request: NextRequest) {
  try {
    const { rewardId, userPublicKey, mintAddress, tokenAmount } = await request.json();

    console.log('🪙 Token claim request:', {
      rewardId,
      userPublicKey,
      mintAddress,
      tokenAmount
    });

    // Validate inputs
    if (!rewardId || !userPublicKey || !mintAddress || !tokenAmount) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 });
    }

    // Get admin private key from existing website settings (same as SOL/NFT withdrawals)
    const { data: adminData, error: adminError } = await supabase
      .from('website_settings')
      .select('value')
      .eq('key', 'admin_private_key')
      .maybeSingle();

    if (adminError || !adminData?.value) {
      console.error('❌ Admin private key not found in website_settings:', adminError);
      return NextResponse.json({
        success: false,
        error: 'Admin wallet not configured'
      }, { status: 500 });
    }

    // Import admin wallet (base58-encoded private key, same format as Website Settings UI)
    const adminKeypair = (() => {
      try {
        const decoded = bs58.decode(adminData.value);
        const { Keypair } = require('@solana/web3.js');
        return Keypair.fromSecretKey(decoded);
      } catch (error) {
        console.error('❌ Error parsing admin private key:', error);
        throw new Error('Invalid admin private key format');
      }
    })();

    const adminPublicKey = adminKeypair.publicKey;
    const userPubKey = new PublicKey(userPublicKey);
    const tokenMint = new PublicKey(mintAddress);

    console.log('🔑 Admin wallet:', adminPublicKey.toString());
    console.log('👤 User wallet:', userPubKey.toString());
    console.log('🪙 Token mint:', tokenMint.toString());

    // Get admin's token account
    const adminTokenAccount = await getAssociatedTokenAddress(tokenMint, adminPublicKey);
    
    // Get user's token account
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, userPubKey);

    console.log('🏦 Admin token account:', adminTokenAccount.toString());
    console.log('👤 User token account:', userTokenAccount.toString());

    // Fetch token mint info to get actual decimals
    let tokenDecimals = 9; // Default fallback
    try {
      const mintInfo = await getMint(connection, tokenMint);
      tokenDecimals = mintInfo.decimals;
      console.log(`🔢 Token decimals: ${tokenDecimals}`);
    } catch (error) {
      console.warn('⚠️ Could not fetch token decimals, using default 9:', error);
    }

    // Check admin token balance
    try {
      const adminTokenAccountInfo = await getAccount(connection, adminTokenAccount);
      const adminBalance = Number(adminTokenAccountInfo.amount);
      const requiredAmount = parseFloat(tokenAmount) * Math.pow(10, tokenDecimals);

      console.log('💰 Admin token balance:', adminBalance, `(${adminBalance / Math.pow(10, tokenDecimals)} tokens)`);
      console.log('📊 Required amount:', requiredAmount, `(${tokenAmount} tokens)`);

      if (adminBalance < requiredAmount) {
        return NextResponse.json({
          success: false,
          error: `Insufficient token balance. Required: ${requiredAmount} (${tokenAmount} tokens), Available: ${adminBalance} (${adminBalance / Math.pow(10, tokenDecimals)} tokens)`
        }, { status: 400 });
      }
    } catch (error) {
      console.error('❌ Error checking admin token balance:', error);
      return NextResponse.json({
        success: false,
        error: 'Admin does not have the required token account or balance'
      }, { status: 400 });
    }

    // Check if user token account exists, if not we'll need to create it
    let userTokenAccountExists = false;
    try {
      await getAccount(connection, userTokenAccount);
      userTokenAccountExists = true;
      console.log('✅ User token account exists');
    } catch (error) {
      console.log('ℹ️ User token account does not exist, will be created automatically');
    }

    // Create transaction
    const transaction = new Transaction();

    // If user token account doesn't exist, add instruction to create it
    if (!userTokenAccountExists) {
      const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
      const createAccountInstruction = createAssociatedTokenAccountInstruction(
        adminPublicKey, // payer
        userTokenAccount, // associated token account
        userPubKey, // owner
        tokenMint // mint
      );
      transaction.add(createAccountInstruction);
      console.log('➕ Added create token account instruction');
    }

    // Add transfer instruction (use the actual token decimals we fetched earlier)
    const transferAmount = parseFloat(tokenAmount) * Math.pow(10, tokenDecimals);
    
    const transferInstruction = createTransferInstruction(
      adminTokenAccount, // source
      userTokenAccount, // destination
      adminPublicKey, // owner
      transferAmount // amount
    );
    
    transaction.add(transferInstruction);
    console.log(`💸 Added transfer instruction: ${tokenAmount} tokens (${transferAmount} base units with ${tokenDecimals} decimals)`);

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = adminPublicKey;

    // Sign and send transaction
    transaction.sign(adminKeypair);
    
    console.log('📡 Sending token transfer transaction...');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3
    });
    
    console.log('⏳ Confirming transaction:', signature);
    
    // Use polling instead of websocket subscription to avoid bufferUtil errors
    // Poll for transaction status instead of using confirmTransaction (which uses websockets)
    let confirmed = false;
    const maxAttempts = 30; // 30 attempts * 1 second = 30 seconds max
    const pollInterval = 1000; // 1 second
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = await connection.getSignatureStatus(signature);
        
        if (status?.value?.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
        }
        
        if (status?.value?.confirmationStatus === 'confirmed' || status?.value?.confirmationStatus === 'finalized') {
          confirmed = true;
          console.log(`✅ Token transfer confirmed (attempt ${attempt + 1}):`, signature);
          break;
        }
        
        // Wait before next poll
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      } catch (pollError: any) {
        // If it's a transaction error, throw it
        if (pollError.message?.includes('Transaction failed')) {
          throw pollError;
        }
        // Otherwise, continue polling
        console.warn(`⚠️ Poll attempt ${attempt + 1} failed, retrying...`, pollError.message);
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }
    }
    
    if (!confirmed) {
      console.warn('⚠️ Transaction confirmation timeout, but transaction was sent:', signature);
      // Don't throw - transaction was sent, even if we couldn't confirm it
      // Frontend can check transaction status later
    }

    return NextResponse.json({
      success: true,
      signature,
      message: `Successfully transferred ${tokenAmount} tokens to user wallet`
    });

  } catch (error: any) {
    console.error('❌ Error claiming token reward:', error);
    
    // Handle specific Solana errors
    if (error.message?.includes('0x1')) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient token balance in admin wallet'
      }, { status: 400 });
    }
    
    if (error.message?.includes('TokenAccountNotFoundError')) {
      return NextResponse.json({
        success: false,
        error: 'Token account not found. Please ensure the token mint address is correct.'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred'
    }, { status: 500 });
  }
}