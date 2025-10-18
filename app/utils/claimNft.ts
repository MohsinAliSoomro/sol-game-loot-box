import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Program } from '@coral-xyz/anchor';

// Load the IDL
import idl from '../../idl/vault_project.json';

const PROGRAM_ID = new PublicKey(idl.address);

/**
 * Claim any NFT from the vault without ownership restrictions
 * @param program - The Anchor program instance
 * @param mint - The NFT mint address to claim
 * @param claimer - The public key of the user claiming the NFT
 * @returns Promise<string> - Transaction signature
 */
export async function claimAnyNft(
    program: Program,
    mint: PublicKey,
    claimer: PublicKey
): Promise<string> {
    try {
        console.log('🎯 Claiming NFT with claim_any_nft instruction...');
        console.log(`Claimer: ${claimer.toString()}`);
        console.log(`NFT Mint: ${mint.toString()}`);
        
        // Get vault authority PDA
        const [vaultAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), mint.toBuffer()],
            program.programId
        );
        
        console.log(`Vault Authority: ${vaultAuthority.toString()}`);
        
        // Get token accounts
        const vaultAta = await getAssociatedTokenAddress(mint, vaultAuthority);
        const claimerAta = await getAssociatedTokenAddress(mint, claimer);
        
        console.log(`Vault ATA: ${vaultAta.toString()}`);
        console.log(`Claimer ATA: ${claimerAta.toString()}`);
        
        // Call the claim_any_nft instruction
        const tx = await program.methods
            .claimAnyNft()
            .accounts({
                claimer: claimer,
                mint: mint,
                claimerNftAta: claimerAta,
                vaultAuthority: vaultAuthority,
                vaultNftAta: vaultAta,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .rpc();
        
        console.log(`✅ NFT claimed successfully! Transaction: ${tx}`);
        return tx;
        
    } catch (error) {
        console.error('❌ Error claiming NFT:', error);
        throw error;
    }
}

/**
 * Check if an NFT is available in the vault for claiming
 * @param program - The Anchor program instance
 * @param mint - The NFT mint address to check
 * @returns Promise<boolean> - True if NFT is available
 */
export async function isNftAvailableInVault(
    program: Program,
    mint: PublicKey
): Promise<boolean> {
    try {
        // Get vault authority PDA
        const [vaultAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), mint.toBuffer()],
            program.programId
        );
        
        // Get vault ATA
        const vaultAta = await getAssociatedTokenAddress(mint, vaultAuthority);
        
        // Check if vault ATA exists and has tokens
        const vaultAccountInfo = await program.provider.connection.getAccountInfo(vaultAta);
        
        if (vaultAccountInfo) {
            const amount = vaultAccountInfo.data.readBigUInt64LE(64);
            return amount > BigInt(0);
        }
        
        return false;
        
    } catch (error) {
        console.error('❌ Error checking NFT availability:', error);
        return false;
    }
}

/**
 * Get the number of NFTs available in the vault for a specific mint
 * @param program - The Anchor program instance
 * @param mint - The NFT mint address to check
 * @returns Promise<number> - Number of NFTs available
 */
export async function getNftCountInVault(
    program: Program,
    mint: PublicKey
): Promise<number> {
    try {
        // Get vault authority PDA
        const [vaultAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), mint.toBuffer()],
            program.programId
        );
        
        // Get vault ATA
        const vaultAta = await getAssociatedTokenAddress(mint, vaultAuthority);
        
        // Check vault ATA
        const vaultAccountInfo = await program.provider.connection.getAccountInfo(vaultAta);
        
        if (vaultAccountInfo) {
            const amount = vaultAccountInfo.data.readBigUInt64LE(64);
            return Number(amount);
        }
        
        return 0;
        
    } catch (error) {
        console.error('❌ Error getting NFT count:', error);
        return 0;
    }
}

/**
 * React hook for claiming NFTs
 * @param program - The Anchor program instance
 * @param userPublicKey - The user's public key
 * @returns Object with claim functions and state
 */
export function useClaimNft(program: Program, userPublicKey: PublicKey | null) {
    const claimNft = async (mint: PublicKey) => {
        if (!userPublicKey) {
            throw new Error('User not connected');
        }
        
        return await claimAnyNft(program, mint, userPublicKey);
    };
    
    const checkAvailability = async (mint: PublicKey) => {
        return await isNftAvailableInVault(program, mint);
    };
    
    const getCount = async (mint: PublicKey) => {
        return await getNftCountInVault(program, mint);
    };
    
    return {
        claimNft,
        checkAvailability,
        getCount,
    };
}
