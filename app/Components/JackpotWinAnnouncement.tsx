"use client";
import { useState, useEffect, useCallback } from "react";
import { JackpotService, JackpotWin } from "@/lib/jackpot-service";
import { useProject } from "@/lib/project-context";

interface JackpotWinAnnouncementProps {
  userId?: string;
  onWin?: (win: JackpotWin) => void;
}

export default function JackpotWinAnnouncement({ userId, onWin }: JackpotWinAnnouncementProps) {
  const { getProjectTokenSymbol } = useProject();
  const tokenSymbol = getProjectTokenSymbol();
  const [recentWins, setRecentWins] = useState<JackpotWin[]>([]);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [currentWin, setCurrentWin] = useState<JackpotWin | null>(null);

  const loadRecentWins = useCallback(async () => {
    try {
      const wins = await JackpotService.getUserWins(userId!);
      const unclaimedWins = wins.filter(win => !win.is_claimed);
      
      if (unclaimedWins.length > 0) {
        const latestWin = unclaimedWins[0];
        if (!currentWin || latestWin.id !== currentWin.id) {
          setCurrentWin(latestWin);
          setShowAnnouncement(true);
          onWin?.(latestWin);
        }
      }
      
      setRecentWins(wins);
    } catch (error) {
      console.error('Error loading jackpot wins:', error);
    }
  }, [userId, currentWin, onWin]);

  useEffect(() => {
    if (!userId) return;

    loadRecentWins();
    
    // Check for new wins every 10 seconds
    const interval = setInterval(loadRecentWins, 10000);
    return () => clearInterval(interval);
  }, [userId, loadRecentWins]);

  const handleClaimWin = async () => {
    if (!currentWin) return;

    try {
      // Here you would implement the actual claim logic
      // For now, we'll just mark it as claimed in the UI
      setShowAnnouncement(false);
      setCurrentWin(null);
      
      // Refresh wins
      await loadRecentWins();
    } catch (error) {
      console.error('Error claiming jackpot win:', error);
    }
  };

  const handleCloseAnnouncement = () => {
    setShowAnnouncement(false);
    setCurrentWin(null);
  };

  if (!showAnnouncement || !currentWin) {
    return null;
  }

  return (
    <>
      {/* Full screen overlay */}
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
              {currentWin.amount} SOL
            </h2>
            <p className="text-white/80 text-sm mb-4">
              from {currentWin.pool?.name || 'Jackpot Pool'}
            </p>
            
            <div className="bg-white/20 rounded-lg p-4 mb-6">
              <p className="text-white font-medium">
                🎉 Congratulations! You won the jackpot!
              </p>
              <p className="text-white/80 text-sm mt-1">
                You received {currentWin.amount * 1000} {tokenSymbol} (equivalent to {currentWin.amount} SOL)
              </p>
              <p className="text-white/80 text-xs mt-2">
                You can sell this {tokenSymbol} to get SOL in your wallet!
              </p>
            </div>

            <button
              onClick={handleClaimWin}
              className="bg-white text-orange-600 font-bold py-3 px-6 rounded-lg hover:bg-gray-100 transition-colors mr-2"
            >
              🎉 Claim Win!
            </button>
            
            <button
              onClick={handleCloseAnnouncement}
              className="bg-white/20 text-white font-bold py-3 px-6 rounded-lg hover:bg-white/30 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
