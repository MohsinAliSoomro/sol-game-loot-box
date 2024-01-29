"use client";
import TopNav from "../Components/TopNav";
import Image from "next/image";
// import SpinAndWin from "react-spin-game";
import "react-spin-game/dist/index.css";
import { useRef, useState } from "react";
import { Wheel } from "react-custom-roulette";

const data = [
    {
        option: "0",
        image: {
            uri: "/coin.png",
            offsetX: 0,
            offsetY: 200,
        },
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
        option: "2",
        image: {
            uri: "/coin.png",
            offsetX: 0,
            offsetY: 200,
        },
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
        option: "4",
        image: {
            uri: "/coin.png",
            offsetX: 0,
            offsetY: 200,
        },
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
        option: "6",
        image: {
            uri: "/coin.png",
            offsetX: 0,
            offsetY: 200,
        },
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
        option: "8",
        image: {
            uri: "/coin.png",
            offsetX: 0,
            offsetY: 200,
        },
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
// const freeSpinGifts = [
//     ["test1", "#706233"],
//     ["test2", "#A2C579"],
//     ["test3", "#99B080"],
//     ["test4", "#748E63"],
//     ["test5", "#A7D397"],
//     ["test6", "#43766C"],
//     ["test1", "#706233"],
//     ["test2", "#A2C579"],
//     ["test3", "#99B080"],
//     ["test4", "#748E63"],
//     ["test5", "#A7D397"],
//     ["test6", "#43766C"],
// ];
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
    const ref = useRef(null);

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
                            backgroundColors={["#D35D6E", "#F39189", "#FFAAA7", "#CA8A8B", "#F29191", "#F4A9A8"]}
                            innerBorderColor="white"
                            innerBorderWidth={2}
                            radiusLineWidth={2}
                            spinDuration={1}
                            fontSize={20}
                        />
                        <button
                            onClick={handleSpinClick}
                            className="mx-auto flex mt-5 bg-[#1A240A]  px-10 py-4 rounded-lg">
                            SPIN
                        </button>
                        {/* <SpinAndWin
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
                        </button> */}
                    </div>
                </div>
            </div>
        </div>
    );
}
