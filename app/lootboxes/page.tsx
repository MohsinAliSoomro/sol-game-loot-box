import TopNav from "../Components/TopNav";
import data from "../Components/JSON/NFT_LOOK.json";
import { Bitcoin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
export default function LookBox() {
    return (
        <div className="p-4 sm:ml-64">
            <TopNav />
            <div className="flex items-center justify-center flex-wrap gap-4 pt-2 relative">
                <div className="absolute top-0 left-0 flex items-center justify-center w-full h-full">
                    <h1
                        style={{ fontSize: "200px" }}
                        className="text-7xl font-bold text-foreground">
                        Clan Of Thor
                    </h1>
                </div>
                {data.nfts.map((item) => (
                    <Link
                        href={"/lootboxes/" + item.name}
                        className="nft"
                        key={item.name}>
                        <div className="main">
                            <img
                                className="tokenImage w-full"
                                src="https://images.unsplash.com/photo-1621075160523-b936ad96132a?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80"
                                alt="NFT"
                            />
                            <p className="mt-2 font-bold text-xl">
                                {item.name}
                            </p>
                            <div className="tokenInfo">
                                <div className="flex items-center">
                                    <ins>
                                        <Bitcoin />
                                    </ins>
                                    <p>0.031 ETH</p>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
