"use client";
import { supabase } from "@/service/supabase";
import { useUserState } from "@/state/useUserState";
import { useRequest } from "ahooks";
import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { solanaProgramService } from "@/lib/solana-program";
import Image from "next/image";

/**
 * Fetches the prizes won by a user that are available to claim.
 * Only shows NFTs that the user has actually won by spinning the wheel.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<SupabaseClient<Database>['data'] | Error>} - The prizes won by the user, or an error.
 */
const getWinPrizes = async (userId: string) => {
    try {
        console.log("🔍 Fetching NFT prizes won by user:", userId);

        // Get rewards that user has won (not withdrawn) - both NFTs and SOL
        const response = await supabase.from("prizeWin").select().eq("userId", userId).eq("isWithdraw", false);

        if (response.error) {
            console.error("❌ Error fetching prizes:", response.error);
            return response;
        }

        console.log("✅ Fetched prizes from database:", response.data);

        // Separate NFT and SOL rewards
        const nftRewards = response.data.filter((reward: any) => reward.reward_type === 'nft' && reward.mint);
        const solRewards = response.data.filter((reward: any) => reward.reward_type === 'sol');

        console.log(`📊 Found ${nftRewards.length} NFT rewards and ${solRewards.length} SOL rewards`);

        // Get actually deposited NFTs from vault (only for NFT rewards)
        let depositedMints: string[] = [];
        if (nftRewards.length > 0) {
            try {
                const { getDepositedNFTs } = await import("@/lib/nft-metadata");
                depositedMints = await getDepositedNFTs();
                console.log("📦 Actually deposited NFTs in vault:", depositedMints);
            } catch (error) {
                console.warn("⚠️ Could not fetch deposited NFTs from vault:", error);
                // If we can't check vault, return only SOL rewards to be safe
                return { ...response, data: solRewards };
            }
        }

        // Filter NFT rewards to only show those that are actually deposited in vault
        const validWonNFTs = nftRewards.filter((nft: any) => {
            // Skip placeholder mints (11111111111111111111111111111111)
            if (nft.mint === "11111111111111111111111111111111") {
                console.log("🚫 Filtering out placeholder mint:", nft.mint);
                return false;
            }

            // Only include if actually deposited in vault
            const isDeposited = depositedMints.includes(nft.mint);
            if (!isDeposited) {
                console.log("🚫 Won NFT not in vault, filtering out:", nft.mint);
            }
            return isDeposited;
        });

        // Combine valid NFT rewards with SOL rewards
        const validRewards = [...validWonNFTs, ...solRewards];

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

        // Combine unique NFTs with SOL rewards
        const finalRewards = [...uniqueNFTs, ...solRewards];

        console.log(`🎯 Final rewards: ${uniqueNFTs.length} unique NFTs + ${solRewards.length} SOL rewards = ${finalRewards.length} total`);

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
    const [claimingReward, setClaimingReward] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            console.log("🔄 Refreshing cart for user:", user.id);
            run(user?.id);
        }
    }, [user, run]);

    // Claim NFT reward function
    const claimNFTReward = async (rewardId: string, rewardName: string, mintAddress?: string) => {
        if (claimingReward) {
            console.log("⚠️ Claim already in progress, ignoring duplicate request");
            return;
        }

        try {
            setClaimingReward(rewardId);
            console.log(`🎨 Starting NFT claim for reward ${rewardId} with mint ${mintAddress}`);

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
                alert(`🎉 NFT Already Claimed!\n\nYou already claimed ${rewardName}!\n\nCheck your wallet for the NFT!`);
                run(user?.id); // Refresh to update UI
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

            // Use the actual mint address from the database, or fallback to placeholder
            const nftMint = mintAddress ? new PublicKey(mintAddress) : new PublicKey("11111111111111111111111111111111");

            console.log(`🎨 Claiming NFT with mint: ${nftMint.toString()}`);

            // Use the NFT withdrawal functionality
            const signature = await solanaProgramService.withdrawNFT(userPublicKey, nftMint, wallet);

            // Update ALL instances of this mint as claimed (not just this specific reward)
            const updateResult = await supabase.from("prizeWin").update({
                isWithdraw: true
            }).eq("userId", user.id).eq("mint", mintAddress);

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

            alert(`🎉 NFT Reward Claimed!\n\nYou claimed ${rewardName}!\n\nTransaction: ${signature}\n\nCheck your wallet for the NFT!`);

            // Refresh the cart
            run(user?.id);

        } catch (error) {
            console.error("Error claiming NFT reward:", error);

            // Handle specific error cases
            if (error instanceof Error) {
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
                    // Update ALL instances of this mint as claimed
                    await supabase.from("prizeWin").update({
                        isWithdraw: true
                    }).eq("userId", user.id).eq("mint", mintAddress);

                    alert(`🎉 NFT Reward Already Claimed!\n\nYou already claimed ${rewardName}!\n\nCheck your wallet for the NFT!`);

                    // Refresh the cart
                    run(user?.id);
                    return;
                } else if (error.message.includes("NoNftDeposited") || error.message.includes("No NFT deposited")) {
                    console.log("⚠️ NFT not available in vault, marking as claimed");
                    // Update ALL instances of this mint as claimed since it's not available
                    await supabase.from("prizeWin").update({
                        isWithdraw: true
                    }).eq("userId", user.id).eq("mint", mintAddress);
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

            alert(`Error claiming NFT reward: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setClaimingReward(null);
        }
    };

    // Claim SOL reward function
    const claimSOLReward = async (rewardId: string, rewardName: string, solAmount: string) => {
        if (claimingReward) {
            console.log("⚠️ Claim already in progress, ignoring duplicate request");
            return;
        }

        try {
            setClaimingReward(rewardId);
            console.log(`💰 Starting SOL claim for reward ${rewardId} with amount ${solAmount}`);

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
                console.log("⚠️ SOL reward already withdrawn, skipping claim");
                alert(`🎉 SOL Already Claimed!\n\nYou already claimed ${rewardName}!\n\nCheck your wallet for the SOL!`);
                run(user?.id); // Refresh to update UI
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

            // Use the SOL withdrawal functionality from the vault
            const signature = await solanaProgramService.withdrawSOL(userPublicKey, parseFloat(solAmount), wallet);

            // Update this specific SOL reward as claimed
            const updateResult = await supabase.from("prizeWin").update({
                isWithdraw: true
            }).eq("id", rewardId);

            if (updateResult.error) {
                console.error("Error updating SOL reward status:", updateResult.error);
                throw new Error("Failed to update reward status");
            }

            console.log(`✅ Marked SOL reward ${rewardId} as claimed`);

            alert(`🎉 SOL Reward Claimed!\n\nYou claimed ${rewardName}!\n\nTransaction: ${signature}\n\nCheck your wallet for the SOL!`);

            // Refresh the cart
            run(user?.id);

        } catch (error) {
            console.error("Error claiming SOL reward:", error);

            // Handle specific error cases
            if (error instanceof Error) {
                if (error.message.includes("already been processed")) {
                    console.log("✅ Transaction was already processed successfully");
                    // Update this specific SOL reward as claimed
                    await supabase.from("prizeWin").update({
                        isWithdraw: true
                    }).eq("id", rewardId);

                    alert(`🎉 SOL Reward Already Claimed!\n\nYou already claimed ${rewardName}!\n\nCheck your wallet for the SOL!`);

                    // Refresh the cart
                    run(user?.id);
                    return;
                } else if (error.message.includes("Insufficient balance") || error.message.includes("InsufficientBalance") || error.message.includes("0x1771") || error.message.includes("6001")) {
                    console.log("⚠️ Insufficient SOL in vault, converting to OGX");
                    // Convert SOL to OGX equivalent (1 SOL = 1000 OGX)
                    const ogxEquivalent = parseFloat(solAmount) * 1000;
                    const newBalance = (user.apes || 0) + ogxEquivalent;

                    // Update user balance
                    await supabase.from("user").update({ apes: newBalance }).eq("id", user.id);

                    // Mark SOL reward as claimed
                    await supabase.from("prizeWin").update({ isWithdraw: true }).eq("id", rewardId);

                    alert(`⚠️ Vault has insufficient SOL!\n\nYou received ${ogxEquivalent} OGX instead of ${solAmount} SOL.\n\nYou can sell this OGX to get SOL in your wallet!`);

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

            alert(`Error claiming SOL reward: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setClaimingReward(null);
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
                            <div className="flex h-full flex-col bg-[#ff914d]/90" style={{ margin: '10px 10px 10px 10px' }}>
                                <div className="flex items-center justify-between p-4 relative">
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
                                            {(data as any)?.data?.map((item: any, index: number) => (
                                                <div key={index} className="flex items-center bg-white/10 rounded-lg p-4 ">
                                                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
                                                        <img
                                                            src={`${item?.image}`}
                                                            alt={item?.name}
                                                            width={64}
                                                            height={64}
                                                            className="h-full w-full object-cover object-center"
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
                                                                disabled={claimingReward === (item.id?.toString() || index.toString()) || claimingReward !== null}
                                                                className={`mt-2  disabled:bg-gray-500 text-white py-2 px-4 rounded-lg text-sm font-bold transition-colors ${item?.reward_type === 'sol'
                                                                        ? 'bg-red-600 hover:bg-red-700'
                                                                        : 'bg-red-600 hover:bg-red-700'
                                                                    }`}
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
                                            ))}

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

                                <div className="p-4 bg-white/10">
                                    <div className="flex justify-between text-lg font-bold text-white mb-4">
                                        <p>Total Rewards</p>
                                        <p>{(data as any)?.data?.length || 0} items</p>
                                    </div>
                                    {/* <div className="text-center text-white/60 mb-4">
                                        <p className="text-sm">NFT rewards appear here only after winning them</p>
                                        <p className="text-sm">OGX tokens are automatically added to your balance</p>
                                    </div> */}
                                    <div className="text-center">
                                        <button
                                            onClick={() => setCart({ ...user, cart: false })}
                                            className="text-white hover:text-white/80 font-medium">
                                            OGX Lootbox <span aria-hidden="true">→</span>
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
