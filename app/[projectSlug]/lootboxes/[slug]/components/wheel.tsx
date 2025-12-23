import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/service/supabase";
import { getWheelSettings, getImageUrl } from "@/service/websiteSettings";
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
import { useProject } from "@/lib/project-context";
// import { WalletContextProvider, useWallet } from "@solana/wallet-adapter-react";
import deployedIdl from "../../../../../deployed_idl.json";
import Loader from "@/app/Components/Loader";

// Helper function to convert Supabase storage path to full URL
const getImageUrlFromPath = (path: string | null | undefined): string => {
  if (!path) return '/default-item.png';
  
  // If it's already a full URL, return it
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // If it starts with '/', it's a local path
  if (path.startsWith('/')) {
    return path;
  }
  
  // Otherwise, it's a Supabase storage path - convert to full URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zkltmkbmzxvfovsgotpt.supabase.co';
  return `${supabaseUrl}/storage/v1/object/public/apes-bucket/${path}`;
};

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
  const { getProjectTokenSymbol, getProjectId } = useProject();
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<WheelItem | null>(null);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [isFreeSpin, setIsFreeSpin] = useState(false);
  const [shuffledData, setShuffledData] = useState<WheelItem[]>([]);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isReloading, setIsReloading] = useState(false);
  const [wheelBgImage, setWheelBgImage] = useState<string | null>(null);
  
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

  // Load NFT rewards from database (only active ones)
  const getNFTWheelSegments = useCallback(async () => {
    try {
      console.log(`🎨 Loading NFT rewards from database for lootbox: ${item.id}...`);
      
      // Load ACTIVE NFT rewards from database for THIS specific lootbox
      // Check if product_id column exists in nft_reward_percentages
      const query = supabase
        .from('nft_reward_percentages')
        .select('*')
        .eq('is_active', true)
        .not('mint_address', 'is', null);
      
      // Try to filter by product_id if column exists
      const { data: nftRewards, error } = await query.eq('product_id', item.id);

      if (error) {
        console.warn('⚠️ Could not load NFT rewards from database:', error);
        return [];
      }

      if (!nftRewards || nftRewards.length === 0) {
        console.log("📦 No active NFT rewards found in database");
        return [];
      }

      // Convert database NFT rewards to wheel items
      const nftSegments: WheelItem[] = nftRewards.map((r: any, idx: number) => ({
        id: r.id || (2000 + idx),
        name: r.reward_name || 'NFT Reward',
        image: r.reward_image || '/NFT-Logo.png',
        color: `hsl(${(idx * 120) % 360}, 70%, 60%)`,
        textColor: '#ffffff',
        percentage: Math.max(r.percentage || 0, 1), // Ensure minimum 1% for visibility
        price: r.reward_price || '100',
        mint: r.mint_address,
        isNFT: true,
      }));

      console.log(`✅ Loaded ${nftSegments.length} active NFT rewards from database for lootbox ${item.id}`);
      console.log('🎨 Active NFT rewards:', nftSegments.map(nft => `${nft.name} (${nft.percentage}%) - ${nft.mint?.slice(0, 8)}...`));
      
      return nftSegments;
    } catch (e) {
      console.warn('⚠️ Error loading NFT rewards:', e);
      return [];
    }
  }, [item.id]);

  // Sync deposited NFTs to database (run once on component mount)
  const syncNFTsToDatabase = useCallback(async () => {
    try {
      console.log("🔄 Syncing deposited NFTs to database...");
      
      // Import the NFT metadata fetcher
      const { fetchMultipleNFTMetadata, getDepositedNFTs } = await import("@/lib/nft-metadata");
      
      // Get mint addresses of deposited NFTs
      const mintAddresses = await getDepositedNFTs();
      console.log("📍 Found", mintAddresses.length, "deposited NFTs");
      
      if (mintAddresses.length === 0) {
        console.log("📦 No NFTs deposited in vault");
        return;
      }
      
      // Fetch metadata for all NFTs
      const nftMetadata = await fetchMultipleNFTMetadata(mintAddresses);
      console.log("✅ Loaded NFT metadata for", nftMetadata.length, "NFTs");
      
      // Get existing NFT rewards from DB to avoid duplicates
      const { data: existing, error: existingErr } = await supabase
        .from('nft_reward_percentages')
        .select('mint_address');
      
      if (existingErr) {
        console.warn('⚠️ Could not fetch existing NFT rewards:', existingErr);
        return;
      }
      
      const existingMints = new Set((existing || []).map((r: any) => r.mint_address));
      const toInsert = nftMetadata
        .filter(nft => !existingMints.has(nft.mint))
        .map(nft => ({
          reward_name: nft.name || 'NFT Reward',
          reward_image: nft.image || '/NFT-Logo.png',
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
          console.warn('⚠️ Failed to sync NFTs to database:', insertErr);
        } else {
          console.log(`✅ Synced ${toInsert.length} new NFTs to database`);
        }
      } else {
        console.log("✅ All NFTs already synced to database");
      }
      
      // Check which NFTs are in sidebar carts (won but not yet claimed)
      console.log("🔄 Checking for NFTs in sidebar carts...");
      
      // Get current project ID
      const projectId = typeof window !== 'undefined' 
        ? localStorage.getItem('currentProjectId') 
        : null;
      
      let cartQuery = supabase
        .from('prizeWin')
        .select('mint, userId, name, created_at')
        .eq('reward_type', 'nft')
        .eq('isWithdraw', false) // In cart but not yet claimed
        .not('mint', 'is', null);
      
      if (projectId) {
        cartQuery = cartQuery.eq('project_id', parseInt(projectId));
      }
      
      const { data: cartNFTs } = await cartQuery;
      
      const cartMints = new Set((cartNFTs || []).map(w => w.mint));
      console.log(`📋 Found ${cartMints.size} NFTs in sidebar carts:`, Array.from(cartMints));
      console.log('📋 Cart NFT details:', cartNFTs?.map(nft => `${nft.name} (${nft.mint?.slice(0, 8)}...) - User: ${nft.userId}`));
      
      // Sync NFT active status: In vault AND not in carts
      console.log("🔄 Syncing NFT active status...");
      const depositedMints = new Set(mintAddresses);
      console.log(`📍 Deposited mints: ${Array.from(depositedMints)}`);
      
      // Get all NFTs in database (active and inactive)
      const { data: allDBNFTs } = await supabase
        .from('nft_reward_percentages')
        .select('*')
        .not('mint_address', 'is', null);
      
      console.log(`📊 All NFTs in database: ${allDBNFTs?.length || 0}`);
      if (allDBNFTs) {
        console.log('📋 Database NFTs:', allDBNFTs.map(nft => `${nft.reward_name} (${nft.mint_address?.slice(0, 8)}...) - Active: ${nft.is_active}`));
        
        // Activate NFTs that are: in vault AND not in carts AND currently inactive
        const toActivate = allDBNFTs.filter(nft => 
          depositedMints.has(nft.mint_address) && 
          !cartMints.has(nft.mint_address) && 
          !nft.is_active
        );
        
        // Deactivate NFTs that are: (not in vault OR in carts) AND currently active
        const toDeactivate = allDBNFTs.filter(nft => 
          (!depositedMints.has(nft.mint_address) || cartMints.has(nft.mint_address)) && 
          nft.is_active
        );
        
        console.log('🔍 Analysis for each NFT:');
        allDBNFTs.forEach(nft => {
          const inVault = depositedMints.has(nft.mint_address);
          const inCart = cartMints.has(nft.mint_address);
          const shouldBeActive = inVault && !inCart;
          console.log(`  ${nft.reward_name}: InVault=${inVault}, InCart=${inCart}, ShouldBeActive=${shouldBeActive}, CurrentlyActive=${nft.is_active}`);
        });
        
        if (toActivate.length > 0) {
          console.log(`🔄 Activating ${toActivate.length} available NFTs:`, toActivate.map(n => n.reward_name));
          
          for (const nft of toActivate) {
            await supabase
              .from('nft_reward_percentages')
              .update({ is_active: true })
              .eq('id', nft.id);
          }
          
          console.log("✅ Activated available NFTs");
        }
        
        if (toDeactivate.length > 0) {
          console.log(`🔄 Deactivating ${toDeactivate.length} unavailable NFTs:`, toDeactivate.map(n => n.reward_name));
          
          for (const nft of toDeactivate) {
            await supabase
              .from('nft_reward_percentages')
              .update({ is_active: false })
              .eq('id', nft.id);
          }
          
          console.log("✅ Deactivated unavailable NFTs (not in vault or in carts)");
        }
        
        if (toActivate.length === 0 && toDeactivate.length === 0) {
          console.log("✅ All NFTs already have correct active status");
        }
      }
      
      // Update percentages for all active NFTs to ensure equal distribution
      const { data: allActiveNFTs } = await supabase
        .from('nft_reward_percentages')
        .select('*')
        .eq('is_active', true)
        .not('mint_address', 'is', null);
      
      if (allActiveNFTs && allActiveNFTs.length > 0) {
        const equalPercentage = 50 / allActiveNFTs.length; // 50% total for all NFTs
        console.log(`🔄 Updating ${allActiveNFTs.length} active NFTs to ${equalPercentage}% each`);
        
        for (const nft of allActiveNFTs) {
          await supabase
            .from('nft_reward_percentages')
            .update({ percentage: equalPercentage })
            .eq('id', nft.id);
        }
        
        console.log("✅ Updated all active NFT percentages for equal distribution");
      }
      
    } catch (error) {
      console.error("❌ Error syncing NFTs to database:", error);
    }
  }, []);

  // Load ALL active rewards from database (replaces original data)
  const loadAllActiveRewards = useCallback(async () => {
    try {
      console.log("🎯 Loading rewards from database for lootbox:", item.id);
      
      // Load token rewards for THIS specific lootbox (filter by product_id)
      const { data: tokenRewards, error: tokenError } = await supabase
        .from('token_reward_percentages')
        .select('*')
        .eq('is_active', true)
        .eq('product_id', item.id) // Filter by this specific lootbox
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

      console.log(`✅ Loaded ${databaseRewards.length} active rewards from database for lootbox ${item.id}:`, databaseRewards);
      return databaseRewards;
      
    } catch (error) {
      console.error("❌ Error loading active rewards:", error);
      return [];
    }
  }, [item.id]);

  // Load SOL rewards from backend (token_reward_percentages table where reward_name contains "SOL")
  const loadSolRewards = useCallback(async (): Promise<WheelItem[]> => {
    try {
      const { data: solRewards, error } = await supabase
        .from('token_reward_percentages')
        .select('*')
        .eq('is_active', true)
        .eq('product_id', item.id) // Filter by this specific lootbox
        .like('reward_name', '%SOL%');

      if (error) {
        console.warn('⚠️ Could not load SOL rewards from backend:', error);
        return [];
      }

      const mapped: WheelItem[] = (solRewards || []).map((r: any, idx: number) => ({
        id: 3000 + (r.id || idx),
        name: r.reward_name || `${r.reward_price} SOL`,
        image: getImageUrlFromPath(r.reward_image) || 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
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

      console.log(`✅ Loaded SOL rewards from backend for lootbox ${item.id}:`, mapped);
      return mapped;
    } catch (e) {
      console.warn('⚠️ Error loading SOL rewards:', e);
      return [];
    }
  }, [item.id]);

  // Load ITEM rewards from backend (token_reward_percentages table - NOT SOL, NOT NFT)
  const loadItemRewards = useCallback(async (): Promise<WheelItem[]> => {
    try {
      // Fetch all non-SOL token rewards for this lootbox
      const { data: allTokenRewards, error } = await supabase
        .from('token_reward_percentages')
        .select('*')
        .eq('is_active', true)
        .eq('product_id', item.id) // Filter by this specific lootbox
        .not('reward_name', 'ilike', '%SOL%');

      if (error) {
        console.warn('⚠️ Could not load token rewards from backend:', error);
        return [];
      }

      // Filter items: exclude NFTs (which have both collection and token_id)
      const itemRewards = (allTokenRewards || []).filter((r: any) => {
        const hasCollection = r.collection && r.collection.trim() !== '';
        const hasTokenId = r.token_id && r.token_id.toString().trim() !== '';
        // Item: doesn't have both collection AND token_id (not an NFT)
        return !(hasCollection && hasTokenId);
      });

      const mapped: WheelItem[] = itemRewards.map((r: any, idx: number) => {
        // Ensure reward_price is properly extracted and stored
        const rewardPrice = String(r.reward_price || r.price || '0').trim();
        const itemValue = parseFloat(rewardPrice) || 0;
        
        console.log(`📦 Loading item reward:`, {
          id: r.id,
          name: r.reward_name,
          reward_price: r.reward_price,
          parsed_itemValue: itemValue
        });
        
        return {
          id: 4000 + (r.id || idx),
          name: r.reward_name || 'Item',
          image: getImageUrlFromPath(r.reward_image) || '/default-item.png',
          color: `hsl(${(idx * 55 + 120) % 360}, 70%, 60%)`,
          textColor: '#ffffff',
          percentage: r.percentage || 0,
          price: rewardPrice,
          // @ts-ignore
          reward_type: 'item',
          isNFT: false,
          // @ts-ignore
          itemValue: rewardPrice, // Store as string for consistency
          // @ts-ignore
          itemValueNumber: itemValue, // Also store as number for direct use
        };
      });

      console.log(`✅ Loaded ITEM rewards from backend for lootbox ${item.id}:`, mapped);
      return mapped;
    } catch (e) {
      console.warn('⚠️ Error loading ITEM rewards:', e);
      return [];
    }
  }, [item.id]);

  // Backend-powered NFT activation
  const manuallyActivateDepositedNFTs = useCallback(async () => {
    try {
      console.log("🔧 Syncing NFT status with backend...");
      
      // Call backend API to get and sync NFT status
      const response = await fetch('/api/nft-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (!result.success) {
        console.error("❌ Backend NFT sync failed:", result.error);
        return;
      }
      
      console.log(`✅ Backend sync complete: ${result.availableNFTs.length} available NFTs`);
      console.log(`📊 Total deposited: ${result.totalDeposited}, Won: ${result.wonNFTs.length}`);
      
    } catch (error) {
      console.error("❌ Error syncing NFT status:", error);
    }
  }, []);

  useEffect(() => {
    // Load wheel data from database
    const loadWheelData = async () => {
      try {
        console.log("🎰 Loading wheel data from database...");
        console.log("👤 Current user ID:", user.id);
        
        setIsLoading(true);
        
        // First, sync NFTs to database (if not already synced)
        console.log("🔄 About to call syncNFTsToDatabase...");
        await syncNFTsToDatabase();
        console.log("✅ syncNFTsToDatabase completed");
        
        // Manual fallback to ensure deposited NFTs are active
        console.log("🔧 Running manual activation as fallback...");
        await manuallyActivateDepositedNFTs();
        console.log("✅ Manual activation completed");
        
        // Then load NFT, SOL, and ITEM segments from database
        const [nftSegments, solSegments, itemSegments] = await Promise.all([
          getNFTWheelSegments(),
          loadSolRewards(),
          loadItemRewards(),
        ]);

        console.log(`📊 Loaded ${nftSegments.length} NFT rewards, ${solSegments.length} SOL rewards, and ${itemSegments.length} ITEM rewards`);

        // Merge segments (percentages come from database)
        let merged = [...nftSegments, ...solSegments, ...itemSegments];

        if (merged.length === 0) {
          console.warn("⚠️ No active rewards found in database. Wheel will be empty.");
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
        
        console.log(`🎯 Wheel loaded with ${merged.length} total segments (${nftSegments.length} NFT + ${solSegments.length} SOL + ${itemSegments.length} ITEM)`);
        console.log("📊 Rewards:", merged.map(r => `${r.name}: ${r.percentage}%`));
        
        setIsLoading(false);
        
      } catch (error) {
        console.error("❌ Error loading wheel data:", error);
        // Set empty array if error
        setShuffledData([]);
        setIsLoading(false);
      }
    };
    
    loadWheelData();

    // Load wheel background image
    const loadWheelBgImage = async () => {
      try {
        // Pass project ID to fetch project-specific wheel settings
        const projectId = getProjectId();
        const wheelSettings = await getWheelSettings(projectId || undefined);
        if (wheelSettings?.backgroundImage) {
          const bgImageUrl = getImageUrl(wheelSettings.backgroundImage);
          if (bgImageUrl) {
            setWheelBgImage(bgImageUrl);
          }
        }
      } catch (error) {
        console.error('Error loading wheel background image:', error);
      }
    };

    loadWheelBgImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncNFTsToDatabase, getNFTWheelSegments, loadSolRewards]); // Load from database

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
        image: "/NFT-Logo.png",
        mint: "11111111111111111111111111111111",
        price: "100"
      };
    }
  }, []);

  // Add reward to cart function
  const addRewardToCart = useCallback(async (winnerItem: WheelItem) => {
    try {
      console.log("🎯 Adding reward to cart:", winnerItem);
      console.log("🎯 Winner item type check:", {
        isNFT: winnerItem.isNFT,
        hasMint: !!winnerItem.mint,
        mint: winnerItem.mint,
        name: winnerItem.name
      });
      
      // Check if this is a SOL reward
      if ((winnerItem as any).reward_type === 'sol' && (winnerItem as any).solAmount) {
        console.log("💰 Processing SOL reward:", (winnerItem as any).solAmount);
        
        // Generate a unique reward ID
        const rewardId = Date.now() % 1000000;
        
        console.log("📝 Inserting SOL reward into prizeWin table...");
        
        // Get current project ID
        const projectId = typeof window !== 'undefined' 
          ? localStorage.getItem('currentProjectId') 
          : null;
        
        // Add SOL reward to prizeWin table (for sidebar cart)
        const prizeWinData: any = {
          userId: user.id,
          name: `${(winnerItem as any).solAmount} SOL`,
          image: winnerItem.image,
          sol: (winnerItem as any).solAmount, // SOL amount
          isWithdraw: false,
          reward_type: 'sol', // Add reward type
          mint: null, // No mint for SOL rewards
          product_id: item.id, // Add the lootbox/product ID
          created_at: new Date().toISOString(),
        };
        
        // Add project_id if available
        if (projectId) {
          prizeWinData.project_id = parseInt(projectId);
        }
        
        const prizeWinResult = await supabase.from("prizeWin").insert(prizeWinData);

        if (prizeWinResult.error) {
          console.error("❌ Error inserting SOL reward into prizeWin:", prizeWinResult.error);
          throw prizeWinResult.error;
        }

        console.log("✅ Successfully inserted SOL reward into prizeWin:", prizeWinResult.data);
        console.log(`🎉 SOL reward added to cart: ${(winnerItem as any).solAmount} SOL`);
        
        // Automatically open sidebar cart to show the won reward
        setUser({ ...user, cart: true });
        console.log("🛒 Sidebar cart opened automatically for SOL reward");
        
      } else if (winnerItem.isNFT && winnerItem.mint) {
        console.log("🎨 Processing NFT reward:", winnerItem.name);
        
        // Add NFT reward to prizeWin table (for sidebar cart)
        console.log("📝 Inserting NFT into prizeWin table...");
        console.log("🎯 NFT data to insert:", {
          userId: user.id,
          name: winnerItem.name,
          image: winnerItem.image,
          sol: winnerItem.price,
          isWithdraw: false,
          reward_type: 'nft',
          mint: winnerItem.mint,
          product_id: item.id,
          created_at: new Date().toISOString(),
        });
        
        // Fetch NFT image from database if not available in winnerItem
        let nftImage = winnerItem.image;
        if (!nftImage && winnerItem.mint) {
          const { data: nftData } = await supabase
            .from('nft_reward_percentages')
            .select('reward_image')
            .eq('mint_address', winnerItem.mint)
            .single();
          
          if (nftData?.reward_image) {
            nftImage = nftData.reward_image;
            console.log("📸 Fetched NFT image from database:", nftImage);
          }
        }

        console.log("📝 NFT winner data:", {
          name: winnerItem.name,
          image: nftImage,
          mint: winnerItem.mint
        });

        // Get current project ID
        const projectId = typeof window !== 'undefined' 
          ? localStorage.getItem('currentProjectId') 
          : null;
        
        const prizeWinData: any = {
          userId: user.id,
          name: winnerItem.name,
          image: nftImage || '/NFT-Logo.png', // Use fetched image or fallback
          sol: winnerItem.price, // Keep as string to match varchar type
          isWithdraw: false, // Use correct field name from table
          reward_type: 'nft', // Add reward type
          mint: winnerItem.mint, // Add mint address
          product_id: item.id, // Add the lootbox/product ID
          created_at: new Date().toISOString(),
        };
        
        // Add project_id if available
        if (projectId) {
          prizeWinData.project_id = parseInt(projectId);
        }
        
        const prizeWinResult = await supabase.from("prizeWin").insert(prizeWinData);

        if (prizeWinResult.error) {
          console.error("❌ Error inserting NFT into prizeWin:", prizeWinResult.error);
          console.error("❌ Error details:", JSON.stringify(prizeWinResult.error, null, 2));
          throw prizeWinResult.error;
        }

        console.log("✅ Successfully inserted NFT into prizeWin:", prizeWinResult.data);
        console.log("✅ Insert result:", JSON.stringify(prizeWinResult.data, null, 2));
        
        // Mark NFT as won using backend API
        console.log("🔄 Marking NFT as won via backend...");
        try {
          const response = await fetch('/api/nft-status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              mint: winnerItem.mint,
              userId: user.id
            }),
          });
          
          const result = await response.json();
          
          if (!result.success) {
            console.error("❌ Backend NFT marking failed:", result.error);
          } else {
            console.log(`✅ NFT marked as won via backend: ${winnerItem.mint}`);
            console.log("🔄 Forcing wheel reload after NFT win...");
            
            // Reload wheel data after successful API call
            setTimeout(async () => {
              try {
                console.log("🔄 Reloading wheel data after NFT win...");
                setIsReloading(true);
                
                const nftSegments = await getNFTWheelSegments();
                const solSegments = await loadSolRewards();
                const itemSegments = await loadItemRewards();
                const merged = [...nftSegments, ...solSegments, ...itemSegments];
                
                if (merged.length === 0) {
                  setShuffledData([]);
                } else {
                  const totalPct = merged.reduce((s, r:any) => s + (Number(r.percentage) || 0), 0);
                  const normalized = totalPct <= 0.001
                    ? merged.map((r) => ({ ...r, percentage: 100 / merged.length }))
                    : merged;
                  const shuffled = normalized.sort(() => Math.random() - 0.5);
                  setShuffledData(shuffled);
                }
                
                console.log(`✅ Wheel reloaded with ${merged.length} segments after NFT win`);
                setIsReloading(false);
              } catch (error) {
                console.error("❌ Error reloading wheel after NFT win:", error);
                setIsReloading(false);
              }
            }, 500); // Wait 500ms after API success
          }
        } catch (error) {
          console.error("❌ Error calling backend API:", error);
          // Even if API fails, try to reload wheel
          setTimeout(async () => {
            try {
              console.log("🔄 Reloading wheel data after NFT win (API failed, but trying anyway)...");
              setIsReloading(true);
              
              const nftSegments = await getNFTWheelSegments();
              const solSegments = await loadSolRewards();
              const merged = [...nftSegments, ...solSegments];
              
              if (merged.length === 0) {
                setShuffledData([]);
              } else {
                const totalPct = merged.reduce((s, r:any) => s + (Number(r.percentage) || 0), 0);
                const normalized = totalPct <= 0.001
                  ? merged.map((r) => ({ ...r, percentage: 100 / merged.length }))
                  : merged;
                const shuffled = normalized.sort(() => Math.random() - 0.5);
                setShuffledData(shuffled);
              }
              
              console.log(`✅ Wheel reloaded with ${merged.length} segments after NFT win`);
              setIsReloading(false);
            } catch (reloadError) {
              console.error("❌ Error reloading wheel after NFT win:", reloadError);
              setIsReloading(false);
            }
          }, 1000);
        }
        
        console.log(`🎉 NFT reward added to cart: ${winnerItem.name} (Mint: ${winnerItem.mint})`);
        
        // Automatically open sidebar cart to show the won reward
        setUser({ ...user, cart: true });
        console.log("🛒 Sidebar cart opened automatically for NFT reward");
        
      } else if ((winnerItem as any).reward_type === 'item') {
        // Item rewards are NOT added to cart - they are immediately credited to token balance
        // This is handled in the spinWheel function after addRewardToCart
        console.log("🎁 Item reward won - will be credited immediately to token balance (not added to cart)");
        
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
            // Don't show alert - just log and skip adding to cart
            // The user still gets their spin result, just no NFT reward
            console.log("ℹ️ No NFTs available in vault for token reward. User still won the spin.");
            return;
          }
        } catch (error) {
          console.warn("⚠️ Could not verify random NFT in vault:", error);
          // Don't show alert - just log and skip
          console.log("ℹ️ Could not verify NFT availability. Skipping NFT reward addition.");
          return;
        }
        
        // Generate a unique reward ID
        const rewardId = Date.now() % 1000000;
        
        console.log("📝 Inserting into prizeWin table...");
        
        // Get current project ID
        const projectId = typeof window !== 'undefined' 
          ? localStorage.getItem('currentProjectId') 
          : null;
        
        // Add reward to prizeWin table (for sidebar cart)
        const prizeWinData: any = {
          userId: user.id,
          name: randomNFT.name,
          image: randomNFT.image,
          sol: randomNFT.price, // Keep as string to match varchar type
          isWithdraw: false, // Use correct field name from table
          reward_type: 'nft', // Add reward type
          mint: randomNFT.mint, // Add mint address for token rewards too
          product_id: item.id, // Add the lootbox/product ID
          created_at: new Date().toISOString(),
        };
        
        // Add project_id if available
        if (projectId) {
          prizeWinData.project_id = parseInt(projectId);
        }
        
        const prizeWinResult = await supabase.from("prizeWin").insert(prizeWinData);

        if (prizeWinResult.error) {
          console.error("❌ Error inserting into prizeWin:", prizeWinResult.error);
          throw prizeWinResult.error;
        }

        console.log("✅ Successfully inserted into prizeWin:", prizeWinResult.data);
        console.log(`🎉 NFT reward added to cart: ${randomNFT.name} (Mint: ${randomNFT.mint})`);
        
        // Automatically open sidebar cart to show the won reward
        setUser({ ...user, cart: true });
        console.log("🛒 Sidebar cart opened automatically for token/item reward");
      }

    } catch (error) {
      console.error("❌ Error adding reward to cart:", error);
      alert(`Error adding reward to cart: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, item.id, setUser]); // Only include essential dependencies

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
      // Get current project ID
      const projectId = typeof window !== 'undefined' 
        ? localStorage.getItem('currentProjectId') 
        : null;
      
      if (!projectId) {
        console.error("No project ID available for balance update");
        alert("Project context not available. Please refresh the page.");
        return;
      }

      // Verify user has a valid ID
      if (!user.id) {
        console.error("User ID is missing. Cannot update balance.");
        alert("User session error. Please refresh the page and try again.");
        return;
      }

      // Use project_users table for multi-tenant support
      const { data: updatedUser, error: updateError } = await supabase
        .from("project_users")
        .update({ apes: user.apes - price })
        .eq("id", user.id)
        .eq("project_id", parseInt(projectId)) // Ensure we're updating the correct project's user
        .select(); // Select to verify the update
      
      if (updateError) {
        console.error("Error updating user balance:", updateError);
        throw updateError;
      }
      
      if (!updatedUser || updatedUser.length === 0) {
        console.error("No user found to update. User ID:", user.id, "Project ID:", projectId);
        alert("User not found. Please refresh the page and try again.");
        return;
      }
      
      // Update local state with the new balance from database
      const newBalance = updatedUser[0].apes;
      setUser({ ...user, apes: newBalance });
      console.log(`✅ Deducted ${price} tokens. Old balance: ${user.apes}, New balance: ${newBalance}`);
    } catch (e) {
      console.error("Update error", e);
      alert("Failed to deduct tokens. Please try again.");
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
      console.log("🎯 Winner determined:", winnerItem);
      console.log("🎯 Winner isNFT:", winnerItem?.isNFT);
      console.log("🎯 Winner mint:", winnerItem?.mint);
      console.log("🎯 Winner reward_type:", (winnerItem as any)?.reward_type);
      console.log("🎯 Winner itemValue:", (winnerItem as any)?.itemValue);
      console.log("🎯 Winner price:", winnerItem?.price);
      console.log("🎯 Full winner item object:", JSON.stringify(winnerItem, null, 2));
      
      setWinner(winnerItem);
      setShowWinnerDialog(true);
      setIsSpinning(false);

      // Item rewards are NOT added to cart - they are immediately credited to token balance
      // Only add to cart if it's NOT an item reward
      if ((winnerItem as any).reward_type !== 'item') {
        console.log("🎯 About to call addRewardToCart with:", winnerItem);
        console.log("🎯 Winner item details:", {
          name: winnerItem.name,
          isNFT: winnerItem.isNFT,
          mint: winnerItem.mint,
          price: winnerItem.price,
          image: winnerItem.image
        });
        await addRewardToCart(winnerItem);
        console.log("✅ addRewardToCart completed");
      } else {
        console.log("🎁 Item reward - skipping cart, will credit tokens directly");
      }

      // Reward payout for ITEM rewards - credit user's offchain token balance immediately (project-specific token)
      if ((winnerItem as any).reward_type === 'item') {
        // Extract item value - try multiple sources in order of preference
        const itemValueNumber = (winnerItem as any).itemValueNumber; // Direct number if available
        const itemValueStr = (winnerItem as any).itemValue || winnerItem?.price || '0';
        const rewardAmount = itemValueNumber || parseFloat(String(itemValueStr)) || 0;
        const projectTokenSymbol = getProjectTokenSymbol();
        const projectId = getProjectId();
        
        console.log(`🎁 Processing ITEM reward:`);
        console.log(`   - Winner item:`, winnerItem);
        console.log(`   - itemValue (string):`, (winnerItem as any).itemValue);
        console.log(`   - itemValueNumber (number):`, (winnerItem as any).itemValueNumber);
        console.log(`   - price:`, winnerItem?.price);
        console.log(`   - Final parsed rewardAmount:`, rewardAmount);
        console.log(`   - Token symbol:`, projectTokenSymbol);
        console.log(`   - Current user balance:`, user.apes);
        console.log(`   - Spin price:`, price);
        console.log(`   - Calculation: ${user.apes} - ${price} + ${rewardAmount} = ${user.apes - price + rewardAmount}`);
        
        if (rewardAmount <= 0) {
          console.error(`❌ Invalid reward amount: ${rewardAmount}. Item value not found!`);
          console.error(`   - Checked itemValue:`, (winnerItem as any).itemValue);
          console.error(`   - Checked itemValueNumber:`, (winnerItem as any).itemValueNumber);
          console.error(`   - Checked price:`, winnerItem?.price);
          return;
        }
        
        try {
          // Get current project ID for multi-tenant support
          const isMainProject = !projectId;
          
          // Update user's token balance in project_users table
          const newBalance = user.apes - price + rewardAmount;
          let updateQuery = supabase
            .from("project_users")
            .update({ apes: newBalance })
            .eq("id", user.id);
          
          // Filter by project_id if it's a sub-project
          if (!isMainProject && projectId) {
            updateQuery = updateQuery.eq("project_id", parseInt(projectId.toString()));
          } else if (isMainProject) {
            // For main project, try to find user with project_id IS NULL
            updateQuery = updateQuery.is("project_id", null);
          }
          
          const { data: updatedUser, error: updateError } = await updateQuery.select();
          
          if (updateError || !updatedUser || updatedUser.length === 0) {
            console.error("❌ Error updating user balance for item reward:", updateError);
            console.error("   - Update query details:", { isMainProject, projectId, userId: user.id, newBalance });
            // Try fallback without project_id filter for main project
            if (isMainProject) {
              const fallbackQuery = supabase
                .from("project_users")
                .update({ apes: newBalance })
                .eq("id", user.id)
                .select();
              const fallbackResult = await fallbackQuery;
              if (fallbackResult.data && fallbackResult.data.length > 0) {
                const updatedBalance = fallbackResult.data[0].apes;
                setUser({ ...user, apes: updatedBalance });
                console.log(`✅ Item reward credited (fallback): ${rewardAmount} ${projectTokenSymbol}. New balance: ${updatedBalance}`);
              } else {
                console.error("❌ Fallback update also failed:", fallbackResult.error);
              }
            }
          } else {
            const updatedBalance = updatedUser[0].apes;
            setUser({ ...user, apes: updatedBalance });
            console.log(`✅ Item reward credited: ${rewardAmount} ${projectTokenSymbol}. New balance: ${updatedBalance}`);
          }
        } catch (e) {
          console.error("❌ Item reward update failed:", e);
        }
      }
      
      // Reward payout (OGX tokens automatically added) - only for OGX token rewards, NOT NFTs or ITEMs
      if ((winnerItem as any).reward_type === 'ogx') {
        const rewardAmount = Number(winnerItem?.price);
        try {
          await supabase.from("user").update({ apes: user.apes - price + rewardAmount }).eq("id", user.id);
          setUser({ ...user, apes: user.apes - price + rewardAmount });
        } catch (e) {
          console.error("Reward update failed", e);
        }
      }
      // Note: NFT and SOL rewards are handled in addRewardToCart() - no tokens should be added for NFTs/SOL

      // Jackpot system integration
      try {
        console.log("🎰 Checking for jackpot win...");
        
        // Auto-contribute to jackpots
        // Pass projectId for sub-projects (main project would be null, but this is sub-project route)
        const projectId = getProjectId();
        const projectIdForJackpot = projectId ? projectId : null;
        const contribution = await JackpotService.autoContributeFromSpin(user.id, price, undefined, projectIdForJackpot);
        if (contribution.contributed) {
          console.log(`💰 Contributed to ${contribution.contributions} jackpot pools`);
        }
        
        // Check for jackpot win
        // Pass projectId for sub-projects
        const jackpotResult = await JackpotService.checkJackpotWin(user.id, price, projectIdForJackpot);
        if (jackpotResult.won && jackpotResult.pool && jackpotResult.winAmount) {
          console.log(`🎉 JACKPOT WIN! ${jackpotResult.winAmount} SOL from ${jackpotResult.pool.name}`);
          
          // Check if prize is an item (not an NFT)
          // Item: image is a file path (contains '/' or '.') or item_price is set
          // NFT: image is a mint address (32-44 chars, no '/' or '.')
          const poolImage = jackpotResult.pool.image;
          const isNFTMint = poolImage && 
                           typeof poolImage === 'string' && 
                           poolImage.length >= 32 && 
                           poolImage.length <= 44 && 
                           !poolImage.includes('/') &&
                           !poolImage.includes('.');
          const isItemPrize = !isNFTMint && jackpotResult.pool.item_price;
          
          let tokenAmount = 0;
          if (isItemPrize && jackpotResult.pool.item_price) {
            // Item prize: credit item_price in OGX/tokens
            tokenAmount = jackpotResult.pool.item_price || 0;
            console.log(`🎁 Item prize: Crediting ${tokenAmount} OGX/tokens (item_price)`);
          } else {
            // NFT or SOL prize: convert SOL to OGX (legacy behavior)
            tokenAmount = jackpotResult.winAmount * 1000; // 1 SOL = 1000 OGX
            console.log(`💰 NFT/SOL prize: Crediting ${tokenAmount} OGX (converted from ${jackpotResult.winAmount} SOL)`);
          }
          
          const newBalance = (user.apes || 0) + tokenAmount;
          
          // Update balance in project_users table for sub-projects
          const projectId = getProjectId();
          if (projectId) {
            await supabase
              .from("project_users")
              .update({ apes: newBalance })
              .eq("id", user.id)
              .eq("project_id", projectId);
          } else {
            // Fallback to user table if no project_id
            await supabase.from("user").update({ apes: newBalance }).eq("id", user.id);
          }
          
          setUser({ ...user, apes: newBalance });
          
          // Show jackpot win announcement
          setJackpotWin({
            pool: jackpotResult.pool,
            amount: jackpotResult.winAmount,
            ogxEquivalent: tokenAmount
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
      {isLoading && (
       <Loader />
      )}
      
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
            backgroundImage: `url(${wheelBgImage || '/bg.jpg'})`,
            backgroundSize: "cover",
            backgroundPosition: "center"
          }} />

          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-30">
            <div 
              className="w-4 md:h-12 h-8" 
              style={{
                backgroundColor: 'var(--wheel-pointer, #f74e14)',
                clipPath: "polygon(0 100%, 100% 100%, 50% 0)",
                transform: "rotate(180deg)"
              }} 
            />
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
                    <path 
                      d={pathData} 
                      fill="var(--wheel-segment-fill, #ff914d)" 
                      stroke="var(--wheel-segment-stroke, #f74e14)" 
                      strokeWidth="0.5" 
                    />
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
                      fill="var(--wheel-text, #ffffff)"
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
                      fill="var(--wheel-text, #ffffff)"
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
          disabled={isSpinning || isLoading}
          className={`mt-10 px-2 py-1 rounded font-bold transition-all duration-200 ${
            isSpinning || isLoading 
              ? 'bg-gray-500 cursor-not-allowed' 
              : ''
          } text-white`}
          style={{
            backgroundColor: isSpinning || isLoading ? undefined : 'var(--wheel-button-bg, #f74e14)'
          }}
          onMouseEnter={(e) => {
            if (!isSpinning && !isLoading) {
              e.currentTarget.style.backgroundColor = 'var(--wheel-button-hover, #e63900)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSpinning && !isLoading) {
              e.currentTarget.style.backgroundColor = 'var(--wheel-button-bg, #f74e14)';
            }
          }}
        >
          {isSpinning ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>SPINNING...</span>
            </div>
          ) : (
            `SPIN FOR ${item?.price} OGX`
          )}
        </button>
        <button
          onClick={handleFreeTry}
          disabled={isSpinning || isLoading}
          className={`mt-4 px-4 py-2 rounded font-bold transition-all duration-200 ${
            isSpinning || isLoading 
              ? 'text-gray-500 cursor-not-allowed' 
              : ''
          }`}
          style={{
            color: isSpinning || isLoading ? undefined : 'var(--wheel-button-bg, #f74e14)'
          }}
          onMouseEnter={(e) => {
            if (!isSpinning && !isLoading) {
              e.currentTarget.style.color = 'var(--wheel-button-hover, #e63900)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSpinning && !isLoading) {
              e.currentTarget.style.color = 'var(--wheel-button-bg, #f74e14)';
            }
          }}
        >
          {isSpinning ? 'SPINNING...' : 'TRY FOR FREE'}
        </button>
      </div>
      )}

      {showWinnerDialog && winner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div 
            className="bg-white rounded-xl p-6 w-[90%] max-w-lg border-2" 
            style={{ borderColor: 'var(--wheel-button-bg, #f74e14)' }}
          >
            <div className="text-end text-black cursor-pointer" onClick={resetWheel}>X</div>
            <div className="text-center">
              <h2 
                className="text-2xl font-bold mb-4"
                style={{ color: 'var(--wheel-button-bg, #f74e14)' }}
              >
                Congratulations!
              </h2>
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
                    className="px-6 py-2 border-2 rounded-lg transition-colors"
                    style={{
                      borderColor: 'var(--wheel-button-bg, #f74e14)',
                      color: 'var(--wheel-button-bg, #f74e14)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--wheel-button-bg, #f74e14)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '';
                      e.currentTarget.style.color = 'var(--wheel-button-bg, #f74e14)';
                    }}
                  >
                    Spin Again
                  </button>
                ) : (
                <button
                  onClick={resetWheel}
                  className="px-6 py-2 border-2 rounded-lg transition-colors"
                  style={{
                    borderColor: 'var(--wheel-button-bg, #f74e14)',
                    color: 'var(--wheel-button-bg, #f74e14)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--wheel-button-bg, #f74e14)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '';
                    e.currentTarget.style.color = 'var(--wheel-button-bg, #f74e14)';
                  }}
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
                  className="px-4 sm:px-6 py-2 text-white rounded-lg transition-colors text-sm sm:text-base font-medium"
                  style={{
                    backgroundColor: 'var(--wheel-button-bg, #f74e14)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--wheel-button-hover, #e63900)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--wheel-button-bg, #f74e14)';
                  }}
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
