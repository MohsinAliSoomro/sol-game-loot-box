"use client";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";

/**
 * Fetches the 10 most recent transactions from the database.
 * @returns A promise that resolves to an array of the 10 most recent transactions.
 */
async function transaction() {
    return await supabase.from("transaction").select().limit(10);
}
/**
 * The LiveDraw component. It displays the leaderboard of the top 10 users that have purchased the most lootboxes.
 * @returns A JSX element representing the LiveDraw component.
 */

export default function LiveDraw() {
    const { data, loading, error } = useRequest(transaction);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error</div>;

    return (
        <div className="flex justify-center items-center flex-col">
            <h1 className="text-4xl font-bold my-4">Leaderboard</h1>
            <div className="">
                <button className="px-4 py-2 rounded-lg border bg-foreground text-white">Volume</button>
                <button className="px-4 py-2 rounded-lg border bg-foreground text-white">Affiliate</button>
            </div>
            <div className="relative overflow-x-auto shadow-md sm:rounded-lg w-6/12">
                <table className="w-full text-sm text-left rtl:text-right text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase  dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th
                                scope="col"
                                className="px-6 py-3">
                                Rank
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3">
                                Username
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3">
                                Price
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data?.data?.map((tran, index) => (
                            <tr
                                key={tran.transactionId}
                                className="even:bg-background odd:bg-gray-50 border-b dark:border-gray-700">
                                <td className="px-6 py-4">{index + 1}</td>
                                <th
                                    scope="row"
                                    className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                    {tran.username}
                                </th>
                                {/* <td className="px-6 py-4">{tran.name}</td> */}
                                <td className="px-6 py-4">SOL {tran.sol}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
