"use client";
import { useEffect, useState } from "react";

export default function PurchaseModal() {
    const [form, setForm] = useState({
        amount: 0,
        balance: 0,
        availableBalance: 0,
    });

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

            // Parse the response as JSON
            const data = await response.json();

            // Extract the SOL balance from the response
            const solBalance = data.result / 1000000000; // Solana's smallest unit is lamports, so we divide by 1 billion to get SOL

            console.log(`Current SOL balance: ${solBalance}`);
        } catch (error) {
            console.error("Error fetching SOL balance:", error);
        }
    }
    // url = "https://public-api.solscan.io/token/meta?tokenAddress=4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"

    useEffect(() => {
        fetchSolBalance();
    }, []);

    return (
        <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-black/40">
            <div className="z-50 justify-center items-center">
                <div className="relative p-4 w-full max-w-2xl max-h-full">
                    <div className="relative bg-background rounded-lg shadow dark:bg-gray-700">
                        <div className="flex items-center justify-between p-4 md:p-5 border-b rounded-t dark:border-gray-600">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mx-auto -mr-5">Deposite Apes</h3>
                            <button
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
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                                    />
                                </svg>
                                <span className="sr-only">Close modal</span>
                            </button>
                        </div>
                        <div className="p-4 md:p-5 ">
                            <p className="text-base leading-relaxed text-gray-500 dark:text-gray-400">
                                With less than a month to go before the European Union enacts new consumer privacy laws for its citizens, companies around the world are updating their terms of service
                                agreements to comply.
                            </p>
                            <label>Deposite Apes ($)</label>
                            <input
                                value={5}
                                className="w-full p-2 border border-gray-300 rounded-md"
                            />
                            <label className="mt-6 flex">Balance Apes</label>
                            <input
                                className="w-full p-2 border border-gray-300 rounded-md"
                                value={5 * 100}
                            />

                            <label className="mt-6 flex">Availabe Apes</label>
                            <input
                                value={0}
                                className="w-full p-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div className="flex items-center p-4 md:p-5 border-t border-gray-200 rounded-b dark:border-gray-600">
                            <button
                                data-modal-hide="default-modal"
                                type="button"
                                className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                Purchase
                            </button>
                            <button
                                data-modal-hide="default-modal"
                                type="button"
                                className="py-2.5 px-5 ms-3 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
