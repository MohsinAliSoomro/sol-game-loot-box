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
const bs58 = require('bs58');

// Configuration
const RPC_URL = 'https://api.devnet.solana.com';
const SUPABASE_URL = process.env.SUPABASE_URL; // Set this environment variable
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; // Set this environment variable

// Initialize connections
const connection = new Connection(RPC_URL, 'confirmed');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Get admin private key for a specific project
 */
async function getProjectAdminKey(projectId) {
    if (!projectId) {
        throw new Error('No project_id found in withdrawal request');
    }

    const { data, error } = await supabase
        .from('project_settings')
        .select('setting_value')
        .eq('project_id', projectId)
        .eq('setting_key', 'admin_private_key')
        .single();

    if (error || !data?.setting_value) {
        throw new Error(`Admin private key not configured for project ID ${projectId}`);
    }

    return data.setting_value;
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

        for (const withdrawal of withdrawals) {
            try {
                await processWithdrawal(withdrawal);
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
async function processWithdrawal(withdrawal) {
    const solAmount = parseFloat(withdrawal.solAmount || 0);
    const userWallet = new PublicKey(withdrawal.walletAddress);
    const projectId = withdrawal.project_id;
    
    console.log(`\n🔄 Processing withdrawal ${withdrawal.id}:`);
    console.log(`   Project ID: ${projectId}`);
    console.log(`   User Wallet: ${withdrawal.walletAddress}`);
    console.log(`   Amount: ${solAmount} SOL`);
    console.log(`   OGX: ${withdrawal.apes}`);
    console.log(`   ✅ SOL will be sent TO: ${userWallet.toString()}`);

    // Get project-specific admin private key
    const adminPrivateKeyBase58 = await getProjectAdminKey(projectId);
    const privateKeyBytes = bs58.decode(adminPrivateKeyBase58.trim());
    const adminWallet = Keypair.fromSecretKey(privateKeyBytes);
    
    console.log(`   🔑 Using admin wallet: ${adminWallet.publicKey.toString()}`);

    // Check if admin wallet has enough SOL
    const adminBalance = await connection.getBalance(adminWallet.publicKey);
    const adminSOLBalance = adminBalance / LAMPORTS_PER_SOL;
    console.log(`   💰 Admin wallet balance: ${adminSOLBalance.toFixed(4)} SOL`);
    
    if (adminSOLBalance < solAmount + 0.01) { // Add 0.01 SOL for fees
        throw new Error(`Insufficient admin wallet balance. Available: ${adminSOLBalance.toFixed(4)} SOL, Required: ${(solAmount + 0.01).toFixed(4)} SOL`);
    }

    // Get fresh blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create transfer transaction
    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: adminWallet.publicKey,
            toPubkey: userWallet,
            lamports: solAmount * LAMPORTS_PER_SOL,
        })
    );

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = adminWallet.publicKey;

    // Sign and send transaction
    transaction.sign(adminWallet);
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
        console.log(`💰 ${solAmount} SOL sent from ${adminWallet.publicKey.toString()} to ${userWallet.toString()}`);
    }
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 Starting Withdrawal Processor...');
    console.log('📋 Processing withdrawals from project-specific admin wallets...');
    
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
