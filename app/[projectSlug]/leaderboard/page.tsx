"use client";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";
import Loader from "@/app/Components/Loader";
import { useState } from "react";
import React from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useProject } from "@/lib/project-context";
import { LeaderboardRowSkeleton } from "@/app/Components/Skeleton";

async function getLeaderboard(timeFilter: string = "all", projectId: number | null = null, isMainProject: boolean = false) {
  try {
    console.log("🔍 DEBUG: Fetching leaderboard with filter:", timeFilter, "projectId:", projectId, "isMainProject:", isMainProject);
    
    // For main project, we don't need projectId (uses legacy tables)
    // For sub-projects, we need projectId
    if (!isMainProject && !projectId) {
      console.log("⚠️ No project ID for sub-project, returning empty leaderboard");
      return { data: [], error: null };
    }

    // Get real spending data from transactions based on time filter
    let dateFilter = "";
    switch (timeFilter) {
      case "daily":
        dateFilter = "AND t.created_at >= CURRENT_DATE";
        break;
      case "weekly":
        dateFilter = "AND t.created_at >= CURRENT_DATE - INTERVAL '7 days'";
        break;
      case "monthly":
        dateFilter = "AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'";
        break;
      default:
        dateFilter = "";
    }

    console.log("🔍 DEBUG: Date filter:", dateFilter);

    // Query real spending data from transactions
    // Main project: Don't filter by project_id (legacy tables)
    // Sub-projects: Filter by project_id (multi-tenant tables)
    let transactionQuery = supabase
      .from("transaction")
      .select(`
        "userId",
        ogx,
        created_at,
        project_id,
        user!inner(full_name, avatar_url)
      `)
      .eq("t_status", "purchase");
    
    // Only filter by project_id if NOT main project
    if (!isMainProject && projectId) {
      transactionQuery = transactionQuery.eq("project_id", projectId);
    }
    
    transactionQuery = transactionQuery
      .not("ogx", "is", null)
      .neq("ogx", "");
    
    const { data: transactionData, error: transactionError } = await transactionQuery;

    if (transactionError) {
      console.warn("⚠️ WARNING: Transaction query failed:", transactionError);
      // Return empty data for new projects (no transactions yet)
      return { data: [], error: null };
    }

    // If no transactions, return empty data (new project with no data)
    if (!transactionData || transactionData.length === 0) {
      console.log("✅ No transactions found for this project - returning empty leaderboard");
      return { data: [], error: null };
    }

    // Process transaction data
    const processedData = processTransactionData(transactionData, timeFilter);
    return { data: processedData, error: null };
  } catch (error) {
    console.error("❌ ERROR: Error in getLeaderboard:", error);
    return { data: [], error };
  }
}

