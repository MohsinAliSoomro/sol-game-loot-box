"use client";
import TopNav from "../Components/TopNav";
import Image from "next/image";
// import SpinAndWin from "react-spin-game";
import "react-spin-game/dist/index.css";
import { useRef, useState } from "react";
import { Wheel } from "react-custom-roulette";

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
        option: "1",
        image: {
            uri: "/coin.png",
            offsetX: 0,
            offsetY: 200,
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
            uri: "/coin.png",
            offsetX: 0,
            offsetY: 200,
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
            uri: "/coin.png",
            offsetX: 0,
            offsetY: 200,
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
            uri: "/coin.png",
            offsetX: 0,
            offsetY: 200,
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
            uri: "/coin.png",
            offsetX: 0,
            offsetY: 200,
        },
    },
];

export default function LookBox() {
    const [mustSpin, setMustSpin] = useState(false);
    const [prizeNumber, setPrizeNumber] = useState(0);

    const handleSpinClick = () => {
        if (!mustSpin) {
            const newPrizeNumber = Math.floor(Math.random() * data.length);
            setPrizeNumber(newPrizeNumber);
            setMustSpin(true);
        }
    };

    return (
        <div className="p-4 sm:ml-64 overflow-hidden">
            <TopNav />

            <div className="flex items-center flex-col justify-center flex-wrap gap-4 relative">
                <div className="w-full h-[80vh] flex items-center justify-center">
                    <div className="w-full h-full flex flex-col items-center justify-center">
                        <Wheel
                            mustStartSpinning={mustSpin}
                            prizeNumber={prizeNumber}
                            data={data}
                            onStopSpinning={() => {
                                setMustSpin(false);
                            }}
                            outerBorderWidth={2}
                            outerBorderColor="white"
                            backgroundColors={["#D35D6E", "#F39189", "#D35D6E", "#F39189", "#D35D6E", "#F39189"]}
                            innerBorderColor="white"
                            innerBorderWidth={2}
                            radiusLineWidth={2}
                            spinDuration={1}
                            fontSize={20}
                        />
                        <button
                            onClick={handleSpinClick}
                            className="mx-auto flex mt-5 bg-background shadow-md border border-background text-foreground px-10 py-4 rounded-lg">
                            SPIN
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
