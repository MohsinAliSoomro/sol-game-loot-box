"use client";
import TopNav from "./Components/TopNav";
import dynamic from "next/dynamic";
import { useState } from "react";
import LootModal from "./Components/LootModal";
import Image from "next/image";
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
export default function Home() {
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
    let buttons = ["Deposite", "PVP Battles", "Leaderboard", "Lootboxes"];
    let options = [
        { name: "Thread", image: "/1.png" },
        { name: "Rug", image: "/2.png" },
        { name: "Rug", image: "/3.png" },
        { name: "Rug", image: "/3.png" },
        { name: "Carpet Tape", image: "/3.png" },
        { name: "Rug", image: "/3.png" },
        { name: "Thread", image: "/3.png" },
        { name: "Carpet Tape", image: "/3.png" },
    ];
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

            <div className="flex justify-between flex-wrap lg:flex-nowrap gap-4 mt-4">
                {buttons.map((button) => (
                    <button
                        className="bg-gradient-to-l from-foreground to-orange-300 shadow-lg rounded-full w-full p-2 text-background"
                        key={button}>
                        {button}
                    </button>
                ))}
            </div>
            <p className="text-xl font-bold my-4">Live Opens</p>
            <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 m-2 gap-2">
                {options.map((loot) => (
                    <div
                        key={loot.name}
                        className="bg-foreground p-2 rounded-xl text-background flex flex-col items-center">
                        <Image
                            src={loot.image}
                            alt={loot.name}
                            width={200}
                            height={200}
                            className=""
                        />
                        <span className="font-bold text-center mx-auto"> {loot.name}</span>
                        <span className="font-bold text-center flex mx-auto text-xl"> $29</span>
                    </div>
                ))}
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
                                console.log("STOP SPINNER");
                                setMustSpin(false);
                            }}
                            outerBorderWidth={8}
                            outerBorderColor="#ef71b0"
                            backgroundColors={["#ef64aa", "#ef71b0", "#ef64aa", "#ef71b0", "#ef64aa", "#ef71b0"]}
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
                        <button
                            onClick={handleSpinClick}
                            className="mx-auto flex mt-5 bg-transprent backdrop-blur-2xl font-bold text-white shadow-md border border-background text-foreground px-10 py-4 rounded-lg">
                            SPIN
                        </button>
                    </div>
                </div>
            </div>
            {openModal && <LootModal close={handleModal} />}
        </div>
    );
}
