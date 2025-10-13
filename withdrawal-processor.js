#!/usr/bin/env node

/**
 * Withdrawal Processor Service
 * 
 * This script processes pending withdrawal requests by sending SOL from the platform wallet
 * to user wallets. It should be run periodically (e.g., every few minutes) to process
 * withdrawal requests.
 * 
 * Usage: node withdrawal-processor.js
 */

const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair } = require('@solana/web3.js');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const RPC_URL = 'https://api.devnet.solana.com';
const PLATFORM_WALLET_PRIVATE_KEY = process.env.PLATFORM_WALLET_PRIVATE_KEY; // Set this environment variable
const SUPABASE_URL = process.env.SUPABASE_URL; // Set this environment variable
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; // Set this environment variable

// Initialize connections
const connection = new Connection(RPC_URL, 'confirmed');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Platform wallet keypair (you need to set the private key)
let platformWallet;
if (PLATFORM_WALLET_PRIVATE_KEY) {
    const privateKeyArray = JSON.parse(PLATFORM_WALLET_PRIVATE_KEY);
    platformWallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
} else {
    console.error('❌ PLATFORM_WALLET_PRIVATE_KEY environment variable not set!');
    console.error('Please set your platform wallet private key as an environment variable.');
    process.exit(1);
}

/**
 * Process pending withdrawal requests
 */
async function processWithdrawals() {
    try {
        console.log('🔍 Checking for pending withdrawal requests...');
        
        // Get pending withdrawal requests
        const { data: withdrawals, error } = await supabase
            .from('withdraw')
            .select('*')
            .eq('status', 'PENDING')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('❌ Error fetching withdrawals:', error);
            return;
        }

        if (!withdrawals || withdrawals.length === 0) {
            console.log('✅ No pending withdrawals found.');
            return;
        }

        console.log(`📋 Found ${withdrawals.length} pending withdrawal(s)`);

        // Check platform wallet balance
        const platformBalance = await connection.getBalance(platformWallet.publicKey);
        const platformSOLBalance = platformBalance / LAMPORTS_PER_SOL;
        console.log(`💰 Platform wallet balance: ${platformSOLBalance.toFixed(4)} SOL`);

        for (const withdrawal of withdrawals) {
            try {
                await processWithdrawal(withdrawal, platformSOLBalance);
            } catch (error) {
                console.error(`❌ Error processing withdrawal ${withdrawal.id}:`, error.message);
                // Mark as failed
                await supabase
                    .from('withdraw')
                    .update({ status: 'FAILED', error_message: error.message })
                    .eq('id', withdrawal.id);
            }
        }

    } catch (error) {
        console.error('❌ Error in processWithdrawals:', error);
    }
}

/**
 * Process a single withdrawal request
 */
async function processWithdrawal(withdrawal, platformBalance) {
    const solAmount = parseFloat(withdrawal.solAmount || 0);
    const userWallet = new PublicKey(withdrawal.walletAddress);
    
    console.log(`\n🔄 Processing withdrawal ${withdrawal.id}:`);
    console.log(`   User Wallet: ${withdrawal.walletAddress}`);
    console.log(`   Amount: ${solAmount} SOL`);
    console.log(`   OGX: ${withdrawal.apes}`);
    console.log(`   ✅ SOL will be sent TO: ${userWallet.toString()}`);

    // Check if platform has enough SOL
    if (platformBalance < solAmount + 0.01) { // Add 0.01 SOL for fees
        throw new Error(`Insufficient platform balance. Available: ${platformBalance.toFixed(4)} SOL, Required: ${(solAmount + 0.01).toFixed(4)} SOL`);
    }

    // Get fresh blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create transfer transaction
    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: platformWallet.publicKey,
            toPubkey: userWallet,
            lamports: solAmount * LAMPORTS_PER_SOL,
        })
    );

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = platformWallet.publicKey;

    // Sign and send transaction
    transaction.sign(platformWallet);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
    });

    console.log(`   Transaction signature: ${signature}`);

    // Confirm transaction
    const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    // Update withdrawal status to completed
    const { error: updateError } = await supabase
        .from('withdraw')
        .update({ 
            status: 'COMPLETED',
            completed_at: new Date().toISOString(),
            platform_transaction_id: signature
        })
        .eq('id', withdrawal.id);

    if (updateError) {
        console.error('❌ Error updating withdrawal status:', updateError);
    } else {
        console.log(`✅ Withdrawal ${withdrawal.id} completed successfully!`);
        console.log(`💰 ${solAmount} SOL sent to wallet: ${userWallet.toString()}`);
    }
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 Starting Withdrawal Processor...');
    console.log(`📍 Platform wallet: ${platformWallet.publicKey.toString()}`);
    
    try {
        await processWithdrawals();
        console.log('\n✅ Withdrawal processing completed.');
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run the processor
if (require.main === module) {
    main();
}

module.exports = { processWithdrawals, processWithdrawal };
