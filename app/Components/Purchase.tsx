"use client";
import { useUserState } from "@/state/useUserState";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";
import { solanaProgramService, OGX_MINT, SOL_MINT } from "@/lib/solana-program";
import { useWallet } from "@solana/wallet-adapter-react";
import { CONFIG, convertSOLToOGX } from "@/lib/config";

const getTransactions = async (userId: string) => {
  const response = await supabase
    .from("transaction")
    .select()
    .eq("userId", userId)
    .order("created_at", { ascending: false })
    .limit(8);
  return response;
};
function truncate(str: string, maxLength: number) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
// const DepositHistory = ({ Deposits }:any) => {
//     return (
//         <div className="Deposit-history w-full">
//             <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Deposit History</h2>
//             {Deposits.length > 0 ? (
//                 <div className="p-4 md:p-5 overflow-x-auto w-full">
//                     <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400 min-w-full table-fixed">
//                         <thead className="text-xs text-gray-700 uppercase dark:text-gray-400">
//                             <tr>
//                                 <th scope="col" className="px-6 py-3 bg-gray-50 dark:bg-gray-800 w-1/3">Wallet</th>
//                                 <th scope="col" className="px-6 py-3 w-1/3">Amount</th>
//                                 <th scope="col" className="px-6 py-3 bg-gray-50 dark:bg-gray-800 w-1/3">Status</th>
//                             </tr>
//                         </thead>
//                         <tbody className="w-full">
//                             {Deposits.map((Deposit, index) => (
//                                 <tr key={index} className="border-b border-gray-200 dark:border-gray-700 w-full">
//                                     <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap bg-gray-50 dark:text-white dark:bg-gray-800 truncate">
//                                         {Deposit.wallet}
//                                     </th>
//                                     <td className="px-6 py-4">{Deposit.apes}</td>
//                                     <td className="px-6 py-4 bg-gray-50 dark:bg-gray-800">{Deposit.status}</td>
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                 </div>
//             ) : (
//                 <p className="text-gray-500">No Deposit history found</p>
//             )}
//         </div>
//     );
// };

