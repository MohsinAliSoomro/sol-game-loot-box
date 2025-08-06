"use client";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";
import Loader from "../Components/Loader";
import { useState } from "react";
import Image from "next/image";

async function getLeaderboard() {
  return await supabase
    .from("user")
    .select("*")
    .order("apes", { ascending: false })
    .limit(10);
}
// code merge
export default function Leaderboard() {
  const { data, loading, error } = useRequest(getLeaderboard);
  const [timeFilter, setTimeFilter] = useState("all");

  if (loading) return <Loader />;
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
  ];

  const formatNumber = (num: number) => {
    if (num === undefined || num === null) return 0;
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return num;
  };
  const newData: any = data?.data;
  console.log({newData})
  return (
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
                  src={newData[1]?.avatar_url}
                  alt={newData[1]?.full_name}
                  className="w-full h-full object-cover"
                  width={300}
                  height={300}
                />
              </div>
              <h3 className={`font-bold text-white mb-2 ${
                newData[1].full_name && newData[1].full_name.length > 11 ? "text-xs" : "text-lg"
              }`}>
                {newData[1].full_name}
              </h3>
              <div className="bg-[#00FFD5] rounded-full px-4 py-1 w-full text-center shadow-md">
                <span className="font-medium text-xs text-gray-900">
                  Spent{" "}
                </span>
                <span className="font-bold text-gray-900">
                  {formatNumber(newData[1].apes)}
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
                  src={newData[0].avatar_url}
                  alt={newData[0].full_name}
                  className="w-full h-full object-cover"
                  width={300}
                  height={300}
                />
              </div>
              <h3 className={`font-bold text-white mb-2 ${
                newData[0].full_name && newData[0].full_name.length > 11 ? "text-sm" : "text-xl"
              }`}>
                {newData[0].full_name}
              </h3>
              <div className="bg-[#00FFD5] rounded-full px-4 py-1 w-full text-center shadow-md">
                <span className="font-medium text-xs text-gray-900">
                  Spent{" "}
                </span>
                <span className="font-bold text-gray-900">
                  {formatNumber(newData[0].apes)}
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
                  src={newData[2].avatar_url}
                  alt={newData[2].full_name}
                  className="w-full h-full object-cover"
                  width={300}
                  height={300}
                />
              </div>
              <h3 className={`font-bold text-white mb-2 ${
                newData[2].full_name && newData[2].full_name.length > 11 ? "text-xs" : "text-lg"
              }`}>
                {newData[2].full_name}
              </h3>
              <div className="bg-[#00FFD5] rounded-full px-4 py-1 w-full text-center shadow-md">
                <span className="font-medium text-xs text-gray-900">
                  Spent{" "}
                </span>
                <span className="font-bold text-gray-900">
                  {formatNumber(newData[2].apes)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Remaining Rankings */}
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
                  <Image
                    src={user?.avatar_url}
                    alt={user.full_name}
                    className="w-full h-full object-cover"
                    width={300}
                    height={300}
                  />
                </div>
                <span className={`font-bold text-white text-wrap ${
                  user.full_name && user.full_name.length > 11 ? "text-xs" : ""
                }`}>
                  {user.full_name}
                </span>
              </div>
              <div className="bg-gray-700 rounded-full px-4 py-1">
                <span className="text-gray-300 text-sm">Spent </span>
                <span className="text-white font-bold">
                  {formatNumber(user.apes)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
