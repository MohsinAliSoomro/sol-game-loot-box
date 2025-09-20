"use client";
import { useUserState } from "@/state/useUserState";
import { useEffect, useMemo, useState } from "react";
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
  const [form, setForm] = useState({
    amount: 1,
    balance: 100,
    availableBalance: 0,
  });
  const [solState, setSolState] = useState({
    amount: 1,
    balance: 100,
    availableBalance: 0,
  });
  const { run, data, loading } = useRequest(getTransactions, { manual: true });
  const [activeTab, setActiveTab] = useState("ogx");

  async function fetchSolBalance() {
    // try {
    //     const response = await fetch(`https://api.solana.com`, {
    //         method: "POST",
    //         headers: {
    //             "Content-Type": "application/json",
    //         },
    //         body: JSON.stringify({
    //             jsonrpc: "2.0",
    //             id: 1,
    //             method: "getBalance",
    //             params: [""],
    //         }),
    //     });
    //     const data = await response.json();
    //     const solBalance = data.result / 1000000000;
    //     console.log(`Current SOL balance: ${solBalance}`);
    // } catch (error) {
    //     console.error("Error fetching SOL balance:", error);
    // }
  }

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
  };
  
  const makeTransaction = async () => {
    try {
      // Ensure the wallet is connected
      let walletAddress = "";
      //@ts-ignore
      walletAddress = await connectWallet();
      if (!walletAddress) return;

      // Create connection to testnet
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

      // Test the connection
      try {
        const blockHeight = await connection.getBlockHeight();
        console.log("Connected to Solana testnet. Current block height:", blockHeight);
      } catch (error) {
        console.error("Failed to connect to Solana testnet:", error);
        throw new Error("Network connection failed");
      }

      let recipientAddress = "CRt41RoAZ4R9M7QHx5vyKB2Jee3NvDSmhoSak8GfMwtY";

      const fromPubkey = new PublicKey(walletAddress);
      const toPubkey = new PublicKey(recipientAddress);

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();

      // Create a new transaction
      let transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromPubkey,
          toPubkey: toPubkey,
          lamports: 0.1 * LAMPORTS_PER_SOL, // Convert SOL to lamports
        })
      );
      // Set the blockhash and fee payer
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = fromPubkey;

      //@ts-ignore
      const signedTransaction = await window.solana.signTransaction(
        transaction
      );

      // Send the transaction
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize()
      );

      // Confirm the transaction
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      await updaetUserApes(signature);
      alert("Transaction sent and confirmed ");
      // dave into database transaction and add apes into user wallet
      return signature;
    } catch (error) {
      console.error("Error making transaction:", error);
      //@ts-ignore
      alert(
        `Error making transaction ===> ${JSON.stringify(
          error
        )}`
      );
      if (error instanceof Error) {
        console.error(error.message);
      }
    }
  };
  
  const solExchange = useMemo(()=>{
    return solState.amount * 1000
  },[solState.amount])
  
  if (!state.purchase) return null;
  return (
    <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-black/40 z-50" >
      <div className="z-50 justify-center items-center w-full max-w-2xl bg-orange-400 rounded-lg">
        {/* <div className="relative p-4 w-full"> */}
          <div className="relative bg-background rounded-lg shadow dark:bg-gray-700">
            <div className="flex items-center justify-between p-4 md:p-5 border-b rounded-t dark:border-gray-600">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mx-auto -mr-5">
                Deposit OGX
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
                OGX Deposit
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
                    Deposit OGX tokens to your account. You can use these tokens
                    to open lootboxes and participate in the platform.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-orange-600 mb-2">
                        Deposit OGX
                      </label>
                      <input
                        value={form.amount}
                        onChange={(e) =>
                          setForm({
                            ...form,
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
                        value="0"
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
                      className="px-5 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-[#f74e14] to-[#ff914d] text-white hover:opacity-90 focus:ring-2 focus:ring-[#ff914d]/50"
                    >
                      Deposit OGX
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
                        min={1}
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
                        value={state.apes || 0}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end pt-4 space-x-3 border-t border-[#ff914d]/20">
                    <button
                      onClick={() =>
                        alert("SOL Deposit functionality coming soon!")
                      }
                      className="px-5 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-[#f74e14] to-[#ff914d] text-white hover:opacity-90 focus:ring-2 focus:ring-[#ff914d]/50"
                    >
                      Deposit SOL
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
