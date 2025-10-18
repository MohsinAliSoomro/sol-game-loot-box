import React, { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useClaimNft } from '../utils/claimNft';
import { Program } from '@coral-xyz/anchor';

interface ClaimNftButtonProps {
    program: Program;
    userPublicKey: PublicKey | null;
    nftMint: PublicKey;
    onClaimSuccess?: (tx: string) => void;
    onClaimError?: (error: any) => void;
}

export default function ClaimNftButton({ 
    program, 
    userPublicKey, 
    nftMint, 
    onClaimSuccess, 
    onClaimError 
}: ClaimNftButtonProps) {
    const [isClaiming, setIsClaiming] = useState(false);
    const [isAvailable, setIsAvailable] = useState(false);
    const [nftCount, setNftCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    
    const { claimNft, checkAvailability, getCount } = useClaimNft(program, userPublicKey);
    
    // Check availability on mount and when mint changes
    useEffect(() => {
        const checkNftAvailability = async () => {
            try {
                const available = await checkAvailability(nftMint);
                const count = await getCount(nftMint);
                setIsAvailable(available);
                setNftCount(count);
                setError(null);
            } catch (err) {
                console.error('Error checking NFT availability:', err);
                setError('Failed to check NFT availability');
            }
        };
        
        checkNftAvailability();
    }, [nftMint, checkAvailability, getCount]);
    
    const handleClaim = async () => {
        if (!userPublicKey) {
            setError('Please connect your wallet');
            return;
        }
        
        if (!isAvailable) {
            setError('No NFT available to claim');
            return;
        }
        
        setIsClaiming(true);
        setError(null);
        
        try {
            const tx = await claimNft(nftMint);
            console.log('NFT claimed successfully:', tx);
            onClaimSuccess?.(tx);
            
            // Refresh availability after successful claim
            const available = await checkAvailability(nftMint);
            const count = await getCount(nftMint);
            setIsAvailable(available);
            setNftCount(count);
            
        } catch (err) {
            console.error('Error claiming NFT:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to claim NFT';
            setError(errorMessage);
            onClaimError?.(err);
        } finally {
            setIsClaiming(false);
        }
    };
    
    return (
        <div className="p-4 border border-gray-300 rounded-lg bg-white">
            <h3 className="text-lg font-semibold mb-2">Claim NFT</h3>
            
            <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                    <strong>NFT Mint:</strong> {nftMint.toString()}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                    <strong>Available:</strong> {isAvailable ? 'Yes' : 'No'} ({nftCount} NFT{nftCount !== 1 ? 's' : ''})
                </p>
            </div>
            
            {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
                    {error}
                </div>
            )}
            
            <button
                onClick={handleClaim}
                disabled={!userPublicKey || !isAvailable || isClaiming}
                className={`
                    w-full px-4 py-2 rounded font-medium transition-colors
                    ${!userPublicKey || !isAvailable || isClaiming
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }
                `}
            >
                {!userPublicKey 
                    ? 'Connect Wallet' 
                    : !isAvailable 
                        ? 'No NFT Available' 
                        : isClaiming 
                            ? 'Claiming...' 
                            : 'Claim NFT'
                }
            </button>
            
            {isClaiming && (
                <div className="mt-2 text-sm text-blue-600">
                    ⏳ Processing claim transaction...
                </div>
            )}
        </div>
    );
}
