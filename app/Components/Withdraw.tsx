"use client";
import { useUserState } from "@/state/useUserState";
import { useEffect, useState } from "react";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";
const getWithdrawHistory = async (userId: string) => {
    const response = await supabase.from("withdraw").select("*").eq("userId", userId);
    return response.data;
};
export default function WithdrawModal() {
    const [tab, setTab] = useState("withdraw");
    const [state, setState] = useUserState();
    const [user] = useUserState();
    const { run, data, loading } = useRequest(getWithdrawHistory);
    const [form, setForm] = useState({ withdrawBalance: 0, availableBalance: 0, walletAddress: "" });
    const [withdrawType, setWithdrawType] = useState('ogx'); // Add state for withdraw type

    async function fetchSolBalance() {
        try {
            // Fetch the current SOL balance from the Solana API
            const response = await fetch(`https://api.solana.com`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "getBalance",
                    params: [""],
                }),
            });

            const data = await response.json();
            const solBalance = data.result / 1000000000; // Solana's smallest unit is lamports, so we divide by 1 billion to get SOL

            // console.log(`Current SOL balance: ${solBalance}`);
        } catch (error) {
            console.error("Error fetching SOL balance:", error);
        }
    }
    // url = "https://public-api.solscan.io/token/meta?tokenAddress=4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"

    // const calculateBalance = useMemo(() => {
    //     return form.withdrawBalance;
    // }, [form]);

    useEffect(() => {
        fetchSolBalance();
        run(user?.walletAddress);
    }, [user,run]);

    const updaetUserApes = async () => {
        const minus = state.apes - form.withdrawBalance;
        await supabase.from("user").update({ apes: minus }).eq("walletAddress", state.walletAddress);
        setState({ ...state, apes: minus });
    };

    const makeTransaction = async () => {
        if (!form.walletAddress || !form.withdrawBalance) return alert("Please fill all the fields");
        if (state.apes < form.withdrawBalance) {
            return alert("Insufficient OGX");
        }
        try {
            await supabase.from("withdraw").insert({
                apes: form.withdrawBalance,
                status: "PENDING",
                walletAddress: form.walletAddress,
                userId: state.walletAddress,
            });
            await updaetUserApes();
            alert("Transaction sent successfully");
        } catch (error) {
            console.error("Error making transaction:", error);
            alert("Error making transaction");
        }
    };
    if (!state.withdraw) return null;
    return (
        <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-black/40 z-50">
            <div className="z-50 justify-center items-center">
                <div className="relative p-4 w-full max-w-2xl h-[40rem] ">
                    <div className="relative bg-background rounded-lg shadow dark:bg-gray-700 h-full overflow-hidden">
                        <div className="flex items-center justify-between p-4 md:p-5 border-b rounded-t dark:border-gray-600">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mx-auto -mr-5">Withdraw OGX</h3>
                            <button
                                onClick={() => setState({ ...state, withdraw: false })}
                                type="button"
                                className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
                                data-modal-hide="default-modal">
                                <svg
                                    className="w-3 h-3"
                                    aria-hidden="true"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 14 14">
                                    <path
                                        stroke="currentColor"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                                    />
                                </svg>
                                <span className="sr-only">Close modal</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-2">
                            <button
                                onClick={() => setTab("withdraw")}
                                className={`border py-2 ${tab === "withdraw" ? "bg-gray-200" : ""}`}>
                                Withdraw
                            </button>
                            <button
                                onClick={() => setTab("history")}
                                className={`border py-2 ${tab === "history" ? "bg-gray-200" : ""}`}>
                                Withdraw History
                            </button>
                        </div>
                        {tab === "withdraw" && (
                            <div className="p-4 md:p-5 ">
                                <p className="text-base leading-relaxed text-gray-400 mb-3">
                                    Withdraw your tokens from your account. Choose between OGX tokens or SOL.
                                </p>
                                {/* Withdraw Type Tabs */}
                                <div className="flex space-x-4 border-b  mb-4">
                                    <button
                                        onClick={() => setWithdrawType('ogx')}
                                        className={`py-2 px-4 w-1/2 text-center ${withdrawType === 'ogx' ? 'border-b-2 border-[#ff914d] text-orange-600 bg-gray-200' : 'text-orange-600 bg-transparent'}`}>
                                        OGX Withdraw
                                    </button>
                                    <button
                                        onClick={() => setWithdrawType('sol')}
                                        className={`py-2 px-4 w-1/2 text-center ${withdrawType === 'sol' ? 'border-b-2 border-[#ff914d] text-orange-600 bg-gray-200' : 'text-orange-600 bg-transparent'}`}>
                                        SOL Withdraw
                                    </button>
                                </div>

                                {withdrawType === 'ogx' ? (
                                    // OGX Withdraw Content
                                    <>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-orange-600 mb-2">Available OGX</label>
                                                <input
                                                    value={state.apes || 0}
                                                    className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800"
                                                    disabled
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-orange-600 mb-2">Withdraw OGX</label>
                                                <input
                                                    value={form.withdrawBalance}
                                                    type="number"
                                                    min={0}
                                                    max={1000000}
                                                    placeholder="0"
                                                    className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800 focus:ring-[#ff914d]/50 focus:border-[#ff914d]/50"
                                                    onChange={(e) => setForm({ ...form, withdrawBalance: Number(e.target.value) })}
                                                />
                                            </div>
                                            {/* <div>
                                                <label className="block text-sm font-medium text-orange-600 mb-2">Wallet Address</label>
                                                <input
                                                    value={form.walletAddress}
                                                    type="text"
                                                    placeholder="Enter your wallet address"
                                                    className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800 focus:ring-[#ff914d]/50 focus:border-[#ff914d]/50"
                                                    onChange={(e) => setForm({ ...form, walletAddress: e.target.value })}
                                                />
                                            </div> */}
                                        </div>
                                    </>
                                ) : (
                                    // SOL Withdraw Content
                                    <>
                                        {/* <p className="text-xs mb-4">
                                            Withdraw SOL from your account. OGX tokens will be converted to SOL at the current exchange rate.
                                        </p> */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-orange-600 mb-2">Available OGX</label>
                                                <input
                                                    value={state.apes || 0}
                                                    className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800"
                                                    disabled
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-orange-600 mb-2">Convert OGX to SOL</label>
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800 focus:ring-[#ff914d]/50 focus:border-[#ff914d]/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-orange-600 mb-2">Estimated SOL</label>
                                                <input
                                                    className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800"
                                                    value="0"
                                                    disabled
                                                />
                                            </div>
                                            {/* <div>
                                                <label className="block text-sm font-medium text-orange-600 mb-2">Wallet Address</label>
                                                <input
                                                    placeholder="Enter your SOL wallet address"
                                                    className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800 focus:ring-[#ff914d]/50 focus:border-[#ff914d]/50"
                                                />
                                            </div> */}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {tab === "history" && (
                            <div className="p-4 md:p-5 overflow-x-auto w-full">
                                {loading ? (
                                    <div className="flex justify-center items-center py-8">
                                        <div className="w-12 h-12 border-4 border-[#ff914d] border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : (
                                    <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400 min-w-full table-fixed">
                                        <thead className="text-xs text-gray-700 uppercase dark:text-gray-400">
                                            <tr>
                                                <th
                                                    scope="col"
                                                    className="px-6 py-3 bg-gray-50 dark:bg-gray-800 w-1/3">
                                                    <span className="flex justify-center">Wallet</span>
                                                </th>
                                            
                                                <th
                                                    scope="col"
                                                    className="px-6 py-3 w-52 flex justify-center">
                                                     <span className="">OGX</span> / <span>SOL</span>
                                                </th>
                                                <th
                                                    scope="col"
                                                    className="px-6 py-3 bg-gray-50 dark:bg-gray-800 w-1/3 ">
                                                    <span className="flex justify-center">Status</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="w-full">
                                            {data?.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                                        No withdraw history found
                                                    </td>
                                                </tr>
                                            ) : (
                                                data?.map((item) => (
                                                    <tr
                                                        key={item?.id}
                                                        className="border-b border-gray-200 dark:border-gray-700 w-full">
                                                        <th
                                                            scope="row"
                                                            className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap bg-gray-50 dark:text-white dark:bg-gray-800 truncate">
                                                            {item?.walletAddress}
                                                        </th>
                                                        <td className="px-6 py-4">{item?.apes}</td>
                                                        <td className="px-6 py-4 bg-gray-50 dark:bg-gray-800">{item?.status}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}

                        <div className="flex absolute bottom-0 right-0 items-center p-4 md:p-5  rounded-b dark:border-gray-600">
                            {tab === "withdraw" && (
                                <button
                                    data-modal-hide="default-modal"
                                    type="button"
                                    onClick={withdrawType === 'ogx' ? makeTransaction : () => alert("SOL withdrawal functionality coming soon!")}
                                    className="px-5 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-[#f74e14] to-[#ff914d] text-white hover:opacity-90 focus:ring-2 focus:ring-[#ff914d]/50">
                                    {withdrawType === 'ogx' ? 'Withdraw OGX' : 'Withdraw SOL'}
                                </button>
                            )}
                            <button
                                onClick={() => setState({ ...state, withdraw: false })}
                                data-modal-hide="default-modal"
                                type="button"
                                className="px-5 py-2.5 text-sm font-medium rounded-lg border border-[#ff914d]/20 text-gray-300 hover:bg-[#ff914d]/20 focus:ring-2 focus:ring-[#ff914d]/50">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
