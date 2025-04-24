"use client";
import { useUserState } from "@/state/useUserState";
import { useEffect, useMemo, useState } from "react";
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, clusterApiUrl } from "@solana/web3.js";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";

const DepositHistory = ({ deposits }) => {
    return (
        <div className="deposit-history w-full">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Deposit History</h2>
            {deposits.length > 0 ? (
                <div className="p-4 md:p-5 overflow-x-auto w-full">
                    <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400 min-w-full table-fixed">
                        <thead className="text-xs text-gray-700 uppercase dark:text-gray-400">
                            <tr>
                                <th scope="col" className="px-6 py-3 bg-gray-50 dark:bg-gray-800 w-1/3">Wallet</th>
                                <th scope="col" className="px-6 py-3 w-1/3">Amount</th>
                                <th scope="col" className="px-6 py-3 bg-gray-50 dark:bg-gray-800 w-1/3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="w-full">
                            {deposits.map((deposit, index) => (
                                <tr key={index} className="border-b border-gray-200 dark:border-gray-700 w-full">
                                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap bg-gray-50 dark:text-white dark:bg-gray-800 truncate">
                                        {deposit.wallet}
                                    </th>
                                    <td className="px-6 py-4">{deposit.apes}</td>
                                    <td className="px-6 py-4 bg-gray-50 dark:bg-gray-800">{deposit.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-gray-500">No deposit history found</p>
            )}
        </div>
    );
};

export default function PurchaseModal() {
    const [state, setState] = useUserState();
    const [form, setForm] = useState({
        amount: 1,
        balance: 100,
        availableBalance: 0,
    });
    const { run, data, loading } = useRequest();

    const [deposits, setDeposits] = useState([]);
    const [activeTab, setActiveTab] = useState('deposit');

    async function fetchSolBalance() {
        try {
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
            const solBalance = data.result / 1000000000;
            console.log(`Current SOL balance: ${solBalance}`);
        } catch (error) {
            console.error("Error fetching SOL balance:", error);
        }
    }

    const fetchDepositHistory = async () => {
        try {
            const { data, error } = await supabase
                .from('deposits')
                .select('*')
                .eq('user_id', state.id);

            if (error) throw error;
            setDeposits(data);
        } catch (error) {
            console.error("Error fetching deposit history:", error);
        }
    };

    const calculateBalance = useMemo(() => {
        return form.amount * 100;
    }, [form]);

    useEffect(() => {
        fetchSolBalance();
        fetchDepositHistory();
    }, []);

    const updaetUserApes = async () => {
        const plus = calculateBalance + (state.apes || 0);
        await supabase.from("user").update({ apes: plus }).eq("id", state.id);
        setState({ ...state, apes: plus });
    };

    const connectWallet = async () => {
        const { solana } = window;
        if (solana) {
            const response = await solana.connect();
            console.log("Connected with Public Key:", response.publicKey.toString());
            return response.publicKey.toString();
        }
    };

    const makeTransaction = async () => {
        try {
            let walletAddress = await connectWallet();
            if (!walletAddress) return;

            const connection = new Connection(clusterApiUrl("testnet"), "confirmed");
            const blockHeight = await connection.getBlockHeight();
            console.log("Connected to Solana testnet. Current block height:", blockHeight);

            let recipientAddress = "J97hUXpUzFoRuyJLPmN26JEdE8Eog6BMeByVmAQabgdY";
            const fromPubkey = new PublicKey(walletAddress);
            const toPubkey = new PublicKey(recipientAddress);

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

            let transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: fromPubkey,
                    toPubkey: toPubkey,
                    lamports: 0.1 * LAMPORTS_PER_SOL,
                })
            );

            transaction.recentBlockhash = blockhash;
            transaction.lastValidBlockHeight = lastValidBlockHeight;
            transaction.feePayer = fromPubkey;

            const signedTransaction = await window.solana.signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signedTransaction.serialize());

            const confirmation = await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight,
            });

            console.log("Confirmation:", confirmation);
            await updaetUserApes();
            alert("Transaction sent and confirmed ");
            return signature;
        } catch (error) {
            console.error("Error making transaction:", error);
            alert(`Error making transaction ===> ${JSON.stringify(error.transactionMessage)}`);
        }
    };

    if (!state.purchase) return null;
    return (
        <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-black/40">
            <div className="z-50 justify-center items-center w-full max-w-2xl">
                <div className="relative p-4 w-full">
                    <div className="relative bg-background rounded-lg shadow dark:bg-gray-700">
                        <div className="flex items-center justify-between p-4 md:p-5 border-b rounded-t dark:border-gray-600">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mx-auto -mr-5">Deposite OGX</h3>
                            <button
                                onClick={() => setState({ ...state, purchase: false })}
                                type="button"
                                className="text-gray-400 bg-transparent hover:bg-[#ff914d]/20 hover:text-white rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center">
                                <svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
                                </svg>
                                <span className="sr-only">Close modal</span>
                            </button>
                        </div>

                        <div className="flex space-x-4 border-b w-full">
                            <button
                                onClick={() => setActiveTab('deposit')}
                                className={`py-2 px-4 w-1/2 text-center ${activeTab === 'deposit' ? 'border-b-2 border-[#ff914d] text-orange-600 bg-gray-200' : 'text-orange-600 bg-transparent'}`}>
                                Deposit
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`py-2 px-4 w-1/2 text-center ${activeTab === 'history' ? 'border-b-2 border-[#ff914d] text-orange-600 bg-gray-200' : 'text-orange-600 bg-transparent'}`}>
                                Deposit History
                            </button>
                        </div>

                        <div className="w-full">
                            {activeTab === 'deposit' && (
                                <div className="p-4 md:p-5">
                                    <div className="space-y-4">
                                        <p className="text-base leading-relaxed text-gray-400">
                                            With less than a month to go before the European Union enacts new consumer privacy laws for its citizens, companies around the world are updating their terms of service agreements to comply.
                                        </p>
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
                                                    value={form.amount}
                                                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                                                    className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800 focus:ring-[#ff914d]/50 focus:border-[#ff914d]/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-orange-600 mb-2">Wallet Address</label>
                                                <input
                                                    className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800"
                                                    value={calculateBalance}
                                                    disabled
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-end pt-4 space-x-3 border-t border-[#ff914d]/20">
                                            <button
                                                onClick={makeTransaction}
                                                className="px-5 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-[#f74e14] to-[#ff914d] text-white hover:opacity-90 focus:ring-2 focus:ring-[#ff914d]/50">
                                                Deposite
                                            </button>
                                            <button
                                                onClick={() => setState({ ...state, purchase: false })}
                                                className="px-5 py-2.5 text-sm font-medium rounded-lg border border-[#ff914d]/20 text-gray-300 hover:bg-[#ff914d]/20 focus:ring-2 focus:ring-[#ff914d]/50">
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeTab === "history" && (
                            <div className="p-4 md:p-5 overflow-x-auto w-full min-h-[400px] flex flex-col">
                                {loading ? (
                                    <div className="flex justify-center items-center py-8 w-full flex-grow">
                                        <div className="w-12 h-12 border-4 border-[#ff914d] border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : (
                                    <div className="flex-grow flex flex-col">
                                        <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400 min-w-full table-fixed">
                                            <thead className="text-xs text-gray-700 uppercase dark:text-gray-400">
                                                <tr>
                                                    <th
                                                        scope="col"
                                                        className="px-6 py-3 bg-gray-50 dark:bg-gray-800 w-1/3">
                                                        Wallet
                                                    </th>
                                                    <th
                                                        scope="col"
                                                        className="px-6 py-3 w-1/3">
                                                        OGX
                                                    </th>
                                                    <th
                                                        scope="col"
                                                        className="px-6 py-3 bg-gray-50 dark:bg-gray-800 w-1/3">
                                                        Status
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
                                        {(!data || data.length === 0) && (
                                            <div className="flex-grow flex items-center justify-center" style={{height:'348px'}}>
                                                <p className="text-gray-500 dark:text-gray-400">No deposit history found</p>
                                            </div>
                                        )}
                                         <div className="flex items-center justify-end  pt-4 space-x-3 border-t border-[#ff914d]/20">
                                           
                                            <button
                                                onClick={() => setState({ ...state, purchase: false })}
                                                className="px-5 py-2.5 text-sm font-medium rounded-lg border border-[#ff914d]/20 text-gray-300 hover:bg-[#ff914d]/20 focus:ring-2 focus:ring-[#ff914d]/50">
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                        )}
                        
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
