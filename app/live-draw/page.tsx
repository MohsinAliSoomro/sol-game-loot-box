"use client";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";
import { useRouter } from "next/navigation";
// import Image from "next/image";
import Model from "../Components/Model";
import Loader from "../Components/Loader";
import Image from "next/image";

const getProducts = async () => {
    const response = await supabase.from("tickets").select();
    return response;
};

export default function LiveDraw() {
    const { data, loading, error } = useRequest(getProducts);
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

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 overflow-hidden">
            <div className="flex items-center justify-center mb-8">
                <h1 className="text-3xl font-bold bg-white bg-clip-text text-transparent">Feature Jackpots</h1>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-12">
                {
                    //@ts-ignore
                    data?.data?.map((loot, index) => (
                        <div
                            key={loot.title}
                            className="bg-white backdrop-blur-sm rounded-2xl border border-[#f74e14]/20 overflow-hidden shadow-xl flex flex-col relative h-[400px]"
                        >
                            {/* Background pattern */}
                            <div className="absolute inset-0 opacity-5" style={{
                                backgroundImage: `url('/lv-pattern.png')`,
                                backgroundSize: '120px',
                                backgroundRepeat: 'repeat',
                            }}></div>
                            
                            {/* Content */}
                            <div className="p-1 flex-1 flex flex-col items-center justify-center relative z-10">
                                <div className="w-56 h-48 mb-4 relative mt-4">
                                    <div className="absolute inset-0 rounded-ful bg-gradient-to-r from-[#f74e14]/20 to-[#ff914d]/20 "></div>
                                    <Image
                                        src={'/'+loot.image}
                                        alt={loot.name}
                                        width={160}
                                        height={160}
                                        className="relative z-10 object-contain w-full h-full"
                                    />
                                </div>
                                
                                <h2 className="font-bold text-xl text-center mb-2 text-[#ff914d] mt-5">{loot.title}</h2>
                                
                                <p className="text-[#ff914d] text-sm text-center mb-6">
                                    {/* {loot.description?.substring(0, 80)}
                                    {loot.description?.length > 80 ? '...' : ''} */}
                                </p>
                                
                                <div className="flex items-center justify-center gap-4 mt-auto">
                                    <div className="text-center">
                                        <span className="block text-xs text-[#ff914d]">PRICE</span>
                                        <span className="text-[#ff914d] font-medium">{loot.price} OGX</span>
                                    </div>
                                    
                                    <div className="h-10 border-r border-[#f74e14]/20"></div>
                                    
                                    <div className="text-center">
                                        <span className="block text-xs text-[#ff914d]">ENDS IN</span>
                                        <span className="text-[#ff914d] font-medium">2d 4h</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Bottom button */}
                            <button
                                onClick={() => {
                                    navigate.push("/live-draw/" + loot.id);
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
    );
}
