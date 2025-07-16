import { supabase } from "@/service/supabase";
import { useUserState } from "@/state/useUserState";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useEffectOnce } from "react-use";

function formatNumber(num: number | undefined) {
  if (num === undefined || num === null) return 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return num;
}

export default function TopNav() {
    const [user, setUser] = useUserState();
    const [open, setOpen] = useState(false);
    const [isLogin, setIsLogin] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const router = useRouter();

    const handleSocialLogin = async (provider: "google" | "discord") => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: provider,
            options: {
                redirectTo: `https://spin2win.vibingapes.com/`,
            },
        });
        console.log({ data, error });
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
                const { error: insertError } = await supabase.from("user").insert({
                    ...userData,
                    created_at: new Date().toISOString(),
                });
                if (insertError) throw insertError;
            }
        } catch (error) {
            console.error("Error saving user:", error);
        }
    };
//@ts-ignore
    useEffectOnce(() => {
        const onLoad = async () => {
            try {
                const response = await supabase.auth.getSession();
                const userId = response.data.session?.user.id;
                const userGet = await supabase.from("user").select().eq("id", userId).single();
                setUser({ ...user, ...userGet.data });
                setIsLogin(response.data.session ? true : false);
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

    const handleOpenModal = async () => {
        // await router.push('/');
        setOpen(true);
    };

    const handleCloseModal = () => {
        setOpen(false);
    };

    return (
        <div className="flex flex-col md:flex-row justify-between items-center border-white py-4 px-2 md:px-4 border-foreground backdrop-blur-sm relative">
            {open && <div className="backdrop-blur"></div>}
            {/* Logo and Mobile Menu Button */}
            <div className="w-full md:w-1/4 flex items-center justify-between md:justify-start">
                <Link href={"/"} className="flex items-center">
                    <Image
                        src={"/logo.png"}
                        alt="logo"
                        width={600}
                        height={400}
                        className="w-full h-16 md:h-24"
                    />
                </Link>
                {/* Mobile menu button */}
                <button
                    className="md:hidden text-foreground"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        {mobileMenuOpen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                </button>
            </div>

            {/* Navigation links */}
            <div className={`${mobileMenuOpen ? 'flex' : 'hidden'} md:flex w-full md:w-2/4 flex-col md:flex-row justify-center items-center mt-4 md:mt-0`}>
                <div className="flex flex-col md:flex-row gap-4 md:gap-8 w-full md:w-auto items-center">
                    <Link
                        href="/"
                        className="text-base font-bold hover:text-gray-300 transition-colors w-full text-center py-2 md:py-0"
                    >
                        Spinloot
                    </Link>
                    <Link
                        href="/live-draw"
                        className="text-base font-bold hover:text-gray-300 transition-colors w-full text-center py-2 md:py-0"
                    >
                        Jackpot
                    </Link>
                    <Link
                        href="/leaderboard"
                        className="text-base font-bold hover:text-gray-300 transition-colors w-full text-center py-2 md:py-0"
                    >
                        Leaderboard
                    </Link>
                </div>
            </div>

      {/* Auth section */}
      <div
        className={`${
          mobileMenuOpen ? "flex" : "hidden"
        } md:flex w-full md:w-1/4 flex-col items-center md:items-end mt-4 md:mt-0`}
      >
        {isLogin? (
          <div className="flex flex-col items-center md:items-end gap-4">
            <div className="flex items-center gap-4 w-full">
              <div className="border border-foreground flex-1 flex justify-between flex-col  rounded-lg px-6 md:px-10   relative  ">
                <div className="w-32 relative bottom-3 text-center bg-orange-500  bg-background left-[20%]">
                  My Account
                </div>
                <div className="items flex justify-between">
                  <div className="text-xs pt-2 pb-2">
                    <p>OGX</p>
                    <p className="text-center">{formatNumber(user?.apes)}</p>
                  </div>
                  <div className="text-xs pt-2">
                    <p className="text-center">Volume</p>
                    <p className="text-center">{formatNumber(100000000)}</p>
                  </div>
                  <div className="text-xs pt-2">
                    <p>SOL</p>
                    <p className="text-center">{formatNumber(user?.apes)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex  justify-center md:justify-end gap-2 text-xs">
              <button
                onClick={() => setUser({ ...user, cart: true })}
                className="hover:text-gray-300 transition-colors"
              >
                Reward
              </button>
              <span>|</span>
              <button
                onClick={() => setUser({ ...user, purchase: true })}
                className="hover:text-gray-300 transition-colors"
              >
                Deposit
              </button>
              <span>|</span>
              <button
                onClick={() => setUser({ ...user, withdraw: true })}
                className="hover:text-gray-300 transition-colors"
              >
                Withdraw
              </button>

              <span>|</span>

                                <button
                                onClick={logout}
                                className="flex justify-around"
                            >
                               
                                Logout
                            {/* <svg
                                        viewBox="0 0 512 512"
                                        className="w-3 h-3 fill-current"
                                        // style={{fontSize:'10px',}}
                                    >
                                        <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z" />
                                    </svg> */}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={handleOpenModal}
                        className=" text-background px-8 py-2 rounded-full hover:bg-opacity-90 transition-colors w-full md:w-auto bg-orange-500"
                    >
                        Login
                    </button>
                )}
            </div>

            {/* Login modal */}
            {open && (
                <div
                    style={{ zIndex: 9999 }}
                    className=" fixed top-0 left-0 backdrop-blur-md bg-black/60 z-50 flex justify-center items-center h-screen w-screen "
                >
                    <div className="bg-background bg-orange-500 w-full md:w-[400px] rounded-2xl p-6 relative shadow-xl border border-foreground/20 mx-4 overflow-hidden">
                        {/* Background pattern */}
                        <div className="absolute inset-0 opacity-10" style={{
                            backgroundImage: `url('/lv-pattern.png')`,
                            backgroundSize: '120px',
                            backgroundRepeat: 'repeat',
                        }}></div>

                        {/* Close button */}
                        <button
                            onClick={handleCloseModal}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors duration-200 text-foreground"
                        >
                            {/* <svg
                            className="me-2"
                                width="24px"
                                height="24px"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M14.5 9.50002L9.5 14.5M9.49998 9.5L14.5 14.5"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                />
                            </svg> */}
                            <p className="ms-5">x</p>
                        </button>

                        {/* Header */}
                        <div className="mb-8 text-center relative z-10">
                            <h1 className="text-3xl font-bold text-foreground">SIGN IN</h1>
                            <p className="text-foreground/60 mt-2">Connect to access your account</p>
                        </div>

                        {/* Buttons */}
                        <div className="space-y-4 relative z-10">
                            <button
                                onClick={() => handleSocialLogin("google")}
                                className="flex items-center justify-center gap-3 w-full bg-white text-black py-3 px-6 rounded-lg hover:bg-gray-100 transition-colors duration-200 font-medium"
                            >
                                <svg
                                    width="24px"
                                    height="24px"
                                    viewBox="-3 0 262 262"
                                    xmlns="http://www.w3.org/2000/svg"
                                    preserveAspectRatio="xMidYMid"
                                >
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
                                Continue with Google
                            </button>

                            <button
                                onClick={() => handleSocialLogin("discord")}
                                className="flex items-center justify-center gap-3 w-full bg-[#5865F2] text-white py-3 px-6 rounded-lg hover:bg-[#4752c4] transition-colors duration-200 font-medium"
                            >
                                <svg
                                    width="24px"
                                    height="24px"
                                    viewBox="0 -28.5 256 256"
                                    version="1.1"
                                    xmlns="http://www.w3.org/2000/svg"
                                    preserveAspectRatio="xMidYMid"
                                >
                                    <g>
                                        <path
                                            d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"
                                            fill="white"
                                            fillRule="nonzero"
                                        ></path>
                                    </g>
                                </svg>
                                Continue with Discord
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="flex items-center my-6 relative z-10">
                            <div className="flex-grow bg-gray-700 h-px"></div>
                            <span className="mx-3 text-gray-400 text-sm">OR</span>
                            <div className="flex-grow bg-gray-700 h-px"></div>
                        </div>

            {/* Guest option */}
            <button
              onClick={handleCloseModal}
              className="w-full border border-gray-700 text-gray-300 py-3 px-6 rounded-lg hover:bg-gray-800 transition-colors duration-200 font-medium relative z-10"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
