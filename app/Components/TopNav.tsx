"use-client";
import { supabase } from "@/service/supabase";
import { useUserState } from "@/state/useUserState";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useEffectOnce } from "react-use";

export default function TopNav() {
    const [user, setUser] = useUserState();
    const [open, setOpen] = useState(false);
    const [isLogin, setIsLogin] = useState(false);
    const router = useRouter();

    const handleSocialLogin = async (provider: "google" | "discord") => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: provider,
            options: {
                redirectTo: `https://spin2win.vibingapes.com/`,
            },
        });
        console.log({ data, error });
        debugger;
    };

    useEffect(() => {
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === "INITIAL_SESSION" && session?.user) {
                await saveUserToDatabase(session.user);
            }
        });
        return () => data?.subscription.unsubscribe();
    }, []);
    const saveUserToDatabase = async (user: any) => {
        try {
            // Check if user already exists
            const { data: existingUser, error: fetchError } = await supabase.from("user").select().eq("id", user.id).single();
            if (fetchError && fetchError.code !== "PGRST116") {
                throw fetchError;
            }

            const userData = {
                uid: user.id,
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name,
                avatar_url: user.user_metadata?.avatar_url,
                provider: user.app_metadata?.provider,
                updated_at: new Date().toISOString(),
                apes: 0,
            };

            if (!existingUser) {
                // Create new user profile
                const { error: insertError } = await supabase.from("user").insert({
                    ...userData,
                    created_at: new Date().toISOString(),
                });
                if (insertError) throw insertError;
            } else {
                // Update existing user profile
                // const { error: updateError } = await supabase.from("user").update(userData).eq("id", user.id);
                // if (updateError) throw updateError;
            }
        } catch (error) {
            console.error("Error saving user:", error);
        }
    };

    // const checkIfWalletIsConnected = async () => {
    //     try {
    //         //@ts-ignore
    //         const { solana } = window;

    //         if (solana) {
    //             if (solana.isPhantom) {
    //                 const response = await solana.connect({ onlyIfTrusted: true });
    //                 const currentUser = await supabase.from("user").select().eq("walletAddress", response.publicKey.toString()).single();
    //                 let params = { ...currentUser.data, isShow: currentUser.data?.username ? false : true };
    //                 setUser(params);
    //                 setWalletAddress(response.publicKey.toString());
    //             }
    //         } else {
    //             alert("Solana object not found! Get a Phantom Wallet 👻");
    //         }
    //     } catch (error) {
    //         console.error(error);
    //     }
    // };

    // const connectWallet = async () => {
    //     //@ts-ignore
    //     const { solana } = window;

    //     if (solana) {
    //         const response = await solana.connect();
    //         const user = await supabase
    //             .from("user")
    //             .upsert(
    //                 { walletAddress: response.publicKey.toString(), username: "" },
    //                 {
    //                     onConflict: "walletAddress",
    //                     ignoreDuplicates: true,
    //                 }
    //             )
    //             .select()
    //             .single();
    //         if (!user.count) {
    //             const currentUser = await supabase.from("user").select().eq("walletAddress", response.publicKey.toString()).single();
    //             let params = { ...currentUser.data, isShow: currentUser.data?.username ? false : true };
    //             setUser(params);
    //         } else {
    //             setUser({ ...user.data, isShow: true });
    //         }
    //         console.log("Connected with Public Key:", response.publicKey.toString());
    //         setWalletAddress(response.publicKey.toString());
    //     }
    // };
    //@ts-ignore
    useEffectOnce(() => {
        const onLoad = async () => {
            try {
                const response = await supabase.auth.getSession();
                const userId = response.data.session?.user.id;
                const userGet = await supabase.from("user").select().eq("id", userId).single();
                setUser({ ...user, ...userGet.data });
                setIsLogin(response.data.session ? true : false);
                // await checkIfWalletIsConnected();
            } catch (error) {
                console.log({ error });
                alert("Error connecting to wallet");
            }
        };
        onLoad();
        return () => onLoad();
    });
    const logout = async () => {
        await supabase.auth.signOut();
        router.push("/");
        setIsLogin(false);
    };
    return (
        <div className="flex justify-between items-center flex-wrap border-white py-4 px-2 md:px-4 border-foreground backdrop-blur-sm relative">
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
            <div className="flex gap-x-8">
                <Link
                    href="/"
                    className="text-base font-bold">
                    OGX Lootbox
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
            {isLogin ? (
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
                        onClick={() => setUser({ ...user, withdraw: true })}
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
                        onClick={logout}>
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
                    onClick={() => setOpen(!open)}
                    className="bg-foreground text-background px-8 py-2 rounded-full">
                    Login
                </button>
            )}
            {open && (
                <div
                    style={{ zIndex: 9999 }}
                    className="absolute top-0 left-0 backdrop-blur-sm bg-slate-400/20 z-50 flex justify-center items-center h-screen w-screen">
                    <div className="bg-background w-2/5 rounded-xl p-2 relative py-10">
                        <h1 className="text-2xl text-center my-2">Sign In</h1>
                        <button
                            onClick={() => setOpen(false)}
                            className="absolute top-2 right-2">
                            <svg
                                width="32px"
                                height="32px"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <circle
                                    opacity="0.5"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="#f645ff"
                                    stroke-width="1.5"
                                />
                                <path
                                    d="M14.5 9.50002L9.5 14.5M9.49998 9.5L14.5 14.5"
                                    stroke="#f645ff"
                                    stroke-width="1.5"
                                    stroke-linecap="round"
                                />
                            </svg>
                        </button>
                        <button
                            onClick={() => handleSocialLogin("google")}
                            className="my-4 flex mx-auto">
                            <svg
                                width="40px"
                                height="40px"
                                viewBox="-3 0 262 262"
                                xmlns="http://www.w3.org/2000/svg"
                                preserveAspectRatio="xMidYMid">
                                <path
                                    d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
                                    fill="#34A853"
                                />
                                <path
                                    d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
                                    fill="#EB4335"
                                />
                            </svg>
                        </button>
                        <button
                            onClick={() => handleSocialLogin("discord")}
                            className="my-4 flex mx-auto">
                            <svg
                                width="40px"
                                height="40px"
                                viewBox="0 -28.5 256 256"
                                version="1.1"
                                xmlns="http://www.w3.org/2000/svg"
                                preserveAspectRatio="xMidYMid">
                                <g>
                                    <path
                                        d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"
                                        fill="#5865F2"
                                        fill-rule="nonzero"></path>
                                </g>
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
