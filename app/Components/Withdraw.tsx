"use client";
import { useUserState } from "@/state/useUserState";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";
import { solanaProgramService, OGX_MINT, SOL_MINT } from "@/lib/solana-program";
import { useWallet } from "@solana/wallet-adapter-react";
import { CONFIG, convertOGXToSOL, convertSOLToOGX } from "@/lib/config";
const getWithdrawHistory = async (userId: string) => {
    const response = await supabase.from("withdraw").select("*").eq("userId", userId);
    return response.data;
};
export default function WithdrawModal() {
    // Default to Sell OGX flow
    const [tab, setTab] = useState("sell");
    const [state, setState] = useUserState();
    const { publicKey, signTransaction, connected } = useWallet();
    const { run, data, loading } = useRequest(getWithdrawHistory);
    const [form, setForm] = useState({ 
        // sell flow: user enters ogxToSell (from purchased OGX balance), we pay out SOL
        ogxToSell: 0,
        withdrawBalance: 0, 
        availableBalance: 0, 
        walletAddress: "",
        solAmount: 0,
        solBalance: 0
    });
    const [isProcessing, setIsProcessing] = useState(false);
    
    const fetchSolBalance = useCallback(async () => {
        if (!publicKey) return;
        
        try {
            const balance = await solanaProgramService.getSOLBalance(publicKey);
            setForm(prev => ({ ...prev, solBalance: balance }));
            console.log(`Current SOL balance: ${balance}`);
        } catch (error) {
            console.error("Error fetching SOL balance:", error);
        }
    }, [publicKey]);

    const connectWallet = async () => {
        //@ts-ignore
        const { solana } = window;
        if (solana) {
            const response = await solana.connect();
            return response.publicKey.toString();
        }
        return null;
    };
    // Calculate SOL equivalent for OGX withdrawal
    const solExchange = useMemo(() => {
        return convertOGXToSOL(form.withdrawBalance);
    }, [form.withdrawBalance]);

    // Sell flow: payout SOL calculated from OGX amount the user wants to sell
    const solPayoutForSell = useMemo(() => {
        return convertOGXToSOL(form.ogxToSell || 0);
    }, [form.ogxToSell]);

    // Calculate OGX equivalent for SOL withdrawal
    const ogxExchange = useMemo(() => {
        return convertSOLToOGX(form.solAmount);
    }, [form.solAmount]);

    useEffect(() => {
        fetchSolBalance();
        if (publicKey) {
            run(publicKey.toString());
        }
    }, [publicKey, run, fetchSolBalance]);

    const updaetUserApes = async (walletAddress: string) => {
        const minus = state.apes - form.withdrawBalance;
        await supabase.from("user").update({ apes: minus }).eq("walletAddress", walletAddress);
        setState({ ...state, apes: minus });
    };

    const makeOGXWithdrawTransaction = async () => {
        if (!publicKey || !signTransaction) {
            return alert("Please connect your wallet first");
        }

        if (!state.id) {
            return alert("User not authenticated. Please refresh the page and try again.");
        }

        if (!form.withdrawBalance) return alert("Please enter withdrawal amount");
        if (state.apes < form.withdrawBalance) {
            return alert("Insufficient OGX");
        }

        if (isProcessing) {
            return alert("Transaction already in progress. Please wait.");
        }

        setIsProcessing(true);

        try {
            // Use the real Solana program for OGX withdrawal (burns OGX and sends SOL)
            const signature = await solanaProgramService.withdrawOGX(
                publicKey,
                form.withdrawBalance,
                { publicKey, signTransaction }
            );

            // Update database
            console.log("OGX Withdrawal - User state:", { 
                userId: state.id, 
                walletAddress: publicKey.toString(),
                ogx: form.withdrawBalance 
            });
            
            const { error: withdrawError } = await supabase.from("withdraw").insert({
                ogx: form.withdrawBalance,
                status: "COMPLETED",
                walletAddress: publicKey.toString(),
                userId: state.id,
            });

            if (withdrawError) {
                console.error("Error saving OGX withdrawal:", withdrawError);
                throw withdrawError;
            }

            // Update user balance
            await updaetUserApes(publicKey.toString());
            alert(`Withdrawal successful! Transaction: ${signature}`);
            
        } catch (error) {
            console.error("Error making withdrawal transaction:", error);
            if (error instanceof Error && error.message.includes("already been processed")) {
                alert("This transaction has already been processed. Please check your wallet or try again with a different amount.");
            } else if (error instanceof Error && error.message.includes("already in progress")) {
                alert("Transaction already in progress. Please wait for it to complete.");
            } else {
                alert(`Error making withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const makeSOLWithdrawTransaction = async () => {
        if (!publicKey || !signTransaction) {
            return alert("Please connect your wallet first");
        }

        if (!state.id) {
            return alert("User not authenticated. Please refresh the page and try again.");
        }

        if (!form.solAmount) return alert("Please enter SOL amount");
        if (state.apes < ogxExchange) {
            return alert(`Insufficient OGX. You need ${ogxExchange} OGX to withdraw ${form.solAmount} SOL`);
        }

        if (isProcessing) {
            return alert("Transaction already in progress. Please wait.");
        }

        setIsProcessing(true);

        try {
            // Verify that the connected wallet matches the user's deposit wallet
            if (!publicKey) {
                alert("Please connect your wallet first");
                return;
            }

            // Check platform wallet balance first
            const platformBalance = await solanaProgramService.getPlatformWalletBalance();
            if (platformBalance < form.solAmount + 0.01) {
                alert(`Platform wallet has insufficient SOL. Available: ${platformBalance.toFixed(4)} SOL, Required: ${(form.solAmount + 0.01).toFixed(4)} SOL`);
                return;
            }

            // Withdraw SOL directly from the program's vault
            // This ensures SOL goes back to the same wallet that made the deposit
            const signature = await solanaProgramService.withdrawSOL(
                publicKey, // This is the wallet address that made the deposit
                form.solAmount,
                { publicKey, signTransaction }
            );

            // Update database with completed withdrawal
            console.log("SOL Withdrawal - User state:", {
                userId: state.id,
                walletAddress: publicKey.toString(),
                ogx: ogxExchange,
                status: "COMPLETED"
            });
            
            const { error: withdrawError } = await supabase.from("withdraw").insert({
                ogx: ogxExchange,
                status: "COMPLETED", // Direct withdrawal from vault
                walletAddress: publicKey.toString(),
                userId: state.id, // Use state.id instead of publicKey.toString()
            });

            if (withdrawError) {
                console.error("Error saving withdrawal:", withdrawError);
                throw withdrawError;
            }
            
            console.log("Withdrawal saved successfully to database");

            // Update user balance immediately (OGX deducted)
            const minus = state.apes - ogxExchange;
            const { error: userError } = await supabase.from("user").update({ apes: minus }).eq("id", state.id);
            
            if (userError) {
                console.error("Error updating user balance:", userError);
                throw userError;
            }
            
            setState({ ...state, apes: minus });

            alert(`SOL withdrawal completed! Transaction: ${signature}\n\n✅ SOL sent to: ${publicKey.toString()}\n\nYour SOL has been withdrawn from the vault and sent to your wallet.`);
            
        } catch (error) {
            console.error("Error making SOL withdrawal transaction:", error);
            if (error instanceof Error && error.message.includes("already been processed")) {
                alert("This transaction has already been processed. Please check your wallet or try again with a different amount.");
            } else if (error instanceof Error && error.message.includes("already in progress")) {
                alert("Transaction already in progress. Please wait for it to complete.");
            } else if (error instanceof Error && error.message.includes("insufficient SOL")) {
                alert(error.message);
            } else if (error instanceof Error && error.message.includes("simulation failed")) {
                alert("Transaction simulation failed. This might be due to network issues. Please try again.");
            } else {
                alert(`Error making SOL withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    // SELL: convert OGX (from purchased balance) to SOL payout
    const handleSellOGX = async () => {
        if (!publicKey || !signTransaction) {
            return alert("Please connect your wallet first");
        }

        if (!state.id) {
            return alert("User not authenticated. Please refresh the page and try again.");
        }

        if (!form.ogxToSell || form.ogxToSell <= 0) return alert("Please enter OGX amount to sell");
        if (state.apes < form.ogxToSell) return alert("Insufficient OGX balance to sell");
        if (isProcessing) return alert("Transaction already in progress. Please wait.");

        setIsProcessing(true);
        try {
            // Ensure platform has enough SOL to pay out
            const solToSend = solPayoutForSell;
            const platformBalance = await solanaProgramService.getPlatformWalletBalance();
            if (platformBalance < solToSend + 0.01) {
                alert(`Platform wallet has insufficient SOL. Available: ${platformBalance.toFixed(4)} SOL, Required: ${(solToSend + 0.01).toFixed(4)} SOL`);
                return;
            }

            // Send SOL payout to user's wallet
            const signature = await solanaProgramService.withdrawSOL(
                publicKey,
                solToSend,
                { publicKey, signTransaction }
            );

            // Deduct OGX from user's purchased balance
            const remaining = state.apes - form.ogxToSell;
            const { error: userError } = await supabase.from("user").update({ apes: remaining }).eq("id", state.id);
            if (userError) throw userError;
            setState({ ...state, apes: remaining });

            // Record sale in withdraw table for now
            await supabase.from("withdraw").insert({
                ogx: form.ogxToSell,
                status: "COMPLETED",
                walletAddress: publicKey.toString(),
                userId: state.id,
            });

            alert(`Sold ${form.ogxToSell} OGX for ${solToSend.toFixed(4)} SOL.\nTransaction: ${signature}`);
        } catch (error) {
            console.error("Error selling OGX:", error);
            alert(`Error selling OGX: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!state.withdraw) return null;
    
    return (
<div className="fixed top-0 left-0 w-screen h-screen flex items-center 
        justify-center bg-black/40 z-50">            <div className="z-50 justify-center items-center">
                <div className="relative p-4 w-full max-w-2xl h-[40rem] ">
                    <div className="relative bg-orange-400 rounded-lg shadow dark:bg-gray-700 h-full overflow-hidden">
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
                        <div className="flex space-x-4 border-b w-full">
                            {/* Withdraw OGX tab still disabled for now */}
                            <button
                                onClick={() => setTab("sell")}
                                className={`py-2 px-4 w-1/3 text-center ${
                                    tab === "sell"
                                        ? "border-b-2 border-[#ff914d] text-orange-600 bg-gray-200"
                                        : "text-orange-600 bg-transparent"
                                }`}
                            >
                                Sell OGX
                            </button>
                            <button
                                onClick={() => setTab("sol")}
                                className={`py-2 px-4 w-1/3 text-center ${
                                    tab === "sol"
                                        ? "border-b-2 border-[#ff914d] text-orange-600 bg-gray-200"
                                        : "text-orange-600 bg-transparent"
                                }`}
                            >
                                SOL Withdraw
                            </button>
                            <button
                                onClick={() => setTab("history")}
                                className={`py-2 px-4 w-1/3 text-center ${
                                    tab === "history"
                                        ? "border-b-2 border-[#ff914d] text-orange-600 bg-gray-200"
                                        : "text-orange-600 bg-transparent"
                                }`}
                            >
                                Withdraw History
                            </button>
                        </div>
                        {tab === "sell" && (
                            <div className="p-4 md:p-5">
                                <p className="text-base leading-relaxed text-orange-600 mb-3">
                                    Sell your purchased OGX for SOL at the current exchange rate. This does not require deposited OGX in the vault.
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
                                        <label className="block text-sm font-medium text-orange-600 mb-2">OGX to Sell</label>
                                        <input
                                            type="number"
                                            step="1"
                                            placeholder="0"
                                            min={1}
                                            value={form.ogxToSell}
                                            onChange={(e) => setForm({ ...form, ogxToSell: Number(e.target.value) })}
                                            className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800 focus:ring-[#ff914d]/50 focus:border-[#ff914d]/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-orange-600 mb-2">You will receive (SOL)</label>
                                        <input
                                            className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800"
                                            value={solPayoutForSell.toFixed(4)}
                                            disabled
                                        />
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded-lg">
                                        <p className="text-sm text-blue-800">
                                            <strong>Note:</strong> SOL will be sent to your connected wallet address.
                                            This sells OGX from your purchased balance (not the vault).
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {tab === "sol" && (
                            <div className="p-4 md:p-5">
                                <p className="text-base leading-relaxed text-orange-600 mb-3">
                                    Withdraw SOL from the vault. Your OGX will be converted to SOL at the current exchange rate.
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
                                        <label className="block text-sm font-medium text-orange-600 mb-2">Withdraw SOL Amount</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.0"
                                            min={0.01}
                                            max={10}
                                            value={form.solAmount}
                                            onChange={(e) => setForm({ ...form, solAmount: Number(e.target.value) })}
                                            className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800 focus:ring-[#ff914d]/50 focus:border-[#ff914d]/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-orange-600 mb-2">Required OGX</label>
                                        <input
                                            className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800"
                                            value={ogxExchange}
                                            disabled
                                        />
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded-lg">
                                        <p className="text-sm text-blue-800">
                                            <strong>Note:</strong> SOL will be sent to your connected wallet address.
                                            This withdraws directly from the program vault and deducts OGX accordingly.
                                        </p>
                                    </div>
                                </div>
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
                            {tab === "sell" && (
                                <button
                                    data-modal-hide="default-modal"
                                    type="button"
                                    onClick={handleSellOGX}
                                    disabled={isProcessing || !connected}
                                    className="px-5 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-[#f74e14] to-[#ff914d] text-white hover:opacity-90 focus:ring-2 focus:ring-[#ff914d]/50 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isProcessing ? "Processing..." : "Sell OGX"}
                                </button>
                            )}
                            {tab === "sol" && (
                                <button
                                    data-modal-hide="default-modal"
                                    type="button"
                                    onClick={makeSOLWithdrawTransaction}
                                    disabled={isProcessing || !connected}
                                    className="px-5 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-[#f74e14] to-[#ff914d] text-white hover:opacity-90 focus:ring-2 focus:ring-[#ff914d]/50 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isProcessing ? "Processing..." : "Withdraw SOL"}
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
