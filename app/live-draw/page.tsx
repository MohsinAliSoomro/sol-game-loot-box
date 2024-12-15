"use client";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Model from "../Components/Model";

const getProducts = async () => {
    const response = await supabase.from("tickets").select();
    return response;
};

export default function LiveDraw() {
    const { data, loading, error } = useRequest(getProducts);
    const navigate = useRouter();

    if (loading) {
        return <div>Loading...</div>;
    }
    if (error) {
        return <div>Error...</div>;
    }

    return (
        <div className="overflow-hidden">
            <div className="flex items-center">
                <p className="text-3xl font-bold my-4 ml-4 w-full">Future Jackpots</p>
            </div>
            <div className="w-full flex">
                <div className="w-full grid grid-cols-3 md:grid-cols-3 lg:grid-cols-3 m-2 gap-y-6 gap-2 mb-40">
                    {
                        //@ts-ignore
                        data?.data?.map((loot, index) => (
                            <div
                                key={loot.title}
                                className="h-96 bg-gradient-to-b from-foreground to-secondary border-white/40 p-2 py-10 rounded-xl text-background flex flex-col items-center relative">
                                <Image
                                    src={loot.image}
                                    alt={loot.name}
                                    width={200}
                                    height={200}
                                    className=""
                                />
                                <span className="font-bold text-center mx-auto text-white"> {loot.title}</span>
                                <button
                                    onClick={() => {
                                        navigate.push("/live-draw/" + loot.id);
                                    }}
                                    className="text-xl rounded-full px-2 lg:px-5 py-1 lg:py-2 absolute -bottom-4 left-4 right-4 shadow-lg backdrop-blur-md bg-foreground border border-white/40 text-white text-center">
                                    Purchase ticket
                                </button>
                            </div>
                        ))
                    }
                </div>
            </div>
            {/* <button className="text-xl rounded-full px-2 lg:px-5 py-1 lg:py-2 mx-auto w-full shadow-lg backdrop-blur-md bg-foreground border border-white/40 text-white text-center">
                Purchase ticket
            </button> */}
            <Model />
        </div>
    );
}
