"use-client";
import { supabase } from "@/service/supabase";
import { useUserState } from "@/state/useUserState";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useEffectOnce } from "react-use";

export default function TopNav() {
    const [walletAddress, setWalletAddress] = useState(null);
    const [_, setUser] = useUserState();
    const checkIfWalletIsConnected = async () => {
        try {
            //@ts-ignore
            const { solana } = window;

            if (solana) {
                if (solana.isPhantom) {
                    const response = await solana.connect({ onlyIfTrusted: true });
                    const currentUser = await supabase.from("user").select().eq("walletAddress", response.publicKey.toString()).single();
                    let params = { ...currentUser.data, isShow: currentUser.data?.username ? false : true };
                    setUser(params);
                    setWalletAddress(response.publicKey.toString());
                }
            } else {
                alert("Solana object not found! Get a Phantom Wallet 👻");
            }
        } catch (error) {
            console.error(error);
        }
    };
    const connectWallet = async () => {
        //@ts-ignore
        const { solana } = window;

        if (solana) {
            const response = await solana.connect();
            const user = await supabase
                .from("user")
                .upsert(
                    { walletAddress: response.publicKey.toString(), username: "" },
                    {
                        onConflict: "walletAddress",
                        ignoreDuplicates: true,
                    }
                )
                .select()
                .single();
            if (!user.count) {
                const currentUser = await supabase.from("user").select().eq("walletAddress", response.publicKey.toString()).single();
                let params = { ...currentUser.data, isShow: currentUser.data?.username ? false : true };
                setUser(params);
            } else {
                setUser({ ...user.data, isShow: true });
            }
            console.log("Connected with Public Key:", response.publicKey.toString());
            setWalletAddress(response.publicKey.toString());
        }
    };
    //@ts-ignore
    useEffectOnce(() => {
        const onLoad = async () => {
            try {
                await checkIfWalletIsConnected();
            } catch (error) {
                console.log({ error });
            }
        };
        onLoad();
        return () => onLoad();
    });

    return (
        <div className="flex justify-between items-center flex-wrap border-white  px-2 md:px-4 border-foreground backdrop-blur-sm">
            <div className="flex items-center justify-center gap-4 flex-wrap">
                <Link
                    href={"/"}
                    className="flex items-center">
                    <Image
                        src={"/logo.png"}
                        alt="logo"
                        width={600}
                        height={400}
                        className="w-full h-24"
                    />
                    {/* <span className="font-bold text-xl">Spin 2 win</span> */}
                </Link>
            </div>
            <div className="flex gap-x-8">
                <Link
                    href="/lootboxes.123"
                    className="text-base font-bold">
                    Apes Lootbox
                </Link>
                <Link
                    href="/live-draw"
                    className="text-base font-bold">
                    Live Draw
                </Link>
                <Link
                    href="/lootboxes/123"
                    className="text-base font-bold">
                    Leaderboard
                </Link>
            </div>
            {walletAddress ? (
                <button
                    onClick={() => setWalletAddress(null)}
                    className="bg-foreground text-background px-8 py-2 rounded-full">
                    Disconnect
                </button>
            ) : (
                <button
                    onClick={connectWallet}
                    className="bg-foreground text-background px-8 py-2 rounded-full">
                    Login
                </button>
            )}
        </div>
    );
}
