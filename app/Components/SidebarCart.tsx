"use client";
import { supabase } from "@/service/supabase";
import { useUserState } from "@/state/useUserState";
import { useRequest } from "ahooks";
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { solanaProgramService } from "@/lib/solana-program";
import Image from "next/image";
import JackpotImage from "./JackpotImage";
import { useProject } from "@/lib/project-context";

/**
 * Fetches the prizes won by a user that are available to claim.
 * Only shows NFTs that the user has actually won by spinning the wheel.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<SupabaseClient<Database>['data'] | Error>} - The prizes won by the user, or an error.
 */
const getWinPrizes = async (userId: string) => {
    try {
        console.log("🔍 Fetching NFT prizes won by user:", userId);

        // Get current project ID and slug
        const projectId = typeof window !== 'undefined'
            ? localStorage.getItem('currentProjectId')
            : null;
        const projectSlug = typeof window !== 'undefined'
            ? localStorage.getItem('currentProjectSlug')
            : null;

        // Check if we're on the main project by checking URL pathname
        // Main project routes: /, /lootboxes/..., /live-draw/..., /leaderboard
        // Sub-project routes: /[projectSlug]/lootboxes/..., /[projectSlug]/live-draw/...
        let isMainProject = false;
        if (typeof window !== 'undefined') {
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            // If first path segment is NOT a project slug (i.e., it's 'lootboxes', 'live-draw', 'leaderboard', or empty)
            // then we're on the main project
            const firstSegment = pathParts[0];
            isMainProject = !firstSegment ||
                firstSegment === 'lootboxes' ||
                firstSegment === 'live-draw' ||
                firstSegment === 'leaderboard' ||
                (!projectSlug && !projectId);
        }

        // Get rewards that user has won (not withdrawn) - only NFTs and SOL (exclude item rewards)
        // Item rewards are credited directly to token balance and should NOT appear in sidebar
        // Note: We fetch all unwithdrawn rewards first, then filter in JavaScript to handle legacy entries
        // that might not have reward_type set
        let query = supabase
            .from("prizeWin")
            .select()
            .eq("userId", userId)
            .eq("isWithdraw", false);

        // Filter by project_id based on whether we're on main project or sub-project
        if (isMainProject) {
            // Main project: only show rewards where project_id IS NULL
            query = query.is("project_id", null);
            console.log("🏠 Main project: filtering for rewards with project_id IS NULL");
        } else if (projectId) {
            // Sub-project: filter by specific project_id
            query = query.eq("project_id", parseInt(projectId));
            console.log(`📦 Sub-project: filtering for rewards with project_id = ${projectId}`);
        }
        // If no projectId and not main project, show all rewards (fallback)

        const response = await query;

        if (response.error) {
            console.error("❌ Error fetching prizes:", response.error);
            return response;
        }

        console.log("✅ Fetched prizes from database:", response.data);
        console.log("📋 All rewards breakdown:", {
            total: response.data?.length || 0,
            rewards: response.data?.map((r: any) => ({
                id: r.id,
                name: r.name,
                reward_type: r.reward_type,
                mint: r.mint,
                hasMint: !!r.mint && r.mint.trim() !== '',
                isWithdraw: r.isWithdraw,
                project_id: r.project_id,
                userId: r.userId,
                image: r.image,
                sol: r.sol
            }))
        });
        console.log("🔍 Project context:", {
            projectId: projectId,
            projectSlug: projectSlug,
            isMainProject: isMainProject,
            pathname: typeof window !== 'undefined' ? window.location.pathname : 'N/A'
        });

        // Separate NFT and SOL rewards (case-insensitive check)
        // Explicitly exclude item rewards - they should never appear in sidebar
        // Handle legacy entries that might not have reward_type set
        const nftRewards = response.data.filter((reward: any) => {
            const rewardType = (reward.reward_type || '').toLowerCase();
            const hasMint = !!reward.mint && reward.mint.trim() !== '';
            const isNFT = rewardType === 'nft';
            const isItem = rewardType === 'item';
            const isSol = rewardType === 'sol';

            // Exclude item rewards
            if (isItem) {
                console.log(`🚫 Filtering out item reward from sidebar:`, reward.name);
                return false;
            }

            // Exclude SOL rewards (they're handled separately)
            if (isSol) {
                return false;
            }

            // If reward_type is explicitly 'nft', require mint address
            if (isNFT) {
                if (!hasMint) {
                    console.log(`⚠️ NFT reward without mint address:`, reward);
                    return false;
                }
                return true;
            }

            // Legacy entries: if reward_type is NULL/empty but has a mint address, treat as NFT
            // Also exclude if name contains "SOL" (likely a SOL reward)
            if (!rewardType && hasMint) {
                const nameLower = (reward.name || '').toLowerCase();
                if (nameLower.includes('sol')) {
                    return false; // Likely a SOL reward, not NFT
                }
                console.log(`🔄 Legacy entry treated as NFT (has mint but no reward_type):`, reward.name);
                return true;
            }

            return false;
        });
        const solRewards = response.data.filter((reward: any) => {
            const rewardType = (reward.reward_type || '').toLowerCase();
            const hasMint = !!reward.mint && reward.mint.trim() !== '';
            const isItem = rewardType === 'item';
            const isSol = rewardType === 'sol';
            const isNFT = rewardType === 'nft';
            const isToken = rewardType === 'token';

            // CRITICAL: Exclude NFT and token rewards - they should never appear as SOL rewards
            if (isNFT || isToken) {
                console.log(`🚫 Filtering out ${rewardType} reward from SOL rewards:`, reward.name);
                return false;
            }

            // Exclude item rewards
            if (isItem) {
                return false;
            }

            // Explicit SOL reward type (and NOT an NFT or token)
            if (isSol && !hasMint) {
                return true;
            }

            // Legacy entries: if reward_type is NULL/empty and name contains "SOL", treat as SOL
            // BUT only if it doesn't have a mint address (which would indicate it's an NFT)
            if (!rewardType && !hasMint) {
                const nameLower = (reward.name || '').toLowerCase();
                if (nameLower.includes('sol')) {
                    console.log(`🔄 Legacy entry treated as SOL (name contains SOL but no reward_type):`, reward.name);
                    return true;
                }
            }

            return false;
        });

        // Filter token rewards (on-chain tokens like OGX)
        const tokenRewards = response.data.filter((reward: any) => {
            const rewardType = (reward.reward_type || '').toLowerCase();
            const hasMint = !!reward.mint && reward.mint.trim() !== '';
            const isItem = rewardType === 'item';
            const isToken = rewardType === 'token';

            // Exclude item rewards
            if (isItem) {
                return false;
            }

            // Explicit token reward type (must have mint address)
            if (isToken && hasMint) {
                return true;
            }

            return false;
        });

        console.log(`📊 Found ${nftRewards.length} NFT rewards, ${solRewards.length} SOL rewards, and ${tokenRewards.length} Token rewards`);
        if (nftRewards.length > 0) {
            console.log("🎨 NFT rewards details:", nftRewards.map((r: any) => ({
                id: r.id,
                name: r.name,
                mint: r.mint,
                reward_type: r.reward_type,
                hasMint: !!r.mint && r.mint.trim() !== ''
            })));
        } else {
            console.log("⚠️ No NFT rewards found. Checking why...");
            const allWithMint = response.data?.filter((r: any) => !!r.mint && r.mint.trim() !== '') || [];
            const allWithNFTType = response.data?.filter((r: any) => (r.reward_type || '').toLowerCase() === 'nft') || [];
            console.log(`   - Entries with mint address: ${allWithMint.length}`);
            console.log(`   - Entries with reward_type='nft': ${allWithNFTType.length}`);
            if (allWithMint.length > 0) {
                console.log("   - Sample entries with mint:", allWithMint.slice(0, 3).map((r: any) => ({
                    id: r.id,
                    name: r.name,
                    reward_type: r.reward_type,
                    mint: r.mint?.substring(0, 20) + '...'
                })));
            }
        }

        // Get actually deposited NFTs from vault (only for NFT rewards) - for verification only
        let depositedMints: string[] = [];
        if (nftRewards.length > 0) {
            try {
                const { getDepositedNFTs } = await import("@/lib/nft-metadata");
                depositedMints = await getDepositedNFTs();
                console.log("📦 Actually deposited NFTs in vault:", depositedMints);
                console.log("📦 Won NFT mints:", nftRewards.map((r: any) => r.mint));
            } catch (error) {
                console.warn("⚠️ Could not fetch deposited NFTs from vault:", error);
                // Continue anyway - show all won NFTs even if we can't verify vault
                depositedMints = [];
            }
        }

        // Filter NFT rewards - show all won NFTs (not just those in vault)
        // Only filter out placeholder mints
        const validWonNFTs = nftRewards.filter((nft: any) => {
            // Normalize mint address for comparison (trim whitespace, lowercase)
            const mintAddress = (nft.mint || '').trim();

            // Skip placeholder mints (11111111111111111111111111111111)
            if (mintAddress === "11111111111111111111111111111111" || !mintAddress) {
                console.log("🚫 Filtering out placeholder or empty mint:", mintAddress);
                return false;
            }

            // Show all won NFTs - don't filter by vault availability
            // The vault check is just for logging/info purposes
            const isDeposited = depositedMints.some((depMint: string) =>
                depMint.trim().toLowerCase() === mintAddress.toLowerCase()
            );

            if (!isDeposited && depositedMints.length > 0) {
                console.log(`⚠️ Won NFT ${mintAddress} not found in vault (but showing anyway)`);
            } else if (isDeposited) {
                console.log(`✅ Won NFT ${mintAddress} verified in vault`);
            }

            // Return true for all valid mints (not placeholders)
            return true;
        });

        // Combine valid NFT rewards with SOL rewards and Token rewards
        const validRewards = [...validWonNFTs, ...solRewards, ...tokenRewards];

        console.log(`🎯 Filtered rewards: ${response.data.length} → ${validRewards.length} rewards available to claim`);

        // Deduplicate NFT rewards by mint address - only show one instance per mint
        const uniqueNFTs = validWonNFTs.reduce((acc: any[], current: any) => {
            const existingIndex = acc.findIndex(item => item.mint === current.mint);
            if (existingIndex === -1) {
                // First instance of this mint - add it
                acc.push(current);
            } else {
                // Duplicate mint - keep the one with lower ID (older record)
                if (current.id < acc[existingIndex].id) {
                    acc[existingIndex] = current;
                }
            }
            return acc;
        }, []);

        // Combine unique NFTs with SOL rewards and Token rewards
        const finalRewards = [...uniqueNFTs, ...solRewards, ...tokenRewards];

        console.log(`🎯 Final rewards: ${uniqueNFTs.length} unique NFTs + ${solRewards.length} SOL rewards + ${tokenRewards.length} Token rewards = ${finalRewards.length} total`);

        return { ...response, data: finalRewards };
    } catch (error) {
        console.error("❌ Error in getWinPrizes:", error);
        return error;
    }
};

