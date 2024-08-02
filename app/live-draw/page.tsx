"use client";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";

async function transaction() {
    return await supabase.from("transaction").select().limit(10);
}
function truncateString(inputString: any) {
    if (inputString.length > 20) {
        return inputString.slice(0, 20);
    } else {
        return inputString;
    }
}

export default function LiveDraw() {
    const { data, loading, error } = useRequest(transaction);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error</div>;

    return (
        <div className="flex justify-center items-center flex-col">
            <h1 className="text-4xl font-bold my-4">Live Draw</h1>
            <div className="relative overflow-x-auto shadow-md sm:rounded-lg w-10/12">
                <table className="w-full text-sm text-left rtl:text-right text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase  dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th
                                scope="col"
                                className="px-6 py-3">
                                Username
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3">
                                TxId
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3">
                                lootbox Name
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3">
                                Price
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data?.data?.map((tran) => (
                            <tr
                                key={tran.transactionId}
                                className="even:bg-background odd:bg-gray-50 border-b dark:border-gray-700">
                                <th
                                    scope="row"
                                    className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                                    {tran.username}
                                </th>
                                <td className="px-6 py-4">{truncateString(tran.transactionId)}</td>
                                <td className="px-6 py-4">{tran.name}</td>
                                <td className="px-6 py-4">SOL {tran.sol}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
