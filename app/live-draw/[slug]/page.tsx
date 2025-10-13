"use client";
import { supabase } from "@/service/supabase";
import { useUserState } from "@/state/useUserState";
import { useRequest } from "ahooks";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Countdown from "react-countdown";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Loader from "../../Components/Loader";
import TopNav from "../../Components/TopNav";

const getJackpotData = async (id: string) => {
    try {
        console.log("🔍 DEBUG: Fetching jackpot with ID:", id);
        console.log("🔍 DEBUG: ID type:", typeof id);
        console.log("🔍 DEBUG: ID value:", JSON.stringify(id));
        
        // Validate ID parameter
        if (!id || id === 'undefined' || id === 'null') {
            console.error("❌ ERROR: Invalid ID parameter:", id);
            throw new Error(`Invalid ID parameter: ${id}`);
        }

        // Get jackpot pool details from database
        console.log("🔍 DEBUG: Querying jackpot pool with ID:", id);
        console.log("🔍 DEBUG: SQL Query: SELECT * FROM jackpot_pools WHERE id = " + id);
        
        const jackpotResponse = await supabase
        .from("jackpot_pools")
        .select("*")
        .eq("id", id)
        .single();

        console.log("🔍 DEBUG: Jackpot query result:", jackpotResponse);
        
        if (jackpotResponse.error) {
            console.warn("⚠️ WARNING: Jackpot not found, using fallback data:", jackpotResponse.error);
            console.log("🔍 DEBUG: Error details:", {
                code: jackpotResponse.error.code,
                message: jackpotResponse.error.message,
                details: jackpotResponse.error.details,
                hint: jackpotResponse.error.hint
            });
            
            // Return fallback data if specific jackpot not found
            const fallbackJackpots = {
                "1": {
                    id: 1,
                    name: "Daily Jackpot",
                    description: "Win amazing prizes in our daily jackpot draw! Each ticket gives you an equal chance to win the grand prize.",
                    current_amount: 0,
                    ticket_price: 100,
                    max_tickets: 1000,
                    end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    is_active: true
                },
                "2": {
                    id: 2,
                    name: "Weekly Mega Jackpot",
                    description: "Our biggest weekly jackpot with incredible rewards! Perfect for serious players.",
                    current_amount: 0,
                    ticket_price: 500,
                    max_tickets: 500,
                    end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    is_active: true
                },
                "3": {
                    id: 3,
                    name: "Monthly Super Jackpot",
                    description: "The ultimate monthly jackpot with life-changing prizes! Limited time only.",
                    current_amount: 0,
                    ticket_price: 1000,
                    max_tickets: 200,
                    end_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    is_active: true
                }
            };

            const key = String(id) as keyof typeof fallbackJackpots;
            const fallbackJackpot = fallbackJackpots[key] || fallbackJackpots["1"];
            
            return {
                data: [fallbackJackpot],
                count: 0,
                error: null
            };
        }

        console.log("✅ SUCCESS: Jackpot data:", jackpotResponse.data);

        // Get ticket purchase count for this jackpot
        console.log("🔍 DEBUG: Getting ticket count for jackpot ID:", id);
        console.log("🔍 DEBUG: SQL Query: SELECT COUNT(*) FROM jackpot_tickets WHERE pool_id = " + id);
        
        const { count, error: countError } = await supabase
            .from("jackpot_tickets")
            .select("*", { count: "exact", head: true })
            .eq("pool_id", id);

        console.log("🔍 DEBUG: Ticket count result:", { count, countError });

        if (countError) {
            console.warn("⚠️ WARNING: Error getting ticket count:", countError);
            console.log("🔍 DEBUG: Count error details:", {
                code: countError.code,
                message: countError.message,
                details: countError.details,
                hint: countError.hint
            });
        }

        console.log("✅ SUCCESS: Ticket count:", count);

        return {
            data: [jackpotResponse.data],
            count: count || 0,
            error: null
        };
    } catch (error) {
        console.error("Error fetching jackpot data:", error);
        // Return fallback data as last resort
        const fallbackJackpot = {
            id: id,
            name: "Daily Jackpot",
            description: "Win amazing prizes in our daily jackpot draw! Each ticket gives you an equal chance to win the grand prize.",
            current_amount: 0,
            ticket_price: 100,
            max_tickets: 1000,
            end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            is_active: true
        };

    return {
            data: [fallbackJackpot],
            count: 0,
            error: null
        };
    }
};

