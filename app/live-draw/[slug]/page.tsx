"use client";
import { supabase } from "@/service/supabase";
import { useUserState } from "@/state/useUserState";
import { useRequest } from "ahooks";
import JackpotImage from "../../Components/JackpotImage";
import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Countdown from "react-countdown";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Loader from "../../Components/Loader";
import TopNav from "../../Components/TopNav";
// Removed pickJackpotWinner - winner selection is now handled by backend API
import { fetchNFTMetadata } from "@/lib/nft-metadata";
import { formatLocalDateTime, getCurrentUTCTime, isPastDate } from "@/lib/timezone-utils";
import { useWallet } from "@solana/wallet-adapter-react";

const getJackpotData = async (id: string) => {
    try {
        console.log("🔍 DEBUG: Fetching jackpot with ID:", id);
        console.log("🔍 DEBUG: ID type:", typeof id);
        console.log("🔍 DEBUG: ID value:", JSON.stringify(id));
        
        // Validate ID parameter
        if (!id || id === 'undefined' || id === 'null') {
            console.error("❌ ERROR: Invalid ID parameter:", id);
            throw new Error(`Invalid ID parameter: ${id}`);
        }

        // Get jackpot pool details from database
        // MAIN PROJECT: Only show jackpots where project_id IS NULL
        console.log("🔍 DEBUG: Querying jackpot pool with ID:", id, "(MAIN PROJECT - project_id IS NULL)");
        console.log("🔍 DEBUG: SQL Query: SELECT * FROM jackpot_pools WHERE id = " + id + " AND project_id IS NULL");
        
        const jackpotResponse = await supabase
        .from("jackpot_pools")
        .select("*")
        .eq("id", id)
        .is("project_id", null) // MAIN PROJECT ONLY: Filter by project_id IS NULL
        .single();

        console.log("🔍 DEBUG: Jackpot query result:", jackpotResponse);
        
        if (jackpotResponse.error) {
            console.warn("⚠️ WARNING: Jackpot not found, using fallback data:", jackpotResponse.error);
            console.log("🔍 DEBUG: Error details:", {
                code: jackpotResponse.error.code,
                message: jackpotResponse.error.message,
                details: jackpotResponse.error.details,
                hint: jackpotResponse.error.hint
            });
            
            // Return fallback data if specific jackpot not found
            const fallbackJackpots = {
                "1": {
                    id: 1,
                    name: "Daily Jackpot",
                    description: "Win amazing prizes in our daily jackpot draw! Each ticket gives you an equal chance to win the grand prize.",
                    current_amount: 0,
                    ticket_price: 100,
                    max_tickets: 1000,
                    end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    is_active: true
                },
                "2": {
                    id: 2,
                    name: "Weekly Mega Jackpot",
                    description: "Our biggest weekly jackpot with incredible rewards! Perfect for serious players.",
                    current_amount: 0,
                    ticket_price: 500,
                    max_tickets: 500,
                    end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    is_active: true
                },
                "3": {
                    id: 3,
                    name: "Monthly Super Jackpot",
                    description: "The ultimate monthly jackpot with life-changing prizes! Limited time only.",
                    current_amount: 0,
                    ticket_price: 1000,
                    max_tickets: 200,
                    end_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    is_active: true
                }
            };

            const key = String(id) as keyof typeof fallbackJackpots;
            const fallbackJackpot = fallbackJackpots[key] || fallbackJackpots["1"];
            
            return {
                data: [fallbackJackpot],
                count: 0,
                error: null
            };
        }

        console.log("✅ SUCCESS: Jackpot data:", jackpotResponse.data);

        // Get total tickets sold (sum of ticket_count, not count of rows)
        // MAIN PROJECT: Filter by project_id IS NULL (jackpot_tickets might have project_id column)
        console.log("🔍 DEBUG: Getting total tickets sold for jackpot ID:", id);
        
        const { data: ticketsData, error: countError } = await supabase
            .from("jackpot_tickets")
            .select("ticket_count")
            .eq("pool_id", id);
        
        // Calculate total tickets sold (sum of all ticket_count values)
        const totalTicketsSold = ticketsData?.reduce((sum, ticket) => sum + (parseInt(String(ticket.ticket_count || 0))), 0) || 0;
        const count = totalTicketsSold; // Use total tickets for display

        console.log("🔍 DEBUG: Ticket count result:", { count, countError });

        if (countError) {
            console.warn("⚠️ WARNING: Error getting ticket count:", countError);
            console.log("🔍 DEBUG: Count error details:", {
                code: countError.code,
                message: countError.message,
                details: countError.details,
                hint: countError.hint
            });
        }

        console.log("✅ SUCCESS: Ticket count:", count);

        return {
            data: [jackpotResponse.data],
            count: count || 0,
            error: null
        };
    } catch (error) {
        console.error("Error fetching jackpot data:", error);
        // Return fallback data as last resort
        const fallbackJackpot = {
            id: id,
            name: "Daily Jackpot",
            description: "Win amazing prizes in our daily jackpot draw! Each ticket gives you an equal chance to win the grand prize.",
            current_amount: 0,
            ticket_price: 100,
            max_tickets: 1000,
            end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            is_active: true
        };

    return {
            data: [fallbackJackpot],
            count: 0,
            error: null
        };
    }
};

