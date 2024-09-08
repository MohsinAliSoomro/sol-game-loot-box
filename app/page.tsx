"use client";
import TopNav from "./Components/TopNav";
import Image from "next/image";
import Model from "./Components/Model";
import { useRouter } from "next/navigation";
// import { useUserState } from "@/state/useUserState";
import { useRequest } from "ahooks";
import { supabase } from "@/service/supabase";

const getProducts = async () => {
    const response = await supabase.from("products").select();
    return response;
};
export default function Home() {
    const { data, loading, error } = useRequest(getProducts);

    const navigate = useRouter();
    // const [user] = useUserState();
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
            <div className="flex items-center">
                <p className="text-3xl font-bold my-4 ml-4 w-9/12">Feature Apes Lootbox</p>
                <p className="text-3xl font-bold ml-8 w-3/12">Live draw</p>
            </div>
            <div className="w-full flex">
                <div className="w-9/12 grid grid-cols-3 md:grid-cols-3 lg:grid-cols-3 m-2 gap-y-6 gap-2 mb-40">
                    {
                        //@ts-ignore
                        data?.data?.map((loot, index) => (
                            <div
                                key={loot.name}
                                className="h-96 bg-gradient-to-b from-foreground to-secondary border-white/40 p-2 py-10 rounded-xl text-background flex flex-col items-center relative">
                                <span className="absolute top-2 right-2">{loot?.winProb || "0%"}</span>
                                <Image
                                    src={loot.image}
                                    alt={loot.name}
                                    width={200}
                                    height={200}
                                    className=""
                                />
                                <span className="font-bold text-center mx-auto text-white"> {loot.name}</span>
                                <span className="font-bold text-center flex mx-auto text-xl mb-4 text-white">${loot.price}</span>
                                <button
                                    onClick={() => {
                                        navigate.push("/lootboxes/" + loot.id);
                                    }}
                                    className="text-xl rounded-full px-2 lg:px-5 py-1 lg:py-2 absolute -bottom-4 left-4 right-4 shadow-lg backdrop-blur-md bg-foreground border border-white/40 text-white text-center">
                                    Open
                                </button>
                            </div>
                        ))
                    }
                </div>
                <div className="w-3/12">
                    <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 m-2 gap-y-6 gap-2 mt-4">
                        {
                            //@ts-ignore
                            data?.data?.map((loot, index) => (
                                <div
                                    key={loot.name}
                                    className="border-b mx-auto">
                                    <p className="text-xl font-bold mb-2">Mohsin</p>

                                    <div className="w-40 h-40  bg-gradient-to-b from-foreground to-secondary border-white/40 p-2 py-2 rounded-xl text-background flex flex-col items-center relative">
                                        {/* <span className="absolute top-2 right-2">{loot?.winProb || "0%"}</span> */}
                                        <Image
                                            src={loot.image}
                                            alt={loot.name}
                                            width={120}
                                            height={120}
                                            className=""
                                        />
                                        <span className="font-bold text-center mx-auto text-black">{loot.name}</span>
                                        {/* <span className="font-bold text-center flex mx-auto text-xl mb-4 text-white">${loot.price}</span> */}
                                        <button
                                            onClick={() => {
                                                navigate.push("/lootboxes/" + loot.id);
                                            }}
                                            className="text-xs rounded-full px-2 lg:px-2 py-1 lg:py-2 absolute -top-2 left-8 right-8 shadow-lg backdrop-blur-md bg-foreground border border-white/40 text-white text-center">
                                            Win
                                        </button>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>
            <Model />
        </div>
    );
}
