import { FileLock, Flame, Layers3, PanelTop, Users, Wallet2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function TopNav() {
    return (
        <div className="flex justify-between items-center flex-wrap border-white px-2 md:px-4 border-foreground backdrop-blur-sm">
            <div className="flex items-center justify-center gap-4 flex-wrap">
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
                    href="/lootboxes.123"
                    className="text-sm font-bold">
                    Lootboxes
                </Link>
                <Link
                    href="/lootboxes/123"
                    className="text-sm font-bold">
                    Battle
                </Link>
                <Link
                    href="/lootboxes/123"
                    className="text-sm font-bold">
                    Leaderboard
                </Link>
            </div>
            <button className="bg-foreground text-background px-8 py-2 rounded-full">Login</button>
        </div>
    );
}