export default function Page() {
    const [value, setValue] = useState("");
    const [user, setUser] = useUserState();
    const [isTimeExpired, setIsTimeExpired] = useState(false);
    const [currentWinner, setCurrentWinner] = useState<{user_id: string; amount: number; created_at: string; reward_type?: string; is_nft?: boolean} | null>(null);
    const params = useParams<{ slug: string }>();
    const { data, loading, error, run } = useRequest(getJackpotData);
    const { publicKey, connected } = useWallet(); // Check wallet connection status
    const balanceCreditedRef = useRef<Set<string>>(new Set()); // Track which winners have been credited in this session
    
    // Debug: Log user state and wallet connection changes
    useEffect(() => {
        console.log("🔍 DEBUG: User state changed:", {
            user: user,
            userId: user?.id,
            walletAddress: user?.walletAddress,
            apes: user?.apes,
            hasUser: !!user,
            hasId: !!user?.id,
            hasWalletAddress: !!user?.walletAddress,
            walletConnected: connected,
            publicKey: publicKey?.toBase58()
        });
    }, [user, connected, publicKey]);
    
    // If wallet is connected but user is not loaded, try to load user data
    useEffect(() => {
        const loadUserIfWalletConnected = async () => {
            if (connected && publicKey && (!user || (!user.id && !user.walletAddress))) {
                console.log("🔍 Wallet connected but user not loaded. Attempting to load user...");
                try {
                    // Try to find user by wallet address
                    const { data: userData, error: fetchError } = await supabase
                        .from("user")
                        .select()
                        .eq("walletAddress", publicKey.toBase58())
                        .single();
                    
                    if (userData && !fetchError) {
                        console.log("✅ Found user by wallet address:", userData);
                        setUser(prevUser => ({ ...prevUser, ...userData }));
                    } else {
                        console.log("⚠️ User not found for wallet address:", publicKey.toBase58());
                        // User might not be created yet - TopNav should handle this
                        // But we can set walletAddress in user state as fallback
                        setUser(prevUser => ({ ...prevUser, walletAddress: publicKey.toBase58() }));
                    }
                } catch (error) {
                    console.error("❌ Error loading user:", error);
                }
            }
        };
        
        loadUserIfWalletConnected();
    }, [connected, publicKey, user, setUser]);
    
    useEffect(() => {
        if (params?.slug) {
            run(params.slug);
        }
    }, [params, run]);

    // Check if time has expired and select final winner
    useEffect(() => {
        if (data?.data?.[0]?.end_time) {
            // Parse end_time as UTC (Supabase stores in UTC)
            const endTimeUTC = new Date(data.data[0].end_time);
            const nowUTC = new Date(); // Current time in UTC
            const expired = nowUTC >= endTimeUTC;
            setIsTimeExpired(expired);
            
            console.log("⏰ Time check:", {
                end_time_utc: endTimeUTC.toISOString(),
                now_utc: nowUTC.toISOString(),
                expired: expired,
                end_time_local: formatLocalDateTime(endTimeUTC),
                now_local: formatLocalDateTime(nowUTC)
            });
            
            // If time just expired, select final winner (only once)
            if (expired && params?.slug) {
                const selectFinalWinner = async () => {
                    const poolId = parseInt(params.slug);
                    try {
                        // CRITICAL: Check if jackpot is already settled by reading is_settled from jackpot_pools
                        // This is the authoritative source - if is_settled === true, winner is fixed permanently
                        const endTimeISO = endTimeUTC.toISOString();
                        
                        // First, try to check jackpot_pools for is_settled and winner_user_id
                        // These columns may not exist if migration wasn't run
                        let poolSettledData: any = null;
                        try {
                            const { data, error } = await supabase
                                .from('jackpot_pools')
                                .select('id, name, image, item_price, is_settled, winner_user_id, settled_at')
                                .eq('id', poolId)
                                .is('project_id', null) // Main project has NULL project_id
                                .single();
                            
                            if (!error) {
                                poolSettledData = data;
                            } else {
                                console.log("⚠️ Could not fetch settlement columns (may not exist):", error.message);
                            }
                        } catch (err) {
                            console.log("⚠️ Exception fetching settlement data:", err);
                        }
                        
                        // If is_settled === true, use the saved winner_user_id (NEVER recompute)
                        if (poolSettledData?.is_settled === true && poolSettledData?.winner_user_id) {
                            console.log("🏆 Jackpot already settled (is_settled=true), using saved winner:", poolSettledData.winner_user_id);
                            
                            // Get win details from jackpot_wins for display
                            const { data: existingWin } = await supabase
                                .from('jackpot_wins')
                                .select('id, user_id, amount, created_at')
                                .eq('pool_id', poolId)
                                .eq('user_id', poolSettledData.winner_user_id)
                                .eq('win_type', 'jackpot_final')
                                .is('project_id', null) // Main project
                                .maybeSingle();
                            
                            // Use pool data for display
                            const poolData = poolSettledData;
                            
                            // Check if it's an NFT jackpot:
                            // 1. If image is a mint address (old format: 32-44 chars, no slashes/dots)
                            // 2. OR if image is a URL but item_price is NULL/0 (new format: image URL stored, but it's still an NFT)
                            // 3. OR check existing prizeWin entries to see if there's a mint field (for already-settled jackpots)
                            const isMintAddress = poolData?.image && 
                                               typeof poolData.image === 'string' && 
                                               poolData.image.length >= 32 && 
                                               poolData.image.length <= 44 && 
                                               !poolData.image.includes('/') && 
                                               !poolData.image.includes('.');
                            
                            let isNFTJackpot = isMintAddress;
                            // If not a mint address but image exists and item_price is NULL/0, check existing prizeWin
                            if (!isMintAddress && poolData?.image && (!poolData.item_price || poolData.item_price === 0)) {
                              // Check if there's an existing prizeWin entry with a mint field for this jackpot
                              const { data: existingPrizeWin } = await supabase
                                .from('prizeWin')
                                .select('mint, reward_type')
                                .eq('name', poolData.name)
                                .not('mint', 'is', null)
                                .limit(1)
                                .maybeSingle();
                              
                              if (existingPrizeWin?.mint || existingPrizeWin?.reward_type === 'nft') {
                                isNFTJackpot = true;
                                console.log('🎨 Detected NFT jackpot from existing prizeWin entry');
                              }
                            }
                            
                            const isItemPrize = !isNFTJackpot && poolData?.item_price && poolData.item_price > 0;
                            
                            // If it's an item prize, claim reward via API (idempotent)
                            if (isItemPrize && existingWin) {
                                const itemPriceAmount = parseFloat(String(poolData.item_price)) || 0;
                                console.log(`🎁 Existing winner found for item prize. Claiming ${itemPriceAmount} OGX via API...`);
                                
                                // Create a unique key for this winner+pool combination
                                const creditKey = `${poolId}-${existingWin.user_id}`;
                                
                                // Check if we've already claimed this winner in this session
                                if (balanceCreditedRef.current.has(creditKey)) {
                                    console.log(`⏭️ Skipping reward claim - already claimed for winner ${existingWin.user_id} in pool ${poolId} in this session`);
                                } else {
                                    try {
                                        // Call backend API to claim reward (idempotent)
                                        const response = await fetch('/api/claim-jackpot-reward', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({
                                                winId: existingWin.id,
                                                userId: existingWin.user_id,
                                                poolId: poolId,
                                                projectId: null // Main project
                                            }),
                                        });

                                        const result = await response.json();

                                        if (result.success) {
                                            if (result.alreadyClaimed) {
                                                console.log(`✅ Reward already claimed (idempotent check)`);
                                            } else {
                                                console.log(`✅ Reward claimed successfully: ${result.rewardAmount} tokens. New balance: ${result.newBalance}`);
                                            }
                                            // Mark as claimed to prevent duplicate API calls
                                            balanceCreditedRef.current.add(creditKey);
                                        } else {
                                            console.error("❌ Error claiming reward:", result.error);
                                        }
                                    } catch (claimError) {
                                        console.error("❌ Exception claiming reward:", claimError);
                                    }
                                }
                            }
                            
                            // For item prizes, display item_price instead of the stored amount
                            // CRITICAL: For NFT jackpots, don't show OGX amount
                            let displayAmount = 0;
                            if (isItemPrize && poolData?.item_price) {
                                displayAmount = parseFloat(String(poolData.item_price));
                            } else if (!isNFTJackpot && existingWin) {
                                // Only show amount for token/SOL rewards, not NFT rewards
                                displayAmount = parseFloat(String(existingWin.amount || 0));
                            }
                            // For NFT jackpots, displayAmount remains 0
                            
                            setCurrentWinner({
                                user_id: poolSettledData.winner_user_id,
                                amount: displayAmount,
                                created_at: poolSettledData.settled_at || existingWin?.created_at || new Date().toISOString(),
                                reward_type: isNFTJackpot ? 'nft' : (isItemPrize ? 'item' : 'sol'),
                                is_nft: isNFTJackpot
                            });
                            
                            console.log("✅ Winner loaded from database (fixed permanently):", {
                                winnerId: poolSettledData.winner_user_id,
                                isSettled: true,
                                settledAt: poolSettledData.settled_at
                            });
                            
                            return; // Don't proceed to settle - already settled
                        }
                        
                        // Check if winner already exists in jackpot_wins (fallback for old data)
                        // Main project: filter for project_id IS NULL
                        const { data: existingWin } = await supabase
                            .from('jackpot_wins')
                            .select('id, user_id, amount, created_at')
                            .eq('pool_id', poolId)
                            .eq('win_type', 'jackpot_final') // Only final winners
                            .is('project_id', null) // Main project has NULL project_id
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                        
                        if (existingWin) {
                            // Winner already selected, but we need to check if balance was credited
                            console.log("🏆 Final winner already selected (from jackpot_wins):", existingWin);
                            
                            // Get pool data to check if it's an item prize that needs crediting
                            const { data: poolData } = await supabase
                                .from('jackpot_pools')
                                .select('name, image, item_price')
                                .eq('id', poolId)
                                .is('project_id', null) // MAIN PROJECT ONLY
                                .single();
                            
                            // Check if it's an NFT jackpot:
                            // 1. If image is a mint address (old format: 32-44 chars, no slashes/dots)
                            // 2. OR if image is a URL but item_price is NULL/0 (new format: image URL stored, but it's still an NFT)
                            // 3. OR check existing prizeWin entries to see if there's a mint field (for already-settled jackpots)
                            const isMintAddress = poolData?.image && 
                                               typeof poolData.image === 'string' && 
                                               poolData.image.length >= 32 && 
                                               poolData.image.length <= 44 && 
                                               !poolData.image.includes('/') && 
                                               !poolData.image.includes('.');
                            
                            let isNFTJackpot = isMintAddress;
                            // If not a mint address but image exists and item_price is NULL/0, check existing prizeWin
                            if (!isMintAddress && poolData?.image && (!poolData.item_price || poolData.item_price === 0)) {
                              // Check if there's an existing prizeWin entry with a mint field for this jackpot
                              const { data: existingPrizeWin } = await supabase
                                .from('prizeWin')
                                .select('mint, reward_type')
                                .eq('name', poolData.name)
                                .not('mint', 'is', null)
                                .limit(1)
                                .maybeSingle();
                              
                              if (existingPrizeWin?.mint || existingPrizeWin?.reward_type === 'nft') {
                                isNFTJackpot = true;
                                console.log('🎨 Detected NFT jackpot from existing prizeWin entry');
                              }
                            }
                            
                            const isItemPrize = !isNFTJackpot && poolData?.item_price && poolData.item_price > 0;
                            
                            // If it's an item prize, claim reward via API (idempotent)
                            if (isItemPrize) {
                                const itemPriceAmount = parseFloat(String(poolData.item_price)) || 0;
                                console.log(`🎁 Existing winner found for item prize. Claiming ${itemPriceAmount} OGX via API...`);
                                
                                // Create a unique key for this winner+pool combination
                                const creditKey = `${poolId}-${existingWin.user_id}`;
                                
                                // Check if we've already claimed this winner in this session
                                if (balanceCreditedRef.current.has(creditKey)) {
                                    console.log(`⏭️ Skipping reward claim - already claimed for winner ${existingWin.user_id} in pool ${poolId} in this session`);
                                } else {
                                    try {
                                        // Call backend API to claim reward (idempotent)
                                        const response = await fetch('/api/claim-jackpot-reward', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({
                                                winId: existingWin.id,
                                                userId: existingWin.user_id,
                                                poolId: poolId,
                                                projectId: null // Main project
                                            }),
                                        });

                                        const result = await response.json();

                                        if (result.success) {
                                            if (result.alreadyClaimed) {
                                                console.log(`✅ Reward already claimed (idempotent check)`);
                                            } else {
                                                console.log(`✅ Reward claimed successfully: ${result.rewardAmount} tokens. New balance: ${result.newBalance}`);
                                            }
                                            // Mark as claimed to prevent duplicate API calls
                                            balanceCreditedRef.current.add(creditKey);
                                        } else {
                                            console.error("❌ Error claiming reward:", result.error);
                                        }
                                    } catch (claimError) {
                                        console.error("❌ Exception claiming reward:", claimError);
                                    }
                                }
                            }
                            
                            // For item prizes, display item_price instead of the stored amount
                            // CRITICAL: For NFT jackpots, don't show OGX amount
                            let displayAmount = 0;
                            if (isItemPrize && poolData?.item_price) {
                                displayAmount = parseFloat(String(poolData.item_price));
                            } else if (!isNFTJackpot) {
                                // Only show amount for token/SOL rewards, not NFT rewards
                                displayAmount = parseFloat(String(existingWin.amount || 0));
                            }
                            // For NFT jackpots, displayAmount remains 0
                            
                            setCurrentWinner({
                                user_id: existingWin.user_id,
                                amount: displayAmount,
                                created_at: existingWin.created_at,
                                reward_type: isNFTJackpot ? 'nft' : (isItemPrize ? 'item' : 'sol'),
                                is_nft: isNFTJackpot
                            });
                            
                            console.log(`🎯 Display amount for existing winner: ${displayAmount} (isNFTJackpot: ${isNFTJackpot}, isItemPrize: ${isItemPrize}, item_price: ${poolData?.item_price}, stored amount: ${existingWin.amount})`);
                            return;
                        }
                        
                        console.log("⏰ Jackpot time expired! Calling backend to settle jackpot...");
                        
                        // CRITICAL: Use backend API to settle jackpot (NOT frontend winner selection)
                        // This ensures only ONE winner is selected atomically
                        let winner: { user_id: string; amount?: number } | null = null;
                        try {
                            const settleResponse = await fetch('/api/jackpot/settle', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    poolId: poolId,
                                    projectId: null // Main project
                                })
                            });
                            
                            const settleResult = await settleResponse.json();
                            
                            if (settleResult.success && settleResult.winner) {
                                winner = {
                                    user_id: settleResult.winner.userId,
                                    amount: settleResult.winner.prizeAmount
                                };
                                console.log('✅ Backend returned winner:', settleResult);
                                if (settleResult.alreadySettled) {
                                    console.log('ℹ️ Winner was already settled - returning saved winner');
                                }
                            } else if (settleResult.noWinner) {
                                console.log('⚠️ No winner - no contributions found for this pool');
                                winner = null;
                            } else {
                                console.error('❌ Backend settle failed:', settleResult.error);
                                // DO NOT fallback to frontend winner selection - this would cause the bug
                                winner = null;
                            }
                        } catch (settleError) {
                            console.error('❌ Error calling settle API:', settleError);
                            // DO NOT fallback to frontend winner selection - this would cause the bug
                            winner = null;
                        }
                        
                        if (winner && winner.user_id) {
                            // Get pool data for display
                            const { data: poolData } = await supabase
                                .from('jackpot_pools')
                                .select('name, image, item_price')
                                .eq('id', poolId)
                                .is('project_id', null) // MAIN PROJECT ONLY
                                .single();
                            
                            // Fetch win data from backend (already created by settle API)
                            let winData: any = null;
                            let winError: any = null;
                            
                            try {
                                const { data: existingWinData, error: fetchError } = await supabase
                                    .from('jackpot_wins')
                                    .select('*')
                                    .eq('pool_id', poolId)
                                    .eq('user_id', winner.user_id)
                                    .eq('win_type', 'jackpot_final')
                                    .is('project_id', null) // Main project
                                    .order('created_at', { ascending: false })
                                    .limit(1)
                                    .maybeSingle();
                                
                                winData = existingWinData;
                                winError = fetchError;
                                
                                if (winData) {
                                    console.log("✅ Found existing winner record from backend:", winData);
                                }
                            } catch (fetchErr) {
                                console.warn("⚠️ Could not fetch win data:", fetchErr);
                            }
                            
                            // Check if it's an NFT jackpot:
                            // 1. If image is a mint address (old format: 32-44 chars, no slashes/dots)
                            // 2. OR if image is a URL but item_price is NULL/0 (new format: image URL stored, but it's still an NFT)
                            // 3. OR check existing prizeWin entries to see if there's a mint field (for already-settled jackpots)
                            const isMintAddress = poolData?.image && 
                                               typeof poolData.image === 'string' && 
                                               poolData.image.length >= 32 && 
                                               poolData.image.length <= 44 && 
                                               !poolData.image.includes('/') && 
                                               !poolData.image.includes('.');
                            
                            let isNFTJackpot = isMintAddress;
                            // If not a mint address but image exists and item_price is NULL/0, check existing prizeWin
                            if (!isMintAddress && poolData?.image && (!poolData.item_price || poolData.item_price === 0)) {
                              // Check if there's an existing prizeWin entry with a mint field for this jackpot
                              const { data: existingPrizeWin } = await supabase
                                .from('prizeWin')
                                .select('mint, reward_type')
                                .eq('name', poolData.name)
                                .not('mint', 'is', null)
                                .limit(1)
                                .maybeSingle();
                            
                              if (existingPrizeWin?.mint || existingPrizeWin?.reward_type === 'nft') {
                                isNFTJackpot = true;
                                console.log('🎨 Detected NFT jackpot from existing prizeWin entry');
                              }
                            }
                            
                            // Check if it's an item prize
                            const isItemPrize = !isNFTJackpot && poolData?.item_price && poolData.item_price > 0;
                            
                            // If it's an item prize, claim reward via API (idempotent)
                            if (isItemPrize && winData) {
                                const itemPriceAmount = parseFloat(String(poolData?.item_price)) || 0;
                                console.log(`🎁 Item jackpot prize detected. Claiming ${itemPriceAmount} tokens via API...`);
                            
                                // Create a unique key for this winner+pool combination
                                const creditKey = `${poolId}-${winner.user_id}`;
                                
                                // Check if we've already claimed this winner in this session
                                if (balanceCreditedRef.current.has(creditKey)) {
                                    console.log(`⏭️ Skipping reward claim - already claimed for winner ${winner.user_id} in pool ${poolId} in this session`);
                                } else {
                                    try {
                                        // Call backend API to claim reward (idempotent)
                                        const response = await fetch('/api/claim-jackpot-reward', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({
                                                winId: winData.id,
                                                userId: winner.user_id,
                                                poolId: poolId,
                                                projectId: null // Main project
                                            }),
                                        });

                                        const result = await response.json();

                                        if (result.success) {
                                            if (result.alreadyClaimed) {
                                                console.log(`✅ Reward already claimed (idempotent check)`);
                                            } else {
                                                console.log(`✅ Reward claimed successfully: ${result.rewardAmount} tokens. New balance: ${result.newBalance}`);
                                                toast.success(`🎉 ${result.rewardAmount} tokens credited to your balance!`, {
                                                    position: "top-center",
                                                    autoClose: 5000,
                                                });
                                            }
                                            // Mark as claimed to prevent duplicate API calls
                                            balanceCreditedRef.current.add(creditKey);
                                } else {
                                            console.error("❌ Error claiming reward:", result.error);
                                            alert(`Error: Failed to claim reward. ${result.error}`);
                                        }
                                    } catch (claimError) {
                                        console.error("❌ Exception claiming reward:", claimError);
                                        alert(`Error: Exception while claiming reward. Please contact support.`);
                                    }
                                }
                            }
                            
                            // Set current winner for display (regardless of jackpot_wins insert success)
                            // CRITICAL: For NFT jackpots, don't show OGX amount - show 0 or null
                            // For item prizes, display item_price instead of prizeAmount
                            let displayAmount = 0;
                            if (isItemPrize && poolData?.item_price) {
                                displayAmount = parseFloat(String(poolData.item_price));
                            } else if (!isNFTJackpot && winner.amount) {
                                // Only show amount for token/SOL rewards, not NFT rewards
                                displayAmount = winner.amount;
                            }
                            // For NFT jackpots, displayAmount remains 0 (will be handled in UI)
                            
                            setCurrentWinner({
                                user_id: winner.user_id,
                                amount: displayAmount,
                                created_at: winData?.created_at || new Date().toISOString(),
                                reward_type: isNFTJackpot ? 'nft' : (isItemPrize ? 'item' : 'sol'),
                                is_nft: isNFTJackpot
                            });
                            
                            console.log(`🎯 Display amount set: ${displayAmount} (isNFTJackpot: ${isNFTJackpot}, isItemPrize: ${isItemPrize}, item_price: ${poolData?.item_price}, prizeAmount: ${winner.amount})`);
                            
                            // CRITICAL FIX: DO NOT create jackpot_wins entries from frontend!
                            // The backend settle API (/api/jackpot/settle) handles jackpot_wins creation
                            // Frontend creating entries was causing race conditions
                            console.log("ℹ️ jackpot_wins entry creation handled by backend settle API");
                            
                            // CRITICAL FIX: DO NOT create prizeWin entries from frontend!
                            // The backend settle API (/api/jackpot/settle) handles prizeWin creation
                            // Frontend creating entries was causing the bug where ALL users got NFT rewards
                            console.log("ℹ️ PrizeWin entry creation handled by backend settle API - skipping frontend insertion");
                            console.log("🎯 Winner details:", {
                                        userId: winner.user_id,
                                poolId: poolId,
                                isNFTJackpot: isNFTJackpot,
                                isItemPrize: isItemPrize
                            });
                            
                            toast.success(`🏆 Final Winner Selected!`, {
                                position: "top-center",
                                autoClose: 5000,
                            });
                        } else {
                            console.warn("⚠️ No contributions found - no winner to select");
                            // Set a flag to show "No winner" message
                            setCurrentWinner({
                                user_id: 'NO_WINNER',
                                amount: 0,
                                created_at: new Date().toISOString()
                            });
                        }
                    } catch (error) {
                        console.error("❌ ERROR: Error selecting final winner:", error);
                    }
                };
                
                selectFinalWinner();
            } else if (!expired) {
                // Clear winner display while jackpot is active
                setCurrentWinner(null);
            }
            
            // Update every second to check expiration
            const interval = setInterval(() => {
                const currentTimeUTC = new Date();
                if (currentTimeUTC >= endTimeUTC && !expired) {
                    setIsTimeExpired(true);
                }
            }, 1000);
            
            return () => clearInterval(interval);
        }
    }, [data?.data?.[0]?.end_time, params?.slug]);

    // Fetch latest winner only if time has expired
    useEffect(() => {
        const fetchLatestWinner = async () => {
            if (params?.slug && isTimeExpired && data?.data?.[0]?.end_time) {
                const poolId = parseInt(params.slug);
                try {
                    // Parse end_time as UTC (Supabase stores in UTC)
                    const endTimeUTC = new Date(data.data[0].end_time);
                    const endTimeISO = endTimeUTC.toISOString();
                    
                    // Fetch final winner (selected after expiration)
                    // Main project: filter for project_id IS NULL
                    const { data: winnerData, error: winnerError } = await supabase
                        .from('jackpot_wins')
                        .select('user_id, amount, created_at, win_type')
                        .eq('pool_id', poolId)
                        .eq('win_type', 'jackpot_final') // Only final winners
                        .is('project_id', null) // Main project has NULL project_id
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    
                    if (!winnerError && winnerData) {
                        setCurrentWinner(winnerData);
                    } else if (winnerError && winnerError.code !== 'PGRST116') {
                        // PGRST116 is "no rows returned" which is fine
                        console.error('Error fetching winner:', winnerError);
                    }
                } catch (error) {
                    console.error('Error fetching winner:', error);
                }
            } else if (!isTimeExpired) {
                // Clear winner display while jackpot is active
                setCurrentWinner(null);
            }
        };
        
        if (data?.data?.[0]) {
            fetchLatestWinner();
        }
    }, [data?.data, params?.slug, isTimeExpired]);

    const purchaseJackpotTicket = async () => {
        const ticketCount = parseInt(value) || 1;
        const ticketPrice = data?.data[0]?.ticket_price || 1;
        const totalCost = ticketCount * ticketPrice;
        const poolId = parseInt(params?.slug || '0');
        // Use id first (from database), fallback to walletAddress, then publicKey as last resort
        const userId = user?.id || user?.walletAddress || publicKey?.toBase58();
        
        console.log("🔍 DEBUG: purchaseJackpotTicket - User ID:", {
            userId: userId,
            userIdType: typeof userId,
            userIdValue: userId,
            userObject: user,
            publicKey: publicKey?.toBase58(),
            walletConnected: connected
        });
        
        if (!userId) {
            console.error("❌ ERROR: No user ID available for ticket purchase");
            throw new Error("User ID is required. Please ensure your wallet is connected.");
        }

        const purchaseData: any = {
            pool_id: poolId, 
            user_id: userId,
            ticket_count: ticketCount,
            total_cost: totalCost,
            project_id: null // Main website: project_id IS NULL
        };

        console.log("🔍 DEBUG: Purchasing jackpot ticket (Main website):", purchaseData);

        // Insert into jackpot_tickets table
        const { error: ticketError } = await supabase.from("jackpot_tickets").insert(purchaseData);
        
        if (ticketError) {
            console.error("❌ ERROR: Error purchasing jackpot ticket:", ticketError);
            throw new Error(`Failed to purchase jackpot ticket: ${ticketError.message}`);
        }

        console.log("✅ SUCCESS: Jackpot ticket purchased successfully");

        // Insert contributions into jackpot_contribution table (one entry per ticket for fair drawing)
        // This makes it easy to pick a random winner - each ticket gets one entry
        try {
            const contributionEntries = [];
            for (let i = 0; i < ticketCount; i++) {
                contributionEntries.push({
                    pool_id: poolId,
                    user_id: String(userId || ''), // Ensure it's a string and not undefined
                    amount: parseFloat(ticketPrice) || 0, // Use number for NUMERIC type
                    contribution_type: 'ticket_purchase',
                    transaction_hash: null, // Can be added later if needed
                    project_id: null // Main website: project_id IS NULL
                });
            }
            
            // Validate entries before inserting
            if (contributionEntries.length === 0) {
                console.warn("⚠️ WARNING: No contribution entries to insert");
                return;
            }
            
            if (!poolId || poolId === 0) {
                console.error("❌ ERROR: Invalid pool_id:", poolId);
                toast.error("Error: Invalid jackpot pool ID");
                return;
            }
            
            if (!userId) {
                console.error("❌ ERROR: Invalid user_id:", userId);
                toast.error("Error: User ID is missing");
                return;
            }

            console.log("🔍 DEBUG: Inserting contributions:", contributionEntries);
            console.log("🔍 DEBUG: Contribution entries count:", contributionEntries.length);
            console.log("🔍 DEBUG: Pool ID:", poolId, "User ID:", userId, "Ticket Price:", ticketPrice);

            const { data: contributionData, error: contributionError } = await supabase
                .from("jackpot_contribution")
                .insert(contributionEntries)
                .select(); // Select to verify insert
            
            if (contributionError) {
                console.error("❌ ERROR: Error recording contributions:", contributionError);
                console.error("❌ ERROR Details:", {
                    message: contributionError.message,
                    code: contributionError.code,
                    details: contributionError.details,
                    hint: contributionError.hint
                });
                
                // Show error to user via toast
                toast.error(`Warning: Ticket purchased but contribution tracking failed: ${contributionError.message}`);
            } else {
                console.log("✅ SUCCESS: Contributions recorded successfully", contributionData);
                // Winner will be selected only when time expires, not during active period
            }
        } catch (contributionException) {
            console.error("❌ EXCEPTION: Error in contribution insertion:", contributionException);
            toast.error(`Warning: Ticket purchased but contribution tracking failed. Please check console for details.`);
        }
    };
    
    const updateUser = async (remainApes: number) => {
        // Use id first, fallback to walletAddress or publicKey
        const userId = user?.id || user?.walletAddress || publicKey?.toBase58();
        console.log("Updating user balance:", { userId: userId, newBalance: remainApes, userObject: user });
        
        if (!userId || !user?.id) {
            console.error("❌ ERROR: No user ID available for balance update");
            throw new Error("User ID is required to update balance");
        }
        
        // Check if we're on the main project
        const projectId = typeof window !== 'undefined' 
            ? localStorage.getItem('currentProjectId') 
            : null;
        const isMainProject = !projectId;
        
        console.log(`🔄 Updating balance for user ${user.id}, project: ${projectId || 'main'}, isMainProject: ${isMainProject}`);
        
        // Use project_users table for multi-tenant support
        // First, try to find the user with project_id filter
        let updateQuery = supabase
            .from("project_users")
            .update({ apes: remainApes })
            .eq("id", user.id);
        
        // Filter by project_id if it's a sub-project
        if (!isMainProject && projectId) {
            updateQuery = updateQuery.eq("project_id", parseInt(projectId));
        } else if (isMainProject) {
            // For main project, try to find user with project_id IS NULL
            updateQuery = updateQuery.is("project_id", null);
        }
        
        let { data: updatedUser, error: updateError } = await updateQuery.select(); // Select to verify the update
        
        // If update failed and we're on main project, try without project_id filter as fallback
        if ((!updatedUser || updatedUser.length === 0) && isMainProject && !updateError) {
            console.log("⚠️ User not found with project_id IS NULL, trying without project_id filter...");
            const fallbackQuery = supabase
                .from("project_users")
                .update({ apes: remainApes })
                .eq("id", user.id)
                .select();
            
            const fallbackResult = await fallbackQuery;
            updatedUser = fallbackResult.data;
            updateError = fallbackResult.error;
        }
        
        // If still not found, try legacy user table as fallback
        if ((!updatedUser || updatedUser.length === 0) && !updateError) {
            console.warn("⚠️ User not found in project_users table. Trying legacy user table as fallback...");
            const { data: legacyUser, error: legacyError } = await supabase
                .from("user")
                .update({ apes: remainApes })
                .eq("id", user.id)
                .select();
            
            if (!legacyError && legacyUser && legacyUser.length > 0) {
                updatedUser = legacyUser;
                updateError = null;
                console.log("✅ Updated balance using legacy user table");
            } else if (legacyError) {
                updateError = legacyError;
            }
        }
        
        // If we still have an error or no user found, update local state and continue
        if (updateError || !updatedUser || updatedUser.length === 0) {
            console.error("❌ Could not update user balance in database:", updateError || "User not found");
            console.error("User object:", { id: user.id, apes: user.apes });
            // Update local state anyway to prevent blocking the user
            setUser({ ...user, apes: remainApes });
            console.warn("⚠️ Updated local state only. Balance may be out of sync. Please refresh the page.");
            throw new Error(`Failed to update user balance: ${updateError?.message || 'User not found'}`);
        }
        
        // Update local state with the new balance from database
        const newBalance = updatedUser[0].apes;
        setUser({ ...user, apes: newBalance });
        console.log(`✅ Deducted tokens. Old balance: ${user.apes}, New balance: ${newBalance}`);
    };
    
    const handlePurchase = async () => {
        // Check if time has expired
        if (isTimeExpired) {
            return toast.error("Jackpot time has expired. Ticket purchases are no longer available.");
        }

        // Double-check end_time from data (UTC comparison)
        if (data?.data?.[0]?.end_time) {
            const endTimeUTC = new Date(data.data[0].end_time);
            const nowUTC = new Date();
            if (nowUTC >= endTimeUTC) {
                setIsTimeExpired(true);
                return toast.error("Jackpot time has expired. Ticket purchases are no longer available.");
            }
        }

        // Check wallet connection - check Solana wallet first, then user data
        console.log("🔍 DEBUG: Checking wallet connection:", {
            user: user,
            userId: user?.id,
            walletAddress: user?.walletAddress,
            hasUser: !!user,
            hasId: !!user?.id,
            hasWalletAddress: !!user?.walletAddress,
            walletConnected: connected,
            publicKey: publicKey?.toBase58()
        });

        // First check if Solana wallet is connected
        if (!connected || !publicKey) {
            console.error("❌ ERROR: Solana wallet is not connected");
            return toast.error("Please connect your Solana wallet first");
        }

        // Check if user object exists
        if (!user) {
            console.error("❌ ERROR: User object is null/undefined");
            return toast.error("User data is loading. Please wait a moment and try again.");
        }
        
        // Check if user has either id (from database) or walletAddress (from wallet connection)
        // If wallet is connected but user doesn't have id, use walletAddress or publicKey as fallback
        const userId = user?.id || user?.walletAddress || publicKey?.toBase58();
        if (!userId) {
            console.error("❌ ERROR: No user identifier available:", { user, publicKey });
            return toast.error("Please connect your wallet. User ID or wallet address is required.");
        }

        if (value === "" || value === "0") {
            return toast.error("Please enter a valid amount");
        }

        const ticketPrice = data?.data[0]?.ticket_price || 0;
        const maxTickets = data?.data[0]?.max_tickets || 1000;
        const requestedQuantity = parseInt(value) || 1;
        
        // Check how many tickets have already been sold
        // MAIN PROJECT: Filter by project_id IS NULL if the table has that column
        const poolId = parseInt(params?.slug || '0');
        let ticketsQuery = supabase
            .from('jackpot_tickets')
            .select('ticket_count')
            .eq('pool_id', poolId);
        
        // Note: If jackpot_tickets table has project_id column, filter by NULL for main project
        // For now, we'll query all tickets for this pool_id (main project jackpots should have unique IDs)
        
        const { data: ticketsData, error: ticketsError } = await ticketsQuery;
        
        if (ticketsError) {
            console.error("❌ Error fetching tickets count:", ticketsError);
            return toast.error("Error checking available tickets. Please try again.");
        }
        
        // Calculate total tickets sold (sum of all ticket_count values)
        const ticketsSold = ticketsData?.reduce((sum, ticket) => {
            const ticketCount = parseInt(String(ticket.ticket_count || 0));
            console.log(`🎫 Ticket entry: ticket_count=${ticketCount}`);
            return sum + ticketCount;
        }, 0) || 0;
        const availableTickets = maxTickets - ticketsSold;
        
        console.log(`🎫 Ticket availability check:`, {
            maxTickets,
            ticketsSold,
            availableTickets,
            requestedQuantity,
            ticketsDataLength: ticketsData?.length || 0,
            ticketsData: ticketsData
        });
        
        // Validate requested quantity doesn't exceed available tickets
        if (requestedQuantity > availableTickets) {
            if (availableTickets <= 0) {
                return toast.error(`No tickets available. All ${maxTickets} tickets have been sold.`);
            }
            return toast.error(`Only ${availableTickets} ticket(s) available. You requested ${requestedQuantity} tickets.`);
        }
        
        // Use the validated quantity (should be <= availableTickets)
        const quantity = Math.min(requestedQuantity, availableTickets);
        const totalCost = quantity * ticketPrice;
        const currentApes = user?.apes || 0;
        
        if (totalCost > currentApes) {
            return toast.error("Insufficient balance");
        }

        const remainApes = currentApes - totalCost;
        
        // Store the actual quantity for the success message
        const actualQuantity = quantity;
        
        try {
            await toast.promise(
                Promise.all([purchaseJackpotTicket(), updateUser(remainApes)]),
                {
                    pending: "Purchasing jackpot ticket...",
                    success: `Successfully purchased ${actualQuantity} jackpot ticket(s) for ${totalCost} OGX!`,
                    error: "Failed to purchase jackpot ticket",
                },
                {
                    position: "top-center",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "light",
                }
            );
            
            // Reset form and refresh data
            setValue("");
            if (params?.slug) {
                run(params.slug);
            }
        } catch (error) {
            console.error("Purchase error:", error);
        }
    };

    if (loading) return <Loader />;
    if (error) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center p-4 rounded-lg bg-red-500/10 text-red-500">
                <p>Failed to load jackpot details. Please try again later.</p>
            </div>
        </div>
    );

    return (
        <div>
            {/* <TopNav /> */}
        <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-[#f74e14]/20 overflow-hidden">
                <div className="flex flex-col md:flex-row gap-8">
                        {/* Left Section - Image */}
                    <div className="w-full md:w-4/12 flex items-center justify-center">
                        <div className="rounded-xl overflow-hidden border-2 border-[#f74e14]/20 shadow-lg">
                            <JackpotImage
                                image={data?.data[0]?.image || null}
                                name={data?.data[0]?.name || 'Jackpot'}
                                width={200}
                                height={200}
                                className="w-full h-full object-cover aspect-square"
                                fallbackSrc="/coin.png"
                            />
                        </div>
                    </div>

                    {/* Right Section - Content */}
                    <div className="w-full md:w-8/12">
                        {/* Wallet Connection Status Alert */}
                        {/* {(!connected || !publicKey) && (
                            <div className="mb-4 p-4 bg-red-500/10 border-2 border-red-500 rounded-lg flex items-center gap-3">
                                <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <p className="text-red-600 font-medium">Please connect your wallet to purchase tickets</p>
                            </div>
                        )} */}
                        {connected && publicKey && (!user?.id && !user?.walletAddress) && (
                            <div className="mb-4 p-4 bg-yellow-500/10 border-2 border-yellow-500 rounded-lg flex items-center gap-3">
                                <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <p className="text-yellow-600 font-medium">Wallet connected. Loading user data...</p>
                            </div>
                        )}
                        
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#f74e14] to-[#ff914d] bg-clip-text text-transparent mb-4 flex justify-center">
                                {data?.data[0]?.name || 'Jackpot'}
                        </h1>

                        {/* Description Box */}
                        <div className="p-6 border border-[#f74e14]/20 bg-white rounded-xl my-6 flex justify-center flex-col items-center">
                            <h2 className="text-xl font-semibold mb-2 text-[#ff914d]">Description</h2>
                                <p className="text-black">
                                    {data?.data[0]?.description || 'No description available'}
                                </p>
                        </div>

                            {/* Countdown and Tickets Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="bg-white border border-[#f74e14]/20 rounded-xl p-6 flex flex-col items-center justify-center">
                                    <p className="text-[#ff914d] mb-2">Time Remaining</p>
                                {isTimeExpired ? (
                                    <div className="flex flex-col items-center">
                                        <span className="text-2xl md:text-3xl font-bold text-red-500">EXPIRED</span>
                                        <span className="text-sm text-gray-500 mt-2">Jackpot has ended</span>
                                    </div>
                                ) : (
                                    <Countdown
                                        date={new Date(data?.data[0]?.end_time || Date.now() + 86400000)}
                                        className="text-2xl font-bold text-black"
                                        onComplete={() => setIsTimeExpired(true)}
                                        renderer={props => (
                                            <div className="flex gap-2">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xl md:text-2xl text-black">{props.days}</span>
                                                    <span className="text-xs text-[#ff914d]">DAYS</span>
                                                </div>
                                                <span className="text-xl md:text-2xl text-[#f74e14]">:</span>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xl md:text-2xl text-black">{props.hours}</span>
                                                    <span className="text-xs text-[#ff914d]">HRS</span>
                                                </div>
                                                <span className="text-xl md:text-2xl text-[#f74e14]">:</span>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xl md:text-2xl text-black">{props.minutes}</span>
                                                    <span className="text-xs text-[#ff914d]">MINS</span>
                                                </div>
                                                <span className="text-xl md:text-2xl text-[#f74e14]">:</span>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xl md:text-2xl text-black">{props.seconds}</span>
                                                    <span className="text-xs text-[#ff914d]">SECS</span>
                                                </div>
                                            </div>
                                        )}
                                    />
                                )}
                            </div>

                            <div className="bg-white border border-[#f74e14]/20 rounded-xl p-6 flex flex-col items-center justify-center">
                                    <p className="text-[#ff914d] mb-2">Tickets Sold</p>
                                    <span className="text-3xl md:text-4xl font-bold text-black">{data?.count || 0}</span>
                                </div>
                        </div>

                        {/* Winner Display - Only show after time expires */}
                        {isTimeExpired && currentWinner ? (
                            currentWinner.user_id === 'NO_WINNER' ? (
                                <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-6 mb-6">
                                    <div className="flex items-center justify-center gap-3 mb-2">
                                        <span className="text-3xl">⚠️</span>
                                        <h3 className="text-2xl font-bold text-yellow-700">
                                            No Winner Selected
                                        </h3>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg text-gray-700 mb-2">
                                            No tickets were purchased for this jackpot.
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            Since there were no participants, no winner could be selected.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-xl p-6 mb-6">
                                    <div className="flex items-center justify-center gap-3 mb-2">
                                        <span className="text-3xl">🏆</span>
                                        <h3 className="text-2xl font-bold text-green-700">
                                            Final Winner
                                        </h3>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg text-gray-700 mb-1">
                                            <span className="font-semibold">User:</span> {currentWinner.user_id.substring(0, 8)}...{currentWinner.user_id.substring(currentWinner.user_id.length - 6)}
                                        </p>
                                        <p className="text-xl font-bold text-green-600">
                                            {currentWinner.is_nft || currentWinner.reward_type === 'nft' ? (
                                                <>Prize: <span className="text-purple-600">NFT</span></>
                                            ) : currentWinner.amount > 0 ? (
                                                <>Prize: {parseFloat(String(currentWinner.amount)).toFixed(2)} OGX</>
                                            ) : (
                                                <>Prize: <span className="text-gray-500">N/A</span></>
                                            )}
                                        </p>
                                        <p className="text-sm text-gray-500 mt-2">
                                            Final winner selected at: {formatLocalDateTime(currentWinner.created_at)}
                                        </p>
                                        <p className="text-sm font-semibold text-green-600 mt-2">
                                            🎉 Congratulations! Jackpot has ended.
                                        </p>
                                    </div>
                                </div>
                            )
                        ) : !isTimeExpired ? (
                            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6 mb-6 text-center">
                                <p className="text-lg font-semibold text-blue-700 mb-2">
                                    ⏳ Winner will be announced when time expires
                                </p>
                                <p className="text-sm text-gray-600">
                                    All participants have an equal chance to win based on their ticket purchases.
                                </p>
                            </div>
                        ) : isTimeExpired && !currentWinner ? (
                            <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-6 mb-6 text-center">
                                <p className="text-lg font-semibold text-gray-700 mb-2">
                                    ⏳ Loading winner information...
                                </p>
                                <p className="text-sm text-gray-600">
                                    Please wait while we fetch the winner details.
                                </p>
                            </div>
                        ) : null}

                        {/* Purchase Form */}
                        {!isTimeExpired && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ff914d] text-sm font-medium">Price:</span>
                                    <input
                                        type="text"
                                        disabled
                                        placeholder={`${data?.data[0]?.ticket_price || 0} OGX`}
                                        className="w-full h-14 bg-white border border-[#f74e14]/20 rounded-lg pl-16 pr-4 text-black text-right text-sm font-medium leading-relaxed placeholder:text-black"
                                    />
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        placeholder="Enter Number of Tickets"
                                        disabled={isTimeExpired}
                                        className={`w-full h-14 bg-white border border-[#f74e14]/20 rounded-lg px-4 text-black focus:border-[#f74e14] transition-all duration-200 placeholder:text-black placeholder:text-sm placeholder:font-normal leading-relaxed ${
                                            isTimeExpired ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                        value={value}
                                        onChange={(e) => setValue(e.target.value)}
                                        min="1"
                                    />
                                </div>
                                <button
                                    onClick={() => handlePurchase()}
                                    disabled={isTimeExpired}
                                    className={`h-12 rounded-lg text-black font-medium transition-all duration-200 ${
                                        isTimeExpired 
                                            ? 'bg-gray-400 cursor-not-allowed opacity-50' 
                                            : 'bg-gradient-to-r from-[#f74e14] to-[#ff914d] hover:opacity-90'
                                    }`}
                                >
                                    {isTimeExpired ? 'Time Expired' : 'Purchase Jackpot Tickets'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
        <ToastContainer />
        </div>
    );
}