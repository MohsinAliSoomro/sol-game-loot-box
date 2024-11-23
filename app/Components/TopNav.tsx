"use-client";
import { supabase } from "@/service/supabase";
import { useUserState } from "@/state/useUserState";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useEffectOnce } from "react-use";

/**
 * Top navigation bar for the website.
 * It displays the logo, links to different pages, and the user's account information.
 * If the user is not logged in, it displays a "Login" button to connect their Phantom wallet.
 * If the user is logged in, it displays their account balance and allows them to deposit, withdraw, or view their rewards.
 */
export default function TopNav() {
    const [walletAddress, setWalletAddress] = useState(null);
    const [user, setUser] = useUserState();
    const router = useRouter();
    /**
     * Checks if a user has a connected Phantom wallet.
     * If yes, it fetches the user's info from the database and updates the state.
     * If no, it alerts the user to get a Phantom wallet.
     */
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
    /**
     * Connects to a Phantom wallet and checks if a user with the same wallet address exists in the database.
     * If the user exists, it fetches the user's info and updates the state.
     * If the user does not exist, it creates a new user with the wallet address and updates the state.
     * If a user is already logged in, it logs out the user and logs in the new user.
     */
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
        /**
         * Checks if a user has a connected Phantom wallet.
         * If yes, it fetches the user's info from the database and updates the state.
         * If no, it alerts the user to get a Phantom wallet.
         */
        const onLoad = async () => {
            try {
                await checkIfWalletIsConnected();
            } catch (error) {
                console.log({ error });
                alert("Error connecting to wallet");
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
                    href="/"
                    className="text-base font-bold">
                    Apes Lootbox
                </Link>
                <Link
                    href="/live-draw"
                    className="text-base font-bold">
                    Jackpot
                </Link>
                <Link
                    href="/leaderboard"
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
                            <p className="text-center">{user?.apes || 0}</p>
                        </div>
                        <div className="text-xs pt-2">
                            <p className="text-center">Volume</p>
                            <p className="text-center">100000000</p>
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
                    |{" "}
                    <button
                        onClick={() => router.push("/withdraw")}
                        className="text-xs">
                        Withdraw
                    </button>{" "}
                    |{" "}
                    <Link
                        className="text-xs"
                        href={"/affiliate"}>
                        Affiliate
                    </Link>
                    |{" "}
                    <button
                        className="text-xs w-5 h-5"
                        onClick={() => setWalletAddress(null)}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            version="1.1"
                            width="20"
                            height="20"
                            className="mt-1"
                            fill="currentColor"
                            viewBox="0 0 256 256">
                            <defs></defs>
                            <g transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)">
                                <path
                                    d="M 69.313 54.442 c -0.397 0 -0.798 -0.118 -1.147 -0.363 c -0.904 -0.636 -1.122 -1.883 -0.487 -2.786 l 10.118 -14.399 L 67.679 22.495 c -0.635 -0.904 -0.417 -2.151 0.487 -2.786 c 0.904 -0.637 2.151 -0.417 2.786 0.486 l 10.926 15.549 c 0.484 0.69 0.484 1.61 0 2.3 L 70.952 53.592 C 70.563 54.146 69.943 54.442 69.313 54.442 z"
                                    transform=" matrix(1 0 0 1 0 0) "
                                    stroke-linecap="round"
                                />
                                <path
                                    d="M 57.693 30.092 c 1.104 0 2 -0.896 2 -2 V 2 c 0 -1.104 -0.896 -2 -2 -2 H 9.759 C 9.746 0 9.735 0.003 9.722 0.004 C 9.685 0.004 9.648 0.012 9.611 0.015 c -0.122 0.009 -0.24 0.027 -0.354 0.057 C 9.211 0.083 9.168 0.098 9.124 0.113 C 9.011 0.151 8.903 0.198 8.8 0.255 C 8.775 0.269 8.747 0.274 8.723 0.289 c -0.012 0.007 -0.02 0.018 -0.031 0.025 c -0.13 0.083 -0.252 0.177 -0.36 0.287 C 8.313 0.62 8.299 0.643 8.281 0.662 C 8.196 0.757 8.12 0.859 8.053 0.969 C 8.029 1.009 8.008 1.05 7.987 1.091 C 7.935 1.192 7.893 1.297 7.858 1.407 C 7.845 1.449 7.83 1.489 7.82 1.532 C 7.783 1.683 7.759 1.838 7.759 2 v 69.787 c 0 0.17 0.028 0.333 0.068 0.49 c 0.011 0.043 0.025 0.083 0.039 0.124 c 0.04 0.123 0.091 0.239 0.152 0.35 c 0.019 0.033 0.034 0.068 0.054 0.1 c 0.086 0.135 0.185 0.26 0.3 0.371 c 0.022 0.021 0.047 0.037 0.07 0.058 c 0.102 0.09 0.214 0.169 0.333 0.237 c 0.021 0.012 0.037 0.03 0.058 0.042 l 31.016 16.213 C 40.139 89.925 40.457 90 40.775 90 c 0.359 0 0.718 -0.097 1.036 -0.289 c 0.598 -0.362 0.964 -1.012 0.964 -1.711 V 73.787 h 14.918 c 1.104 0 2 -0.896 2 -2 V 45 c 0 -1.104 -0.896 -2 -2 -2 s -2 0.896 -2 2 v 24.787 H 42.775 V 18.213 c 0 -0.745 -0.414 -1.428 -1.074 -1.772 L 17.902 4 h 37.791 v 24.092 C 55.693 29.196 56.589 30.092 57.693 30.092 z"
                                    transform=" matrix(1 0 0 1 0 0) "
                                    stroke-linecap="round"
                                />
                                <path
                                    d="M 80.241 38.894 H 47.536 c -1.104 0 -2 -0.896 -2 -2 s 0.896 -2 2 -2 h 32.705 c 1.104 0 2 0.896 2 2 S 81.346 38.894 80.241 38.894 z"
                                    transform=" matrix(1 0 0 1 0 0) "
                                    stroke-linecap="round"
                                />
                            </g>
                        </svg>
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
