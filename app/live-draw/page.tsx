"use client";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";
import { useRouter } from "next/navigation";
import Model from "../Components/Model";
import Loader from "../Components/Loader";
import TopNav from "../Components/TopNav";
import Image from "next/image";

const getJackpotPools = async () => {
    try {
        console.log("🔍 DEBUG: Fetching jackpot pools...");
        
        // Load active jackpot pools ordered by current amount (highest first)
        const response = await supabase
            .from("jackpot_pools")
            .select("id, name, description, current_amount, ticket_price, max_tickets, end_time, is_active, image")
            .eq("is_active", true)
            .order("current_amount", { ascending: false });
        
        console.log("🔍 DEBUG: Jackpot pools response:", response);
        
        if (response.error) {
            console.warn("⚠️ WARNING: Error fetching jackpot pools:", response.error);
            // Return fallback data if database query fails
            return {
                data: [
                    {
                        id: 1,
                        name: "Daily Jackpot",
                        description: "Win amazing prizes in our daily jackpot draw! Each ticket gives you an equal chance to win the grand prize.",
                        current_amount: 0,
                        ticket_price: 100,
                        max_tickets: 1000,
                        end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                        is_active: true
                    },
                    {
                        id: 2,
                        name: "Weekly Mega Jackpot",
                        description: "Our biggest weekly jackpot with incredible rewards! Perfect for serious players.",
                        current_amount: 0,
                        ticket_price: 500,
                        max_tickets: 500,
                        end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        is_active: true
                    },
                    {
                        id: 3,
                        name: "Monthly Super Jackpot",
                        description: "The ultimate monthly jackpot with life-changing prizes! Limited time only.",
                        current_amount: 0,
                        ticket_price: 1000,
                        max_tickets: 200,
                        end_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        is_active: true
                    }
                ],
                error: null
            };
        }
        
        return response;
    } catch (error) {
        console.error("❌ ERROR: Error in getJackpotPools:", error);
        // Return fallback data as last resort
        return {
            data: [
                {
                    id: 1,
                    name: "Daily Jackpot",
                    description: "Win amazing prizes in our daily jackpot draw! Each ticket gives you an equal chance to win the grand prize.",
                    current_amount: 0,
                    ticket_price: 100,
                    max_tickets: 1000,
                    end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    is_active: true
                }
            ],
            error: null
        };
    }
};

export default function LiveDraw() {
    const { data, loading, error } = useRequest(getJackpotPools);
    const navigate = useRouter();

    if (loading) {
        return <Loader />;
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center p-4 rounded-lg bg-red-500/10 text-red-500">
                    <p>Failed to load live draws. Please try again later.</p>
                </div>
            </div>
        );
    }
console.log( data?.data,'img data')
    return (
        <div>
            {/* <TopNav /> */}
            <div className="max-w-7xl mx-auto px-4 py-8 overflow-hidden">
            <div className="flex items-center justify-center mb-8">
                <h1 className="text-3xl font-bold bg-white bg-clip-text text-transparent">Featured Jackpots</h1>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-12">
                {
                    //@ts-ignore
                    data?.data?.map((pool: any, index: number) => (
                        <div
                            key={pool.id}
                            className="bg-white backdrop-blur-sm rounded-2xl border border-[#f74e14]/20 overflow-hidden shadow-xl flex flex-col relative h-[440px]"
                        >
                            {/* Background pattern */}
                            <div className="absolute inset-0 opacity-5" style={{
                                backgroundImage: `url('/lv-pattern.png')`,
                                backgroundSize: '120px',
                                backgroundRepeat: 'repeat',
                            }}></div>
                            
                            {/* Content */}
                            <div className="p-1 flex-1 flex flex-col items-center justify-center relative z-10">
                                <div className="w-64 h-56 mb-4 relative mt-4">
                                    <div className="absolute inset-0 rounded-ful bg-gradient-to-r from-[#f74e14]/20 to-[#ff914d]/20  rounded-lg"></div>
                                    <Image
                                        src={'public'+'/'+pool.image ? `/${pool.image}` : '/coin.png'}
                                        alt={pool.name}
                                        width={260}
                                        height={230}
                                        className=""
                                        onError={(e) => {
                                            console.log('❌ Jackpot image failed to load:', pool.image ? `/${pool.image}` : '/coin.png');
                                        }}
                                        onLoad={() => {
                                            console.log('✅ Jackpot image loaded successfully:', pool.image ? `/${pool.image}` : '/coin.png');
                                        }}
                                    />
                                </div>
                                
                              <div className="content">
                              <h2 className="font-bold text-xl text-center mb-2 text-[#ff914d] relative top-4">{pool.name}</h2>
                                
                                <p className="text-[#ff914d] text-sm text-center mb-6">
                                    {/* {pool.description || ''} */}
                                </p>
                                
                                <div className="flex items-center justify-center gap-4 mt-auto">
                                    <div className="text-center">
                                        <span className="block text-xs text-[#ff914d]">PRICE</span>
                                        <span className="text-[#ff914d] font-medium">{Number(pool.ticket_price).toFixed(0)} OGX</span>
                                    </div>
                                    
                                    <div className="h-10 border-r border-[#f74e14]/20"></div>
                                    
                                    <div className="text-center">
                                        <span className="block text-xs text-[#ff914d]">MAX TICKETS</span>
                                        <span className="text-[#ff914d] font-medium">{pool.max_tickets}</span>
                                    </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Bottom button */}
                            <button
                                onClick={() => {
                                    navigate.push("/live-draw/" + pool.id);
                                }}
                                className="w-full py-4 bg-gradient-to-r from-[#f74e14] to-[#ff914d] text-white font-medium hover:opacity-90 transition-all duration-200 z-10 relative"
                            >
                                View Jackpot
                            </button>
                        </div>
                    ))
                }
            </div>
            
            <Model />
            </div>
        </div>
    );
}
