"use client";
import TopNav from "@/app/Components/TopNav";
import Image from "next/image";
import { useState } from "react";
import { motion } from "framer-motion";
export default function Details() {
    const [isActive, setIsActive] = useState(false);
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
        <div className="p-4 sm:ml-64">
            <TopNav />
            <div className="flex items-center flex-col justify-center flex-wrap gap-4 pt-2 relative">
                <Image
                    src={"/njPhhkca.gif"}
                    alt="Background"
                    width={1000}
                    height={720}
                    className="w-full h-[89vh]"
                />
                <div className="absolute top-0 left-0 w-full h-screen flex items-center justify-between mx-5">
                    {data.map((item) => (
                        <div
                            key={item.id}
                            className="relative w-full">
                            <Image
                                src="/frame.png"
                                alt="frame"
                                width={400}
                                height={300}
                            />
                            {item.id === 3 ? (
                                <motion.img
                                    src="/coin.png"
                                    onClick={() => setIsActive(!isActive)}
                                    animate={{
                                        scale: isActive ? 2 : 1,
                                        rotate: isActive
                                            ? [90, -90, 180, -180, 0]
                                            : 0,
                                        transition: {
                                            duration: 1.5,
                                        },
                                    }}
                                    width={100}
                                    height={100}
                                    className="absolute left-28 top-32"
                                />
                            ) : (
                                <Image
                                    src={"/coin.png"}
                                    alt="coin"
                                    width={100}
                                    height={100}
                                    className="absolute left-28 top-32"
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
