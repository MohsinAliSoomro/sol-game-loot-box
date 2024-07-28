"use client";
import TopNav from "./Components/TopNav";
import Image from "next/image";
import Model from "./Components/Model";
import { useRouter } from "next/navigation";
import { useUserState } from "@/state/useUserState";
import { useRequest } from "ahooks";
import { supabase } from "@/service/supabase";

const getProducts = async () => {
    const response = await supabase.from("products").select();
    return response;
};
export default function Home() {
    const { data, loading, error } = useRequest(getProducts);

    const navigate = useRouter();
    const [user] = useUserState();
    // let buttons = ["Deposite", "PVP Battles", "Leaderboard", "Lootboxes"];
    if (loading) {
        return <div>Loading...</div>;
    }
    if (error) {
        return <div>Error</div>;
    }
    return (
        <div className="overflow-hidden">
            <TopNav />
            <Image
                src={"/background.png"}
                alt="background"
                width={1280}
                height={500}
                className="w-full h-[50vh] object-cover"
            />

            {/* <div className="flex justify-between flex-wrap md:flex-nowrap gap-4 mt-4">
                {buttons.map((button) => (
                    <button
                        className="bg-gradient-to-l from-foreground to-orange-300 shadow-lg rounded-full w-full p-2 text-background"
                        key={button}>
                        {button}
                    </button>
                ))}
            </div> */}
            <p className="text-xl font-bold my-4">Live Options</p>
            <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-3 m-2 gap-y-6 gap-2 mb-40">
                {
                    //@ts-ignore
                    data?.data.map((loot) => (
                        <div
                            key={loot.name}
                            className="bg-gradient-to-t from-background border border-white/40 to-white p-2 rounded-xl text-background flex flex-col items-center relative">
                            <Image
                                src={loot.image}
                                alt={loot.name}
                                width={200}
                                height={200}
                                className=""
                            />
                            <span className="font-bold text-center mx-auto"> {loot.name}</span>
                            <span className="font-bold text-center flex mx-auto text-xl mb-4">Sol {loot.price}</span>
                            <button
                                onClick={() => {
                                    navigate.push("/lootboxes/" + loot.id);
                                }}
                                className="text-primary rounded-full px-2 lg:px-5 py-1 lg:py-2 absolute -bottom-4 left-4 right-4 shadow-lg backdrop-blur-md bg-transparent border border-white/40 text-white text-center">
                                Open
                            </button>
                        </div>
                    ))
                }
            </div>
            <Model />
        </div>
    );
}