// Helper function to process transaction data
function processTransactionData(transactions: any[], timeFilter: string) {
  const userSpending: { [key: string]: any } = {};

  transactions.forEach((tx: any) => {
    const userId = tx.userId;
    const ogxAmount = parseFloat(tx.ogx) || 0;
    const createdAt = new Date(tx.created_at);
    const now = new Date();

    if (!userSpending[userId]) {
      userSpending[userId] = {
        id: userId,
        user_id: userId,
        user_name: tx.user?.full_name || `Player ${userId}`,
        user_avatar: tx.user?.avatar_url || "/default-avatar.png",
        total_spent: 0,
        daily_spent: 0,
        weekly_spent: 0,
        monthly_spent: 0
      };
    }

    // Add to total spending
    userSpending[userId].total_spent += ogxAmount;

    // Add to daily spending (last 24 hours)
    if (createdAt >= new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
      userSpending[userId].daily_spent += ogxAmount;
    }

    // Add to weekly spending (last 7 days)
    if (createdAt >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) {
      userSpending[userId].weekly_spent += ogxAmount;
    }

    // Add to monthly spending (last 30 days)
    if (createdAt >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) {
      userSpending[userId].monthly_spent += ogxAmount;
    }
  });

  // Convert to array and sort by appropriate field
  let sortField = "total_spent";
  switch (timeFilter) {
    case "daily":
      sortField = "daily_spent";
      break;
    case "weekly":
      sortField = "weekly_spent";
      break;
    case "monthly":
      sortField = "monthly_spent";
      break;
  }

  const sortedData = Object.values(userSpending)
    .sort((a: any, b: any) => b[sortField] - a[sortField])
    .slice(0, 10)
    .map((user: any, index: number) => ({
      ...user,
      all_time_rank: index + 1,
      daily_rank: index + 1,
      weekly_rank: index + 1,
      monthly_rank: index + 1
    }));

  return sortedData;
}
// code merge
export default function Leaderboard() {
  const [timeFilter, setTimeFilter] = useState("all");
  const params = useParams();
  const { currentProject, getProjectId, getProjectTokenSymbol } = useProject();
  const projectId = getProjectId();
  const projectTokenSymbol = getProjectTokenSymbol();
  
  // Check if we're on the root page (main project) - no projectSlug in URL params
  const isMainProject = !params?.projectSlug;
  
  const { data, loading, error, run } = useRequest(
    () => getLeaderboard(timeFilter, projectId, isMainProject),
    {
      manual: true,
      refreshDeps: [timeFilter, projectId, isMainProject]
    }
  );

  // Fetch data when component mounts, timeFilter changes, or projectId changes
  React.useEffect(() => {
    // For main project, always fetch (no projectId needed)
    // For sub-projects, only fetch if projectId exists
    if (isMainProject || projectId) {
      run();
    } else {
      console.log("⚠️ No project ID available for leaderboard");
    }
  }, [timeFilter, projectId, isMainProject, run]);

  if (error)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-4 rounded-lg bg-red-500/10 text-red-500">
          <p>Failed to load leaderboard data. Please try again later.</p>
        </div>
      </div>
    );

  const timeFilterButtons = [
    { id: "all", label: "All Time" },
    { id: "weekly", label: "Weekly" },
    { id: "daily", label: "Daily" },
    { id: "monthly", label: "Monthly" },
  ];

  // Get the appropriate spending amount based on time filter
  const getSpendingAmount = (user: any) => {
    switch (timeFilter) {
      case "daily":
        return user.daily_spent || 0;
      case "weekly":
        return user.weekly_spent || 0;
      case "monthly":
        return user.monthly_spent || 0;
      default:
        return user.total_spent || 0;
    }
  };

  const formatNumber = (num: number) => {
    if (num === undefined || num === null) return 0;
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return num;
  };
  const truncateName = (name?: string) => {
    if (!name) return "";
    return name.length > 7 ? name.slice(0, 7) : name;
  };
  const newData: any = data?.data || [];
  
  // Check if we have enough data for the podium
  const hasEnoughData = newData.length >= 3;
  
  return (
    <div>
      {/* <TopNav /> */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12  min-h-screen">
      {/* Header and Time Filters */}
      <div className="text-center mb-8">
        <div className="flex flex-wrap justify-center gap-3 mb-28">
          {timeFilterButtons.map((button) => (
            <button
              key={button.id}
              onClick={() => setTimeFilter(button.id)}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap 
                                ${timeFilter === button.id
                  ? "bg-[#f74e14] text-white shadow-lg"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                } w-56`}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 Winners - Podium */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-end">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-xs shadow-lg">
                <div className="flex flex-col items-center">
                  <LeaderboardRowSkeleton />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !hasEnoughData ? (
        <div className="text-center mb-12">
          <div className="bg-gray-800 rounded-xl p-8 max-w-md mx-auto">
            <h3 className="text-xl font-bold text-white mb-4">🏆 Not Enough Players Yet</h3>
            <p className="text-gray-300">
              We need at least 3 players to show the leaderboard podium. 
              Be the first to play and claim your spot!
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-end">
        {/* 2nd Place */}
        <div className="flex flex-col items-center order-2 md:order-1">
          {/* <div className="bg-gradient-to-b from-[#C0C0C0] to-[#A0A0A0] w-8 h-16 md:w-10 md:h-20 rounded-t-lg mb-2 shadow-md"></div> */}
          <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-xs shadow-lg border border-[#C0C0C0]/20">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#C0C0C0] px-4 py-1 rounded-md font-bold text-gray-900 text-xs shadow-md">
              2nd Place
            </div>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden mb-3 border-4 border-[#C0C0C0] shadow-lg">
                <Image
                  src={newData[1]?.user_avatar || "/default-avatar.png"}
                  alt={newData[1]?.user_name || "2nd Place"}
                  className="w-full h-full object-cover"
                  width={300}
                  height={300}
                />
              </div>
              <h3 className={`font-bold text-white mb-2 ${
                newData[1]?.user_name && newData[1].user_name.length > 11 ? "text-xs" : "text-lg"
              }`}>
                {truncateName(newData[1]?.user_name) || "Player 2"}
              </h3>
              <div className="bg-[#00FFD5] rounded-full px-4 py-1 w-full text-center shadow-md">
                <span className="font-medium text-xs text-gray-900">
                  Spent{" "}
                </span>
                <span className="font-bold text-gray-900">
                  {formatNumber(getSpendingAmount(newData[1]))} {projectTokenSymbol}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 1st Place */}
        <div className="flex flex-col items-center order-1 md:order-2">
          {/* <div className="bg-gradient-to-b from-[#FFD700] to-[#D4AF37] w-10 h-24 md:w-12 md:h-28 rounded-t-lg mb-2 shadow-lg"></div> */}
          <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-xs shadow-xl -mt-4 border border-[#FFD700]/20">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#FFD700] px-4 py-1 rounded-md font-bold text-gray-900 text-xs shadow-md">
              1st Place
            </div>
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden mb-3 border-4 border-[#FFD700] shadow-xl">
                <Image
                  src={newData[0]?.user_avatar || "/default-avatar.png"}
                  alt={newData[0]?.user_name || "1st Place"}
                  className="w-full h-full object-cover"
                  width={300}
                  height={300}
                />
              </div>
              <h3 className={`font-bold text-white mb-2 ${
                newData[0]?.user_name && newData[0].user_name.length > 11 ? "text-sm" : "text-xl"
              }`}>
                {truncateName(newData[0]?.user_name) || "Player 1"}
              </h3>
              <div className="bg-[#00FFD5] rounded-full px-4 py-1 w-full text-center shadow-md">
                <span className="font-medium text-xs text-gray-900">
                  Spent{" "}
                </span>
                <span className="font-bold text-gray-900">
                  {formatNumber(getSpendingAmount(newData[0]))} {projectTokenSymbol}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3rd Place */}
        <div className="flex flex-col items-center order-3 md:order-3">
          {/* <div className="bg-gradient-to-b from-[#CD7F32] to-[#B87333] w-8 h-12 md:w-10 md:h-16 rounded-t-lg mb-2 shadow-md"></div> */}
          <div className="relative bg-gray-800 rounded-xl p-6 w-full max-w-xs shadow-lg border border-[#CD7F32]/20">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#CD7F32] px-4 py-1 rounded-md font-bold text-white text-xs shadow-md">
              3rd Place
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden mb-3 border-4 border-[#CD7F32] shadow-lg">
                <Image
                  src={newData[2]?.user_avatar || "/default-avatar.png"}
                  alt={newData[2]?.user_name || "3rd Place"}
                  className="w-full h-full object-cover"
                  width={300}
                  height={300}
                />
              </div>
              <h3 className={`font-bold text-white mb-2 ${
                newData[2]?.user_name && newData[2].user_name.length > 11 ? "text-xs" : "text-lg"
              }`}>
                {truncateName(newData[2]?.user_name) || "Player 3"}
              </h3>
              <div className="bg-[#00FFD5] rounded-full px-4 py-1 w-full text-center shadow-md">
                <span className="font-medium text-xs text-gray-900">
                  Spent{" "}
                </span>
                <span className="font-bold text-gray-900">
                  {formatNumber(getSpendingAmount(newData[2]))} {projectTokenSymbol}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Remaining Rankings */}
      {loading ? (
        <div className="space-y-3 max-w-2xl mx-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <LeaderboardRowSkeleton key={i} />
          ))}
        </div>
      ) : newData.length > 3 && (
        <div className="space-y-3 max-w-2xl mx-auto">
          {newData.slice(3).map((user: any, index: number) => (
          <div key={user.id} className="relative">
            <div className="bg-gray-800 rounded-xl p-4 pl-16 flex items-center justify-between shadow-md hover:bg-gray-700 transition-all border border-gray-700">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                <div className="bg-[#00FFD5] w-8 h-8 rounded-full flex items-center justify-center shadow-md">
                  <span className="font-bold text-gray-900 text-sm">
                    {index + 4}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#00FFD5]">
                  {/* <Image
                    src={user?.avatar_url }
                    alt={user.full_name}
                    className="w-full h-full object-cover"
                    width={300}
                    height={300}

                  /> */}
                  <img src={user?.user_avatar || "/default-avatar.png"} alt={truncateName(user.user_name)} className="w-full h-full object-cover" />
                </div>
                <span className={`font-bold text-white text-wrap ${
                  user.user_name && user.user_name.length > 11 ? "text-xs" : ""
                }`}>
                  {truncateName(user.user_name)}
                </span>
              </div>
              <div className="bg-gray-700 rounded-full px-4 py-1">
                <span className="text-gray-300 text-sm">Spent </span>
                <span className="text-white font-bold">
                  {formatNumber(getSpendingAmount(user))} {projectTokenSymbol}
                </span>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}
      </div>
    </div>
  );
}
