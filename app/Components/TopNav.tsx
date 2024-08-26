"use-client";
import { supabase } from "@/service/supabase";
import { useUserState } from "@/state/useUserState";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useEffectOnce } from "react-use";

export default function TopNav() {
    const [walletAddress, setWalletAddress] = useState(null);
    const [user, setUser] = useUserState();

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
        <div className="flex justify-between items-center flex-wrap border-white py-4 px-2 md:px-4 border-foreground backdrop-blur-sm">
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
                    LiveDraw
                </Link>
                <Link
                    href="/lootboxes/123"
                    className="text-base font-bold">
                    Leaderboard
                </Link>
            </div>
            {walletAddress ? (
                <div>
                    <div className="border border-foreground flex justify-between gap-6 rounded-lg px-10 pt-4 pb-2 relative h-16">
                        <span className="absolute -top-2 left-16 bg-background px-2 text-lg">My Account</span>
                        <div className="text-xs pt-2">
                            <p>Apes</p>
                            <p className="text-center">0</p>
                        </div>
                        <div className="text-xs pt-2">
                            <p>USD</p>
                            <p className="text-center">0</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setUser({ ...user, cart: true })}
                        className="text-xs">
                        Reward
                    </button>{" "}
                    |{" "}
                    <button
                        onClick={() => setUser({ ...user, purchase: true })}
                        className="text-xs">
                        Deposit
                    </button>{" "}
                    | <button className="text-xs">Withdraw</button> |{" "}
                    <button
                        className="text-xs"
                        onClick={() => setWalletAddress(null)}>
                        Logout
                    </button>
                </div>
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
