const { Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction, Keypair } = require("@solana/web3.js");
const fs = require('fs');
const path = require('path');

async function fundVaultWith1MSOL() {
  try {
    console.log("💰 Funding vault with 1,000,000 SOL for on-chain payouts...");
    
    const PROGRAM_ID = new PublicKey('BkwbgssSuWQS46MtNRcq5RCnUgYq1H1LJpKhCGUtdGaH');
    const CONNECTION_URL = 'https://api.devnet.solana.com';
    const SOL_TO_DEPOSIT = 1000000; // 1,000,000 SOL
    
    const connection = new Connection(CONNECTION_URL, 'confirmed');
    
    // Check if we have a platform wallet keypair
    const keypairPath = path.join(__dirname, 'platform-wallet-keypair.json');
    let platformKeypair;
    
    if (fs.existsSync(keypairPath)) {
      console.log("📁 Loading platform wallet from keypair file...");
      const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
      platformKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    } else {
      console.log("🔑 Creating new platform wallet keypair...");
      platformKeypair = Keypair.generate();
      
      // Save the keypair for future use
      fs.writeFileSync(keypairPath, JSON.stringify(Array.from(platformKeypair.secretKey)));
      console.log(`💾 Platform wallet keypair saved to: ${keypairPath}`);
    }
    
    const platformPubkey = platformKeypair.publicKey;
    console.log(`🏦 Platform Wallet Address: ${platformPubkey.toString()}`);
    
    // Check platform wallet balance
    const platformBalance = await connection.getBalance(platformPubkey);
    const platformSolBalance = platformBalance / LAMPORTS_PER_SOL;
    
    console.log(`📊 Platform wallet balance: ${platformSolBalance.toFixed(4)} SOL`);
    
    if (platformSolBalance < SOL_TO_DEPOSIT + 1) {
      console.log(`❌ Insufficient platform wallet balance!`);
      console.log(`   Required: ${(SOL_TO_DEPOSIT + 1).toFixed(4)} SOL`);
      console.log(`   Available: ${platformSolBalance.toFixed(4)} SOL`);
      console.log(`\n💡 Please fund the platform wallet first:`);
      console.log(`   Platform Wallet: ${platformPubkey.toString()}`);
      console.log(`   Required Amount: ${(SOL_TO_DEPOSIT + 1).toFixed(4)} SOL`);
      console.log(`\n🔗 Devnet Faucet: https://faucet.solana.com/`);
      console.log(`   (Note: Devnet faucet has limits, you may need multiple requests)`);
      return;
    }
    
    // Get all program accounts to find vault accounts
    console.log("🔍 Finding vault accounts...");
    const allAccounts = await connection.getProgramAccounts(PROGRAM_ID);
    console.log(`📊 Found ${allAccounts.length} program accounts`);
    
    // Find accounts that can receive SOL (have data space and are owned by the program)
    const vaultAccounts = allAccounts.filter(account => {
      return account.account.data.length > 0 && account.account.owner.equals(PROGRAM_ID);
    });
    
    console.log(`🎯 Found ${vaultAccounts.length} potential vault accounts`);
    
    if (vaultAccounts.length === 0) {
      console.log("❌ No vault accounts found to fund!");
      return;
    }
    
    // Fund multiple vault accounts with SOL
    const accountsToFund = vaultAccounts.slice(0, Math.min(10, vaultAccounts.length)); // Fund up to 10 accounts
    const solPerAccount = SOL_TO_DEPOSIT / accountsToFund.length;
    
    console.log(`💰 Funding ${accountsToFund.length} vault accounts with ${solPerAccount.toFixed(4)} SOL each`);
    console.log(`📝 Total SOL to distribute: ${SOL_TO_DEPOSIT} SOL`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < accountsToFund.length; i++) {
      const account = accountsToFund[i];
      const accountPubkey = account.pubkey;
      
      try {
        console.log(`\n💸 [${i + 1}/${accountsToFund.length}] Transferring ${solPerAccount.toFixed(4)} SOL to vault account...`);
        console.log(`   Account: ${accountPubkey.toString()}`);
        
        // Create transfer transaction
        const transaction = new Transaction();
        
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: platformPubkey,
            toPubkey: accountPubkey,
            lamports: Math.floor(solPerAccount * LAMPORTS_PER_SOL),
          })
        );
        
        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = platformPubkey;
        
        // Sign the transaction
        transaction.sign(platformKeypair);
        
        // Send the transaction
        const signature = await connection.sendRawTransaction(transaction.serialize());
        console.log(`   ✅ Transaction sent: ${signature}`);
        
        // Confirm the transaction
        await connection.confirmTransaction(signature, 'confirmed');
        console.log(`   ✅ Transaction confirmed: ${signature}`);
        
        successCount++;
        
        // Small delay between transactions
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`   ❌ Error funding account ${accountPubkey.toString()}:`, error.message);
        failCount++;
      }
    }
    
    console.log(`\n🎯 VAULT FUNDING SUMMARY:`);
    console.log(`   ✅ Successful transfers: ${successCount}`);
    console.log(`   ❌ Failed transfers: ${failCount}`);
    console.log(`   💰 Total SOL distributed: ${(successCount * solPerAccount).toFixed(4)} SOL`);
    console.log(`   🏦 Platform wallet remaining: ${((platformSolBalance - (successCount * solPerAccount)).toFixed(4))} SOL`);
    
    if (successCount > 0) {
      console.log(`\n🎉 SUCCESS! Vault is now funded with ${(successCount * solPerAccount).toFixed(4)} SOL!`);
      console.log(`   Users can now claim SOL rewards directly from the vault!`);
      console.log(`   No more OGX fallback needed for SOL rewards!`);
    }
    
  } catch (error) {
    console.error("❌ Error funding vault:", error);
  }
}

