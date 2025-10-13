"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { fetchMultipleNFTMetadata, getDepositedNFTs } from "@/lib/nft-metadata";
import Loader from "@/app/Components/Loader";

interface NFTMetadata {
  name: string;
  image: string;
  description: string;
  mint: string;
  symbol: string;
  attributes: any[];
  percentage?: number;
}

interface SOLReward {
  id: number;
  name: string;
  image: string;
  solAmount: number;
  percentage: number;
  color: string;
}

/**
 * DepositedNFTs Component
 * 
 * Displays the actual NFTs deposited in the vault in the "Loot In the Box" section
 */
export default function DepositedNFTs() {
  const [nfts, setNfts] = useState<NFTMetadata[]>([]);
  const [solRewards, setSolRewards] = useState<SOLReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDepositedNFTs = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log("🎨 Loading deposited NFTs and SOL rewards...");
        
        // Get mint addresses of deposited NFTs
        const mintAddresses = await getDepositedNFTs();
        console.log("📍 Mint addresses:", mintAddresses);
        
        // Fetch metadata for all NFTs
        const nftMetadata = await fetchMultipleNFTMetadata(mintAddresses);
        console.log("✅ Loaded NFT metadata:", nftMetadata);
        
        // Load NFT reward percentages from database
        const { supabase } = await import("@/service/supabase");
        const { data: nftRewards, error: nftRewardError } = await supabase
          .from('nft_reward_percentages')
          .select('*')
          .eq('is_active', true);
        
        if (nftRewardError) {
          console.warn('⚠️ Could not load NFT reward percentages from database:', nftRewardError);
        }
        
        // Merge NFT metadata with database percentages
        const nftsWithPercentages = nftMetadata.map(nft => {
          const dbReward = nftRewards?.find((reward: any) => reward.mint_address === nft.mint);
          return {
            ...nft,
            percentage: dbReward?.percentage || Math.round(100 / nftMetadata.length) // Fallback to equal distribution
          };
        });
        
        console.log("✅ Loaded NFTs with percentages:", nftsWithPercentages);
        setNfts(nftsWithPercentages);
        
        // Load SOL rewards from database
        const { data: solRewards, error: solError } = await supabase
          .from('token_reward_percentages')
          .select('*')
          .eq('is_active', true)
          .like('reward_name', '%SOL%');

        if (solError) {
          console.warn('⚠️ Could not load SOL rewards from database:', solError);
          setSolRewards([]);
        } else {
          const mappedSolRewards: SOLReward[] = (solRewards || []).map((r: any, idx: number) => ({
            id: r.id || (3000 + idx),
            name: r.reward_name || `${r.reward_price} SOL`,
            image: r.reward_image || 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
            solAmount: Number(r.reward_price || 0),
            percentage: r.percentage || 0,
            color: `hsl(${(idx * 55 + 220) % 360}, 70%, 60%)`,
          }));
          
          console.log("✅ Loaded SOL rewards from database:", mappedSolRewards);
          setSolRewards(mappedSolRewards);
        }
        
      } catch (err) {
        console.error("❌ Error loading deposited NFTs:", err);
        setError(err instanceof Error ? err.message : "Failed to load NFTs");
      } finally {
        setLoading(false);
      }
    };

    loadDepositedNFTs();
  }, []);

  if (loading) {
    return <Loader />;
}

  if (error) {
    return (
      <div className="w-full px-4">
        <div className="text-center text-red-300 py-8">
          <p className="text-lg font-bold">❌ Error Loading NFTs</p>
          <p className="text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // if (nfts.length === 0 && solRewards.length === 0) {
  //   return (
  //     <div className="w-full px-4">
  //       <div className="text-center text-white/60 py-8">
  //         <div className="mb-4">
  //           <svg className="mx-auto h-16 w-16 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  //             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  //           </svg>
  //         </div>
  //         <p className="text-xl font-bold mb-2">📦 No Rewards Available Yet</p>
  //         <p className="text-sm mb-4">The vault is currently empty</p>
  //         <div className="bg-orange-500/20 border border-orange-300/30 rounded-lg p-4 max-w-md mx-auto">
  //           <p className="text-sm font-medium mb-2">To deposit NFTs:</p>
  //           <ol className="text-xs text-left space-y-1">
  //             <li>1. Connect your wallet</li>
  //             <li>2. Use the deposit function</li>
  //             <li>3. Transfer NFTs to the vault</li>
  //             <li>4. They&apos;ll appear here automatically!</li>
  //           </ol>
  //         </div>
  //         <div className="mt-4 text-xs text-white/40">
  //           <p>Debug: Check browser console for vault query logs</p>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="w-full px-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-5">
        {/* Display NFT rewards */}
        {nfts.map((nft, index) => (
          <div
            key={nft.mint}
            className="h-48 bg-white border border-orange-300 rounded-lg shadow-md text-orange-800 flex flex-col items-center
                     transition-all duration-300 hover:shadow-lg group overflow-hidden"
            style={{ minWidth: '14.8vw' }}
          >
            {/* Header with NFT symbol */}
            <div className="box-header flex justify-between w-full items-center p-2">
              <div className="font-bold text-center  text-sm text-orange-800 flex justify-center items-center">
                <svg width="30" height="30" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 256 256" xmlSpace="preserve">
                  <style>{`.st0{fill:#3a312a}.st2{fill:#87796f}.st48{fill:#d4db56}`}</style>
                  <path className="st2" d="m207.199 31.647-80.357-16.262a19.365 19.365 0 0 0-7.682 0L38.801 31.647c-9.8 1.983-16.479 11.101-15.414 21.042l5.591 52.223 1.513 14.137.516 4.819a136.456 136.456 0 0 0 72.102 106.215 42.694 42.694 0 0 0 39.783 0 136.458 136.458 0 0 0 72.102-106.215l7.62-71.178c1.063-9.943-5.616-19.06-15.415-21.043z"/>
                  <path className="st0" d="m207.496 30.176-80.357-16.262a20.745 20.745 0 0 0-8.277 0L38.504 30.176c-10.622 2.15-17.762 11.897-16.609 22.672l5.591 52.223a1.509 1.509 0 0 0 1.651 1.332 1.5 1.5 0 0 0 1.332-1.651l-5.591-52.223a17.788 17.788 0 0 1 14.22-19.413l80.358-16.262a17.77 17.77 0 0 1 7.088 0l80.357 16.262a17.788 17.788 0 0 1 14.22 19.413l-7.62 71.178c-4.794 44.79-31.452 84.06-71.309 105.048a41.182 41.182 0 0 1-38.386 0c-39.857-20.988-66.515-60.258-71.309-105.048l-.516-4.818a1.5 1.5 0 0 0-2.983.319l.516 4.818c4.901 45.785 32.151 85.928 72.895 107.383a44.168 44.168 0 0 0 41.181 0c40.743-21.455 67.993-61.598 72.895-107.383l7.62-71.178c1.153-10.775-5.987-20.522-16.609-22.672z"/>
                  <path d="m191.12 49.473-26.822-5.428-13.488-2.729-24.703-4.999a15.668 15.668 0 0 0-6.215 0L54.88 49.473c-7.928 1.604-13.332 8.981-12.471 17.024l6.165 57.586a110.403 110.403 0 0 0 58.333 85.933 34.541 34.541 0 0 0 32.186 0 110.4 110.4 0 0 0 58.333-85.933l6.165-57.586c.861-8.043-4.542-15.419-12.471-17.024z" style={{fill:"#ed6e7a"}}/>
                  <path className="st0" d="m191.417 48.003-26.822-5.428a1.5 1.5 0 1 0-.595 2.941l26.822 5.428a14.104 14.104 0 0 1 11.276 15.394l-6.164 57.586c-3.869 36.141-25.38 67.829-57.541 84.766a33.032 33.032 0 0 1-30.789 0c-32.161-16.936-53.671-48.624-57.541-84.765L43.9 66.337a14.106 14.106 0 0 1 11.277-15.394l65.012-13.157a14.11 14.11 0 0 1 5.621 0l24.703 5a1.5 1.5 0 1 0 .595-2.941l-24.703-5a17.085 17.085 0 0 0-6.81 0L54.583 48.003a17.095 17.095 0 0 0-13.666 18.654l6.164 57.586c3.976 37.137 26.079 69.698 59.127 87.101A35.998 35.998 0 0 0 123 215.496a36.01 36.01 0 0 0 16.792-4.153c33.047-17.402 55.15-49.963 59.127-87.1l6.164-57.586a17.092 17.092 0 0 0-13.666-18.654z"/>
                  <text x="118" y="130" textAnchor="middle" fontSize="62" fill="white" fontWeight="bold" className="text-orange-800">
                    {nft.symbol}
                  </text>
                </svg>
              </div>
              
              {/* Percentage badge */}
              <svg height="30px" width="30px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 256 256" xmlSpace="preserve">
                <style>{`.st0{fill:#3a312a}.st1{fill:#d6df58}.st2{fill:#87796f}.st13{fill:#8ac2d9}`}</style>
                <path className="st2" d="M222.394 16.135H33.605c-9.447 0-17.105 7.658-17.105 17.106V163.53c0 9.447 7.658 17.105 17.105 17.105h188.789c9.447 0 17.106-7.658 17.106-17.105V33.241c0-9.447-7.658-17.106-17.106-17.106z"/>
                <path className="st0" d="M222.394 14.636H33.605C23.346 14.636 15 22.982 15 33.241V163.53c0 10.259 8.346 18.605 18.605 18.605h188.789c10.259 0 18.606-8.347 18.606-18.605V33.241c0-10.259-8.347-18.605-18.606-18.605zM238 163.53c0 8.604-7.001 15.605-15.606 15.605H33.605C25 179.136 18 172.135 18 163.53V33.241c0-8.604 7-15.605 15.605-15.605h188.789c8.605 0 15.606 7.001 15.606 15.605V163.53z"/>
                <path className="st1" d="M214.969 28.635H41.031c-6.583 0-11.92 5.337-11.92 11.92v115.66c0 6.583 5.337 11.92 11.92 11.92h173.938c6.583 0 11.92-5.336 11.92-11.92V40.555c0-6.583-5.337-11.92-11.92-11.92z" style={{fill:"rgb(237, 110, 122)"}}/>
                <path className="st0" d="M214.969 27.136H99.798a1.5 1.5 0 1 0 0 3h115.171c5.745 0 10.42 4.675 10.42 10.42v115.66c0 5.745-4.675 10.42-10.42 10.42H41.031c-5.746 0-10.42-4.675-10.42-10.42V40.556c0-5.745 4.674-10.42 10.42-10.42h45.17a1.5 1.5 0 1 0 0-3h-45.17c-7.4 0-13.42 6.021-13.42 13.42v115.66c0 7.399 6.02 13.42 13.42 13.42h173.938c7.399 0 13.42-6.021 13.42-13.42V40.556c0-7.4-6.021-13.42-13.42-13.42z"/>
                <path className="st2" d="M113.688 180.635h28.625v35.593h-28.625z"/>
                <path className="st0" d="M142.313 179.136h-28.625a1.5 1.5 0 0 0-1.5 1.5v35.593a1.5 1.5 0 0 0 1.5 1.5h28.625a1.5 1.5 0 0 0 1.5-1.5v-35.593a1.5 1.5 0 0 0-1.5-1.5zm-1.5 35.593h-25.625v-32.593h25.625v32.593z"/>
                <path className="st2" d="M148.296 216.229h-40.593c-12.927 0-23.407 10.479-23.407 23.407h87.406c.001-12.928-10.478-23.407-23.406-23.407z"/>
                <path className="st0" d="M148.296 214.729h-40.592c-13.733 0-24.907 11.173-24.907 24.907a1.5 1.5 0 0 0 1.5 1.5h37.584a1.5 1.5 0 1 0 0-3H85.848c.773-11.383 10.281-20.407 21.856-20.407h40.592c11.575 0 21.083 9.024 21.856 20.407h-34.701a1.5 1.5 0 0 0 0 3h36.252a1.5 1.5 0 0 0 1.5-1.5c0-13.735-11.173-24.907-24.907-24.907z"/>
                <path className="st1" d="M47.671 203.469c-.974 11.564-13.025 13.39-13.025 13.39 10.346.487 12.925 14.059 12.925 14.059.221-9.677 13.321-14.202 13.321-14.202-9.813-.587-13.221-13.247-13.221-13.247z"/>
                <path className="st0" d="M60.982 215.219c-8.604-.515-11.831-12.024-11.863-12.141a1.513 1.513 0 0 0-1.583-1.102 1.5 1.5 0 0 0-1.359 1.367c-.86 10.215-11.313 11.963-11.755 12.031a1.5 1.5 0 0 0 .154 2.982c9.028.426 11.499 12.719 11.523 12.844a1.5 1.5 0 0 0 2.973-.248c.195-8.509 12.192-12.777 12.313-12.819a1.5 1.5 0 0 0-.403-2.914zm-13.565 10.345c-1.356-3.131-3.709-6.908-7.587-8.877 2.931-1.404 6.409-3.913 8.202-8.272 1.551 3.071 4.199 6.88 8.334 8.723-3.008 1.639-6.923 4.405-8.949 8.426z"/>
                <path className="st1" d="M25.972 220.45c-.689 8.179-9.212 9.471-9.212 9.471 7.318.344 9.142 9.944 9.142 9.944.156-6.845 9.422-10.045 9.422-10.045-6.941-.416-9.352-9.37-9.352-9.37z"/>
                <path className="st0" d="M35.414 228.322c-5.766-.345-7.972-8.186-7.994-8.265a1.5 1.5 0 0 0-2.942.266c-.579 6.87-7.646 8.066-7.942 8.113a1.5 1.5 0 0 0 .155 2.982c6.035.284 7.723 8.644 7.739 8.726a1.5 1.5 0 0 0 2.973-.246c.131-5.708 8.332-8.633 8.413-8.661a1.5 1.5 0 0 0-.402-2.915zm-9.585 6.795c-.924-1.886-2.339-3.947-4.447-5.28 1.856-1.041 3.697-2.629 4.87-4.916 1.057 1.874 2.654 3.955 4.941 5.224-1.849 1.1-3.987 2.74-5.364 4.972z"/>
                <path className="st1" d="M25.972 193.792c-.689 8.179-9.212 9.47-9.212 9.47 7.318.345 9.142 9.944 9.142 9.944.156-6.844 9.422-10.045 9.422-10.045-6.941-.414-9.352-9.369-9.352-9.369z"/>
                <path className="st0" d="M35.414 201.665c-5.766-.345-7.972-8.187-7.994-8.266a1.5 1.5 0 0 0-2.942.266c-.579 6.871-7.646 8.066-7.942 8.113a1.5 1.5 0 0 0 .154 2.982c6.036.284 7.724 8.645 7.739 8.727a1.5 1.5 0 0 0 2.973-.246c.131-5.709 8.332-8.633 8.413-8.661a1.5 1.5 0 0 0-.401-2.915zm-9.585 6.794c-.924-1.885-2.34-3.947-4.447-5.279 1.856-1.041 3.697-2.63 4.87-4.916 1.057 1.873 2.654 3.954 4.941 5.224-1.849 1.1-3.988 2.74-5.364 4.971z"/>
                <text x="128" y="120" textAnchor="middle" fontSize="59" fill="white" fontWeight="bold" className="text-orange-800">
                  {nft.percentage || Math.round(100 / nfts.length)}%
                </text>
              </svg>
            </div>
            
            {/* NFT Image */}
            <div className="w-24 md:h-24 h-16 group-hover:scale-105 transition-transform duration-300 ml-0">
              <Image
                src={nft.image}
                alt={nft.name}
                width={250}
                height={150}
                className="object-contain drop-shadow-md rounded-lg"
                onError={(e) => {
                  // Fallback to default image if NFT image fails to load
                  e.currentTarget.src = "/default-nft.png";
                }}
              />
            </div>

            {/* NFT Name */}
            <div className="mt-2 reward font-bold text-center relative bottom-7 w-full py-2 text-xs rounded-lg  flex justify-center items-center gap-2 md:-top-1 top-11">
              <span className="truncate max-w-full px-2">
                {nft.name}
              </span>
            </div>
          </div>
        ))}
        
        {/* Display SOL rewards */}
        {solRewards.map((solReward, index) => (
          <div
            key={solReward.id}
            className="h-48 bg-white border border-orange-300 rounded-lg shadow-md text-orange-800 flex flex-col items-center
                     transition-all duration-300 hover:shadow-lg group overflow-hidden"
            style={{ minWidth: '14.8vw' }}
          >
            {/* Header with SOL symbol */}
            <div className="box-header flex justify-between w-full items-center p-2">
              <div className="font-bold text-center text-sm text-orange-800 flex justify-center items-center">
                <svg width="30" height="30" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 256 256" xmlSpace="preserve">
                  <style>{`.st0{fill:#3a312a}.st2{fill:#87796f}.st48{fill:#d4db56}`}</style>
                  <path className="st2" d="m207.199 31.647-80.357-16.262a19.365 19.365 0 0 0-7.682 0L38.801 31.647c-9.8 1.983-16.479 11.101-15.414 21.042l5.591 52.223 1.513 14.137.516 4.819a136.456 136.456 0 0 0 72.102 106.215 42.694 42.694 0 0 0 39.783 0 136.458 136.458 0 0 0 72.102-106.215l7.62-71.178c1.063-9.943-5.616-19.06-15.415-21.043z"/>
                  <path className="st0" d="m207.496 30.176-80.357-16.262a20.745 20.745 0 0 0-8.277 0L38.504 30.176c-10.622 2.15-17.762 11.897-16.609 22.672l5.591 52.223a1.509 1.509 0 0 0 1.651 1.332 1.5 1.5 0 0 0 1.332-1.651l-5.591-52.223a17.788 17.788 0 0 1 14.22-19.413l80.358-16.262a17.77 17.77 0 0 1 7.088 0l80.357 16.262a17.788 17.788 0 0 1 14.22 19.413l-7.62 71.178c-4.794 44.79-31.452 84.06-71.309 105.048a41.182 41.182 0 0 1-38.386 0c-39.857-20.988-66.515-60.258-71.309-105.048l-.516-4.818a1.5 1.5 0 0 0-2.983.319l.516 4.818c4.901 45.785 32.151 85.928 72.895 107.383a44.168 44.168 0 0 0 41.181 0c40.743-21.455 67.993-61.598 72.895-107.383l7.62-71.178c1.153-10.775-5.987-20.522-16.609-22.672z"/>
                  <path d="m191.12 49.473-26.822-5.428-13.488-2.729-24.703-4.999a15.668 15.668 0 0 0-6.215 0L54.88 49.473c-7.928 1.604-13.332 8.981-12.471 17.024l6.165 57.586a110.403 110.403 0 0 0 58.333 85.933 34.541 34.541 0 0 0 32.186 0 110.4 110.4 0 0 0 58.333-85.933l6.165-57.586c.861-8.043-4.542-15.419-12.471-17.024z" style={{fill:"#ed6e7a"}}/>
                  <path className="st0" d="m191.417 48.003-26.822-5.428a1.5 1.5 0 1 0-.595 2.941l26.822 5.428a14.104 14.104 0 0 1 11.276 15.394l-6.164 57.586c-3.869 36.141-25.38 67.829-57.541 84.766a33.032 33.032 0 0 1-30.789 0c-32.161-16.936-53.671-48.624-57.541-84.765L43.9 66.337a14.106 14.106 0 0 1 11.277-15.394l65.012-13.157a14.11 14.11 0 0 1 5.621 0l24.703 5a1.5 1.5 0 1 0 .595-2.941l-24.703-5a17.085 17.085 0 0 0-6.81 0L54.583 48.003a17.095 17.095 0 0 0-13.666 18.654l6.164 57.586c3.976 37.137 26.079 69.698 59.127 87.101A35.998 35.998 0 0 0 123 215.496a36.01 36.01 0 0 0 16.792-4.153c33.047-17.402 55.15-49.963 59.127-87.1l6.164-57.586a17.092 17.092 0 0 0-13.666-18.654z"/>
                  <text x="118" y="130" textAnchor="middle" fontSize="62" fill="white" fontWeight="bold" className="text-orange-800">
                    SOL
                  </text>
                </svg>
              </div>
              
              {/* Percentage badge */}
              <svg height="30px" width="30px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 256 256" xmlSpace="preserve">
                <style>{`.st0{fill:#3a312a}.st1{fill:#d6df58}.st2{fill:#87796f}.st13{fill:#8ac2d9}`}</style>
                <path className="st2" d="M222.394 16.135H33.605c-9.447 0-17.105 7.658-17.105 17.106V163.53c0 9.447 7.658 17.105 17.105 17.105h188.789c9.447 0 17.106-7.658 17.106-17.105V33.241c0-9.447-7.658-17.106-17.106-17.106z"/>
                <path className="st0" d="M222.394 14.636H33.605C23.346 14.636 15 22.982 15 33.241V163.53c0 10.259 8.346 18.605 18.605 18.605h188.789c10.259 0 18.606-8.347 18.606-18.605V33.241c0-10.259-8.347-18.605-18.606-18.605zM238 163.53c0 8.604-7.001 15.605-15.606 15.605H33.605C25 179.136 18 172.135 18 163.53V33.241c0-8.604 7-15.605 15.605-15.605h188.789c8.605 0 15.606 7.001 15.606 15.605V163.53z"/>
                <path className="st1" d="M214.969 28.635H41.031c-6.583 0-11.92 5.337-11.92 11.92v115.66c0 6.583 5.337 11.92 11.92 11.92h173.938c6.583 0 11.92-5.336 11.92-11.92V40.555c0-6.583-5.337-11.92-11.92-11.92z" style={{fill:"rgb(237, 110, 122)"}}/>
                <path className="st0" d="M214.969 27.136H99.798a1.5 1.5 0 1 0 0 3h115.171c5.745 0 10.42 4.675 10.42 10.42v115.66c0 5.745-4.675 10.42-10.42 10.42H41.031c-5.746 0-10.42-4.675-10.42-10.42V40.556c0-5.745 4.674-10.42 10.42-10.42h45.17a1.5 1.5 0 1 0 0-3h-45.17c-7.4 0-13.42 6.021-13.42 13.42v115.66c0 7.399 6.02 13.42 13.42 13.42h173.938c7.399 0 13.42-6.021 13.42-13.42V40.556c0-7.4-6.021-13.42-13.42-13.42z"/>
                <path className="st2" d="M113.688 180.635h28.625v35.593h-28.625z"/>
                <path className="st0" d="M142.313 179.136h-28.625a1.5 1.5 0 0 0-1.5 1.5v35.593a1.5 1.5 0 0 0 1.5 1.5h28.625a1.5 1.5 0 0 0 1.5-1.5v-35.593a1.5 1.5 0 0 0-1.5-1.5zm-1.5 35.593h-25.625v-32.593h25.625v32.593z"/>
                <path className="st2" d="M148.296 216.229h-40.593c-12.927 0-23.407 10.479-23.407 23.407h87.406c.001-12.928-10.478-23.407-23.406-23.407z"/>
                <path className="st0" d="M148.296 214.729h-40.592c-13.733 0-24.907 11.173-24.907 24.907a1.5 1.5 0 0 0 1.5 1.5h37.584a1.5 1.5 0 1 0 0-3H85.848c.773-11.383 10.281-20.407 21.856-20.407h40.592c11.575 0 21.083 9.024 21.856 20.407h-34.701a1.5 1.5 0 0 0 0 3h36.252a1.5 1.5 0 0 0 1.5-1.5c0-13.735-11.173-24.907-24.907-24.907z"/>
                <path className="st1" d="M47.671 203.469c-.974 11.564-13.025 13.39-13.025 13.39 10.346.487 12.925 14.059 12.925 14.059.221-9.677 13.321-14.202 13.321-14.202-9.813-.587-13.221-13.247-13.221-13.247z"/>
                <path className="st0" d="M60.982 215.219c-8.604-.515-11.831-12.024-11.863-12.141a1.513 1.513 0 0 0-1.583-1.102 1.5 1.5 0 0 0-1.359 1.367c-.86 10.215-11.313 11.963-11.755 12.031a1.5 1.5 0 0 0 .154 2.982c9.028.426 11.499 12.719 11.523 12.844a1.5 1.5 0 0 0 2.973-.248c.195-8.509 12.192-12.777 12.313-12.819a1.5 1.5 0 0 0-.403-2.914zm-13.565 10.345c-1.356-3.131-3.709-6.908-7.587-8.877 2.931-1.404 6.409-3.913 8.202-8.272 1.551 3.071 4.199 6.88 8.334 8.723-3.008 1.639-6.923 4.405-8.949 8.426z"/>
                <path className="st1" d="M25.972 220.45c-.689 8.179-9.212 9.471-9.212 9.471 7.318.344 9.142 9.944 9.142 9.944.156-6.845 9.422-10.045 9.422-10.045-6.941-.416-9.352-9.37-9.352-9.37z"/>
                <path className="st0" d="M35.414 228.322c-5.766-.345-7.972-8.186-7.994-8.265a1.5 1.5 0 0 0-2.942.266c-.579 6.87-7.646 8.066-7.942 8.113a1.5 1.5 0 0 0 .155 2.982c6.035.284 7.723 8.644 7.739 8.726a1.5 1.5 0 0 0 2.973-.246c.131-5.708 8.332-8.633 8.413-8.661a1.5 1.5 0 0 0-.402-2.915zm-9.585 6.795c-.924-1.886-2.339-3.947-4.447-5.28 1.856-1.041 3.697-2.629 4.87-4.916 1.057 1.874 2.654 3.955 4.941 5.224-1.849 1.1-3.987 2.74-5.364 4.972z"/>
                <path className="st1" d="M25.972 193.792c-.689 8.179-9.212 9.47-9.212 9.47 7.318.345 9.142 9.944 9.142 9.944.156-6.844 9.422-10.045 9.422-10.045-6.941-.414-9.352-9.369-9.352-9.369z"/>
                <path className="st0" d="M35.414 201.665c-5.766-.345-7.972-8.187-7.994-8.266a1.5 1.5 0 0 0-2.942.266c-.579 6.871-7.646 8.066-7.942 8.113a1.5 1.5 0 0 0 .154 2.982c6.036.284 7.724 8.645 7.739 8.727a1.5 1.5 0 0 0 2.973-.246c.131-5.709 8.332-8.633 8.413-8.661a1.5 1.5 0 0 0-.401-2.915zm-9.585 6.794c-.924-1.885-2.34-3.947-4.447-5.279 1.856-1.041 3.697-2.63 4.87-4.916 1.057 1.873 2.654 3.954 4.941 5.224-1.849 1.1-3.988 2.74-5.364 4.971z"/>
                <text x="128" y="120" textAnchor="middle" fontSize="59" fill="white" fontWeight="bold" className="text-orange-800">
                  {solReward.percentage}%
                </text>
              </svg>
            </div>
            
            {/* SOL Image */}
            <div className="w-24 md:h-24 h-16 group-hover:scale-105 transition-transform duration-300 ml-0">
              <Image
                src={solReward.image}
                alt={solReward.name}
                width={250}
                height={150}
                className="object-contain drop-shadow-md rounded-lg"
                onError={(e) => {
                  // Fallback to default image if SOL image fails to load
                  e.currentTarget.src = "/default-sol.png";
                }}
              />
            </div>

            {/* SOL Name */}
            <div className="mt-2 reward font-bold text-center relative bottom-7 w-full py-2 text-sm rounded-lg  flex justify-center items-center gap-2 md:-top-1 top-11">
              <span className="truncate max-w-full px-2">
                {solReward.name}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Debug info */}
      <div className="text-center text-white/40 text-xs mt-4">
        {/* <p>📦 {nfts.length} NFTs deposited in vault</p> */}
        {/* <p>💰 {solRewards.length} SOL rewards available</p> */}
        {/* <p>🎯 Each spin has chance to win NFTs or SOL rewards</p> */}
      </div>
    </div>
  );
}
