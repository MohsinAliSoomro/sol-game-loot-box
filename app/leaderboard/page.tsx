"use client";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";
import Loader from "../Components/Loader";
import { useState } from "react";

/**
 * Fetches the 10 most recent transactions from the database.
 * @returns A promise that resolves to an array of the 10 most recent transactions.
 */
async function getLeaderboard() {
    return await supabase
        .from("leaderboard")
        .select("*")
        .order("wageredCredits", { ascending: false })
        .limit(5);
}

const mockData = [
    {
        id: 1,
        username: "Degener8s",
        wageredCredits: 3025336.1,
        avatar: "/degener8s.png"
    },
    {
        id: 2,
        username: "DemDan",
        wageredCredits: 363371.5,
        avatar: "/demdan.png"
    },
    {
        id: 3,
        username: "GreenHorse",
        wageredCredits: 199350.5,
        avatar: "/greenhorse.png"
    },
    {
        id: 4,
        username: "Kick-Itsjayz",
        wageredCredits: 187556,
        avatar: "/kick-itsjayz.png"
    },
    {
        id: 5,
        username: "degendonnie.sol",
        wageredCredits: 148648,
        avatar: "/degendonnie.png"
    }
];

export default function Leaderboard() {
    const { data, loading, error } = useRequest(getLeaderboard);
    const [timeFilter, setTimeFilter] = useState("all");

    if (loading) return <Loader />;
    if (error) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center p-4 rounded-lg bg-red-500/10 text-red-500">
                <p>Failed to load leaderboard data. Please try again later.</p>
            </div>
        </div>
    );

    const timeFilterButtons = [
        { id: 'all', label: 'All Time' },
        // { id: 'monthly', label: 'Monthly' },
        { id: 'weekly', label: 'Weekly' },
        { id: 'daily', label: 'Daily' },
    ];

    const getRankBadge = (index: number) => {
        const badges = {
            0: { bg: 'bg-[#FFD700]', text: '1st' },
            1: { bg: 'bg-[#C0C0C0]', text: '2nd' },
            2: { bg: 'bg-[#CD7F32]', text: '3rd' }
        };
        return badges[index as keyof typeof badges];
    };

    const formatNumber = (num: number) => {
        return num.toString();
    };

    return (
        <div className="max-w-[1400px] mx-auto px-8 py-12">
            {/* Time Filter Buttons */}
            {/* <div className="flex flex-col items-center gap-3 sm:gap-4">
            <button
              onClick={spinWheel}
              disabled={isSpinning}
              className="px-2 sm:px-4  py-3 sm:py-3 bg-[#f74e14] hover:bg-[#e63900] text-white rounded-xl font-bold text-sm sm:text-sm md:text-sm transition-all shadow-lg whitespace-nowrap"
            
            >
              SPIN FOR 850 OGX
            </button>
            
            <button 
              className="text-[#f74e14] hover:text-[#e63900] font-bold text-base sm:text-lg"
          
            >
              TRY FOR FREE
            </button>
          </div> */}
            <div className="flex justify-center gap-6 mb-16">
                {timeFilterButtons.map((button) => (
                    <button
                        key={button.id}
                        onClick={() => setTimeFilter(button.id)}
                        className={`px-16 sm:px-16  py-4 sm:py-4 bg-[#f74e14] hover:bg-[#e63900] text-white rounded-xl font-bold text-sm sm:text-sm md:text-sm transition-all shadow-lg whitespace-nowrap  ${
                            timeFilter === button.id 
                            ? 'bg-[#6C5DD3] text-white' 
                            : 'bg-white/5 backdrop-blur-sm text-white hover:bg-white/10'
                        }`}
                    >
                        {button.label}
                    </button>
                ))}
            </div>

            {/* Top 3 Winners */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
  {/* Second Box (now first) */}
  <div className="relative top-24 ">
    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-yellow-400 px-6 py-1 rounded-sm font-bold text-black z-10">
      2nd Place
    </div>
    <div className="bg-white rounded-2xl p-8 flex flex-col items-center shadow-lg">
      <div className="w-24 h-24 rounded-full overflow-hidden mb-4">
        <img src={mockData[1].avatar} alt={mockData[1].username} className="w-full h-full object-cover" />
      </div>
      <h3 className="text-xl font-bold text-black mb-4">{mockData[1].username}</h3>
      <div className="bg-[#00FFD5] rounded-full px-6 py-2 w-full text-center">
        <span className="font-medium">OGX Credits: </span>
        <span className="font-bold">{formatNumber(mockData[1].wageredCredits)}</span>
      </div>
    </div>
  </div>

  {/* First Box (now second, lowered & smaller) */}
  <div className="relative mt-6 ">
    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-yellow-500 px-6 py-1 rounded-sm font-bold text-black z-10">
      1st Place
    </div>
    <div className="bg-white rounded-2xl p-8 flex flex-col items-center shadow-lg">
      <div className="w-28 h-28 rounded-full overflow-hidden mb-4">
        <img src={mockData[0].avatar} alt={mockData[0].username} className="w-full h-full object-cover" />
      </div>
      <h3 className="text-xl font-bold text-black mb-4">{mockData[0].username}</h3>
      <div className="bg-[#00FFD5] rounded-full px-6 py-2 w-full text-center">
        <span className="font-medium">OGX Credits: </span>
        <span className="font-bold">{formatNumber(mockData[0].wageredCredits)}</span>
      </div>
    </div>
  </div>

  {/* Third Box (shifted lower & smaller) */}
  <div className="relative mt-6  top-20">
    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-yellow-600 px-6 py-1 rounded-sm font-bold text-black z-10">
      3rd Place
    </div>
    <div className="bg-white rounded-2xl p-8 flex flex-col items-center shadow-lg">
      <div className="w-24 h-24 rounded-full overflow-hidden mb-4">
        <img src={mockData[2].avatar} alt={mockData[2].username} className="w-full h-full object-cover" />
      </div>
      <h3 className="text-xl font-bold text-black mb-4">{mockData[2].username}</h3>
      <div className="bg-[#00FFD5] rounded-full px-6 py-2 w-full text-center">
        <span className="font-medium">OGX Credits: </span>
        <span className="font-bold">{formatNumber(mockData[2].wageredCredits)}</span>
      </div>
    </div>
  </div>
</div>


            {/* Remaining Rankings */}
            <div className="space-y-4">
                {mockData.slice(3).map((user, index) => (
                    <div key={user.id} className="relative mt-28">
                        <div className="absolute -left-4 top-1/2 transform -translate-y-1/2">
                            <div className="bg-[#00FFD5] px-4 py-1 rounded-sm font-bold text-black">
                                {index + 4}th
                            </div>
                        </div>
                        <div className="bg-white rounded-xl py-4 px-8 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.1)] ml-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full overflow-hidden">
                                    <img
                                        src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                                        alt={user.username}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <span className="font-bold text-black text-lg">{user.username}</span>
                            </div>
                            <div className="bg-gray-100 rounded-full px-6 py-2">
                                <span className="text-gray-500">Wagered Credits: </span>
                                <span className="text-black font-bold">{formatNumber(user.wageredCredits)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