/**
 * The sidebar cart component. It displays the available rewards for the user in a modal.
 * The user can checkout or view the rewards in the modal.
 * @returns A JSX element representing the sidebar cart component.
 */
export default function SidebarCart() {
    const { data, loading, error, run } = useRequest(getWinPrizes, {
        manual: true,
    });
    const [user, setCart] = useUserState();
    const { getProjectId, currentProject, getProjectTokenSymbol } = useProject();
    const tokenSymbol = getProjectTokenSymbol();
    const projectId = getProjectId();
    const [claimingReward, setClaimingReward] = useState<string | null>(null);
    const [claimingAll, setClaimingAll] = useState(false);

    useEffect(() => {
        if (user) {
            console.log("🔄 Refreshing cart for user:", user.id);
            run(user?.id);
        }
    }, [user, run]);

    // Real-time subscription to prizeWin table for automatic cart updates
    useEffect(() => {
        if (!user) return;

        console.log("🔄 Setting up real-time subscription for prizeWin changes...");

        const subscription = supabase
            .channel('prizeWin_changes')
            .on('postgres_changes',
                {
                    event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'prizeWin',
                    filter: `userId=eq.${user.id}` // Only listen to changes for this user
                },
                (payload) => {
                    console.log('🔄 PrizeWin database changed for user:', payload);
                    // Refresh cart when prizeWin changes
                    if (user) {
                        console.log("🔄 Auto-refreshing cart due to prizeWin change...");
                        run(user.id);
                    }
                }
            )
            .subscribe();

        // Cleanup subscription on unmount
        return () => {
            console.log("🔄 Cleaning up prizeWin subscription...");
            subscription.unsubscribe();
        };
    }, [user, run]);

    // Claim NFT reward function
    const claimNFTReward = async (rewardId: string, rewardName: string, mintAddress?: string, bulkMode: boolean = false) => {
        if (claimingReward && !bulkMode) {
            console.log("⚠️ Claim already in progress, ignoring duplicate request");
            return;
        }

        // Declare variables outside try block so they're accessible in catch block
        let userPublicKey: PublicKey | undefined;
        let nftMint: PublicKey | undefined;
        let projectId: string | null = null;
        let isMainProject = false;

        try {
            if (!bulkMode) {
                setClaimingReward(rewardId);
            }
            console.log(`🎨 Starting NFT claim for reward ${rewardId} with mint ${mintAddress}`);

            // Check if this reward is already withdrawn AND verify user is the winner
            const { data: existingReward, error: checkError } = await supabase
                .from("prizeWin")
                .select("isWithdraw, userId, reward_type, name")
                .eq("id", rewardId)
                .single();

            if (checkError) {
                console.error("Error checking reward status:", checkError);
                throw new Error("Failed to check reward status");
            }

            // CRITICAL: Verify the user is the actual winner (backend validation)
            if (existingReward?.userId !== user?.id) {
                console.error("❌ Security violation: User attempting to claim reward that doesn't belong to them", {
                    rewardUserId: existingReward?.userId,
                    currentUserId: user?.id,
                    rewardId: rewardId
                });
                if (!bulkMode) {
                    alert(`❌ Access Denied!\n\nThis reward does not belong to you.\n\nOnly the jackpot winner can claim this NFT.`);
                    run(user?.id); // Refresh to update UI
                }
                return;
            }

            if (existingReward?.isWithdraw) {
                console.log("⚠️ Reward already withdrawn, skipping claim");
                if (!bulkMode) {
                    alert(`🎉 NFT Already Claimed!\n\nYou already claimed ${rewardName}!\n\nCheck your wallet for the NFT!`);
                    run(user?.id); // Refresh to update UI
                }
                return;
            }
            
            // Additional validation: For jackpot NFT rewards, verify user is the winner in jackpot_wins table
            if (existingReward?.reward_type === 'nft' && existingReward?.name) {
                // Check if this is a jackpot reward by checking jackpot_wins table
                const { data: jackpotWin, error: jackpotError } = await supabase
                    .from('jackpot_wins')
                    .select('user_id, pool_id, win_type')
                    .eq('user_id', user?.id)
                    .eq('win_type', 'jackpot_final')
                    .maybeSingle();
                
                if (jackpotError) {
                    console.warn('⚠️ Could not verify jackpot win status:', jackpotError);
                    // Continue anyway - prizeWin entry is the source of truth
                } else if (!jackpotWin) {
                    console.warn('⚠️ User has prizeWin entry but no corresponding jackpot_wins entry');
                    // This could be a lootbox reward, not a jackpot reward - allow it
                } else {
                    console.log('✅ Verified user is jackpot winner:', jackpotWin);
                }
            }

            // Get current project ID and check if main project (before wallet connection)
            projectId = typeof window !== 'undefined'
                ? localStorage.getItem('currentProjectId')
                : null;
            const projectSlug = typeof window !== 'undefined'
                ? localStorage.getItem('currentProjectSlug')
                : null;

            // Check if this is the main project (no projectId or no projectSlug in URL)
            if (typeof window !== 'undefined') {
                const pathParts = window.location.pathname.split('/').filter(Boolean);
                const firstSegment = pathParts[0];
                isMainProject = !firstSegment ||
                    firstSegment === 'lootboxes' ||
                    firstSegment === 'live-draw' ||
                    firstSegment === 'leaderboard' ||
                    (!projectSlug && !projectId);
            }

            // Use the actual mint address from the database, or fallback to placeholder
            nftMint = mintAddress ? new PublicKey(mintAddress) : new PublicKey("11111111111111111111111111111111");

            console.log(`🎨 Claiming NFT with mint: ${nftMint.toString()}`);

            // Connect wallet
            //@ts-ignore
            const wallet = window.solana;
            if (!wallet) {
                alert("Please install Phantom wallet");
                return;
            }

            const walletAddress = await wallet.connect();
            userPublicKey = new PublicKey(walletAddress.publicKey.toString());

            // First, check if user already has the NFT in their wallet
            // If they do, just mark it as claimed without attempting transfer
            const userHasNFT = await solanaProgramService.checkUserHasNFT(userPublicKey, nftMint);
            
            let signature: string;
            if (userHasNFT) {
                console.log("✅ User already has the NFT, marking as claimed without transfer");
                signature = "NFT_ALREADY_IN_WALLET";
            } else {
                // Withdraw NFT from admin wallet directly to user's wallet
                // Main project: use main website admin wallet (pass undefined)
                // Sub-project: use project-specific admin wallet (pass projectId)
                signature = await solanaProgramService.withdrawNFTFromAdminWallet(
                    userPublicKey, 
                    nftMint,
                    isMainProject ? undefined : (projectId ? parseInt(projectId) : undefined)
                );
            }

            // Update ALL instances of this mint as claimed (not just this specific reward)
            let updateQuery = supabase.from("prizeWin").update({
                isWithdraw: true
            }).eq("userId", user.id).eq("mint", mintAddress);

            // Main project: filter for project_id IS NULL
            // Sub-project: filter by specific project_id
            if (isMainProject) {
                console.log("🏠 Main project: Marking NFT as claimed (project_id IS NULL)");
                updateQuery = updateQuery.is("project_id", null);
            } else if (projectId) {
                console.log(`📦 Sub-project: Marking NFT as claimed (project_id = ${projectId})`);
                updateQuery = updateQuery.eq("project_id", parseInt(projectId));
            }

            const updateResult = await updateQuery;

            if (updateResult.error) {
                console.error("Error updating mint status:", updateResult.error);
                throw new Error("Failed to update reward status");
            }

            console.log(`✅ Marked all instances of mint ${mintAddress} as claimed`);

            // Mark NFT as available again using backend API
            try {
                const response = await fetch('/api/nft-status', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        mint: mintAddress
                    }),
                });

                const result = await response.json();

                if (result.success) {
                    console.log(`✅ NFT marked as available again: ${mintAddress}`);
                } else {
                    console.warn("⚠️ Backend NFT availability update failed:", result.error);
                }
            } catch (error) {
                console.warn("⚠️ Error calling backend API:", error);
            }

            // Remove claimed NFT reward from the wheel DB (nft_reward_percentages)
            try {
                const { error: delErr } = await supabase
                    .from('nft_reward_percentages')
                    .delete()
                    .eq('mint_address', mintAddress);
                if (delErr) {
                    console.warn('⚠️ Could not delete claimed NFT from nft_reward_percentages:', delErr);
                } else {
                    console.log(`🗑️ Removed claimed NFT ${mintAddress} from nft_reward_percentages`);
                }
            } catch (dbErr) {
                console.warn('⚠️ DB cleanup error (claimed NFT):', dbErr);
            }

            if (!bulkMode) {
                if (signature === "NFT_ALREADY_IN_WALLET") {
                    alert(`🎉 NFT Already in Your Wallet!\n\n${rewardName} is already in your wallet!\n\nThe reward has been marked as claimed.`);
                } else {
                    alert(`🎉 NFT Reward Claimed!\n\nYou claimed ${rewardName}!\n\nTransaction: ${signature}\n\nCheck your wallet for the NFT!`);
                }
                // Refresh the cart
                run(user?.id);
            }

        } catch (error) {
            console.error("Error claiming NFT reward:", error);

            // Handle specific error cases
            if (error instanceof Error) {
                // Handle transaction timeout errors
                if (error.message.includes("not confirmed") ||
                    error.message.includes("timeout") ||
                    error.message.includes("TransactionExpiredTimeoutError")) {
                    console.log("⚠️ Transaction timeout - checking if it succeeded...");
                    
                    // Try to extract signature from error message
                    const signatureMatch = error.message.match(/signature[:\s]+([A-Za-z0-9]{64,88})/i) ||
                                          error.message.match(/Transaction: ([A-Za-z0-9]{64,88})/);
                    const signature = signatureMatch ? signatureMatch[1] : null;
                    
                    if (signature) {
                        alert(
                            `⏳ Transaction Pending Confirmation\n\n` +
                            `The transaction was sent but confirmation timed out after 120 seconds.\n\n` +
                            `This can happen on mainnet due to network congestion.\n\n` +
                            `Transaction: ${signature.substring(0, 8)}...${signature.substring(-8)}\n\n` +
                            `Please check the transaction status:\n` +
                            `https://solscan.io/tx/${signature}\n\n` +
                            `The transaction may still be processing. If it succeeded, the NFT will appear in your wallet.\n` +
                            `If it failed, you'll see an error on Solana Explorer. Please try claiming again if it failed.`
                        );
                    } else {
                        alert(
                            `⏳ Transaction Pending\n\n` +
                            `The transaction was sent but confirmation timed out.\n\n` +
                            `This is common on mainnet due to network congestion.\n\n` +
                            `Please refresh the page and check your wallet.\n` +
                            `If the NFT doesn't appear, try claiming again.`
                        );
                    }
                    
                    // Refresh cart to check if transaction succeeded
                    setTimeout(() => {
                        run(user?.id);
                    }, 5000);
                    
                    setClaimingReward(null);
                    return;
                }
                
                // Handle blockhash expiration errors
                if (error.message.includes("block height exceeded") ||
                    error.message.includes("TransactionExpiredBlockheightExceededError") ||
                    error.message.includes("blockhash expired")) {
                    console.log("⚠️ Blockhash expired - transaction may still succeed, checking status...");
                    
                    // Try to extract signature from error message
                    const signatureMatch = error.message.match(/Transaction: ([A-Za-z0-9]{64,88})/);
                    const signature = signatureMatch ? signatureMatch[1] : null;
                    
                    if (signature) {
                        alert(
                            `⏳ Transaction Pending Confirmation\n\n` +
                            `The transaction was sent but the blockhash expired during confirmation.\n\n` +
                            `This is common on mainnet due to network congestion.\n\n` +
                            `Transaction: ${signature.substring(0, 8)}...${signature.substring(-8)}\n\n` +
                            `Please check the transaction status:\n` +
                            `https://solscan.io/tx/${signature}\n\n` +
                            `If the transaction succeeded, the NFT will appear in your wallet.\n` +
                            `If it failed, please try claiming again.`
                        );
                    } else {
                        alert(
                            `⏳ Transaction Pending\n\n` +
                            `The transaction was sent but confirmation timed out.\n\n` +
                            `This is common on mainnet due to network congestion.\n\n` +
                            `Please refresh the page and check your wallet.\n` +
                            `If the NFT doesn't appear, try claiming again.`
                        );
                    }
                    
                    // Refresh cart to check if transaction succeeded
                    setTimeout(() => {
                        run(user?.id);
                    }, 3000);
                    
                    setClaimingReward(null);
                    return;
                }
                
                // Handle InstructionError (transaction failed on-chain)
                if (error.message.includes("InstructionError") ||
                    error.message.includes("Instruction") && error.message.includes("failed")) {
                    console.error("❌ Transaction failed on-chain with InstructionError");
                    
                    // Try to extract signature from error message
                    const signatureMatch = error.message.match(/Transaction: ([A-Za-z0-9]{64,88})/);
                    const signature = signatureMatch ? signatureMatch[1] : null;
                    
                    let errorDetails = error.message;
                    if (error.message.includes("Custom error")) {
                        const customMatch = error.message.match(/Custom error: (\d+)/);
                        if (customMatch) {
                            errorDetails = `Program error code: ${customMatch[1]}`;
                        }
                    }
                    
                    alert(
                        `❌ NFT Claim Failed On-Chain\n\n` +
                        `The transaction was sent but failed during execution on the Solana blockchain.\n\n` +
                        `Error: ${errorDetails}\n\n` +
                        (signature 
                            ? `Transaction: ${signature.substring(0, 8)}...${signature.substring(-8)}\n\n` +
                              `Check the transaction on Solana Explorer:\n` +
                              `https://solscan.io/tx/${signature}\n\n`
                            : ``) +
                        `Common causes:\n` +
                        `• NFT not available in admin wallet\n` +
                        `• Insufficient SOL in admin wallet for fees\n` +
                        `• Invalid token account\n` +
                        `• Network congestion\n\n` +
                        `Please try again or contact support if the issue persists.`
                    );
                    
                    setClaimingReward(null);
                    return;
                }
                
                // Handle transaction failure errors
                if (error.message.includes("NFT withdrawal failed")) {
                    console.error("Transaction failed - extracting error details");
                    
                    // Try to extract transaction signature from error message
                    const signatureMatch = error.message.match(/Transaction: ([A-Za-z0-9]{64,88})/);
                    const signature = signatureMatch ? signatureMatch[1] : null;
                    
                    // Extract error details
                    const errorDetails = error.message.split("NFT withdrawal failed:")[1]?.split("\n\n")[0] || "Unknown error";
                    
                    alert(
                        `❌ NFT Claim Failed!\n\n` +
                        `The transaction failed on the Solana blockchain.\n\n` +
                        `Error: ${errorDetails}\n\n` +
                        (signature 
                            ? `Transaction: ${signature.substring(0, 8)}...${signature.substring(-8)}\n\n` +
                              `You can check the transaction status on Solana Explorer:\n` +
                              `https://solscan.io/tx/${signature}\n\n`
                            : ``) +
                        `Common causes:\n` +
                        `• Insufficient SOL in admin wallet for transaction fees\n` +
                        `• Network congestion\n` +
                        `• Invalid token account\n\n` +
                        `Please try again or contact support if the issue persists.`
                    );
                    setClaimingReward(null);
                    return;
                }
                
                // Handle case where admin wallet doesn't have NFT - check if user already has it
                if (error.message.includes("Admin wallet does not have this NFT") || 
                    error.message.includes("NFT not found in admin wallet")) {
                    console.log("⚠️ Admin wallet doesn't have NFT, checking if user already has it...");
                    
                    // Only check if we have the necessary variables (wallet was connected)
                    if (userPublicKey && nftMint) {
                        try {
                            // Check if user already has the NFT in their wallet
                            const userHasNFT = await solanaProgramService.checkUserHasNFT(userPublicKey, nftMint);
                            
                            if (userHasNFT) {
                                console.log("✅ User already has the NFT, marking as claimed in database");
                                
                                // Mark as claimed in database
                                let updateQuery = supabase.from("prizeWin").update({
                                    isWithdraw: true
                                }).eq("userId", user.id).eq("mint", mintAddress);

                                if (isMainProject) {
                                    updateQuery = updateQuery.is("project_id", null);
                                } else if (projectId) {
                                    updateQuery = updateQuery.eq("project_id", parseInt(projectId));
                                }

                                await updateQuery;
                                
                                // Refresh cart
                                run(user?.id);
                                
                                if (!bulkMode) {
                                    alert(`🎉 NFT Already in Your Wallet!\n\n${rewardName} is already in your wallet!\n\nThe reward has been marked as claimed.`);
                                }
                                setClaimingReward(null);
                                return;
                            }
                        } catch (checkError) {
                            console.error("Error checking if user has NFT:", checkError);
                            // Fall through to show error
                        }
                    }
                    
                    // User doesn't have it and admin doesn't have it - NFT is missing
                    alert(
                        `⚠️ NFT Not Available!\n\n` +
                        `${rewardName} is not available in the admin wallet.\n\n` +
                        `The NFT may have already been claimed or is missing.\n\n` +
                        `Please contact support if you believe this is an error.`
                    );
                    setClaimingReward(null);
                    return;
                }

                // Handle new user account initialization error
                if (error.message.includes("NFT CLAIM UNAVAILABLE") ||
                    error.message.includes("account needs initialization") ||
                    error.message.includes("AccountNotInitialized") ||
                    error.message.includes("NFT tracking account")) {
                    alert(
                        `⚠️ NFT CLAIM UNAVAILABLE - ACCOUNT NOT INITIALIZED\n\n` +
                        `Your NFT tracking account has not been initialized.\n\n` +
                        `WHY THIS HAPPENS:\n` +
                        `The Solana program requires you to DEPOSIT AN NFT first before claiming NFT rewards.\n` +
                        `⚠️ Depositing SOL does NOT initialize the NFT tracking account!\n\n` +
                        `SOLUTION:\n` +
                        `You must deposit at least one NFT (any NFT, even a cheap one) to initialize your account.\n` +
                        `After that, you'll be able to claim NFT rewards.\n\n` +
                        `ALTERNATIVE:\n` +
                        `Contact support for manual initialization.\n\n` +
                        `This is a known limitation of the current Solana program design.`
                    );

                    setClaimingReward(null);
                    return;
                }

                if (error.message.includes("already been processed")) {
                    console.log("✅ Transaction was already processed successfully");
                    // Get current project ID and check if main project
                    const projectId = typeof window !== 'undefined'
                        ? localStorage.getItem('currentProjectId')
                        : null;

                    let isMainProjectCheck = false;
                    if (typeof window !== 'undefined') {
                        const pathParts = window.location.pathname.split('/').filter(Boolean);
                        const firstSegment = pathParts[0];
                        isMainProjectCheck = !firstSegment ||
                            firstSegment === 'lootboxes' ||
                            firstSegment === 'live-draw' ||
                            firstSegment === 'leaderboard' ||
                            (!projectId || projectId === 'null' || projectId === '');
                    }

                    // Update ALL instances of this mint as claimed
                    let updateQuery = supabase.from("prizeWin").update({
                        isWithdraw: true
                    }).eq("userId", user.id).eq("mint", mintAddress);

                    // Main project: filter for project_id IS NULL
                    // Sub-project: filter by specific project_id
                    if (isMainProjectCheck) {
                        updateQuery = updateQuery.is("project_id", null);
                    } else if (projectId) {
                        updateQuery = updateQuery.eq("project_id", parseInt(projectId));
                    }

                    await updateQuery;

                    if (!bulkMode) {
                        alert(`🎉 NFT Reward Already Claimed!\n\nYou already claimed ${rewardName}!\n\nCheck your wallet for the NFT!`);
                        // Refresh the cart
                        run(user?.id);
                    }
                    return;
                } else if (error.message.includes("NoNftDeposited") || error.message.includes("No NFT deposited")) {
                    console.log("⚠️ NFT not available in vault, marking as claimed");
                    // Get current project ID and check if main project
                    const projectId = typeof window !== 'undefined'
                        ? localStorage.getItem('currentProjectId')
                        : null;

                    let isMainProjectCheck = false;
                    if (typeof window !== 'undefined') {
                        const pathParts = window.location.pathname.split('/').filter(Boolean);
                        const firstSegment = pathParts[0];
                        isMainProjectCheck = !firstSegment ||
                            firstSegment === 'lootboxes' ||
                            firstSegment === 'live-draw' ||
                            firstSegment === 'leaderboard' ||
                            (!projectId || projectId === 'null' || projectId === '');
                    }

                    // Update ALL instances of this mint as claimed since it's not available
                    let updateQuery = supabase.from("prizeWin").update({
                        isWithdraw: true
                    }).eq("userId", user.id).eq("mint", mintAddress);

                    // Main project: filter for project_id IS NULL
                    // Sub-project: filter by specific project_id
                    if (isMainProjectCheck) {
                        updateQuery = updateQuery.is("project_id", null);
                    } else if (projectId) {
                        updateQuery = updateQuery.eq("project_id", parseInt(projectId));
                    }

                    await updateQuery;
                    // Also ensure it's removed from wheel DB so it doesn't appear again
                    try {
                        const { error: delErr } = await supabase
                            .from('nft_reward_percentages')
                            .delete()
                            .eq('mint_address', mintAddress);
                        if (delErr) {
                            console.warn('⚠️ Could not delete missing NFT from nft_reward_percentages:', delErr);
                        }
                    } catch { }

                    alert(`⚠️ NFT Not Available!\n\n${rewardName} is no longer available in the vault.\n\nIt has been removed from your rewards.`);

                    // Refresh the cart
                    run(user?.id);
                    return;
                } else if (error.message.includes("User rejected")) {
                    alert("❌ Transaction cancelled by user");
                    return;
                } else if (error.message.includes("Insufficient funds")) {
                    alert("❌ Insufficient funds for transaction");
                    return;
                }
            }

            if (!bulkMode) {
                alert(`Error claiming NFT reward: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } else {
                // In bulk mode, re-throw error so claimAllRewards can handle it
                throw error;
            }
        } finally {
            if (!bulkMode) {
                setClaimingReward(null);
            }
        }
    };

    // Claim all rewards function
    const claimAllRewards = async () => {
        if (claimingAll) {
            console.log("⚠️ Bulk claim already in progress, ignoring duplicate request");
            return;
        }

        const rewards = (data as any)?.data || [];
        const unclaimedRewards = rewards.filter((r: any) => !r.isWithdraw);

        if (unclaimedRewards.length === 0) {
            alert("✅ All rewards have already been claimed!");
            return;
        }

        const confirmClaim = confirm(
            `🎯 Claim All Rewards?\n\n` +
            `You are about to claim ${unclaimedRewards.length} reward(s):\n` +
            `${unclaimedRewards.filter((r: any) => r.reward_type === 'nft').length} NFT(s)\n` +
            `${unclaimedRewards.filter((r: any) => r.reward_type === 'sol').length} SOL reward(s)\n` +
            `${unclaimedRewards.filter((r: any) => r.reward_type === 'token').length} Token reward(s)\n\n` +
            `This will process ${unclaimedRewards.length} transaction(s). Continue?`
        );

        if (!confirmClaim) {
            return;
        }

        try {
            setClaimingAll(true);
            console.log(`🚀 Starting bulk claim for ${unclaimedRewards.length} rewards`);

            let successCount = 0;
            let failCount = 0;
            const failedRewards: string[] = [];

            // Process rewards one by one
            for (let i = 0; i < unclaimedRewards.length; i++) {
                const reward = unclaimedRewards[i];
                console.log(`📦 Processing reward ${i + 1}/${unclaimedRewards.length}: ${reward.name}`);

                try {
                    if (reward.reward_type === 'sol') {
                        await claimSOLReward(
                            reward.id?.toString() || i.toString(),
                            reward.name,
                            reward.sol,
                            true // bulk mode - don't show individual alerts
                        );
                        successCount++;
                    } else if (reward.reward_type === 'token') {
                        await claimTokenReward(
                            reward.id?.toString() || i.toString(),
                            reward.name,
                            reward.mint,
                            reward.sol, // token amount
                            reward.token_symbol || 'Token',
                            true // bulk mode - don't show individual alerts
                        );
                        successCount++;
                    } else {
                        await claimNFTReward(
                            reward.id?.toString() || i.toString(),
                            reward.name,
                            reward.mint,
                            true // bulk mode - don't show individual alerts
                        );
                        successCount++;
                    }

                    // Small delay between claims to avoid rate limiting
                    if (i < unclaimedRewards.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (error) {
                    console.error(`❌ Failed to claim reward ${reward.name}:`, error);

                    // Check if it's insufficient SOL balance error - stop immediately
                    if (error instanceof Error && error.message === "INSUFFICIENT_SOL_BALANCE") {
                        console.log("🛑 Stopping bulk claim due to insufficient SOL balance");
                        failCount++;
                        failedRewards.push(reward.name);

                        // Calculate remaining unclaimed rewards
                        const remainingRewards = unclaimedRewards.length - (i + 1);

                        // Refresh cart
                        run(user?.id);

                        // Show alert and stop
                        if (successCount > 0) {
                            alert(
                                `⚠️ Claiming Stopped - Insufficient SOL!\n\n` +
                                `✅ Successfully claimed: ${successCount} reward(s)\n` +
                                `🛑 Stopped at: ${reward.name}\n` +
                                `⏳ Remaining: ${remainingRewards} reward(s) will be claimed later\n\n` +
                                `The vault does not have enough SOL to continue.\n` +
                                `Please try again later when the vault has sufficient SOL balance.`
                            );
                        } else {
                            alert(
                                `⚠️ Insufficient SOL in Vault!\n\n` +
                                `There is not enough SOL in the vault to claim ${reward.name}.\n\n` +
                                `⏳ ${remainingRewards + 1} reward(s) will be claimed later.\n\n` +
                                `Please try again later when the vault has sufficient SOL balance.`
                            );
                        }

                        return; // Stop the loop immediately
                    }

                    // For other errors, continue with next reward
                    failCount++;
                    failedRewards.push(reward.name);
                }
            }

            // Refresh cart after all claims
            run(user?.id);

            // Show summary alert
            if (successCount > 0 && failCount === 0) {
                alert(`🎉 Success!\n\nAll ${successCount} reward(s) have been claimed successfully!\n\nCheck your wallet for the rewards!`);
            } else if (successCount > 0 && failCount > 0) {
                alert(
                    `⚠️ Partial Success\n\n` +
                    `✅ Successfully claimed: ${successCount} reward(s)\n` +
                    `❌ Failed: ${failCount} reward(s)\n\n` +
                    `Failed rewards:\n${failedRewards.join('\n')}\n\n` +
                    `You can try claiming the failed rewards individually.`
                );
            } else {
                alert(`❌ Failed to claim rewards\n\nAll ${failCount} reward(s) failed to claim.\n\nPlease try claiming them individually.`);
            }

        } catch (error) {
            console.error("Error in bulk claim:", error);
            alert(`Error claiming all rewards: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setClaimingAll(false);
        }
    };

    // Claim SOL reward function
    const claimSOLReward = async (rewardId: string, rewardName: string, solAmount: string, bulkMode: boolean = false) => {
        if (claimingReward && !bulkMode) {
            console.log("⚠️ Claim already in progress, ignoring duplicate request");
            return;
        }

        // Get current project ID and slug (outside try block so accessible in catch)
        const projectId = typeof window !== 'undefined'
            ? localStorage.getItem('currentProjectId')
            : null;
        const projectSlug = typeof window !== 'undefined'
            ? localStorage.getItem('currentProjectSlug')
            : null;

        // Check if we're on the main project by checking URL pathname (outside try block so accessible in catch)
        let isMainProject = false;
        if (typeof window !== 'undefined') {
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            const firstSegment = pathParts[0];
            isMainProject = !firstSegment ||
                firstSegment === 'lootboxes' ||
                firstSegment === 'live-draw' ||
                firstSegment === 'leaderboard' ||
                (!projectSlug && !projectId);
        }

        try {
            if (!bulkMode) {
                setClaimingReward(rewardId);
            }
            console.log(`💰 Starting SOL claim for reward ${rewardId} with amount ${solAmount}`);

            // Check if this reward is already withdrawn AND verify user is the winner
            let checkQuery = supabase
                .from("prizeWin")
                .select("isWithdraw, userId, reward_type, name")
                .eq("id", rewardId);

            // Filter by project_id based on whether we're on main project or sub-project
            if (isMainProject) {
                // Main project: only check rewards where project_id IS NULL
                checkQuery = checkQuery.is("project_id", null);
            } else if (projectId) {
                // Sub-project: filter by specific project_id
                checkQuery = checkQuery.eq("project_id", parseInt(projectId));
            }

            const { data: existingReward, error: checkError } = await checkQuery.single();

            if (checkError) {
                console.error("Error checking reward status:", checkError);
                throw new Error("Failed to check reward status");
            }

            // CRITICAL: Verify the user is the actual winner (backend validation)
            if (existingReward?.userId !== user?.id) {
                console.error("❌ Security violation: User attempting to claim reward that doesn't belong to them", {
                    rewardUserId: existingReward?.userId,
                    currentUserId: user?.id,
                    rewardId: rewardId
                });
                if (!bulkMode) {
                    alert(`❌ Access Denied!\n\nThis reward does not belong to you.\n\nOnly the jackpot winner can claim this reward.`);
                    run(user?.id); // Refresh to update UI
                }
                return;
            }

            if (existingReward?.isWithdraw) {
                console.log("⚠️ SOL reward already withdrawn, skipping claim");
                if (!bulkMode) {
                    alert(`🎉 SOL Already Claimed!\n\nYou already claimed ${rewardName}!\n\nCheck your wallet for the SOL!`);
                    run(user?.id); // Refresh to update UI
                }
                return;
            }

            // Connect wallet
            //@ts-ignore
            const wallet = window.solana;
            if (!wallet) {
                alert("Please install Phantom wallet");
                return;
            }

            const walletAddress = await wallet.connect();
            const userPublicKey = new PublicKey(walletAddress.publicKey.toString());

            console.log(`💰 Claiming SOL: ${solAmount} SOL`);

            // Withdraw SOL from admin wallet directly to user's wallet
            // Main project: use main website admin wallet (pass undefined)
            // Sub-project: use project-specific admin wallet (pass projectId)
            const signature = await solanaProgramService.withdrawSOLFromAdminWallet(
                userPublicKey, 
                parseFloat(solAmount), 
                isMainProject ? undefined : (projectId ? parseInt(projectId) : undefined)
            );

            // Update this specific SOL reward as claimed
            let updateQuery = supabase.from("prizeWin").update({
                isWithdraw: true
            }).eq("id", rewardId);

            // Filter by project_id based on whether we're on main project or sub-project
            if (isMainProject) {
                // Main project: only update rewards where project_id IS NULL
                updateQuery = updateQuery.is("project_id", null);
            } else if (projectId) {
                // Sub-project: filter by specific project_id
                updateQuery = updateQuery.eq("project_id", parseInt(projectId));
            }

            const updateResult = await updateQuery;

            if (updateResult.error) {
                console.error("Error updating SOL reward status:", updateResult.error);
                throw new Error("Failed to update reward status");
            }

            console.log(`✅ Marked SOL reward ${rewardId} as claimed`);

            if (!bulkMode) {
                alert(`🎉 SOL Reward Claimed!\n\nYou claimed ${rewardName}!\n\nTransaction: ${signature}\n\nCheck your wallet for the SOL!`);
                // Refresh the cart
                run(user?.id);
            }

        } catch (error) {
            console.error("Error claiming SOL reward:", error);

            // Handle specific error cases
            if (error instanceof Error) {
                if (error.message.includes("already been processed")) {
                    console.log("✅ Transaction was already processed successfully");
                    // Update this specific SOL reward as claimed
                    let updateQuery = supabase.from("prizeWin").update({
                        isWithdraw: true
                    }).eq("id", rewardId);

                    // Filter by project_id based on whether we're on main project or sub-project
                    if (isMainProject) {
                        // Main project: only update rewards where project_id IS NULL
                        updateQuery = updateQuery.is("project_id", null);
                    } else if (projectId) {
                        // Sub-project: filter by specific project_id
                        updateQuery = updateQuery.eq("project_id", parseInt(projectId));
                    }

                    await updateQuery;

                    if (!bulkMode) {
                        alert(`🎉 SOL Reward Already Claimed!\n\nYou already claimed ${rewardName}!\n\nCheck your wallet for the SOL!`);
                        // Refresh the cart
                        run(user?.id);
                    }
                    return;
                } else if (error.message.includes("Insufficient balance") || error.message.includes("InsufficientBalance") || error.message.includes("0x1771") || error.message.includes("6001")) {
                    console.log("⚠️ Insufficient SOL in vault, stopping claim");

                    if (!bulkMode) {
                        alert(`⚠️ Insufficient SOL in Vault!\n\nThere is not enough SOL in the vault to claim ${rewardName}.\n\nPlease try again later when the vault has sufficient SOL balance.`);
                    }

                    // Re-throw error to stop bulk claiming
                    throw new Error("INSUFFICIENT_SOL_BALANCE");
                } else if (error.message.includes("User rejected")) {
                    alert("❌ Transaction cancelled by user");
                    return;
                } else if (error.message.includes("Insufficient funds")) {
                    alert("❌ Insufficient funds for transaction");
                    return;
                }
            }

            if (!bulkMode) {
                alert(`Error claiming SOL reward: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } else {
                // In bulk mode, re-throw error so claimAllRewards can handle it
                throw error;
            }
        } finally {
            if (!bulkMode) {
                setClaimingReward(null);
            }
        }
    };

    // Claim Token reward function
    const claimTokenReward = async (rewardId: string, rewardName: string, mintAddress: string, tokenAmount: string, tokenSymbol: string, bulkMode: boolean = false) => {
        if (claimingReward && !bulkMode) {
            console.log("⚠️ Claim already in progress, ignoring duplicate request");
            return;
        }

        try {
            if (!bulkMode) {
                setClaimingReward(rewardId);
            }
            console.log(`🪙 Starting token claim for reward ${rewardId} with mint ${mintAddress}`);

            // Check if this reward is already withdrawn
            const { data: existingReward, error: checkError } = await supabase
                .from("prizeWin")
                .select("isWithdraw")
                .eq("id", rewardId)
                .single();

            if (checkError) {
                console.error("Error checking reward status:", checkError);
                throw new Error("Failed to check reward status");
            }

            if (existingReward?.isWithdraw) {
                console.log("⚠️ Reward already withdrawn, skipping claim");
                if (!bulkMode) {
                    alert(`🎉 Token Already Claimed!\n\nYou already claimed ${rewardName}!\n\nCheck your wallet for the tokens!`);
                    run(user?.id); // Refresh to update UI
                }
                return;
            }

            // Connect wallet (same pattern as SOL/NFT claims)
            // @ts-ignore
            const wallet = window.solana;
            if (!wallet || !wallet.isPhantom) {
                alert("Please install Phantom wallet");
                return;
            }

            let userPublicKey: PublicKey;
            try {
                // Check if already connected
                if (wallet.isConnected && wallet.publicKey) {
                    userPublicKey = new PublicKey(wallet.publicKey.toString());
                    console.log("✅ Wallet already connected:", userPublicKey.toString());
                } else {
                    // Request connection
                    const response = await wallet.connect({ onlyIfTrusted: false });
                    userPublicKey = new PublicKey(response.publicKey.toString());
                    console.log("✅ Wallet connected:", userPublicKey.toString());
                }
            } catch (error: any) {
                console.error("Wallet connection error:", error);
                if (error.code === 4001 || error.message?.includes("User rejected") || error.message?.includes("User rejected the request")) {
                    alert("❌ Wallet connection cancelled by user");
                    return;
                }
                if (error.message?.includes("WalletConnectionError")) {
                    alert("❌ Wallet connection failed. Please make sure Phantom wallet is installed and unlocked, then try again.");
                    return;
                }
                throw new Error(`Wallet connection failed: ${error.message || 'Please try again'}`);
            }

            console.log(`🪙 Claiming ${tokenAmount} ${tokenSymbol} tokens...`);

            // Call the token claim API
            const response = await fetch('/api/claim-token-reward', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    rewardId,
                    userPublicKey: userPublicKey.toString(),
                    mintAddress,
                    tokenAmount,
                }),
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to claim token reward');
            }

            console.log("✅ Token reward claimed successfully:", result);

            // Mark as withdrawn in database
            const { error: updateError } = await supabase
                .from("prizeWin")
                .update({ isWithdraw: true })
                .eq("id", rewardId);

            if (updateError) {
                console.error("Error updating reward status:", updateError);
                // Don't throw here as the token was already transferred
            }

            if (!bulkMode) {
                alert(`🎉 Token Reward Claimed!\n\nYou received ${tokenAmount} ${tokenSymbol}!\n\nCheck your wallet for the tokens!`);
                run(user?.id); // Refresh to update UI
            }

        } catch (error: any) {
            console.error("Error claiming token reward:", error);
            
            // Handle specific error cases
            if (error.message.includes("already claimed") || error.message.includes("AlreadyClaimed")) {
                console.log("⚠️ Token reward already claimed, updating UI");
                if (!bulkMode) {
                    alert(`🎉 Token Already Claimed!\n\nYou already claimed ${rewardName}!\n\nCheck your wallet for the tokens!`);
                    run(user?.id);
                }
                return;
            } else if (error.message.includes("Insufficient balance") || error.message.includes("InsufficientBalance")) {
                console.log("⚠️ Insufficient token balance in vault");
                if (!bulkMode) {
                    alert(`⚠️ Insufficient Token Balance!\n\nThere are not enough ${tokenSymbol} tokens in the vault to claim ${rewardName}.\n\nPlease try again later.`);
                }
                throw new Error("INSUFFICIENT_TOKEN_BALANCE");
            } else if (error.message.includes("User rejected")) {
                alert("❌ Transaction cancelled by user");
                return;
            }

            if (!bulkMode) {
                alert(`Error claiming token reward: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } else {
                throw error;
            }
        } finally {
            if (!bulkMode) {
                setClaimingReward(null);
            }
        }
    };

    if (!user.cart) return null;

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error</div>;

    /**
     * Calculate the sum of all sol in the prize win data.
     * @param data the prize win data
     * @returns the sum of all sol
     */
    const sum = (data: any) => {
        let sum = 0;
        data?.data?.map((i: any) => {
            sum = sum + Number(i?.sol);
        });
        return sum;
    };
    return (
        <div
            className="relative z-50"
            aria-labelledby="slide-over-title"
            role="dialog"
            aria-modal="true">
            <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                aria-hidden="true"></div>

            <div className="fixed inset-0 overflow-hidden">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                        <div className="pointer-events-auto w-screen max-w-md">
                            <div
                                className="flex h-full flex-col"
                                style={{
                                    margin: '10px 10px 10px 10px',
                                    backgroundColor: 'var(--theme-primary, var(--wheel-segment-fill, #ff914d))',
                                    border: '2px solid var(--theme-secondary, var(--wheel-button-hover, #e63900))',
                                    opacity: 0.9
                                }}
                            >
                                <div 
                                    className="flex items-center justify-between p-4 relative"
                                    style={{
                                        borderBottom: '2px solid var(--theme-secondary, var(--wheel-button-hover, #e63900))'
                                    }}
                                >
                                    <h2 className="text-2xl font-bold text-white w-full text-center">
                                        Available Rewards
                                    </h2>
                                    <div className="absolute right-4 flex gap-2">
                                        <button
                                            onClick={() => run(user?.id)}
                                            type="button"
                                            className="text-white hover:text-white/80"
                                            title="Refresh rewards">
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => setCart({ ...user, cart: false })}
                                            type="button"
                                            className="text-white hover:text-white/80">
                                            <span className="sr-only">Close panel</span>
                                            <svg
                                                className="h-6 w-6"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                strokeWidth="1.5"
                                                stroke="currentColor"
                                                aria-hidden="true">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M6 18L18 6M6 6l12 12"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-white/10 [&::-webkit-scrollbar-thumb]:bg-white/40 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/50">
                                    <div className="px-4 py-2">
                                        <div className="space-y-4">
                                            {(data as any)?.data?.map((item: any, index: number) => {
                                                // Determine image source based on reward type
                                                let imageSource: string | null = null;
                                                if (item?.reward_type === 'sol') {
                                                    // For SOL rewards, use default SOL logo
                                                    imageSource = 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png';
                                                } else if (item?.reward_type === 'token') {
                                                    // For token rewards, PREFER stored image if available, otherwise try token-list logo via mint
                                                    if (item?.image && item.image.trim() !== '') {
                                                        const isUrl = item.image.startsWith('http://') || item.image.startsWith('https://') || item.image.startsWith('/');
                                                        if (isUrl) {
                                                            imageSource = item.image;
                                                        } else {
                                                            imageSource = item.image;
                                                        }
                                                    } else if (item?.mint) {
                                                        imageSource = `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${item.mint}/logo.png`;
                                                    } else {
                                                        // Fallback to generic token icon
                                                        imageSource = 'https://cryptologos.cc/logos/solana-sol-logo.png';
                                                    }
                                                } else if (item?.image && item.image.trim() !== '') {
                                                    // For NFT rewards, prefer image field if it exists (may already be a URL or mint address)
                                                    // Check if it's a URL
                                                    const isUrl = item.image.startsWith('http://') || item.image.startsWith('https://') || item.image.startsWith('/');
                                                    if (isUrl) {
                                                        // It's already a URL, use it directly
                                                        imageSource = item.image;
                                                    } else {
                                                        // Image field might contain a mint address - use it to fetch metadata
                                                        // JackpotImage component will handle mint addresses
                                                        imageSource = item.image;
                                                    }
                                                } else if (item?.mint && item.mint.trim() !== '') {
                                                    // Fallback to mint address if image field is not available
                                                    // This is the primary way to fetch NFT images
                                                    imageSource = item.mint;
                                                } else {
                                                    console.warn('⚠️ SidebarCart: No image source for reward:', {
                                                        name: item?.name,
                                                        reward_type: item?.reward_type,
                                                        hasImage: !!item?.image,
                                                        hasMint: !!item?.mint,
                                                        item
                                                    });
                                                }
                                                
                                                return (
                                                <div 
                                                    key={index} 
                                                    className="flex items-center bg-white/10 rounded-lg p-4"
                                                    style={{
                                                        border: `1px solid var(--theme-secondary, var(--wheel-button-hover, #e63900))`,
                                                        borderLeft: `3px solid var(--theme-secondary, var(--wheel-button-hover, #e63900))`
                                                    }}
                                                >
                                                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
                                                        <JackpotImage
                                                            image={imageSource}
                                                            name={item?.name}
                                                            width={64}
                                                            height={64}
                                                            className="h-full w-full object-cover object-center"
                                                            fallbackSrc="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                                                        />
                                                    </div>
                                                    <div className="ml-4 flex justify-between w-full">
                                                        <div className="flex justify-between items-center">
                                                            <h3 className="text-lg font-bold text-white">
                                                                {item?.name}
                                                            </h3>
                                                            {/* <div className="text-right">
                                                                <p className="text-lg font-bold text-white">
                                                                    {item?.reward_type === 'sol' ? `${item?.sol} SOL` : `$${item?.sol}`}
                                                                </p>
                                                                <span className={`text-xs ${item?.reward_type === 'sol' ? 'text-yellow-300' : 'text-purple-300'}`}>
                                                                    {item?.reward_type === 'sol' ? 'SOL Reward' : 'NFT Reward'}
                                                                </span>
                                                            </div> */}
                                                        </div>
                                                        {/* <p className="text-white/60 text-sm">QTY 1</p> */}

                                                        {/* Claim Button */}
                                                        {!item?.isWithdraw && (
                                                            <button
                                                                onClick={() => {
                                                                    if (claimingReward) {
                                                                        console.log("⚠️ Claim already in progress, button disabled");
                                                                        return;
                                                                    }
                                                                    if (item?.reward_type === 'sol') {
                                                                        console.log("🎯 Claiming SOL:", {
                                                                            id: item.id,
                                                                            name: item.name,
                                                                            solAmount: item.sol,
                                                                            fullItem: item
                                                                        });
                                                                        claimSOLReward(item.id?.toString() || index.toString(), item.name, item.sol);
                                                                    } else if (item?.reward_type === 'token') {
                                                                        console.log("🎯 Claiming Token:", {
                                                                            id: item.id,
                                                                            name: item.name,
                                                                            mint: item.mint,
                                                                            tokenAmount: item.sol,
                                                                            tokenSymbol: item.token_symbol,
                                                                            fullItem: item
                                                                        });
                                                                        claimTokenReward(
                                                                            item.id?.toString() || index.toString(),
                                                                            item.name,
                                                                            item.mint,
                                                                            item.sol,
                                                                            item.token_symbol || 'Token'
                                                                        );
                                                                    } else {
                                                                        console.log("🎯 Claiming NFT:", {
                                                                            id: item.id,
                                                                            name: item.name,
                                                                            mint: item.mint,
                                                                            fullItem: item
                                                                        });
                                                                        claimNFTReward(item.id?.toString() || index.toString(), item.name, item.mint);
                                                                    }
                                                                }}
                                                                disabled={claimingReward === (item.id?.toString() || index.toString()) || claimingReward !== null || claimingAll}
                                                                className="mt-2 disabled:bg-gray-500 text-white py-2 px-4 rounded-lg text-sm font-bold transition-colors"
                                                                style={{
                                    backgroundColor: claimingReward === (item.id?.toString() || index.toString()) || claimingReward !== null || claimingAll
                                        ? undefined
                                        : 'var(--theme-primary, var(--wheel-button-bg, #f74e14))'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    if (claimingReward !== (item.id?.toString() || index.toString()) && claimingReward === null && !claimingAll) {
                                                                        e.currentTarget.style.backgroundColor = 'var(--theme-secondary, var(--wheel-button-hover, #e63900))';
                                                                    }
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    if (claimingReward !== (item.id?.toString() || index.toString()) && claimingReward === null && !claimingAll) {
                                                                        e.currentTarget.style.backgroundColor = 'var(--theme-primary, var(--wheel-button-bg, #f74e14))';
                                                                    }
                                                                }}
                                                            >
                                                                {claimingReward === (item.id?.toString() || index.toString())
                                                                    ? "Claiming..."
                                                                    : item?.reward_type === 'sol'
                                                                        ? "Claim"
                                                                        : "Claim"
                                                                }
                                                            </button>
                                                        )}

                                                        {/* Claimed Status */}
                                                        {item?.isWithdraw && (
                                                            <div className="mt-2 w-full bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-bold text-center">
                                                                ✅ Claimed
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                );
                                            })}

                                            {(!(data as any)?.data || (data as any).data.length === 0) && (
                                                <div className="text-center text-white/60 py-8">
                                                    <p className="text-lg">No rewards won yet</p>
                                                    <p className="text-sm">Spin the wheel to win NFT and SOL rewards!</p>
                                                    <div className="mt-4 text-xs text-white/40">
                                                        <p>💡 Tip: Rewards only appear here after you win them</p>
                                                        <p>🎰 Available NFTs are shown in the wheel and &quot;Loot In the Box&quot; section</p>
                                                        <p>💰 SOL rewards are automatically added when you win them</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div 
                                    className="p-4 bg-white/10"
                                    style={{
                                        borderTop: '2px solid var(--theme-secondary, var(--wheel-button-hover, #e63900))'
                                    }}
                                >
                                    <div className="flex justify-between text-lg font-bold text-white mb-4">
                                        <p>Total Rewards</p>
                                        <p>{(data as any)?.data?.length || 0} items</p>
                                    </div>

                                    {/* Claim All Button */}
                                    {((data as any)?.data?.filter((r: any) => !r.isWithdraw) || []).length > 0 && (
                                        <div className="mb-4">
                                            <button
                                                onClick={claimAllRewards}
                                                disabled={claimingAll || claimingReward !== null}
                                                className="w-full disabled:bg-gray-500 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg text-base font-bold transition-colors"
                                                style={{
                                                    backgroundColor: claimingAll || claimingReward !== null
                                                        ? undefined
                                                        : 'var(--theme-primary, var(--wheel-button-bg, #f74e14))'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!claimingAll && claimingReward === null) {
                                                        e.currentTarget.style.backgroundColor = 'var(--wheel-button-hover, #e63900)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!claimingAll && claimingReward === null) {
                                                        e.currentTarget.style.backgroundColor = 'var(--wheel-button-bg, #f74e14)';
                                                    }
                                                }}
                                            >
                                                {claimingAll ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                        Claiming All Rewards...
                                                    </span>
                                                ) : (
                                                    `🎯 Claim All (${((data as any)?.data?.filter((r: any) => !r.isWithdraw) || []).length} rewards)`
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* <div className="text-center text-white/60 mb-4">
                                        <p className="text-sm">NFT rewards appear here only after winning them</p>
                                        <p className="text-sm">{tokenSymbol} tokens are automatically added to your balance</p>
                                    </div> */}
                                    <div className="text-center">
                                        <button
                                            onClick={() => setCart({ ...user, cart: false })}
                                            className="text-white hover:text-white/80 font-medium">
                                            {tokenSymbol} Lootbox <span aria-hidden="true">→</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
