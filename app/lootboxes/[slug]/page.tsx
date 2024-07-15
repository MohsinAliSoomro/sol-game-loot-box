"use client";
import LootModal from "@/app/Components/LootModal";
import TopNav from "@/app/Components/TopNav";
import { RefreshCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import "react-spin-game/dist/index.css";
const Wheel = dynamic(() => import("react-custom-roulette").then((r) => r.Wheel), {
    ssr: false,
});

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
export default function Details() {
    const [mustSpin, setMustSpin] = useState(false);
    const [prizeNumber, setPrizeNumber] = useState(0);
    const [openModal, setOpenModal] = useState(false);

    const handleSpinClick = () => {
        if (!mustSpin) {
            const newPrizeNumber = Math.floor(Math.random() * data.length);
            setPrizeNumber(newPrizeNumber);
            setMustSpin(true);
        }
    };
    const handleModal = () => {
        setOpenModal(!openModal);
    };

    return (
        <div className="overflow-hidden md:container mx-auto">
            <TopNav />

            <div className="flex items-center flex-col justify-center flex-wrap gap-4 relative">
                <div className="w-full h-[80vh] flex items-center justify-center">
                    <div className="w-full h-full flex flex-col items-center justify-center relative mt-20 relative">
                        <Wheel
                            mustStartSpinning={mustSpin}
                            prizeNumber={prizeNumber}
                            data={data}
                            onStopSpinning={() => {
                                handleModal();
                                setMustSpin(false);
                            }}
                            outerBorderWidth={8}
                            outerBorderColor="#eb7ec3"
                            backgroundColors={["#df1fc2", "#ef71b0", "#ef64aa", "#ef71b0", "#ef64aa", "#ef71b0"]}
                            innerBorderColor="pink"
                            innerBorderWidth={4}
                            radiusLineWidth={3}
                            radiusLineColor="#f38cbf"
                            spinDuration={1}
                            textColors={["#eeb1d0"]}
                            fontSize={14}
                            // pointerProps={{
                            //     src: "/frame.png",
                            // }}
                        />
                        <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center z-50">
                            <span className=" w-40 h-40 md:h-96 md:w-96 rounded-full bg-background border-2 border-white/40"></span>
                        </div>
                        <div className="absolute top-1/2 left-0 right-0 z-50 -mb-20 bg-background w-full h-full">
                            <div className="flex justify-center items-center gap-6">
                                <p className="bg-white backdrop-blur-sm p-2 rounded-lg text-background mt-2">
                                    Spin for <span className="font-bold text-lg">250</span> Credit{" "}
                                </p>
                            </div>
                            <button
                                onClick={handleSpinClick}
                                className="mx-auto flex items-center gap-2 mt-5 bg-transprent font-bold text-white text-foreground px-10 py-4 text-lg">
                                <RefreshCcw
                                    size={20}
                                    height={20}
                                />{" "}
                                <span>Try it for free</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {openModal && <LootModal close={handleModal} />}
        </div>
    );
}
