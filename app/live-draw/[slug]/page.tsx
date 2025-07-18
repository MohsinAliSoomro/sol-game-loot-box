"use client";
import { supabase } from "@/service/supabase";
import { useUserState } from "@/state/useUserState";
import { useRequest } from "ahooks";
// import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Countdown from "react-countdown";
import { toast } from "react-toastify";
import Loader from "../../Components/Loader";
import Image from "next/image";

const getProducts = async (id: string) => {
    const ticketPurchase = await supabase.from("ticketPurchase").select("*", { count: "exact", head: true }).eq("ticketId", id);
    const response = await supabase.from("tickets").select().eq("id", id);
    return { ...response, count: ticketPurchase.count };
};

export default function Page() {
    const [value, setValue] = useState("");
    const [user, setUser] = useUserState();
    const params = useParams<{ slug: string }>();
    const { data, loading, error, run } = useRequest(getProducts);
    useEffect(() => {
        if (params?.slug) {
            run(params?.slug);
        }
    }, [params]);

    const purchaseTicket = async () => {
        await supabase.from("ticketPurchase").insert({ ticketId: params?.slug, userId: user?.walletAddress });
    };
    const updateUser = async (remainApes: number) => {
        await supabase.from("user").update({ apes: remainApes }).eq("walletAddress", user?.walletAddress);
        setUser({ ...user, apes: remainApes });
    };
    const handlePurchase = async () => {
        if (!user) {
            return alert("Please connect your wallet");
        }
        if (!user?.walletAddress) {
            return alert("Please connect your wallet");
        }
        if (value === "") {
            return alert("Please enter amount");
        }

        //@ts-ignore
        const ticketPrice1 = data?.data[0]?.price;
        const values = Number(value) * Number(ticketPrice1);
        const currentApes = user?.apes;
        if (values > currentApes) {
            return alert("Insufficient balance");
        }

        const remainApes = currentApes - values;
        let promises = [purchaseTicket(), updateUser(remainApes)];
        toast.promise(
            Promise.all(promises),
            {
                pending: "Purchasing ticket...",
                success: "Ticket purchased successfully",
                error: "Failed to purchase ticket",
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
        run(params?.slug);
        // purchase ticket and update apes
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
        <div className="max-w-7xl mx-auto px-4 ">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-[#f74e14]/20 overflow-hidden">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Left Section - Image */}
                    <div className="w-full md:w-4/12">
                        <div className="rounded-xl overflow-hidden border-2 border-[#f74e14]/20 shadow-lg">
                            <Image
                                //@ts-ignore
                                src={'/'+data?.data[0].image}
                                //@ts-ignore
                                alt={data?.data[0].name}
                                width={200}
                                height={200}
                                className="w-full h-full object-cover aspect-square"
                            />
                        </div>
                    </div>

                    {/* Right Section - Content */}
                    <div className="w-full md:w-8/12 ">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#f74e14] to-[#ff914d] bg-clip-text text-transparent mb-4 flex justify-center ">
                            {
                                //@ts-ignore
                                data?.data[0]?.title
                            }
                        </h1>

                        {/* Description Box */}
                        <div className="p-6 border border-[#f74e14]/20 bg-white  rounded-xl my-6 flex justify-center flex-col items-center">
                            <h2 className="text-xl font-semibold mb-2 text-[#ff914d]">Description</h2>
                            <p className="text-black">
                                {
                                    //@ts-ignore
                                    data?.data[0]?.description
                                }
                            </p>
                        </div>

                        {/* Countdown and Tickets Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="bg-white border border-[#f74e14]/20 rounded-xl p-6 flex flex-col items-center justify-center">
                                <p className="text-[#ff914d] mb-2">Time Remaining</p>
                                <Countdown
                                    //@ts-ignore
                                    date={new Date(data?.data[0]?.endTime)}
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
                                <span className="text-3xl md:text-4xl font-bold text-black">{data?.count}</span>
                            </div>
                        </div>

                        {/* Purchase Form */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ff914d] text-sm">Price:</span>
                                <input
                                    type="number"
                                    disabled
                                    placeholder={
                                        //@ts-ignore
                                        `${data?.data[0]?.price} OGX`
                                    }
                                    className="w-full h-12 bg-white border border-[#f74e14]/20 rounded-lg pl-16 pr-4 text-black text-right placeholder:text-right placeholder:text-black"
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
                                Purchase Tickets
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