export default function PurchaseModal() {
  const [state, setState] = useUserState();
  const { publicKey, signTransaction, connected } = useWallet();
  const [form, setForm] = useState({
    amount: 1,
    balance: 100,
    availableBalance: 0,
  });
  const [depositMode, setDepositMode] = useState<"SOL" | "OGX">("SOL");

  const [solState, setSolState] = useState({
    amount: 0.01,
    balance: 100,
    availableBalance: 0,
  });
  
  const [ogxState, setOgxState] = useState({
    amount: 0.01, // default OGX deposit
    balance: 0,
    availableBalance: 0,
  });
  
  
  const { run, data, loading } = useRequest(getTransactions, { manual: true });
  const [activeTab, setActiveTab] = useState("ogx");
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchSolBalance = useCallback(async () => {
    if (!publicKey) return;
    
    try {
      const balance = await solanaProgramService.getSOLBalance(publicKey);
      setSolState(prev => ({ ...prev, availableBalance: balance }));
      console.log(`Current SOL balance: ${balance}`);
    } catch (error) {
      console.error("Error fetching SOL balance:", error);
    }
  }, [publicKey]);

  const fetchDepositHistory = async () => {
    // try {
    //     const { data, error } = await supabase
    //         .from('Deposits')
    //         .select('*')
    //         .eq('user_id', state.id);
    //     if (error) throw error;
    //     setDeposits(data);
    // } catch (error) {
    //     console.error("Error fetching Deposit history:", error);
    // }
  };

  const calculateBalance = useMemo(() => {
    return form.amount * 100;
  }, [form]);

  useEffect(() => {
    if (state.id) {
      run(state.id);
    }
  }, [state.id, run]);

  const updaetUserApes = async (transaction: any) => {
    const plus = calculateBalance + (state.apes || 0);
    await supabase.from("user").update({ apes: plus }).eq("id", state.id);
    await saveTransaction(transaction);
    setState({ ...state, apes: plus });
  };

  const connectWallet = async () => {
    //@ts-ignore
    const { solana } = window;
    if (solana) {
      const response = await solana.connect();
      return response.publicKey.toString();
    }
  };
  const saveTransaction = async (transaction: any) => {
    await supabase.from("transaction").insert({
      transactionId: transaction,
      ogx: calculateBalance,
      userId: state.id,
      t_status: "purchase",
    });
    run(state.id);
    
    // Update user spending in state after successful transaction
    const newSpending = (state.totalSpending || 0) + calculateBalance;
    setState({ ...state, totalSpending: newSpending });
  };
  
  const makeTransaction = async () => {
    if (!publicKey || !signTransaction) {
      alert("Please connect your wallet first");
      return;
    }

    if (!solState.amount || solState.amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (isProcessing) {
      alert("Transaction already in progress. Please wait.");
      return;
    }

    setIsProcessing(true);
    
    try {
      // For SOL purchases, we deposit SOL and get OGX credits in database
      console.log(`Depositing ${solState.amount} SOL to get OGX credits`);
      
      // Use depositSOL function to deposit SOL (which gives you OGX credits)
      const signature = await solanaProgramService.depositSOL(
        publicKey,
        solState.amount,
        { publicKey, signTransaction }
      );

      // Only update database if transaction was successful
      if (signature) {
        try {
          // Calculate OGX amount from SOL deposit (1 SOL = 1000 OGX)
          const ogxAmount = convertSOLToOGX(solState.amount);
          
          // Update user balance with the OGX credits earned from SOL deposit
          const plus = ogxAmount + (state.apes || 0);
          
          console.log("Updating user balance:", { userId: state.id, newBalance: plus, ogxAmount });
          
          // Update user balance and wallet address
          const { error: userError } = await supabase.from("user").update({ 
            apes: plus,
            walletAddress: publicKey.toString() // Ensure wallet address is stored
          }).eq("id", state.id);
          
          if (userError) {
            console.error("Error updating user balance:", userError);
            throw userError;
          }
          
          console.log("Saving transaction:", { 
            transactionId: signature, 
            ogx: ogxAmount, 
            userId: state.id
          });
          
          // Save transaction
          const { error: transactionError } = await supabase.from("transaction").insert({
            transactionId: signature,
            ogx: ogxAmount,
            userId: state.id,
          });

          if (transactionError) {
            console.error("Error saving transaction:", transactionError);
            throw transactionError;
          }

          console.log("Database update successful");
          
          // Update user spending in state after successful transaction
          const newSpending = (state.totalSpending || 0) + ogxAmount;
          setState({ ...state, apes: plus, totalSpending: newSpending });
          
          alert(`Purchase successful! You bought ${ogxAmount} OGX tokens for ${solState.amount} SOL. Transaction: ${signature}`);
          
          // Refresh balance
          await fetchSolBalance();
        } catch (dbError) {
          console.error("Database error:", dbError);
          alert(`Transaction successful on blockchain but failed to update database. Please contact support with transaction ID: ${signature}`);
        }
      }
      
      return signature;
    } catch (error) {
      console.error("Error making transaction:", error);
      if (error instanceof Error && error.message.includes("already been processed")) {
        alert("This transaction has already been processed. Please check your wallet or try again with a different amount.");
      } else if (error instanceof Error && error.message.includes("already in progress")) {
        alert("Transaction already in progress. Please wait for it to complete.");
      } else if (error instanceof Error && error.message.includes("simulation failed")) {
        alert("Transaction simulation failed. This might be due to insufficient balance or network issues. Please try again.");
      } else if (error instanceof Error && error.message.includes("Insufficient SOL balance")) {
        alert(error.message);
      } else if (error instanceof Error && error.message.includes("Blockhash not found")) {
        alert("Network issue detected. Please try again in a moment.");
      } else {
        alert(`Error making transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };
  
  const solExchange = useMemo(()=>{
    return convertSOLToOGX(solState.amount)
  },[solState.amount])

  const makeSOLDeposit = async () => {
    if (!publicKey || !signTransaction) {
      alert("Please connect your wallet first");
      return;
    }

    if (!solState.amount || solState.amount <= 0) {
      alert("Please enter a valid SOL amount");
      return;
    }

    if (isProcessing) {
      alert("Transaction already in progress. Please wait.");
      return;
    }

    setIsProcessing(true);
    
    try {
      // Deposit SOL and convert to OGX tokens
      const signature = await solanaProgramService.depositSOL(
        publicKey,
        solState.amount,
        { publicKey, signTransaction }
      );

      // Update user balance with OGX equivalent
      const ogxAmount = convertSOLToOGX(solState.amount);
      const plus = ogxAmount + (state.apes || 0);
      
      // Update user balance and wallet address
      await supabase.from("user").update({ 
        apes: plus,
        walletAddress: publicKey.toString() // Ensure wallet address is stored
      }).eq("id", state.id);
      
      // Save transaction
      await supabase.from("transaction").insert({
        transactionId: signature,
        ogx: ogxAmount,
        userId: state.id,
        t_status: "purchase",
        walletAddress: publicKey.toString(), // Store wallet address in transaction too
      });

      // Update user spending in state after successful transaction
      const newSpending = (state.totalSpending || 0) + ogxAmount;
      setState({ ...state, apes: plus, totalSpending: newSpending });
      
      alert(`SOL deposit successful! You received ${ogxAmount} OGX. Transaction: ${signature}`);
      
      // Refresh balance and transaction history
      await fetchSolBalance();
      run(state.id);
      
      return signature;
    } catch (error) {
      console.error("Error making SOL deposit:", error);
      if (error instanceof Error && error.message.includes("already been processed")) {
        alert("This transaction has already been processed. Please check your wallet or try again with a different amount.");
      } else if (error instanceof Error && error.message.includes("already in progress")) {
        alert("Transaction already in progress. Please wait for it to complete.");
      } else if (error instanceof Error && error.message.includes("simulation failed")) {
        alert("Transaction simulation failed. This might be due to insufficient balance or network issues. Please try again.");
      } else if (error instanceof Error && error.message.includes("Insufficient SOL balance")) {
        alert(error.message);
      } else if (error instanceof Error && error.message.includes("Blockhash not found")) {
        alert("Network issue detected. Please try again in a moment.");
      } else {
        alert(`Error making SOL deposit: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (state.id) {
      run(state.id);
    }
    if (publicKey) {
      fetchSolBalance();
    }
  }, [state.id, run, publicKey, fetchSolBalance]);
  
  if (!state.purchase) return null;
  return (
    <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-black/40 z-50" >
      <div className="z-50 justify-center items-center w-full max-w-2xl bg-orange-400 rounded-lg">
        {/* <div className="relative p-4 w-full"> */}
          <div className="relative bg-background rounded-lg shadow dark:bg-gray-700">
            <div className="flex items-center justify-between p-4 md:p-5 border-b rounded-t dark:border-gray-600">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mx-auto -mr-5">
                Buy OGX Tokens
              </h3>
              <button
                onClick={() => setState({ ...state, purchase: false })}
                type="button"
                className="text-gray-400 bg-transparent hover:bg-[#ff914d]/20 hover:text-white rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center"
              >
                <svg
                  className="w-3 h-3"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 14 14"
                >
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
              <button
                onClick={() => setActiveTab("ogx")}
                className={`py-2 px-4 w-1/3 text-center ${
                  activeTab === "ogx"
                    ? "border-b-2 border-[#ff914d] text-orange-600 bg-gray-200"
                    : "text-orange-600 bg-transparent"
                }`}
              >
                Buy OGX
              </button>
              <button
                onClick={() => setActiveTab("sol")}
                className={`py-2 px-4 w-1/3 text-center ${
                  activeTab === "sol"
                    ? "border-b-2 border-[#ff914d] text-orange-600 bg-gray-200"
                    : "text-orange-600 bg-transparent"
                }`}
              >
                SOL Deposit
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`py-2 px-4 w-1/3 text-center ${
                  activeTab === "history"
                    ? "border-b-2 border-[#ff914d] text-orange-600 bg-gray-200"
                    : "text-orange-600 bg-transparent"
                }`}
              >
                Deposit History
              </button>
            </div>

            <div className="w-full">
              {activeTab === "ogx" && (
                <div className="p-4 md:p-5 " >
                  <p className="text-base leading-relaxed text-orange-600 mb-3">
                    Purchase OGX tokens with SOL. Enter the amount of SOL you want to spend, and you&apos;ll receive OGX tokens at the current exchange rate.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-orange-600 mb-2">
                        SOL Amount to Spend
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.0"
                        min="0.01"
                        value={solState.amount}
                        onChange={(e) =>
                          setSolState({
                            ...solState,
                            amount: Number(e.target.value),
                          })
                        }
                        className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800 focus:ring-[#ff914d]/50 focus:border-[#ff914d]/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-orange-600 mb-2">
                        OGX Tokens You&apos;ll Receive
                      </label>
                      <input
                        className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800"
                        value={convertSOLToOGX(solState.amount)}
                        disabled
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-orange-600 mb-2">
                        Available OGX
                      </label>
                      <input
                        value={state.apes || 0}
                        className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800"
                        disabled
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end pt-4 space-x-3 border-t border-[#ff914d]/20">
                    <button
                      onClick={makeTransaction}
                      disabled={isProcessing || !connected}
                      className="px-5 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-[#f74e14] to-[#ff914d] text-white hover:opacity-90 focus:ring-2 focus:ring-[#ff914d]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? "Processing..." : "Buy OGX with SOL"}
                    </button>
                    <button
                      onClick={() =>
                        setState({ ...state, purchase: false })
                      }
                      className="px-5 py-2.5 text-sm font-medium rounded-lg border border-[#ff914d]/20 text-gray-300 hover:bg-[#ff914d]/20 focus:ring-2 focus:ring-[#ff914d]/50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {activeTab === "sol" && (
                <div className="p-4 md:p-5">
                  <p className="text-base leading-relaxed text-orange-600 mb-3">
                    Deposit SOL to your account. SOL will be converted to OGX tokens at the current exchange rate.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-orange-600 mb-2">
                        Deposit SOL
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.0"
                        min="0.01"
                        value={solState.amount}
                        onChange={(e) =>
                          setSolState({
                            ...solState,
                            amount: Number(e.target.value),
                          })
                        }
                        className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800 focus:ring-[#ff914d]/50 focus:border-[#ff914d]/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-orange-600 mb-2">
                        Estimated OGX
                      </label>
                      <input
                        className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800"
                        value={solExchange}
                        disabled
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-orange-600 mb-2">
                        Available SOL
                      </label>
                      <input
                        className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800"
                        disabled
                        value={solState.availableBalance.toFixed(4)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end pt-4 space-x-3 border-t border-[#ff914d]/20">
                    <button
                      onClick={makeSOLDeposit}
                      disabled={isProcessing || !connected}
                      className="px-5 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-[#f74e14] to-[#ff914d] text-white hover:opacity-90 focus:ring-2 focus:ring-[#ff914d]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? "Processing..." : "Deposit SOL"}
                    </button>
                    <button
                      onClick={() =>
                        setState({ ...state, purchase: false })
                      }
                      className="px-5 py-2.5 text-sm font-medium rounded-lg border border-[#ff914d]/20 text-gray-300 hover:bg-[#ff914d]/20 focus:ring-2 focus:ring-[#ff914d]/50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {activeTab === "history" && (
                <div className="p-4 md:p-5 overflow-x-auto w-full flex flex-col">
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
                              className="px-6 py-3 bg-gray-50 dark:bg-gray-800 w-1/3"
                            >
                              <span className="flex justify-center">
                                Transaction ID
                              </span>
                            </th>

                            <th
                              scope="col"
                              className="px-6 py-3  flex justify-center"
                            >
                              <span className="">OGX</span> / <span>SOL</span>
                            </th>
                            <th
                              scope="col"
                              className="px-6 py-3 bg-gray-50 dark:bg-gray-800 w-1/3 "
                            >
                              <span className="flex justify-center">
                                Status
                              </span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="w-full">
                          {data?.data?.length === 0 ? (
                            <tr>
                              <td
                                colSpan={3}
                                className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                              >
                                No Deposit history found
                              </td>
                            </tr>
                          ) : (
                            data?.data?.map((item) => (
                              <tr
                                key={item?.id}
                                className="border-b border-gray-200 dark:border-gray-700 w-full"
                              >
                                <th
                                  scope="row"
                                  className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap bg-gray-50 dark:text-white dark:bg-gray-800 truncate"
                                >
                                  {truncate(item?.transactionId, 10)}
                                </th>
                                <td className="px-6 py-4">{item?.ogx}</td>
                                <td className="px-6 py-4 bg-gray-50 dark:bg-gray-800">
                                  {item?.t_status}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                      {(!data || data.data?.length === 0) && (
                        <div
                          className="flex-grow flex items-center justify-center"
                          style={{ height: "192px" }}
                        >
                          <p className="text-gray-500 dark:text-gray-400">
                            No Deposit history found
                          </p>
                        </div>
                      )}
                      <div className="flex items-center justify-end  pt-4 space-x-3 border-t border-[#ff914d]/20">
                        <button
                          onClick={() =>
                            setState({ ...state, purchase: false })
                          }
                          className="px-5 py-2.5 text-sm font-medium rounded-lg border border-[#ff914d]/20 text-gray-300 hover:bg-[#ff914d]/20 focus:ring-2 focus:ring-[#ff914d]/50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        {/* </div> */}
      </div>
    </div>
  );
}
