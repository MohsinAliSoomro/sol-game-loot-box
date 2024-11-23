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
        console.log({ data });
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
                            <div className="flex h-full flex-col overflow-y-scroll bg-background shadow-xl">
                                <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                                    <div className="flex items-start justify-between">
                                        <h2
                                            className="text-lg font-medium text-foreground"
                                            id="slide-over-title">
                                            Available Rewards
                                        </h2>
                                        <div className="ml-3 flex h-7 items-center">
                                            <button
                                                onClick={() => setCart({ ...user, cart: false })}
                                                type="button"
                                                className="relative -m-2 p-2 text-gray-400 hover:text-gray-500">
                                                <span className="absolute -inset-0.5"></span>
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
                                    </div>

                                    <div className="mt-8">
                                        <div className="flow-root">
                                            <ul
                                                role="list"
                                                className="-my-6 divide-y divide-gray-200">
                                                {
                                                    //@ts-ignore
                                                    data?.data?.map((item, index) => (
                                                        <li
                                                            key={index}
                                                            className="flex py-6">
                                                            <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md border border-gray-200">
                                                                <img
                                                                    src={item?.image}
                                                                    alt="Salmon orange fabric pouch with match zipper, gray zipper pull, and adjustable hip belt."
                                                                    className="h-full w-full object-cover object-center"
                                                                />
                                                            </div>

                                                            <div className="ml-4 flex flex-1 flex-col">
                                                                <div>
                                                                    <div className="flex justify-between text-base font-medium text-gray-900">
                                                                        <h3>
                                                                            <a
                                                                                href="#"
                                                                                className="text-foreground">
                                                                                {item?.name}
                                                                            </a>
                                                                        </h3>
                                                                        <p className="ml-4">${item?.sol}</p>
                                                                    </div>
                                                                    {/* <p className="mt-1 text-sm text-gray-500">Salmon</p> */}
                                                                </div>
                                                                <div className="flex flex-1 items-end justify-between text-sm">
                                                                    <p className="text-gray-500">Qty 1</p>
                                                                </div>
                                                            </div>
                                                        </li>
                                                    ))
                                                }
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-200 px-4 py-6 sm:px-6">
                                    <div className="flex justify-between text-base font-medium text-gray-900">
                                        <p>Rewards Amount</p>
                                        <p>${sum(data)}</p>
                                    </div>
                                    {/* <p className="mt-0.5 text-sm text-gray-500">Shipping and taxes calculated at checkout.</p> */}
                                    <div className="mt-6">
                                        <a
                                            href="#"
                                            className="flex items-center justify-center rounded-md border border-transparent bg-foreground px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700">
                                            Checkout
                                        </a>
                                    </div>
                                    <div className="mt-6 flex justify-center text-center text-sm text-gray-500">
                                        <p>
                                            <button
                                                type="button"
                                                className="font-medium text-foreground hover:text-indigo-500">
                                                Apes Lootbox
                                                <span aria-hidden="true"> &rarr;</span>
                                            </button>
                                        </p>
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
