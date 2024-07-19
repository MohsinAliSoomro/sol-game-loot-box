"use client";
import TopNav from "./Components/TopNav";
import Image from "next/image";
import Model from "./Components/Model";
import { useRouter } from "next/navigation";
import { useUserState } from "@/state/useUserState";
import { options } from "./data/data";
const data = [
    {
        option: "Rip",
        // image: {
        //     uri: "/coin.png",
        //     offsetX: 0,
        //     offsetY: 300,
        // },
    },
    {
        option: "Rip",
        image: {
            uri: "/2.png",
            offsetX: 0,
            offsetY: 230,
            sizeMultiplier: 0.8,
        },
    },
    {
        option: "Rip",
        // image: {
        //     uri: "/coin.png",
        //     offsetX: 0,
        //     offsetY: 200,
        // },
    },
    {
        option: "3",
        image: {
            uri: "/3.png",
            offsetX: 0,
            offsetY: 230,
            sizeMultiplier: 0.8,
        },
    },
    {
        option: "Rip",
        // image: {
        //     uri: "/coin.png",
        //     offsetX: 0,
        //     offsetY: 200,
        // },
    },
    {
        option: "5",
        image: {
            uri: "/1.png",
            offsetX: 0,
            offsetY: 230,
            sizeMultiplier: 0.8,
        },
    },
    {
        option: "Rip",
        // image: {
        //     uri: "/coin.png",
        //     offsetX: 0,
        //     offsetY: 200,
        // },
    },
    {
        option: "7",
        image: {
            uri: "/2.png",
            offsetX: 0,
            offsetY: 230,
            sizeMultiplier: 0.8,
        },
    },
    {
        option: "Rip",
        // image: {
        //     uri: "/coin.png",
        //     offsetX: 0,
        //     offsetY: 200,
        // },
    },
    {
        option: "9",
        image: {
            uri: "/3.png",
            offsetX: 0,
            offsetY: 230,
            sizeMultiplier: 0.8,
        },
    },
];
export default function Home() {
    const navigate = useRouter();
    const [user] = useUserState();
    // let buttons = ["Deposite", "PVP Battles", "Leaderboard", "Lootboxes"];

    return (
        <div className="overflow-hidden md:container mx-auto">
            <TopNav />
            <Image
                src={"/background.png"}
                alt="background"
                width={1280}
                height={720}
                className="w-full h-full object-cover"
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
            <p className="text-xl font-bold my-4">Live Opens</p>
            <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 m-2 gap-y-6 gap-2 mb-40">
                {options.map((loot) => (
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
                ))}
            </div>
            <Model />
        </div>
    );
}
