"use client";
import TopNav from "../Components/TopNav";
import "react-spin-game/dist/index.css";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import LootModal from "../Components/LootModal";
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
            uri: "/coin.png",
            offsetX: 0,
            offsetY: 330,
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
            offsetY: 330,
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
            offsetY: 330,
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
            offsetY: 330,
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
            offsetY: 330,
        },
    },
];

export default function LookBox() {
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
        <div className="sm:ml-64 overflow-hidden">
            <div className="nav-top z-50 relative">
            <TopNav />

            </div>

            <div className="flex items-center flex-col justify-center flex-wrap gap-4 relative">
                <div className="w-full h-[80vh] flex items-center justify-center">
                    <div className="w-full h-full flex flex-col items-center justify-center">
                        <Wheel
                            mustStartSpinning={mustSpin}
                            prizeNumber={prizeNumber}
                            data={data}
                            onStopSpinning={() => {
                                handleModal();
                                setMustSpin(false);
                            }}
                            outerBorderWidth={0}
                            outerBorderColor="white"
                            backgroundColors={["#D35D6E", "#F39189", "#D35D6E", "#F39189", "#D35D6E", "#F39189"]}
                            innerBorderColor="white"
                            innerBorderWidth={2}
                            radiusLineWidth={1}
                            spinDuration={1}
                            fontSize={16}
                            // pointerProps={{
                            //     src: "/frame.png",
                            // }}
                        />
                        <button
                            onClick={handleSpinClick}
                            className="mx-auto flex mt-5 bg-background shadow-md border border-background text-foreground px-10 py-4 rounded-lg">
                            SPIN
                        </button>
                    </div>
                </div>
            </div>
            {openModal && (
                <LootModal
                    close={handleModal}
                    image="/coin.png"
                />
            )}
        </div>
    );
}
