import { FileLock, Flame, Layers3, PanelTop, Users, Wallet2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function TopNav() {
    let DATA = [
        {
            name: "Volume",
            value: "123123 sol",
            icon: <Users className="w-10 h-10" />,
        },
        {
            name: "Listed",
            value: "123123 sol",
            icon: <Wallet2 className="w-10 h-10" />,
        },
        {
            name: "Floor",
            value: "123123 sol",
            icon: <PanelTop className="w-10 h-10" />,
        },
        {
            name: "Uniqui Holders",
            value: "123123 sol",
            icon: <Users className="w-10 h-10" />,
        },
        {
            name: "Stacked",
            value: "123123 sol",
            icon: <Layers3 className="w-10 h-10" />,
        },
        {
            name: "Burned",
            value: "123123 sol",
            icon: <Flame className="w-10 h-10" />,
        },
        {
            name: "Value Looked",
            value: "123123 sol",
            icon: <FileLock className="w-10 h-10" />,
        },
    ];
    return (
        <div className="flex justify-between items-center flex-wrap border-white px-2 md:px-4 border-foreground backdrop-blur-sm">
            <div className="flex items-center gap-2 flex-wrap">
                <Link
                    href={"/"}
                    className="flex items-center">
                    <Image
                        src={"/logo.png"}
                        alt="logo"
                        width={100}
                        height={100}
                        className="w-20 h-20"
                    />
                    <span className="font-bold text-xl">Apes Army</span>
                </Link>
                <Link
                    href="/lootboxes"
                    className="text-sm font-bold">
                    Lootboxes
                </Link>
                <Link
                    href="/lootboxes"
                    className="text-sm font-bold">
                    Battle
                </Link>
                <Link
                    href="/lootboxes"
                    className="text-sm font-bold">
                    Leaderboard
                </Link>
            </div>
            <button className="bg-foreground text-background px-8 py-2 rounded-full">Login</button>
        </div>
    );
}
