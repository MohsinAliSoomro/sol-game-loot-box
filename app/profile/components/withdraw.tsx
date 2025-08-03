"use client";

import { supabase } from "@/service/supabase";
import { useUserState } from "@/state/useUserState";
import { useRequest } from "ahooks";
import { useEffect } from "react";

const getWithdrawHistory = async (userId: string) => {
    const response = await supabase.from("withdraw").select("*").eq("userId", userId);
    return response.data;
};
export default function WithdrawHistory() {
    const [user] = useUserState();
    const { run, data, loading } = useRequest(getWithdrawHistory);

    useEffect(() => {
        if (user.walletAddress) {
            run(user.walletAddress);
        }
    }, [user,run]);

    if (loading) return <div>Loading...</div>;
    return (
        <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
            <h1>Withdraw History</h1>
            <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase dark:text-gray-400">
                    <tr>
                        <th
                            scope="col"
                            className="px-6 py-3 bg-gray-50 dark:bg-gray-800">
                            Wallet
                        </th>
                        <th
                            scope="col"
                            className="px-6 py-3">
                            OGX
                        </th>
                        <th
                            scope="col"
                            className="px-6 py-3 bg-gray-50 dark:bg-gray-800">
                            Status
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {data?.map((item) => (
                        <tr
                            key={item?.id}
                            className="border-b border-gray-200 dark:border-gray-700">
                            <th
                                scope="row"
                                className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap bg-gray-50 dark:text-white dark:bg-gray-800">
                                {item?.walletAddress}
                            </th>
                            <td className="px-6 py-4">{item?.apes}</td>
                            <td className="px-6 py-4 bg-gray-50 dark:bg-gray-800">{item?.status}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