export default function Page() {
    const [value, setValue] = useState("");
    const [user, setUser] = useUserState();
    const params = useParams<{ slug: string }>();
    const { data, loading, error, run } = useRequest(getJackpotData);
    
    useEffect(() => {
        if (params?.slug) {
            run(params?.slug);
        }
    }, [params, run]);

    const purchaseJackpotTicket = async () => {
        const purchaseData = {
            pool_id: params?.slug, 
            user_id: user?.id || user?.walletAddress,
            ticket_count: parseInt(value) || 1,
            total_cost: (parseInt(value) || 1) * (data?.data[0]?.ticket_price || 1)
        };

        console.log("🔍 DEBUG: Purchasing jackpot ticket:", purchaseData);
        console.log("🔍 DEBUG: SQL Query: INSERT INTO jackpot_tickets (pool_id, user_id, ticket_count, total_cost) VALUES (" + 
            purchaseData.pool_id + ", '" + purchaseData.user_id + "', " + purchaseData.ticket_count + ", " + purchaseData.total_cost + ")");

        const { error } = await supabase.from("jackpot_tickets").insert(purchaseData);
        
        console.log("🔍 DEBUG: Purchase result:", { error });
        
        if (error) {
            console.error("❌ ERROR: Error purchasing jackpot ticket:", error);
            console.log("🔍 DEBUG: Purchase error details:", {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            throw new Error(`Failed to purchase jackpot ticket: ${error.message}`);
        }

        console.log("✅ SUCCESS: Jackpot ticket purchased successfully");
    };
    
    const updateUser = async (remainApes: number) => {
        console.log("Updating user balance:", { userId: user?.id, newBalance: remainApes });
        
        const { error } = await supabase.from("user").update({ apes: remainApes }).eq("id", user?.id);
        
        if (error) {
            console.error("Error updating user balance:", error);
            throw new Error(`Failed to update user balance: ${error.message}`);
        }
        
        // Update local state
        setUser({ ...user, apes: remainApes });
        console.log("User balance updated successfully");
    };
    
    const handlePurchase = async () => {
        if (!user) {
            return toast.error("Please connect your wallet");
        }
        if (!user?.id) {
            return toast.error("Please connect your wallet");
        }
        if (value === "" || value === "0") {
            return toast.error("Please enter a valid amount");
        }

        const ticketPrice = data?.data[0]?.ticket_price || 0;
        const quantity = parseInt(value) || 1;
        const totalCost = quantity * ticketPrice;
        const currentApes = user?.apes || 0;
        
        if (totalCost > currentApes) {
            return toast.error("Insufficient balance");
        }

        const remainApes = currentApes - totalCost;
        
        try {
            await toast.promise(
                Promise.all([purchaseJackpotTicket(), updateUser(remainApes)]),
                {
                    pending: "Purchasing jackpot ticket...",
                    success: `Successfully purchased ${quantity} jackpot ticket(s)!`,
                    error: "Failed to purchase jackpot ticket",
                },
                {
                    position: "top-center",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "light",
                }
            );
            
            // Reset form and refresh data
            setValue("");
            run(params?.slug);
        } catch (error) {
            console.error("Purchase error:", error);
        }
    };

    if (loading) return <Loader />;
    if (error) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center p-4 rounded-lg bg-red-500/10 text-red-500">
                <p>Failed to load jackpot details. Please try again later.</p>
            </div>
        </div>
    );

    return (
        <div>
            {/* <TopNav /> */}
        <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-[#f74e14]/20 overflow-hidden">
                <div className="flex flex-col md:flex-row gap-8">
                        {/* Left Section - Image */}
                    <div className="w-full md:w-4/12">
                        <div className="rounded-xl overflow-hidden border-2 border-[#f74e14]/20 shadow-lg">
                            <Image
                                    src={data?.data[0]?.image ? `/${data.data[0].image}` : '/coin.png'}
                                    alt={data?.data[0]?.name || 'Jackpot'}
                                width={200}
                                height={200}
                                className="w-full h-full object-cover aspect-square"
                            />
                        </div>
                    </div>

                    {/* Right Section - Content */}
                    <div className="w-full md:w-8/12">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#f74e14] to-[#ff914d] bg-clip-text text-transparent mb-4 flex justify-center">
                                {data?.data[0]?.name || 'Jackpot'}
                        </h1>

                        {/* Description Box */}
                        <div className="p-6 border border-[#f74e14]/20 bg-white rounded-xl my-6 flex justify-center flex-col items-center">
                            <h2 className="text-xl font-semibold mb-2 text-[#ff914d]">Description</h2>
                                <p className="text-black">
                                    {data?.data[0]?.description || 'No description available'}
                                </p>
                        </div>

                            {/* Countdown and Tickets Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="bg-white border border-[#f74e14]/20 rounded-xl p-6 flex flex-col items-center justify-center">
                                    <p className="text-[#ff914d] mb-2">Time Remaining</p>
                                <Countdown
                                    date={new Date(data?.data[0]?.end_time || Date.now() + 86400000)}
                                    className="text-2xl font-bold text-black"
                                        renderer={props => (
                                            <div className="flex gap-2">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xl md:text-2xl text-black">{props.days}</span>
                                                    <span className="text-xs text-[#ff914d]">DAYS</span>
                                                </div>
                                                <span className="text-xl md:text-2xl text-[#f74e14]">:</span>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xl md:text-2xl text-black">{props.hours}</span>
                                                    <span className="text-xs text-[#ff914d]">HRS</span>
                                                </div>
                                                <span className="text-xl md:text-2xl text-[#f74e14]">:</span>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xl md:text-2xl text-black">{props.minutes}</span>
                                                    <span className="text-xs text-[#ff914d]">MINS</span>
                                                </div>
                                                <span className="text-xl md:text-2xl text-[#f74e14]">:</span>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xl md:text-2xl text-black">{props.seconds}</span>
                                                    <span className="text-xs text-[#ff914d]">SECS</span>
                                                </div>
                                            </div>
                                        )}
                                    />
                            </div>

                            <div className="bg-white border border-[#f74e14]/20 rounded-xl p-6 flex flex-col items-center justify-center">
                                    <p className="text-[#ff914d] mb-2">Tickets Sold</p>
                                    <span className="text-3xl md:text-4xl font-bold text-black">{data?.count || 0}</span>
                                </div>
                        </div>

                        {/* Purchase Form */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ff914d] text-sm">Price:</span>
                                <input
                                    type="text"
                                    disabled
                                        value={`${data?.data[0]?.ticket_price || 0} OGX`}
                                    className="w-full h-12 bg-white border border-[#f74e14]/20 rounded-lg pl-16 pr-4 text-black text-right"
                                />
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                        placeholder="Enter amount"
                                    className="w-full h-12 bg-white border border-[#f74e14]/20 rounded-lg px-4 text-black focus:border-[#f74e14] transition-all duration-200 placeholder:text-black"
                                        value={value}
                                        onChange={(e) => setValue(e.target.value)}
                                />
                            </div>
                            <button
                                    onClick={() => handlePurchase()}
                                className="h-12 bg-gradient-to-r from-[#f74e14] to-[#ff914d] rounded-lg text-black font-medium hover:opacity-90 transition-all duration-200">
                                    Purchase Jackpot Tickets
                            </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ToastContainer />
        </div>
    );
}