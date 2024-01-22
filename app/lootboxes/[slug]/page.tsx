"use client";
import TopNav from "@/app/Components/TopNav";
import Image from "next/image";
import { useRef, useState } from "react";
import SpinAndWin from "react-spin-game";
import "react-spin-game/dist/index.css";
const freeSpinGifts = [
    ["test1", "#706233"],
    ["test2", "#A2C579"],
    ["test3", "#99B080"],
    ["test4", "#748E63"],
    ["test5", "#A7D397"],
    ["test6", "#43766C"],
];
export default function Details() {
    const [isActive, setIsActive] = useState(false);
    const ref = useRef(null);
    console.log({ ref });
    const data = [
        {
            id: 1,
            type: "wooden",
            contents: ["gold coins", "precious gems", "ancient artifacts"],
            location: { x: 10, y: 20 },
        },
        {
            id: 2,
            type: "ornate",
            contents: ["silver coins", "sapphires", "royal crown"],
            location: { x: 30, y: 15 },
        },
        {
            id: 3,
            type: "metallic",
            contents: ["copper coins", "emeralds", "enchanted amulet"],
            location: { x: 25, y: 18 },
        },
        {
            id: 4,
            type: "gem-studded",
            contents: ["platinum coins", "rubies", "mystical orb"],
            location: { x: 15, y: 25 },
        },
        {
            id: 5,
            type: "hidden",
            contents: ["diamonds", "ancient scroll", "elixir of wisdom"],
            location: { x: 22, y: 12 },
        },
    ];

    return (
        <div className="p-4 sm:ml-64 overflow-hidden">
            <TopNav />
            <div className="flex items-center flex-col justify-center flex-wrap gap-4 pt-2 relative">
                <Image
                    src={"/njPhhkca.gif"}
                    alt="Background"
                    width={1000}
                    height={720}
                    className="w-full h-[89vh]"
                />
                <div className="absolute top-0 left-0 w-full h-[80vh] flex items-center justify-center mx-5">
                    <div>
                        <SpinAndWin
                            ref={ref}
                            data={freeSpinGifts}
                            result="test2"
                            horizantalText
                            hideButton
                        />
                        <button
                            //@ts-ignore
                            onClick={() => ref.current.handleSpin()}
                            className="mx-auto flex mt-5 bg-[#1A240A]  px-10 py-4 rounded-lg">
                            SPIN
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
