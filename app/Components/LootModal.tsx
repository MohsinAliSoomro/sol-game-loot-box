"use client";

import Image from "next/image";

interface IProps {
    close: () => void;
    image: string;
}
export default function LootModal({ close, image }: IProps) {
    return (
        <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center z-50 bg-white/20">
            <div className="bg-transparent backdrop-blur-2xl p-4 max-w-xl w-full text-white rounded-2xl border-2 border-white/30">
                <h1 className="text-center text-2xl font-bold my-4">Congratulations</h1>
                <Image
                    src={image}
                    alt="coin"
                    width={200}
                    height={200}
                    className="mx-auto"
                />
                <button
                    onClick={close}
                    className="bg-foreground border-2 my-4 rounded-lg px-12 py-2 border-white/30 flex items-center justify-center mx-auto mt-10">
                    Okay
                </button>
            </div>
        </div>
    );
}
