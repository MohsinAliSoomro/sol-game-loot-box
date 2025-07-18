"use client";
import { supabase } from "@/service/supabase";
import { useUserState } from "@/state/useUserState";
import { useRequest } from "ahooks";
import { useEffect } from "react";

/**
 * Fetches the prizes won by a user, but have not been withdrawn.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<SupabaseClient<Database>['data'] | Error>} - The prizes won by the user, or an error.
 */
const getWinPrizes = async (userId: string) => {
    try {
        const response = await supabase.from("prizeWin").select().eq("userId", userId).eq("isWithdraw", false);
        return response;
    } catch (error) {
        return error;
    }
};

/**
 * The sidebar cart component. It displays the available rewards for the user in a modal.
 * The user can checkout or view the rewards in the modal.
 * @returns A JSX element representing the sidebar cart component.
 */
export default function SidebarCart() {
    const { data, loading, error, run } = useRequest(getWinPrizes, {
        manual: true,
    });
    const [user, setCart] = useUserState();
    useEffect(() => {
        if (user) {
            run(user?.walletAddress);
        }
    }, [user]);

    if (!user.cart) return null;

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error</div>;

    /**
     * Calculate the sum of all sol in the prize win data.
     * @param data the prize win data
     * @returns the sum of all sol
     */
    const sum = (data: any) => {
        let sum = 0;
        data?.data?.map((i: any) => {
            sum = sum + Number(i?.sol);
        });
        return sum;
    };
    return (
        <div
            className="relative z-50"
            aria-labelledby="slide-over-title"
            role="dialog"
            aria-modal="true">
            <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                aria-hidden="true"></div>

            <div className="fixed inset-0 overflow-hidden">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                        <div className="pointer-events-auto w-screen max-w-md">
                            <div className="flex h-full flex-col bg-[#ff914d]/90" style={{margin:'10px 10px 10px 10px'}}>
                                <div className="flex items-center justify-between p-4 relative">
                                    <h2 className="text-2xl font-bold text-white w-full text-center">
                                        Available Rewards
                                    </h2>
                                    <button
                                        onClick={() => setCart({ ...user, cart: false })}
                                        type="button"
                                        className="absolute right-4 text-white hover:text-white/80">
                                        <span className="sr-only">Close panel</span>
                                        <svg
                                            className="h-6 w-6"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            strokeWidth="1.5"
                                            stroke="currentColor"
                                            aria-hidden="true">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M6 18L18 6M6 6l12 12"
                                            />
                                        </svg>
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-white/10 [&::-webkit-scrollbar-thumb]:bg-white/40 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/50">
                                    <div className="px-4 py-2">
                                        <div className="space-y-4">
                                            {/* {data?.data?.map((item, index) => (
                                                <div key={index} className="flex items-center bg-white/10 rounded-lg p-4">
                                                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg">
                                                        <Image
                                                            src={item?.image}
                                                            alt={item?.name}
                                                            className="h-full w-full object-cover object-center"
                                                        />
                                                    </div>
                                                    <div className="ml-4 flex-1">
                                                        <div className="flex justify-between items-center">
                                                            <h3 className="text-lg font-bold text-white">
                                                                {item?.name}
                                                            </h3>
                                                            <p className="text-lg font-bold text-white">${item?.sol}</p>
                                                        </div>
                                                        <p className="text-white/60 text-sm">QTY {1}</p>
                                                    </div>
                                                </div>
                                            ))} */}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-white/10">
                                    <div className="flex justify-between text-lg font-bold text-white mb-4">
                                        <p>Rewards Amount</p>
                                        <p>${sum(data)}</p>
                                    </div>
                                    <button
                                        onClick={() => {/* handle checkout */}}
                                        className="w-full bg-[#ff4500] text-white py-4 rounded-lg text-lg font-bold hover:opacity-90 transition-opacity mb-4">
                                        Checkout
                                    </button>
                                    <div className="text-center">
                                        <button
                                            onClick={() => setCart({ ...user, cart: false })}
                                            className="text-white hover:text-white/80 font-medium">
                                            OGX Lootbox <span aria-hidden="true">→</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