// Instructions for manual funding
function showManualInstructions() {
  console.log("\n📋 MANUAL FUNDING INSTRUCTIONS:");
  console.log("If the automated script doesn't work, you can fund manually:");
  console.log("");
  console.log("1. 🏦 Get Platform Wallet Address:");
  console.log("   - Run this script once to generate the keypair");
  console.log("   - Copy the platform wallet address shown");
  console.log("");
  console.log("2. 💧 Fund Platform Wallet:");
  console.log("   - Go to: https://faucet.solana.com/");
  console.log("   - Enter platform wallet address");
  console.log("   - Request SOL (may need multiple requests for 1M SOL)");
  console.log("   - Or transfer SOL from another wallet");
  console.log("");
  console.log("3. 🔄 Run Script Again:");
  console.log("   - Once platform wallet has 1,000,001+ SOL");
  console.log("   - Run this script again to distribute to vault");
  console.log("");
  console.log("4. ✅ Verify Funding:");
  console.log("   - Check vault balance with: node check_vault_sol_balance.js");
  console.log("   - Test SOL reward claiming in the app");
}

// Main execution
async function main() {
  console.log("🚀 Starting vault funding process...\n");
  
  // Show manual instructions first
  showManualInstructions();
  
  console.log("\n" + "=".repeat(60));
  console.log("🤖 AUTOMATED FUNDING ATTEMPT");
  console.log("=".repeat(60));
  
  // Try automated funding
  await fundVaultWith1MSOL();
  
  console.log("\n" + "=".repeat(60));
  console.log("📋 NEXT STEPS");
  console.log("=".repeat(60));
  console.log("1. If funding failed, follow manual instructions above");
  console.log("2. Once vault is funded, test SOL reward claiming");
  console.log("3. Users will get real SOL instead of OGX fallback");
  console.log("4. Monitor vault balance and refill as needed");
}

main().then(() => {
  console.log(`\n🎯 Vault funding process complete`);
  process.exit(0);
}).catch(error => {
  console.error("❌ Funding process failed:", error);
  process.exit(1);
});
