"use client";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";
import { useRouter, useParams } from "next/navigation";
import Model from "@/app/Components/Model";
import Loader from "@/app/Components/Loader";
import TopNav from "@/app/Components/TopNav";
import JackpotImage from "@/app/Components/JackpotImage";

const getJackpotPools = async (isMainProject: boolean = false) => {
    try {
        console.log("🔍 DEBUG: Fetching jackpot pools...", "isMainProject:", isMainProject);
        
        // Get current project ID from context
        const projectId = typeof window !== 'undefined' 
            ? localStorage.getItem('currentProjectId') 
            : null;
        
        console.log("🔍 DEBUG: Current project ID:", projectId);
        
        // Load active jackpot pools ordered by current amount (highest first)
        let query = supabase
            .from("jackpot_pools")
            .select("id, name, description, current_amount, ticket_price, max_tickets, end_time, is_active, image, project_id")
            .eq("is_active", true);
        
        // Only filter by project_id if NOT main project
        // Main project uses legacy tables without project_id
        // Sub-projects use multi-tenant tables with project_id
        if (!isMainProject && projectId) {
            query = query.eq("project_id", parseInt(projectId));
        }
        
        const response = await query.order("current_amount", { ascending: false });
        
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
    const params = useParams();
    // Check if we're on the root page (main project) - no projectSlug in URL params
    const isMainProject = !params?.projectSlug;
    const projectSlug = params?.projectSlug as string | undefined;
    const { data, loading, error } = useRequest(() => getJackpotPools(isMainProject));
    const navigate = useRouter();

    // Helper function to create navigation URL with project slug
    // For main project (no projectSlug in URL), don't add project slug
    // For sub-projects, add the project slug
    const createUrl = (path: string) => {
        if (isMainProject) {
            // Main project: no project slug in URL
            return path;
        } else if (projectSlug) {
            // Sub-project: add project slug
            return `/${projectSlug}${path}`;
        }
        return path;
    };

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
        <div className="flex flex-col flex-1">
            {/* <TopNav /> */}
            <div className="flex-1 max-w-7xl mx-auto px-4 py-8 overflow-hidden w-full">
            <div className="flex items-center justify-center mb-8">
                <h1 className="text-3xl font-bold bg-white bg-clip-text text-transparent">Featured Jackpots</h1>
            </div>
            
            {!data?.data || data.data.length === 0 ? (
                <div className="flex items-center justify-center min-h-[400px]">
                    <p className="text-xl text-white">No data available</p>
                </div>
            ) : (
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
                                        <div className="absolute inset-0 rounded-full rounded-lg"></div>
                                        <JackpotImage
                                            image={pool.image}
                                            name={pool.name}
                                            width={260}
                                            height={230}
                                            className="w-full h-full object-cover"
                                            fallbackSrc="/coin.png"
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
                                        navigate.push(createUrl("/live-draw/" + pool.id));
                                    }}
                                    className="w-full py-4 bg-gradient-to-r from-[#f74e14] to-[#ff914d] text-white font-medium hover:opacity-90 transition-all duration-200 z-10 relative"
                                >
                                    View Jackpot
                                </button>
                            </div>
                        ))
                    }
                </div>
            )}
            
            <Model />
            </div>
        </div>
    );
}
