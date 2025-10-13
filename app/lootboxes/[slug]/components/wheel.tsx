import React, { useState, useRef, useEffect, useCallback } from "react";
import img from "../../../../public/bg.jpg"
import { supabase } from "@/service/supabase";
import Image from "next/image";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { solanaProgramService } from "@/lib/solana-program";
import { JackpotService } from "@/lib/jackpot-service";
import JackpotWinAnnouncement from "@/app/Components/JackpotWinAnnouncement";
// import { WalletContextProvider, useWallet } from "@solana/wallet-adapter-react";
import deployedIdl from "../../../../deployed_idl.json";

interface WheelItem {
  id: number;
  name: string;
  image: any;
  color: string;
  textColor: string;
  percentage: number;
  price: string;
  mint?: string; // Add mint address for NFTs
  isNFT?: boolean; // Flag to identify NFT rewards
}

const WheelSpinner = ({ data, item, user, setUser }: any) => {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<WheelItem | null>(null);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [isFreeSpin, setIsFreeSpin] = useState(false);
  const [shuffledData, setShuffledData] = useState<WheelItem[]>([]);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  
  // Jackpot state
  const [jackpotWin, setJackpotWin] = useState<any>(null);
  const [showJackpotWin, setShowJackpotWin] = useState(false);
  const segmentCount = shuffledData.length;
  const segmentAngle = segmentCount > 0 ? 360 / segmentCount : 0;
  
  // Debug logging
  console.log("🎰 Wheel render - segmentCount:", segmentCount, "segmentAngle:", segmentAngle);
  console.log("🎰 Wheel render - shuffledData:", shuffledData.length, "items");

  // Connect wallet function
  const connectWallet = useCallback(async () => {
    //@ts-ignore
    const { solana } = window;
    if (solana) {
      try {
        const response = await solana.connect();
        return response.publicKey.toString();
      } catch (error) {
        console.error("Failed to connect wallet:", error);
        return null;
      }
    }
    return null;
  }, []);

  // Fetch all deposited NFTs and create wheel segments (excluding claimed ones)
  const getNFTWheelSegments = useCallback(async () => {
    try {
      console.log("🎨 Fetching deposited NFTs for wheel segments...");
      
      // Import the NFT metadata fetcher
      const { fetchMultipleNFTMetadata, getDepositedNFTs } = await import("@/lib/nft-metadata");
      
      // Get mint addresses of deposited NFTs
      const mintAddresses = await getDepositedNFTs();
      console.log("📍 Mint addresses:", mintAddresses);
      
      // Get all NFT mints that are already won (claimed or pending) for this user
      let wonMints: string[] = [];
      if (user.id) {
        const { data: wonRewards } = await supabase
          .from("prizeWin")
          .select("mint")
          .eq("userId", user.id)
          .not("mint", "is", null);
        
        wonMints = wonRewards?.map(r => r.mint) || [];
        console.log("🚫 Already won mint addresses:", wonMints);
      } else {
        console.log("⚠️ No user ID, skipping won rewards check");
      }
      
      // Filter out already won NFTs
      const availableMints = mintAddresses.filter(mint => !wonMints.includes(mint));
      console.log("✅ Available mint addresses:", availableMints);
      
      if (availableMints.length === 0) {
        console.log("📦 No available NFTs found in vault (all already won)");
        return [];
      }
      
      // Fetch metadata for available NFTs only
      const nftMetadata = await fetchMultipleNFTMetadata(availableMints);
      console.log("✅ Loaded available NFT metadata:", nftMetadata);
      
      // Sync deposited NFTs into database table `nft_reward_percentages`
      try {
        // Get existing NFT rewards from DB to avoid duplicates
        const { data: existing, error: existingErr } = await supabase
          .from('nft_reward_percentages')
          .select('mint_address');
        if (existingErr) {
          console.warn('⚠️ Could not fetch existing NFT rewards:', existingErr);
        } else {
          const existingMints = new Set((existing || []).map((r: any) => r.mint_address));
          const toInsert = nftMetadata
            .filter(nft => !existingMints.has(nft.mint))
            .map(nft => ({
              reward_name: nft.name || 'NFT Reward',
              reward_image: nft.image || '/default-nft.png',
              reward_price: '100',
              percentage: 1.0, // default; admin can adjust later
              mint_address: nft.mint,
              is_active: true,
            }));

          if (toInsert.length > 0) {
            const { error: insertErr } = await supabase
              .from('nft_reward_percentages')
              .upsert(toInsert, { onConflict: 'mint_address' });
            if (insertErr) {
              console.warn('⚠️ Failed to upsert new deposited NFTs into DB:', insertErr);
            } else {
              console.log(`✅ Upserted ${toInsert.length} newly deposited NFTs into DB`);
            }
          }
        }
      } catch (dbSyncErr) {
        console.warn('⚠️ Error during NFT DB sync:', dbSyncErr);
      }

      // Convert NFTs to wheel segments with equal percentage distribution
      const nftPercentage = 100 / nftMetadata.length; // Equal distribution among all NFTs
      const nftSegments: WheelItem[] = nftMetadata.map((nft, index) => ({
        id: 1000 + index, // Use high IDs to avoid conflicts with existing rewards
        name: nft.name,
        image: nft.image,
        color: `hsl(${(index * 120) % 360}, 70%, 60%)`, // Different colors for each NFT
        textColor: "#ffffff",
        percentage: nftPercentage, // Equal distribution
        price: "100", // Default price
        mint: nft.mint,
        isNFT: true
      }));
      
      console.log(`🎨 NFT segments with percentages:`, nftSegments.map(nft => `${nft.name}: ${nft.percentage}%`));
      
      console.log(`🎯 Created ${nftSegments.length} available NFT wheel segments`);
      return nftSegments;
      
    } catch (error) {
      console.error("❌ Error fetching NFT wheel segments:", error);
      return [];
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load ALL active rewards from database (replaces original data)
  const loadAllActiveRewards = useCallback(async () => {
    try {
      console.log("🎯 Loading ALL active rewards from database...");
      
      // Load all active token rewards
      const { data: tokenRewards, error: tokenError } = await supabase
        .from('token_reward_percentages')
        .select('*')
        .eq('is_active', true)
        .order('reward_price');

      if (tokenError) {
        console.error("❌ Error loading token rewards:", tokenError);
        return [];
      }

      // Convert database rewards to wheel items
      const databaseRewards: WheelItem[] = (tokenRewards || []).map((reward, index) => ({
        id: reward.id,
        name: reward.reward_name || 'OGX Token',
        image: reward.reward_image || 'ogx-token.png', // Use simple filename
        color: `hsl(${(index * 60) % 360}, 70%, 60%)`, // Different colors
        textColor: "#ffffff",
        percentage: reward.percentage || 0,
        price: reward.reward_price,
        reward_type: 'token',
        isNFT: false
      }));

      console.log(`✅ Loaded ${databaseRewards.length} active rewards from database:`, databaseRewards);
      return databaseRewards;
      
    } catch (error) {
      console.error("❌ Error loading active rewards:", error);
      return [];
    }
  }, []);

  // Load SOL rewards from backend (token_reward_percentages table where reward_name contains "SOL")
  const loadSolRewards = useCallback(async (): Promise<WheelItem[]> => {
    try {
      const { data: solRewards, error } = await supabase
        .from('token_reward_percentages')
        .select('*')
        .eq('is_active', true)
        .like('reward_name', '%SOL%');

      if (error) {
        console.warn('⚠️ Could not load SOL rewards from backend:', error);
        return [];
      }

      const mapped: WheelItem[] = (solRewards || []).map((r: any, idx: number) => ({
        id: 3000 + (r.id || idx),
        name: r.reward_name || `${r.reward_price} SOL`,
        image: r.reward_image || 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
        color: `hsl(${(idx * 55 + 220) % 360}, 70%, 60%)`,
        textColor: '#ffffff',
        percentage: r.percentage || 0,
        price: '0',
        // @ts-ignore
        reward_type: 'sol',
        isNFT: false,
        // @ts-ignore
        solAmount: Number(r.reward_price || 0),
      }));

      console.log('✅ Loaded SOL rewards from backend:', mapped);
      return mapped;
    } catch (e) {
      console.warn('⚠️ Error loading SOL rewards:', e);
      return [];
    }
  }, []);

  useEffect(() => {
    // Load wheel data with ONLY deposited NFT rewards
    const loadWheelData = async () => {
      try {
        console.log("🎰 Loading wheel data with ONLY deposited NFT rewards...");
        console.log("👤 Current user ID:", user.id);
        
        setIsLoading(true);
        
        // Note: We'll load NFTs even without user authentication for now
        // User filtering will be applied in getNFTWheelSegments if user.id exists
        
        // Get NFT and SOL segments
        const [nftSegments, solSegments] = await Promise.all([
          getNFTWheelSegments(),
          loadSolRewards(),
        ]);

        // Merge segments (percentages can come from backend; if 0, we will equalize)
        let merged = [...nftSegments, ...solSegments];

        if (merged.length === 0) {
          console.warn("⚠️ No deposited NFTs found in vault. Wheel will be empty.");
          setShuffledData([]);
        } else {
          // If sum of percentages <= 0, normalize equally; otherwise keep backend percentages
          const totalPct = merged.reduce((s, r:any) => s + (Number(r.percentage) || 0), 0);
          const normalized = totalPct <= 0.001
            ? merged.map((r) => ({ ...r, percentage: 100 / merged.length }))
            : merged;
          // Shuffle rewards
          const shuffled = normalized.sort(() => Math.random() - 0.5);
          setShuffledData(shuffled);
        }
        
        console.log(`🎯 Wheel loaded with ${merged.length} total segments (NFT + SOL)`);
        console.log("📊 Rewards:", merged.map(r => `${r.name}: ${r.percentage}%`));
        console.log("🔍 Full segments data:", merged);
        
        setIsLoading(false);
        
      } catch (error) {
        console.error("❌ Error loading wheel data:", error);
        // Set empty array if error
        setShuffledData([]);
        setIsLoading(false);
      }
    };
    
    loadWheelData();
  }, [getNFTWheelSegments]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time updates when NFT rewards are added/changed in database
  useEffect(() => {
    console.log("🔄 Setting up real-time subscription for NFT reward changes...");
    
    // Subscribe to changes in nft_reward_percentages table only
    const subscription = supabase
      .channel('nft_reward_percentages_changes')
      .on('postgres_changes', 
        { 
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public', 
          table: 'nft_reward_percentages' 
        }, 
        (payload) => {
          console.log('🔄 NFT reward database changed:', payload);
          
          // Reload wheel data when NFT database changes
          const reloadWheelData = async () => {
            try {
              console.log("🔄 Reloading wheel data due to NFT database change...");
              
              const nftSegments = await getNFTWheelSegments();
              if (nftSegments.length === 0) {
                setShuffledData([]);
              } else {
                const shuffled = nftSegments.sort(() => Math.random() - 0.5);
                setShuffledData(shuffled);
              }
              
              console.log(`✅ Wheel updated with ${nftSegments.length} NFT segments`);
            } catch (error) {
              console.error("❌ Error reloading wheel data:", error);
            }
          };
          
          reloadWheelData();
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      console.log("🔄 Cleaning up real-time subscription...");
      subscription.unsubscribe();
    };
  }, [getNFTWheelSegments]);

  // Get random NFT from deposited NFTs in vault
  const getRandomNFTFromVault = useCallback(async () => {
    try {
      console.log("🎲 Fetching deposited NFTs from vault...");
      
      // Import the NFT metadata fetcher
      const { fetchMultipleNFTMetadata, getDepositedNFTs } = await import("@/lib/nft-metadata");
      
      // Get mint addresses of deposited NFTs
      const mintAddresses = await getDepositedNFTs();
      console.log("📍 Mint addresses:", mintAddresses);
      
      // Fetch metadata for all NFTs
      const nftMetadata = await fetchMultipleNFTMetadata(mintAddresses);
      console.log("✅ Loaded NFT metadata:", nftMetadata);
      
      if (nftMetadata.length === 0) {
        throw new Error("No NFTs found in vault");
      }
      
      // Randomly select one NFT
      const randomIndex = Math.floor(Math.random() * nftMetadata.length);
      const selectedNFT = nftMetadata[randomIndex];
      
      console.log(`🎯 Selected random NFT: ${selectedNFT.name}`);
      return {
        name: selectedNFT.name,
        image: selectedNFT.image,
        mint: selectedNFT.mint,
        price: "100" // Default price, could be fetched from metadata
      };
      
    } catch (error) {
      console.error("❌ Error fetching NFT from vault:", error);
      // Fallback to default reward
      return {
        name: "OGX NFT Reward",
        image: "/default-nft.png",
        mint: "11111111111111111111111111111111",
        price: "100"
      };
    }
  }, []);

  // Add reward to cart function
  const addRewardToCart = useCallback(async (winnerItem: WheelItem) => {
    try {
      console.log("🎯 Adding reward to cart:", winnerItem);
      
      // Check if this is a SOL reward
      if ((winnerItem as any).reward_type === 'sol' && (winnerItem as any).solAmount) {
        console.log("💰 Processing SOL reward:", (winnerItem as any).solAmount);
        
        // Generate a unique reward ID
        const rewardId = Date.now() % 1000000;
        
        console.log("📝 Inserting SOL reward into prizeWin table...");
        // Add SOL reward to prizeWin table (for sidebar cart)
        const prizeWinResult = await supabase.from("prizeWin").insert({
          userId: user.id,
          name: `${(winnerItem as any).solAmount} SOL`,
          image: winnerItem.image,
          sol: (winnerItem as any).solAmount, // SOL amount
          isWithdraw: false,
          reward_type: 'sol', // Add reward type
          mint: null, // No mint for SOL rewards
          product_id: item.id, // Add the lootbox/product ID
          created_at: new Date().toISOString(),
        });

        if (prizeWinResult.error) {
          console.error("❌ Error inserting SOL reward into prizeWin:", prizeWinResult.error);
          throw prizeWinResult.error;
        }

        console.log("✅ Successfully inserted SOL reward into prizeWin:", prizeWinResult.data);
        console.log(`🎉 SOL reward added to cart: ${(winnerItem as any).solAmount} SOL`);
        
      } else if (winnerItem.isNFT && winnerItem.mint) {
        console.log("🎨 Processing NFT reward:", winnerItem.name);
        
        // Verify the NFT is actually deposited in vault
        try {
          const { getDepositedNFTs } = await import("@/lib/nft-metadata");
          const depositedMints = await getDepositedNFTs();
          
          if (!depositedMints.includes(winnerItem.mint)) {
            console.warn("⚠️ NFT not in vault, skipping cart addition:", winnerItem.mint);
            alert(`⚠️ NFT Not Available!\n\n${winnerItem.name} is no longer available in the vault.\n\nPlease try spinning again for a different reward.`);
            return;
          }
        } catch (error) {
          console.warn("⚠️ Could not verify NFT in vault:", error);
          // If we can't verify, don't add to cart to be safe
          alert(`⚠️ Unable to verify NFT availability!\n\nPlease try spinning again.`);
          return;
        }
        
        // Generate a unique reward ID
        const rewardId = Date.now() % 1000000;
        
        console.log("📝 Inserting NFT into prizeWin table...");
        // Add NFT reward to prizeWin table (for sidebar cart)
        const prizeWinResult = await supabase.from("prizeWin").insert({
          userId: user.id,
          name: winnerItem.name,
          image: winnerItem.image,
          sol: winnerItem.price, // Keep as string to match varchar type
          isWithdraw: false, // Use correct field name from table
          reward_type: 'nft', // Add reward type
          mint: winnerItem.mint, // Add mint address
          product_id: item.id, // Add the lootbox/product ID
          created_at: new Date().toISOString(),
        });

        if (prizeWinResult.error) {
          console.error("❌ Error inserting NFT into prizeWin:", prizeWinResult.error);
          throw prizeWinResult.error;
        }

        console.log("✅ Successfully inserted NFT into prizeWin:", prizeWinResult.data);
        console.log(`🎉 NFT reward added to cart: ${winnerItem.name} (Mint: ${winnerItem.mint})`);
        
      } else {
        console.log("💰 Processing token reward:", winnerItem.name);
        
        // For token rewards, get a random NFT from vault (existing behavior)
        const randomNFT = await getRandomNFTFromVault();
        console.log("🎨 Using random NFT from vault:", randomNFT);
        
        // Verify the random NFT is actually deposited
        try {
          const { getDepositedNFTs } = await import("@/lib/nft-metadata");
          const depositedMints = await getDepositedNFTs();
          
          if (!depositedMints.includes(randomNFT.mint)) {
            console.warn("⚠️ Random NFT not in vault, skipping cart addition:", randomNFT.mint);
            alert(`⚠️ No NFTs Available!\n\nThere are currently no NFTs deposited in the vault.\n\nPlease deposit NFTs first or try spinning again later.`);
            return;
          }
        } catch (error) {
          console.warn("⚠️ Could not verify random NFT in vault:", error);
          // If we can't verify, don't add to cart to be safe
          alert(`⚠️ Unable to verify NFT availability!\n\nPlease try spinning again.`);
          return;
        }
        
        // Generate a unique reward ID
        const rewardId = Date.now() % 1000000;
        
        console.log("📝 Inserting into prizeWin table...");
        // Add reward to prizeWin table (for sidebar cart)
        const prizeWinResult = await supabase.from("prizeWin").insert({
          userId: user.id,
          name: randomNFT.name,
          image: randomNFT.image,
          sol: randomNFT.price, // Keep as string to match varchar type
          isWithdraw: false, // Use correct field name from table
          reward_type: 'nft', // Add reward type
          mint: randomNFT.mint, // Add mint address for token rewards too
          product_id: item.id, // Add the lootbox/product ID
          created_at: new Date().toISOString(),
        });

        if (prizeWinResult.error) {
          console.error("❌ Error inserting into prizeWin:", prizeWinResult.error);
          throw prizeWinResult.error;
        }

        console.log("✅ Successfully inserted into prizeWin:", prizeWinResult.data);
        console.log(`🎉 NFT reward added to cart: ${randomNFT.name} (Mint: ${randomNFT.mint})`);
      }

    } catch (error) {
      console.error("❌ Error adding reward to cart:", error);
      alert(`Error adding reward to cart: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [user.id, getRandomNFTFromVault]);

  const getRandomReward = () => {
    const totalProbability = data.reduce((sum: any, item: any) => sum + item.percentage, 0);
    const random = Math.random() * totalProbability;
    let cumulative = 0;
    for (const reward of data) {
      cumulative += reward.percentage;
      if (random <= cumulative) return reward;
    }
    return data[0];
  };

  const spinWheel = async () => {
    if (user.apes < Number(item.price)) {
      alert("You need to purchase OGX");
      return;
    }
    const price = Number(item.price);

    try {
      await supabase.from("user").update({ apes: user.apes - price }).eq("id", user.id);
      setUser({ ...user, apes: user.apes - price });
    } catch (e) {
      console.error("Update error", e);
      return;
    }

    setIsFreeSpin(false);
    // Spin a random amount: 5-8 full spins + random offset
    const fullSpins = Math.floor(Math.random() * 4) + 5; // 5,6,7,8
    const randomOffset = Math.random() * 460;
    const spinAngle = fullSpins * 360 + randomOffset;
    const newRotation = rotation + spinAngle;

    setIsSpinning(true);
    setRotation(newRotation);

    setTimeout(async () => {
      // After spin, determine which segment is under the pointer (-90°)
      const normalizedRotation = ((newRotation % 360) + 360) % 360;
      const pointerAngle = -90;
      const angleAtPointer = (pointerAngle - normalizedRotation + 360) % 360;
      let pointerSegmentIndex = Math.floor(angleAtPointer / segmentAngle) % segmentCount;
      if (pointerSegmentIndex < 0) pointerSegmentIndex += segmentCount;
      if (pointerSegmentIndex >= segmentCount) pointerSegmentIndex = 0;
      const winnerItem = shuffledData[pointerSegmentIndex];
      setWinner(winnerItem);
      setShowWinnerDialog(true);
      setIsSpinning(false);

      // Paid spin: keep current behavior and add reward to cart
      await addRewardToCart(winnerItem);

      // Reward payout (OGX tokens automatically added) - only for non-SOL rewards
      if ((winnerItem as any).reward_type !== 'sol') {
        const rewardAmount = Number(winnerItem?.price);
        try {
          await supabase.from("user").update({ apes: user.apes - price + rewardAmount }).eq("id", user.id);
          setUser({ ...user, apes: user.apes - price + rewardAmount });
        } catch (e) {
          console.error("Reward update failed", e);
        }
      }

      // Jackpot system integration
      try {
        console.log("🎰 Checking for jackpot win...");
        
        // Auto-contribute to jackpots
        const contribution = await JackpotService.autoContributeFromSpin(user.id, price);
        if (contribution.contributed) {
          console.log(`💰 Contributed to ${contribution.contributions} jackpot pools`);
        }
        
        // Check for jackpot win
        const jackpotResult = await JackpotService.checkJackpotWin(user.id, price);
        if (jackpotResult.won && jackpotResult.pool && jackpotResult.winAmount) {
          console.log(`🎉 JACKPOT WIN! ${jackpotResult.winAmount} SOL from ${jackpotResult.pool.name}`);
          
          // Add jackpot win to user's OGX balance (since vault has no SOL)
          const ogxEquivalent = jackpotResult.winAmount * 1000; // 1 SOL = 1000 OGX
          const newBalance = (user.apes || 0) + ogxEquivalent;
          
          await supabase.from("user").update({ apes: newBalance }).eq("id", user.id);
          setUser({ ...user, apes: newBalance });
          
          // Show jackpot win announcement
          setJackpotWin({
            pool: jackpotResult.pool,
            amount: jackpotResult.winAmount,
            ogxEquivalent: ogxEquivalent
          });
          setShowJackpotWin(true);
          
          // Auto-hide after 10 seconds
          setTimeout(() => {
            setShowJackpotWin(false);
            setJackpotWin(null);
          }, 10000);
        }
      } catch (jackpotError) {
        console.error("❌ Jackpot system error:", jackpotError);
      }
    }, 5000);
  };

  const handleFreeTry = async () => {
    setIsFreeSpin(true);
    // Spin a random amount: 5-8 full spins + random offset
    const fullSpins = Math.floor(Math.random() * 4) + 5; // 5,6,7,8
    const randomOffset = Math.random() * 360;
    const spinAngle = fullSpins * 360 + randomOffset;
    const newRotation = rotation + spinAngle;

    setIsSpinning(true);
    setRotation(newRotation);

    setTimeout(async () => {
      // After spin, determine which segment is under the pointer (-90°)
      const normalizedRotation = ((newRotation % 360) + 360) % 360;
      const pointerAngle = -90;
      const angleAtPointer = (pointerAngle - normalizedRotation + 360) % 360;
      let pointerSegmentIndex = Math.floor(angleAtPointer / segmentAngle) % segmentCount;
      if (pointerSegmentIndex < 0) pointerSegmentIndex += segmentCount;
      if (pointerSegmentIndex >= segmentCount) pointerSegmentIndex = 0;
      const winnerItem = shuffledData[pointerSegmentIndex];
      setWinner(winnerItem);
      setShowWinnerDialog(true);
      setIsSpinning(false);
      
      // Free spin is mock-only: do NOT add to cart or change balances
      console.log("Free spin result (mock only, no cart insert or balance change):", winnerItem);
    }, 5000);
  };

  const resetWheel = () => {
    setShowWinnerDialog(false);
    setWinner(null);
  };

  const handleSpinAgain = () => {
    setShowWinnerDialog(false);
    setWinner(null);
    // Trigger another paid spin
    spinWheel();
  };
  
  return (
    <div className="w-full bg-[#ff914d]/10">
      {/* Show loading state */}
      {/* {isLoading && (
        <div className="text-center py-8 px-4">
          <div className="bg-white/20 rounded-lg p-6 mx-4">
            <h3 className="text-xl font-bold text-white mb-2">🔄 Loading Wheel...</h3>
            <p className="text-white/80 mb-4">Please wait while we load the deposited NFTs.</p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          </div>
        </div>
      )} */}
      
      {/* Show message if no NFTs deposited (only when not loading) */}
      {!isLoading && shuffledData.length === 0 && (
        <div className="text-center py-8 px-4">
          <div className="bg-white/20 rounded-lg p-6 mx-4">
            <h3 className="text-xl font-bold text-white mb-2">🎨 No NFTs Deposited</h3>
            <p className="text-white/80 mb-4">The wheel is empty because no NFTs are currently deposited in the vault.</p>
            <p className="text-sm text-white/60">Deposit NFTs to see them appear on the wheel!</p>
          </div>
        </div>
      )}
      
      {!isLoading && shuffledData.length > 0 && (
        <div className="w-full flex flex-col items-center justify-center">
          <div className="relative w-full flex justify-center overflow-hidden md:h-[30vw] h-[40vw]">
          <div className="absolute inset-0 z-0" style={{
            backgroundImage: `url(${img.src})`,
            backgroundSize: "cover",
            backgroundPosition: "center"
          }} />

          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-30">
            <div className="w-4 md:h-12 h-8 bg-[#f74e14]" style={{
              clipPath: "polygon(0 100%, 100% 100%, 50% 0)",
              transform: "rotate(180deg)"
            }} />
          </div>

          <div className="relative left-1/2 md:bottom-[13vw] bottom-[15vw] transform -translate-x-1/2 translate-y-1/2">
            <svg
              className="w-[120vw] h-[85vw] max-w-[100vw] z-10"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning ? "transform 5s cubic-bezier(0.1, 0.2, 0.1, 1)" : "none",
              }}
              viewBox="0 0 100 100"
            >
              {shuffledData.map((item, i) => {
                const startAngle = i * segmentAngle;
                const endAngle = startAngle + segmentAngle;
                const largeArcFlag = segmentAngle > 180 ? 1 : 0;
                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;
                const outerRadius = 50;
                const innerRadius = 26;

                const outerX1 = 50 + outerRadius * Math.cos(startRad);
                const outerY1 = 50 + outerRadius * Math.sin(startRad);
                const outerX2 = 50 + outerRadius * Math.cos(endRad);
                const outerY2 = 50 + outerRadius * Math.sin(endRad);
                const innerX1 = 50 + innerRadius * Math.cos(endRad);
                const innerY1 = 50 + innerRadius * Math.sin(endRad);
                const innerX2 = 50 + innerRadius * Math.cos(startRad);
                const innerY2 = 50 + innerRadius * Math.sin(startRad);

                const pathData =
                  `M${outerX1},${outerY1}` +
                  ` A${outerRadius},${outerRadius} 0 ${largeArcFlag},1 ${outerX2},${outerY2}` +
                  ` L${innerX1},${innerY1}` +
                  ` A${innerRadius},${innerRadius} 0 ${largeArcFlag},0 ${innerX2},${innerY2}` +
                  " Z";

                const midAngle = startAngle + segmentAngle / 2;
                const midRad = (midAngle * Math.PI) / 180;
                const imgX = 50 + 38 * Math.cos(midRad);
                const imgY = 50 + 38 * Math.sin(midRad);
                // For angle text
                const textRadius = 43;
                const textX = 50 + textRadius * Math.cos(midRad);
                const textY = 50 + textRadius * Math.sin(midRad);
                // For percentage text
                const percentageRadius = 32;
                const percentageX = 50 + percentageRadius * Math.cos(midRad);
                const percentageY = 50 + percentageRadius * Math.sin(midRad);

                return (
                  <g key={i}>
                    <path d={pathData} fill="#ff914d" stroke="#f74e14" strokeWidth="0.5" />
                    <image
                      href={item.image?.startsWith('http') ? item.image : `/images/${item.image || 'default-reward.png'}`}
                      x={imgX - 6}
                      y={imgY - 6}
                      width="12"
                      height="12"
                      transform={`rotate(${midAngle + 90}, ${imgX}, ${imgY})`}
                      className=""
                      onError={(e) => {
                        // Fallback to default image if loading fails
                        e.currentTarget.href.baseVal = '/images/default-reward.png';
                      }}
                    />
                    {/* Percentage Text */}
                    <text
                      x={percentageX}
                      y={percentageY}
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      fontSize="3.5"
                      fill="#ffffff"
                      fontWeight="bold"
                      style={{ 
                        userSelect: 'none', 
                        pointerEvents: 'none',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                      }}
                      transform={`rotate(${midAngle}, ${percentageX}, ${percentageY})`}
                    >
                      {/* {item.percentage?.toFixed(1) || '0.0'}% */}
                    </text>
                    {/* Reward Name Text */}
                    <text
                      x={textX}
                      y={textY + 2}
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      fontSize="2.5"
                      fill="#ffffff"
                      fontWeight="bold"
                      style={{ 
                        userSelect: 'none', 
                        pointerEvents: 'none',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                      }}
                      transform={`rotate(${midAngle}, ${textX}, ${textY + 2})`}
                    >
                      {/* {item.name} */}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <button
          onClick={spinWheel}
          disabled={isSpinning}
          className="mt-10 px-2 py-1 bg-[#f74e14] hover:bg-[#e63900] text-white rounded font-bold"
        >
          SPIN FOR {item?.price} OGX
        </button>
        <button
          onClick={handleFreeTry}
          disabled={isSpinning}
          className="mt-4 px-4 py-2 text-[#f74e14] rounded font-bold "
        >
          TRY FOR FREE
        </button>
        </div>
      )}

      {showWinnerDialog && winner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-[90%] max-w-lg border-2 border-[#f74e14]">
            <div className="text-end text-black cursor-pointer" onClick={resetWheel}>X</div>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4 text-[#f74e14]">Congratulations!</h2>
              <div className="flex items-center justify-center mb-6">
                <Image
                  src={`${winner.image}`}
                  alt={winner.name}
                  className="w-32 h-32 object-contain"
                  width={300}
                  height={300}
                />
              </div>
              <p className="text-xl mb-2 text-gray-800">{winner.name}</p>
              
              {/* Different messages for NFT vs token rewards */}
              {winner.isNFT ? (
                <div>
                  <p className="text-sm text-purple-600 mb-2">🎨 NFT Reward: {winner.name}</p>
                  <p className="text-sm text-gray-600 mb-2">Mint: {winner.mint?.slice(0, 8)}...</p>
                </div>
              ) : (
                <div>
                  {/* <p className="text-sm text-gray-600 mb-2">OGX Reward: {winner.price} (automatically added)</p> */}
                  {/* <p className="text-sm text-blue-600 mb-2">NFT Reward: Random NFT from vault added to cart</p> */}
                </div>
              )}
              
              {/* Reward Added to Cart Message */}
              <div className="mb-4">
              
                <p className="text-sm text-blue-600 mb-2 text-center">
                  {winner.isNFT ? 
                    `Check your sidebar cart to claim your ${winner.name} NFT` :
                    'Check your sidebar cart to claim your NFT reward'
                  }
                </p>
              </div>

              <div className="flex justify-center gap-4">
                {!isFreeSpin ? (
                  <button
                    onClick={handleSpinAgain}
                    className="px-6 py-2 border-2 border-[#f74e14] text-[#f74e14] rounded-lg hover:bg-[#f74e14] hover:text-white"
                  >
                    Spin Again
                  </button>
                ) : (
                  <button
                    onClick={resetWheel}
                    className="px-6 py-2 border-2 border-[#f74e14] text-[#f74e14] rounded-lg hover:bg-[#f74e14] hover:text-white"
                  >
                    Close
                  </button>
                )}
                <button
                  onClick={() => {
                    const message = winner
                      ? `🎉 I just won ${winner.price} OGX reward on the OGX Spin Wheel 🌀
Real blockchain rewards via Anchor program!
Try your luck 👇`
                      : "Check out this awesome OGX Spin Wheel!";
                    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(window.location.href)} Stake. Spin. Win. Repeat.`;
                    window.open(url, '_blank', 'width=550,height=420');
                  }}
                  className="px-4 sm:px-6 py-2 bg-[#f74e14] text-white rounded-lg hover:bg-[#e63900] transition-colors text-sm sm:text-base font-medium"
                >
                  Share on X
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Jackpot Win Announcement */}
      {showJackpotWin && jackpotWin && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
          <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl animate-bounce">
            {/* Confetti effect */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute animate-ping"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${1 + Math.random() * 2}s`
                  }}
                >
                  🎉
                </div>
              ))}
            </div>

            {/* Win content */}
            <div className="relative z-10">
              <div className="text-6xl mb-4">🎰</div>
              <h1 className="text-3xl font-bold text-white mb-2">
                JACKPOT WIN!
              </h1>
              <h2 className="text-xl font-semibold text-white/90 mb-2">
                {jackpotWin.amount} SOL
              </h2>
              <p className="text-white/80 text-sm mb-4">
                from {jackpotWin.pool.name}
              </p>
              
              <div className="bg-white/20 rounded-lg p-4 mb-6">
                <p className="text-white font-medium">
                  🎉 Congratulations! You won the jackpot!
                </p>
                <p className="text-white/80 text-sm mt-1">
                  You received {jackpotWin.ogxEquivalent} OGX (equivalent to {jackpotWin.amount} SOL)
                </p>
                <p className="text-white/80 text-xs mt-2">
                  You can sell this OGX to get SOL in your wallet!
                </p>
              </div>

              <button
                onClick={() => {
                  setShowJackpotWin(false);
                  setJackpotWin(null);
                }}
                className="bg-white text-orange-600 font-bold py-3 px-6 rounded-lg hover:bg-gray-100 transition-colors"
              >
                🎉 Awesome!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WheelSpinner;
