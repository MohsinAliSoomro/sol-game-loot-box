"use client";
import { supabase } from "@/service/supabase";
import { useUserState } from "@/state/useUserState";
import { useRequest } from "ahooks";
import JackpotImage from "../../Components/JackpotImage";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Countdown from "react-countdown";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Loader from "../../Components/Loader";
import TopNav from "../../Components/TopNav";
import { pickJackpotWinner } from "@/lib/pick-jackpot-winner";
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
    const [currentWinner, setCurrentWinner] = useState<{user_id: string; amount: number; created_at: string} | null>(null);
    const params = useParams<{ slug: string }>();
    const { data, loading, error, run } = useRequest(getJackpotData);
    const { publicKey, connected } = useWallet(); // Check wallet connection status
    
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
                        // Check if final winner already exists to avoid duplicates
                        // Use UTC ISO string for comparison
                        const endTimeISO = endTimeUTC.toISOString();
                        
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
                            console.log("🏆 Final winner already selected:", existingWin);
                            
                            // Get pool data to check if it's an item prize that needs crediting
                            const { data: poolData } = await supabase
                                .from('jackpot_pools')
                                .select('name, image, item_price')
                                .eq('id', poolId)
                                .is('project_id', null) // MAIN PROJECT ONLY
                                .single();
                            
                            // Check if it's an item prize
                            const isNFTJackpot = poolData?.image && 
                                               typeof poolData.image === 'string' && 
                                               poolData.image.length >= 32 && 
                                               poolData.image.length <= 44 && 
                                               !poolData.image.includes('/') && 
                                               !poolData.image.includes('.');
                            const isItemPrize = !isNFTJackpot && poolData?.item_price && poolData.item_price > 0;
                            
                            // If it's an item prize, check and credit balance if not already done
                            if (isItemPrize) {
                                const itemPriceAmount = parseFloat(String(poolData.item_price)) || 0;
                                console.log(`🎁 Existing winner found for item prize. Checking if ${itemPriceAmount} OGX was credited...`);
                                
                                try {
                                    // Try to find user by ID first
                                    let { data: userData, error: userError } = await supabase
                                        .from('user')
                                        .select('id, apes, walletAddress')
                                        .eq('id', existingWin.user_id)
                                        .single();
                                    
                                    // If not found by ID, try by walletAddress
                                    if (userError || !userData) {
                                        console.log("⚠️ User not found by ID, trying walletAddress...");
                                        const { data: walletUserData, error: walletError } = await supabase
                                            .from('user')
                                            .select('id, apes, walletAddress')
                                            .eq('walletAddress', existingWin.user_id)
                                            .single();
                                        
                                        if (!walletError && walletUserData) {
                                            userData = walletUserData;
                                            userError = null;
                                            console.log("✅ User found by walletAddress:", userData.id);
                                        }
                                    }
                                    
                                    if (!userError && userData) {
                                        // Check if balance needs to be credited
                                        // We'll credit it anyway to ensure it's done (idempotent operation)
                                        const currentBalance = parseFloat(String(userData.apes || 0));
                                        const newBalance = currentBalance + itemPriceAmount;
                                        
                                        console.log(`💰 Crediting balance for existing winner: ${currentBalance} + ${itemPriceAmount} = ${newBalance}`);
                                        
                                        const { error: updateError } = await supabase
                                            .from('user')
                                            .update({ apes: newBalance })
                                            .eq('id', userData.id);
                                        
                                        if (updateError) {
                                            console.error("❌ Error crediting balance for existing winner:", updateError);
                                        } else {
                                            console.log(`✅ Balance credited for existing winner: ${itemPriceAmount} OGX. New balance: ${newBalance}`);
                                        }
                                    } else {
                                        console.error("❌ Could not find user to credit balance:", userError);
                                    }
                                } catch (creditError) {
                                    console.error("❌ Exception crediting balance for existing winner:", creditError);
                                }
                            }
                            
                            // For item prizes, display item_price instead of the stored amount
                            const displayAmount = isItemPrize && poolData?.item_price 
                                ? parseFloat(String(poolData.item_price)) 
                                : existingWin.amount;
                            
                            setCurrentWinner({
                                user_id: existingWin.user_id,
                                amount: displayAmount,
                                created_at: existingWin.created_at
                            });
                            
                            console.log(`🎯 Display amount for existing winner: ${displayAmount} OGX (isItemPrize: ${isItemPrize}, item_price: ${poolData?.item_price}, stored amount: ${existingWin.amount})`);
                            return;
                        }
                        
                        console.log("⏰ Jackpot time expired! Selecting final winner from all contributions...");
                        
                        // Pick final winner from all contributions (random selection)
                        const winner = await pickJackpotWinner(poolId);
                        
                        if (winner && winner.user_id) {
                            // Get pool data for prize amount, image, and item_price
                            // MAIN PROJECT: Filter by project_id IS NULL
                            const { data: poolData } = await supabase
                                .from('jackpot_pools')
                                .select('current_amount, name, image, item_price')
                                .eq('id', poolId)
                                .is('project_id', null) // MAIN PROJECT ONLY
                                .single();
                            
                            console.log("🔍 DEBUG: Pool data fetched:", {
                                poolId,
                                poolName: poolData?.name,
                                item_price: poolData?.item_price,
                                image: poolData?.image
                            });
                            
                            // Calculate total contributions for prize
                            const { data: contributions } = await supabase
                                .from('jackpot_contribution')
                                .select('amount')
                                .eq('pool_id', poolId);
                            
                            const totalContributions = contributions?.reduce((sum, c) => sum + parseFloat(String(c.amount || 0)), 0) || 0;
                            const prizeAmount = poolData?.current_amount || totalContributions || 0;
                            
                            // Get jackpot pool name for prizeWin entry
                            const jackpotName = poolData?.name || `Jackpot Pool ${poolId}`;
                            
                            // Determine jackpot image - check if it's an NFT mint or file path
                            let jackpotImage = '/coin.png'; // Default fallback
                            if (poolData?.image) {
                                // Check if it's an NFT mint address
                                const isNFTMint = typeof poolData.image === 'string' && 
                                                 poolData.image.length >= 32 && 
                                                 poolData.image.length <= 44 && 
                                                 !poolData.image.includes('/') &&
                                                 !poolData.image.includes('.');
                                
                                if (isNFTMint) {
                                    // It's an NFT - fetch the NFT image
                                    try {
                                        const nftMetadata = await fetchNFTMetadata(poolData.image);
                                        jackpotImage = nftMetadata?.image || '/coin.png';
                                    } catch (error) {
                                        console.error('Error fetching NFT image for jackpot:', error);
                                        jackpotImage = '/coin.png';
                                    }
                                } else {
                                    // It's a file path
                                    if (poolData.image.startsWith('http')) {
                                        jackpotImage = poolData.image;
                                    } else {
                                        jackpotImage = `https://zkltmkbmzxvfovsgotpt.supabase.co/storage/v1/object/public/apes-bucket/${poolData.image}`;
                                    }
                                }
                            }
                            
                            // Check if jackpot prize is an item (not NFT and has item_price)
                            const isNFTJackpot = poolData?.image && 
                                               typeof poolData.image === 'string' && 
                                               poolData.image.length >= 32 && 
                                               poolData.image.length <= 44 && 
                                               !poolData.image.includes('/') && 
                                               !poolData.image.includes('.');
                            const isItemPrize = !isNFTJackpot && poolData?.item_price && poolData.item_price > 0;
                            
                            // If it's an item prize, credit the item_price directly to user balance
                            if (isItemPrize) {
                                const itemPriceAmount = parseFloat(String(poolData.item_price)) || 0;
                                console.log(`🎁 Item jackpot prize detected. Crediting ${itemPriceAmount} OGX directly to user balance.`);
                                console.log(`🔍 DEBUG: Winner user_id: ${winner.user_id}, item_price: ${itemPriceAmount}`);
                                
                                try {
                                    // Get current user balance (main project uses legacy 'user' table)
                                    // Try to find user by ID first
                                    let { data: userData, error: userError } = await supabase
                                        .from('user')
                                        .select('id, apes, walletAddress')
                                        .eq('id', winner.user_id)
                                        .single();
                                    
                                    // If not found by ID, try by walletAddress (in case user_id is actually a wallet address)
                                    if (userError || !userData) {
                                        console.log("⚠️ User not found by ID, trying walletAddress...");
                                        const walletAddress = winner.user_id;
                                        const { data: walletUserData, error: walletError } = await supabase
                                            .from('user')
                                            .select('id, apes, walletAddress')
                                            .eq('walletAddress', walletAddress)
                                            .single();
                                        
                                        if (!walletError && walletUserData) {
                                            userData = walletUserData;
                                            userError = null;
                                            console.log("✅ User found by walletAddress:", walletUserData.id);
                                        }
                                    }
                                    
                                    if (userError || !userData) {
                                        console.error("❌ Error fetching user balance for item jackpot prize:", {
                                            userError,
                                            userId: winner.user_id,
                                            userData
                                        });
                                        // Show alert to user
                                        alert(`Error: Could not find user account to credit ${itemPriceAmount} OGX. Please contact support with user ID: ${winner.user_id}`);
                                    } else {
                                        const currentBalance = parseFloat(String(userData.apes || 0));
                                        const newBalance = currentBalance + itemPriceAmount;
                                        
                                        console.log(`💰 Balance update: ${currentBalance} + ${itemPriceAmount} = ${newBalance}`);
                                        
                                        // Update user balance using the correct user ID
                                        const { data: updatedUser, error: updateError } = await supabase
                                            .from('user')
                                            .update({ apes: newBalance })
                                            .eq('id', userData.id)
                                            .select('apes')
                                            .single();
                                        
                                        if (updateError) {
                                            console.error("❌ Error crediting item jackpot prize to user balance:", {
                                                updateError,
                                                userId: userData.id,
                                                newBalance
                                            });
                                            alert(`Error: Failed to credit ${itemPriceAmount} OGX to your balance. Please contact support.`);
                                        } else {
                                            console.log(`✅ Item jackpot prize credited: ${itemPriceAmount} OGX. New balance: ${updatedUser?.apes}`);
                                            // Show success message
                                            toast.success(`🎉 ${itemPriceAmount} OGX credited to your balance!`, {
                                                position: "top-center",
                                                autoClose: 5000,
                                            });
                                        }
                                    }
                                } catch (itemPrizeError) {
                                    console.error("❌ Exception crediting item jackpot prize:", itemPrizeError);
                                    alert(`Error: Exception while crediting ${itemPriceAmount} OGX. Please contact support.`);
                                }
                                
                                // For item prizes, we don't add to prizeWin table - they're credited directly
                                // Skip the prizeWin insertion below
                            } else {
                                console.log("ℹ️ Not an item prize - isNFTJackpot:", isNFTJackpot, "item_price:", poolData?.item_price);
                            }
                            
                            // Verify user exists in auth.users before inserting
                            // The user_id from contributions should be a valid auth.users UUID
                            // If it's from project_users, we need to get the auth user_id
                            let validUserId = winner.user_id;
                            
                            // Check if user exists in project_users and get auth user_id if needed
                            const { data: projectUser } = await supabase
                                .from('project_users')
                                .select('user_id')
                                .eq('user_id', winner.user_id)
                                .maybeSingle();
                            
                            // If not found in project_users, try to verify it's a valid UUID
                            // The user_id should be a UUID that exists in auth.users
                            // For now, we'll use the user_id directly and let the database handle the constraint
                            
                            // Record the final winner in jackpot_wins table
                            // Main project: don't set project_id (will be NULL)
                            const winDataToInsert: any = {
                                pool_id: poolId,
                                user_id: validUserId,
                                amount: prizeAmount,
                                win_type: 'jackpot_final',
                                is_claimed: false
                                // project_id will be NULL for main project
                            };
                            
                            const { data: winData, error: winError } = await supabase
                                .from('jackpot_wins')
                                .insert(winDataToInsert)
                                .select()
                                .single();
                            
                            // Set current winner for display (regardless of jackpot_wins insert success)
                            // For item prizes, display item_price instead of prizeAmount
                            const displayAmount = isItemPrize && poolData?.item_price 
                                ? parseFloat(String(poolData.item_price)) 
                                : prizeAmount;
                            
                            setCurrentWinner({
                                user_id: winner.user_id,
                                amount: displayAmount,
                                created_at: winData?.created_at || new Date().toISOString()
                            });
                            
                            console.log(`🎯 Display amount set: ${displayAmount} OGX (isItemPrize: ${isItemPrize}, item_price: ${poolData?.item_price}, prizeAmount: ${prizeAmount})`);
                            
                            if (!winError && winData) {
                                console.log("🎉 FINAL WINNER SELECTED!", {
                                    winner_id: winner.user_id,
                                    prize_amount: prizeAmount,
                                    total_contributions: totalContributions
                                });
                            } else {
                                console.warn("⚠️ jackpot_wins insert failed, but continuing with prizeWin insert:", winError);
                            }
                            
                            // Add winner to prizeWin table (for sidebar cart and user rewards)
                            // This should happen regardless of jackpot_wins insert success
                            // because prizeWin uses userId (TEXT) which doesn't have the same constraint
                            // SKIP for item prizes - they're credited directly to balance
                            if (!isItemPrize) {
                                try {
                                    // Determine reward type: 'nft' if prize is NFT, 'sol' if it's SOL/OGX
                                    const rewardType = isNFTJackpot ? 'nft' : 'sol';
                                
                                // Check if already exists in prizeWin to avoid duplicates
                                // Check for both 'nft' and 'sol' types to catch any existing entry
                                // Main project: filter by project_id IS NULL
                                const { data: existingPrizeWin } = await supabase
                                    .from('prizeWin')
                                    .select('id, project_id')
                                    .eq('userId', winner.user_id)
                                    .in('reward_type', ['nft', 'sol', 'jackpot']) // Check all possible types
                                    .eq('name', jackpotName)
                                    .is('project_id', null) // Main project only
                                    .gte('created_at', endTimeISO)
                                    .maybeSingle();
                                
                                if (!existingPrizeWin) {
                                    const prizeWinInsert: any = {
                                        userId: winner.user_id,
                                        name: jackpotName,
                                        image: jackpotImage,
                                        sol: String(prizeAmount), // Prize amount as string
                                        isWithdraw: false, // Not withdrawn yet
                                        reward_type: rewardType, // 'nft' if NFT prize, 'sol' if SOL/OGX prize
                                        product_id: null, // Not from a product/lootbox
                                        created_at: getCurrentUTCTime()
                                        // project_id will be NULL for main project (default)
                                    };
                                    
                                    // If jackpot prize is an NFT, add mint address (required for sidebar cart to show it)
                                    if (isNFTJackpot) {
                                        prizeWinInsert.mint = poolData.image;
                                        console.log("🎨 Adding NFT jackpot prize to cart:", {
                                            mint: poolData.image,
                                            name: jackpotName,
                                            userId: winner.user_id,
                                            reward_type: rewardType
                                        });
                                    } else {
                                        console.log("💰 Adding SOL/OGX jackpot prize to cart:", {
                                            amount: prizeAmount,
                                            name: jackpotName,
                                            userId: winner.user_id,
                                            reward_type: rewardType
                                        });
                                    }
                                    
                                    const { data: prizeWinData, error: prizeWinError } = await supabase
                                        .from('prizeWin')
                                        .insert(prizeWinInsert)
                                        .select()
                                        .single();
                                    
                                    if (prizeWinError) {
                                        console.error("❌ ERROR: Error adding winner to prizeWin table:", prizeWinError);
                                        // Don't fail the whole process if prizeWin insert fails
                                    } else {
                                        console.log("✅ Winner added to prizeWin table:", prizeWinData);
                                    }
                                } else {
                                    console.log("ℹ️ Winner already exists in prizeWin table");
                                }
                                } catch (prizeWinException) {
                                    console.error("❌ EXCEPTION: Error adding to prizeWin:", prizeWinException);
                                    // Continue even if prizeWin insert fails
                                }
                            } else {
                                console.log("ℹ️ Item prize - skipped prizeWin insertion (balance credited directly)");
                            }
                            
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
            .eq("id", user.id)
            .select(); // Select to verify the update
        
        // Filter by project_id if it's a sub-project
        if (!isMainProject && projectId) {
            updateQuery = updateQuery.eq("project_id", parseInt(projectId));
        } else if (isMainProject) {
            // For main project, try to find user with project_id IS NULL
            updateQuery = updateQuery.is("project_id", null);
        }
        
        let { data: updatedUser, error: updateError } = await updateQuery;
        
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
                    <div className="w-full md:w-4/12">
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
                        {(!connected || !publicKey) && (
                            <div className="mb-4 p-4 bg-red-500/10 border-2 border-red-500 rounded-lg flex items-center gap-3">
                                <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <p className="text-red-600 font-medium">Please connect your wallet to purchase tickets</p>
                            </div>
                        )}
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
                                            Prize: {parseFloat(String(currentWinner.amount)).toFixed(2)} OGX
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
                        {isTimeExpired ? (
                            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6 text-center">
                                <p className="text-xl font-bold text-red-600 mb-2">⏰ Jackpot Time Expired</p>
                                <p className="text-gray-600">Ticket purchases are no longer available for this jackpot.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ff914d] text-sm">Price:</span>
                                    <input
                                        type="text"
                                        disabled
                                        value={`${data?.data[0]?.ticket_price || 0} OGX`}
                                        className="w-full h-12 bg-white border border-[#f74e14]/20 rounded-lg pl-16 pr-4 text-black text-right"
                                    />
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        placeholder="Enter number of tickets"
                                        disabled={isTimeExpired}
                                        className={`w-full h-12 bg-white border border-[#f74e14]/20 rounded-lg px-4 text-black focus:border-[#f74e14] transition-all duration-200 placeholder:text-black ${
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