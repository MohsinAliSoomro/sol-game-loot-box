"use client";
import { useUserState } from "@/state/useUserState";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
import { solanaProgramService, OGX_MINT, SOL_MINT, USDC_MINT, TOKEN4_MINT } from "@/lib/solana-program";
import { useWallet } from "@solana/wallet-adapter-react";
import { CONFIG, convertSOLToOGX, convertUSDCToOGX, convertTokenToOGX } from "@/lib/config";
import { useProject } from "@/lib/project-context";
import { useParams } from "next/navigation";
import {
  convertTokenToOGXDynamic,
  calculateTokenToOGXRate,
  getAllExchangeRates,
  getSOLPrice,
  getTokenPrice,
  calculateTokenFee,
  getAllTokenFees
} from "@/lib/price-service";
import { calculateTokenToProjectTokenRate } from "@/lib/project-price-service";
import { generateEmailFromWallet } from "@/lib/email-utils";

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
  const { publicKey, signTransaction, sendTransaction, connected } = useWallet();
  // Available tokens for deposit - dynamically loaded from database
  // Admins can add/edit tokens from the master dashboard
  const [availableTokens, setAvailableTokens] = useState<Array<{
    key: string;
    mint: PublicKey;
    name: string;
    symbol: string;
    decimals: number;
    exchangeRate: number;
    coingeckoId?: string | null;
  }>>([]);

  // Get project context
  const { getProjectId, projectToken, getProjectTokenSymbol, currentProject } = useProject();
  const projectId = getProjectId();
  const projectTokenSymbol = getProjectTokenSymbol();
  
  // Get project slug from URL params (most reliable source)
  const params = useParams();
  const projectSlugFromUrl = (params?.projectSlug as string | undefined);
  
  // Use URL slug first, then fallback to currentProject slug
  const activeProjectSlug = projectSlugFromUrl || currentProject?.slug;

  // Load tokens from database
  // Main project: uses legacy tokenService (tokens table or CONFIG)
  // Sub-projects: uses projectTokenService (project_tokens table)
  useEffect(() => {
    const loadTokens = async () => {
      // Main project: no projectId or no activeProjectSlug
      const isMainProject = !projectId || !activeProjectSlug;
      
      if (isMainProject) {
        console.log("🏠 Main project: Loading tokens from legacy tokenService");
        try {
          const { getAvailableTokens } = await import("@/service/tokenService");
          const tokens = await getAvailableTokens();

          if (tokens && tokens.length > 0) {
            console.log(`✅ Loaded ${tokens.length} tokens for main project`);
            setAvailableTokens(tokens);
            // Default to first token (usually SOL)
            setSelectedToken(tokens[0]?.key || "SOL");
          } else {
            // Fallback: use OGX from CONFIG
            console.warn("⚠️ No tokens in database, using OGX from CONFIG");
            const CONFIG = require("@/lib/config").CONFIG;
            setAvailableTokens([{
              key: "OGX",
              name: "OGX",
              symbol: "OGX",
              decimals: 6,
              exchangeRate: 1,
              coingeckoId: null,
              mint: new PublicKey(CONFIG.TOKENS.OGX),
            }, {
              key: "SOL",
              name: "Solana",
              symbol: "SOL",
              decimals: 9,
              exchangeRate: 1000,
              coingeckoId: "solana",
              mint: new PublicKey("So11111111111111111111111111111111111111112"),
            }]);
            setSelectedToken("SOL");
          }
        } catch (error) {
          console.error("Error loading main project tokens:", error);
          // Fallback to OGX + SOL
          const CONFIG = require("@/lib/config").CONFIG;
          setAvailableTokens([{
            key: "OGX",
            name: "OGX",
            symbol: "OGX",
            decimals: 6,
            exchangeRate: 1,
            coingeckoId: null,
            mint: new PublicKey(CONFIG.TOKENS.OGX),
          }, {
            key: "SOL",
            name: "Solana",
            symbol: "SOL",
            decimals: 9,
            exchangeRate: 1000,
            coingeckoId: "solana",
            mint: new PublicKey("So11111111111111111111111111111111111111112"),
          }]);
          setSelectedToken("SOL");
        }
      } else {
        // Sub-project: use project-specific tokens
        console.log(`📦 Sub-project: Loading tokens for project ID ${projectId}`);
        try {
          const { getProjectAvailableTokens } = await import("@/service/projectTokenService");
          const tokens = await getProjectAvailableTokens(projectId);

          if (tokens && tokens.length > 0) {
            console.log(`✅ Loaded ${tokens.length} tokens (SOL + project tokens)`);
            setAvailableTokens(tokens);
            // Always default to SOL (first token) for deposits
            // SOL is the native token used to buy project tokens
            setSelectedToken("SOL");
          } else {
            // Fallback: at least SOL should be available
            console.warn("⚠️ No tokens loaded, using SOL fallback");
            setAvailableTokens([{
              key: "SOL",
              name: "Solana",
              symbol: "SOL",
              decimals: 9,
              exchangeRate: 1000,
              coingeckoId: "solana",
              mint: new PublicKey("So11111111111111111111111111111111111111112"),
            }]);
            setSelectedToken("SOL");
          }
        } catch (error) {
          console.error("Error loading project tokens:", error);
          setAvailableTokens([]);
        }
      }
    };
    loadTokens();
  }, [projectId, activeProjectSlug]);

  const [selectedToken, setSelectedToken] = useState<string>("");
  const [depositAmount, setDepositAmount] = useState<number>(0.01);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [depositFee, setDepositFee] = useState<number>(0);
  const [dynamicFee, setDynamicFee] = useState<number>(0); // Dynamic fee based on token price
  const [networkFee] = useState<number>(0.01);

  // Base SOL fee (fixed) - Default to 0.001 if not set in project
  // Handle null, undefined, empty string, or 0 values
  const feeAmountValue = currentProject?.fee_amount;
  const BASE_SOL_FEE = (feeAmountValue && 
                        feeAmountValue !== '0' && 
                        feeAmountValue !== 'null' && 
                        feeAmountValue !== 'undefined' &&
                        parseInt(feeAmountValue) > 0)
    ? parseInt(feeAmountValue) / LAMPORTS_PER_SOL
    : 0.001; // 0.001 SOL default

  const { run, data, loading } = useRequest(getTransactions, { manual: true });
  const [activeTab, setActiveTab] = useState("deposit");
  const [isProcessing, setIsProcessing] = useState(false);
  const lastTransactionTime = useRef<number>(0);
  const TRANSACTION_COOLDOWN = 3000; // 3 seconds cooldown between transactions

  // Get selected token info
  const selectedTokenInfo = useMemo(() => {
    if (!selectedToken || availableTokens.length === 0) {
      return null;
    }

    // Find token by symbol (since we're using symbol as key now)
    const found = availableTokens.find(t => t.symbol === selectedToken || t.key === selectedToken);
    if (found) return found;

    // If not found and availableTokens has items, use first one
    if (availableTokens.length > 0) return availableTokens[0];

    return null;
  }, [selectedToken, availableTokens]);

  // Get selected token mint
  const selectedTokenMint = useMemo(() => {
    return selectedTokenInfo?.mint || SOL_MINT;
  }, [selectedTokenInfo]);

  // Fetch balance for selected token
  const fetchTokenBalance = useCallback(async () => {
    if (!publicKey || !selectedTokenMint) return;

    try {
      let balance = 0;
      if (selectedToken === "SOL") {
        balance = await solanaProgramService.getSOLBalance(publicKey);
      } else {
        balance = await solanaProgramService.getTokenBalance(publicKey, selectedTokenMint);
      }
      setTokenBalance(balance);
      console.log(`Current ${selectedTokenInfo?.symbol} balance: ${balance}`);
    } catch (error) {
      console.error(`Error fetching ${selectedTokenInfo?.symbol} balance:`, error);
      setTokenBalance(0);
    }
  }, [publicKey, selectedToken, selectedTokenMint, selectedTokenInfo]);

  // Fetch dynamic fee amount for selected token based on market prices
  useEffect(() => {
    const fetchDynamicFee = async () => {
      try {
        // Calculate fee based on token price relative to SOL
        // Formula: Fee in Token = (SOL Fee Amount * SOL Price) / Token Price
        const tokenFee = await calculateTokenFee(selectedToken, BASE_SOL_FEE);
        setDynamicFee(tokenFee);
        console.log(`💰 Dynamic fee for ${selectedToken}: ${tokenFee.toFixed(6)} ${selectedTokenInfo?.symbol}`);
        console.log(`   (Based on SOL fee: ${BASE_SOL_FEE} SOL)`);
      } catch (error) {
        console.error("Error fetching dynamic fee:", error);
        // Fallback to SOL fee if calculation fails
        setDynamicFee(selectedToken === "SOL" ? BASE_SOL_FEE : BASE_SOL_FEE);
      }
    };

    if (connected && selectedToken) {
      fetchDynamicFee();
    }
  }, [selectedToken, connected, selectedTokenInfo]);

  // Also fetch fee from blockchain (for display, but we'll use dynamic fee for calculations)
  useEffect(() => {
    const fetchDepositFee = async () => {
      try {
        const fee = await solanaProgramService.getFeeAmount(selectedTokenMint);
        setDepositFee(fee);
        console.log(`Blockchain fee for ${selectedToken}: ${fee} ${selectedTokenInfo?.symbol}`);
      } catch (error) {
        console.error("Error fetching deposit fee:", error);
        setDepositFee(0);
      }
    };

    if (publicKey && selectedTokenMint) {
      fetchDepositFee();
    }
  }, [publicKey, selectedTokenMint, selectedTokenInfo]);

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

  // Dynamic exchange rates state
  const [exchangeRates, setExchangeRates] = useState<{
    SOL_TO_OGX: number;
    USDC_TO_OGX: number;
    TOKEN4_TO_OGX: number;
    [key: string]: number;
  }>({
    SOL_TO_OGX: CONFIG.EXCHANGE_RATES.SOL_TO_OGX,
    USDC_TO_OGX: CONFIG.EXCHANGE_RATES.USDC_TO_OGX,
    TOKEN4_TO_OGX: CONFIG.EXCHANGE_RATES.TOKEN4_TO_OGX,
  });

  const [currentRate, setCurrentRate] = useState<number>(
    CONFIG.TOKEN_INFO[selectedToken as keyof typeof CONFIG.TOKEN_INFO]?.exchangeRate || 1000
  );
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  // Initialize price service with project tokens when projectId changes
  useEffect(() => {
    if (projectId) {
      const initPriceService = async () => {
        try {
          const { initializePriceService } = await import("@/lib/price-service");
          await initializePriceService(CONFIG, projectId);
        } catch (error) {
          console.error("Error initializing price service:", error);
        }
      };
      initPriceService();
    }
  }, [projectId]);

  // Fetch dynamic exchange rates on component mount and when token changes
  useEffect(() => {
    const fetchExchangeRates = async () => {
      setIsLoadingRates(true);
      try {
        // Initialize price service with current project tokens
        if (projectId) {
          const { initializePriceService } = await import("@/lib/price-service");
          await initializePriceService(CONFIG, projectId);
        }

        const rates = await getAllExchangeRates(CONFIG.BASE_EXCHANGE_RATE.SOL_TO_OGX);
        setExchangeRates({
          SOL_TO_OGX: rates.SOL_TO_OGX,
          USDC_TO_OGX: rates.USDC_TO_OGX,
          TOKEN4_TO_OGX: rates.TOKEN4_TO_OGX,
        });

        // Set current rate for selected token
        // Calculate rate to project token instead of OGX
        // Formula: (Token USD Price / SOL USD Price) * (1 SOL = X Project Token)
        const tokenRate = await calculateTokenToProjectTokenRate(
          selectedToken,
          projectTokenSymbol,
          CONFIG.BASE_EXCHANGE_RATE.SOL_TO_OGX // Base rate: 1 SOL = 1000 project tokens
        );
        setCurrentRate(tokenRate);

        console.log(`✅ Updated exchange rates:`, rates);
        console.log(`📊 Current ${selectedToken} rate: 1 ${selectedToken} = ${tokenRate.toFixed(4)} ${projectTokenSymbol}`);
      } catch (error) {
        console.error("Error fetching exchange rates:", error);
        // Use fallback rates from config
        setCurrentRate(CONFIG.TOKEN_INFO[selectedToken as keyof typeof CONFIG.TOKEN_INFO]?.exchangeRate || 1000);
      } finally {
        setIsLoadingRates(false);
      }
    };

    if (connected && selectedToken) {
      fetchExchangeRates();

      // Refresh rates every 5 minutes
      const interval = setInterval(fetchExchangeRates, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [selectedToken, connected, projectId, projectTokenSymbol]);

  // Calculate project token equivalent using dynamic rates
  // If depositing project token itself, no conversion needed
  const projectTokenEquivalent = useMemo(() => {
    // If depositing the project's default token, no conversion
    if (selectedToken === projectTokenSymbol) {
      return depositAmount;
    }
    // Otherwise convert to project token using dynamic rate
    return depositAmount * currentRate;
  }, [depositAmount, selectedToken, currentRate, projectTokenSymbol]);

  // Unified deposit function that works with any selected token
  const makeTokenDeposit = async () => {
    if (!publicKey || !signTransaction) {
      alert("Please connect your wallet first");
      return;
    }

    // Ensure selectedTokenInfo is available
    if (!selectedTokenInfo) {
      console.error("Selected token info is not available. Available tokens:", availableTokens);
      alert("Token information not loaded. Please wait a moment and try again.");
      return;
    }

    if (!depositAmount || depositAmount <= 0) {
      alert(`Please enter a valid ${selectedTokenInfo.symbol} amount`);
      return;
    }

    if (isProcessing) {
      alert("Transaction already in progress. Please wait.");
      return;
    }

    // Prevent rapid double-clicks
    const now = Date.now();
    const timeSinceLastTx = now - lastTransactionTime.current;
    if (timeSinceLastTx < TRANSACTION_COOLDOWN) {
      const waitTime = Math.ceil((TRANSACTION_COOLDOWN - timeSinceLastTx) / 1000);
      alert(`Please wait ${waitTime} seconds before making another transaction.`);
      return;
    }

    lastTransactionTime.current = now;
    setIsProcessing(true);

    try {
      // Ensure legacy user exists for main project flows (no slug)
      const currentProjectId = getProjectId();
      const isMainProject = !currentProjectId || !activeProjectSlug;
      let resolvedUserId = state.uid || state.id;

      if (isMainProject) {
        if (!resolvedUserId) {
          const walletAddress = publicKey.toBase58();
          const email = state.email || await generateEmailFromWallet(walletAddress);

          // Fetch by walletAddress
          const { data: existingUser, error: fetchErr } = await supabase
            .from("user")
            .select("*")
            .eq("walletAddress", walletAddress)
            .single();

          if (fetchErr && fetchErr.code !== "PGRST116") {
            console.error("Fetch legacy user before deposit failed:", fetchErr);
            alert("Unable to verify your account. Please reconnect your wallet and try again.");
            setIsProcessing(false);
            return;
          }

          let ensuredUser = existingUser;

          // If existing user has NULL id/uid, backfill with generated UUID
          if (ensuredUser && (!ensuredUser.id || !ensuredUser.uid)) {
            const userId = crypto.randomUUID();
            const { data: updatedUser, error: updateError } = await supabase
              .from("user")
              .update({
                id: userId,
                uid: userId,
              })
              .eq("walletAddress", walletAddress)
              .select()
              .single();
            
            if (!updateError && updatedUser) {
              ensuredUser = updatedUser;
              console.log(`✅ Backfilled id/uid for wallet: ${walletAddress}, new ID: ${userId}`);
            } else if (updateError) {
              console.warn("⚠️ Failed to backfill id/uid:", updateError);
            }
          }

          // If not found, insert a new legacy user (generate UUID for id/uid)
          if (!ensuredUser) {
            // Generate UUID for id and uid columns
            const userId = crypto.randomUUID();
            const { data: newUser, error: insertErr } = await supabase
              .from("user")
              .insert({
                id: userId,
                uid: userId,
                walletAddress,
                email,
                apes: 0,
                provider: "wallet",
              })
              .select()
              .single();

            if (insertErr) {
              console.error("Insert legacy user before deposit failed:", insertErr);
              alert("Unable to verify your account. Please reconnect your wallet and try again.");
              setIsProcessing(false);
              return;
            }
            ensuredUser = newUser;
          }

          resolvedUserId = ensuredUser?.id || ensuredUser?.uid || ensuredUser?.walletAddress;

          if (resolvedUserId) {
            console.log(`✅ Ensured legacy user before deposit. ID: ${resolvedUserId}`);
            setState((prev) => ({
              ...prev,
              id: resolvedUserId?.toString() || prev.id,
              uid: resolvedUserId?.toString() || prev.uid,
              walletAddress,
              apes: ensuredUser?.apes ?? prev.apes ?? 0,
              email: ensuredUser?.email || prev.email,
            }));
          } else {
            console.error("❌ Could not ensure legacy user (no ID).");
            alert("Unable to verify your account. Please reconnect your wallet and try again.");
            setIsProcessing(false);
            return;
          }
        }
      }

      // Calculate total required (deposit amount + dynamic fee)
      const totalRequired = depositAmount + (dynamicFee || 0);

      // Check if user has enough balance (including fee)
      const tokenSymbol = selectedTokenInfo.symbol;
      if (tokenBalance < totalRequired) {
        alert(
          `Insufficient ${tokenSymbol} balance.\n` +
          `Required: ${totalRequired.toFixed(6)} ${tokenSymbol} (${depositAmount.toFixed(4)} deposit + ${(dynamicFee || 0).toFixed(6)} fee)\n` +
          `Available: ${tokenBalance.toFixed(4)} ${tokenSymbol}`
        );
        setIsProcessing(false);
        return;
      }

      console.log(`💰 Deposit Calculation:`);
      console.log(`   Deposit Amount: ${depositAmount} ${tokenSymbol}`);
      console.log(`   Fee: ${(dynamicFee || 0).toFixed(6)} ${tokenSymbol}`);
      console.log(`   Total Required: ${totalRequired.toFixed(6)} ${tokenSymbol}`);
      console.log(`   Available Balance: ${tokenBalance.toFixed(4)} ${tokenSymbol}`);

      let signature: string;

      // Route to appropriate deposit function based on token
      if (selectedToken === "SOL") {
        // Validate project_pda before using it
        let isValidProjectPDA = false;
        let projectPDA: PublicKey | null = null;
        
        if (currentProject && currentProject.project_pda) {
          try {
            // Validate that project_pda is a valid base58 string
            const pdaString = currentProject.project_pda.trim();
            if (pdaString && pdaString.length > 0) {
              projectPDA = new PublicKey(pdaString);
              isValidProjectPDA = true;
              console.log(`✅ Valid project PDA: ${projectPDA.toString()}`);
            } else {
              console.warn("⚠️ Project PDA is empty string");
            }
          } catch (error: any) {
            console.error(`❌ Invalid project_pda: "${currentProject.project_pda}"`, error);
            console.warn("⚠️ Falling back to global deposit function due to invalid project_pda");
            isValidProjectPDA = false;
          }
        }
        
        // Get project fee amount (use project fee if available, otherwise default to 0.001 SOL)
        // Handle null, undefined, empty string, or 0 values
        const projectFeeValue = currentProject?.fee_amount;
        const projectFeeLamports = (projectFeeValue && 
                                    projectFeeValue !== '0' && 
                                    projectFeeValue !== 'null' && 
                                    projectFeeValue !== 'undefined' &&
                                    parseInt(projectFeeValue) > 0)
          ? parseInt(projectFeeValue)
          : 1000000; // Default: 0.001 SOL (1,000,000 lamports)
        
        console.log(`💰 Project Fee Configuration:`);
        console.log(`   Project: ${currentProject?.name || 'None'}`);
        console.log(`   Project fee_amount from DB: ${currentProject?.fee_amount || 'Not set'}`);
        console.log(`   Using fee: ${projectFeeLamports} lamports (${projectFeeLamports / LAMPORTS_PER_SOL} SOL)`);
        console.log(`   Has project_pda: ${isValidProjectPDA ? 'Yes' : 'No'}`);
        
        if (isValidProjectPDA && projectPDA && currentProject) {
          // Use new project-specific deposit function with project PDA
          console.log(`✅ Using depositSOLProject with project PDA and project fee`);
          signature = await solanaProgramService.depositSOLProject(
            publicKey,
            depositAmount,
            { publicKey, signTransaction },
            projectPDA,
            projectFeeLamports,
            projectId // Pass projectId for project-specific deposit wallet
          );
        } else {
          // No project PDA, but still use project fee from database
          console.warn("⚠️ No valid project PDA found, using project fee from database with custom fee function");
          console.log(`✅ Using depositSOLWithCustomFee with project fee: ${projectFeeLamports} lamports (${projectFeeLamports / LAMPORTS_PER_SOL} SOL)`);
          // Use depositSOL with custom fee override
          signature = await solanaProgramService.depositSOLWithCustomFee(
            publicKey,
            depositAmount,
            { publicKey, signTransaction },
            projectFeeLamports,
            projectId // Pass projectId for project-specific deposit wallet
          );
        }
      } else {
        // Use generic deposit function for all SPL tokens (USDC, TOKEN4, and any new tokens)
        // This works for any token mint address
        signature = await solanaProgramService.depositToken(
          publicKey,
          selectedTokenMint,
          depositAmount,
          { publicKey, signTransaction, sendTransaction },
          dynamicFee || 0 // Pass dynamic fee amount
        );
      }

      // Update database with project token equivalent (using current dynamic rate)
      if (signature) {
        try {
          // Use the projectTokenEquivalent which is already calculated with dynamic rate
          const tokenAmount = projectTokenEquivalent;
          let userId = state.uid || state.id;
          console.log(`💰 ${projectTokenSymbol} amount to credit: ${tokenAmount.toFixed(4)} ${projectTokenSymbol} (Rate: 1 ${selectedToken} = ${currentRate.toFixed(4)} ${projectTokenSymbol})`);
          console.log(`🔍 Deposit - Current user state:`, { userId, uid: state.uid, id: state.id, walletAddress: state.walletAddress });

          // Get current project ID from context (most reliable)
          const currentProjectId = getProjectId();
          
          // Check if this is the main project (no projectId or no activeProjectSlug)
          const isMainProject = !currentProjectId || !activeProjectSlug;
          
          // Main project: use legacy user table (no project_id needed)
          if (isMainProject) {
            console.log("🏠 Main project: Processing deposit using legacy user table");
            
            // Final safety net: if userId is still missing, attempt to create/fetch once more
            if (!userId && publicKey) {
              try {
                const walletAddress = publicKey.toBase58();
                const email = state.email || await generateEmailFromWallet(walletAddress);
                const { data: fallbackUser, error: fetchErr } = await supabase
                  .from("user")
                  .select("*")
                  .eq("walletAddress", walletAddress)
                  .single();

                let ensured = fallbackUser;

                if (fetchErr && fetchErr.code !== "PGRST116") {
                  console.error("Fallback fetch user failed:", fetchErr);
                }

                if (!ensured) {
                  const { data: newUser, error: insertErr } = await supabase
                    .from("user")
                    .insert({
                      id: walletAddress,
                      uid: walletAddress,
                      walletAddress,
                      email,
                      apes: 0,
                      provider: "wallet",
                    })
                    .select()
                    .single();
                  if (insertErr) {
                    console.error("Fallback insert user failed:", insertErr);
                  } else {
                    ensured = newUser;
                  }
                }

                const ensuredId = ensured?.id || ensured?.uid || ensured?.walletAddress;

                if (ensuredId) {
                  userId = ensuredId;
                  setState((prev) => ({
                    ...prev,
                    id: userId?.toString() || prev.id,
                    uid: userId?.toString() || prev.uid,
                    walletAddress,
                    apes: ensured?.apes ?? prev.apes ?? 0,
                    email: ensured?.email || prev.email,
                  }));
                } else {
                  console.error("Fallback ensure user returned no ID");
                }
              } catch (fallbackErr) {
                console.error("Fallback: error ensuring legacy user:", fallbackErr);
              }
            }

            if (!userId) {
              console.error("❌ No user ID available for deposit!");
              alert("Please login first.");
              setIsProcessing(false);
              return;
            }
            
            try {
              // Get current balance from legacy user table
              const { data: legacyUser, error: userFetchError } = await supabase
                .from("user")
                .select("apes")
                .eq("id", userId)
                .single();
              
              if (userFetchError) {
                console.error("Error fetching user:", userFetchError);
                throw userFetchError;
              }
              
              const currentBalance = legacyUser?.apes || 0;
              const plus = tokenAmount + currentBalance;
              
              console.log(`💰 Main project deposit balance update:`);
              console.log(`   Current balance: ${currentBalance}`);
              console.log(`   Deposit amount: ${tokenAmount}`);
              console.log(`   New balance: ${plus}`);
              
              // Update legacy user balance
              const { data: updatedUser, error: userError } = await supabase
                .from("user")
                .update({ 
                  apes: plus,
                  walletAddress: publicKey.toString()
                })
                .eq("id", userId)
                .select()
                .single();
              
              if (userError) {
                console.error("Error updating user balance:", userError);
                throw userError;
              }
              
              console.log(`✅ Main project balance updated successfully. New balance: ${updatedUser.apes}`);
              
              // Save transaction (main project has NULL project_id)
              const transactionData: any = {
                transactionId: signature,
                ogx: tokenAmount,
                userId: userId,
                t_status: "purchase",
                walletAddress: publicKey.toString(),
                project_id: null // Main project transactions have NULL project_id
              };
              
              console.log(`💾 Saving main project transaction (project_id: NULL)`);
              
              const { error: txError } = await supabase.from("transaction").insert(transactionData);
              
              if (txError) {
                console.error("Error saving transaction:", txError);
                throw txError;
              }
              
              // Update user state
              const newSpending = (state.totalSpending || 0) + tokenAmount;
              setState({ 
                ...state, 
                apes: plus, 
                totalSpending: newSpending
              });
              
              const tokenSymbol = selectedTokenInfo.symbol;
              alert(`${tokenSymbol} deposit successful! You received ${tokenAmount.toFixed(2)} ${projectTokenSymbol}. Transaction: ${signature}`);
              
              // Refresh balances
              await fetchTokenBalance();
              run(userId);
              
              setIsProcessing(false);
              return;
            } catch (mainProjectError) {
              console.error("Error processing main project deposit:", mainProjectError);
              alert("Deposit failed. Please try again.");
              setIsProcessing(false);
              return;
            }
          }

          // Sub-project: use project_users table (requires project slug)
          if (currentProjectId && publicKey && activeProjectSlug) {
            try {
              const { getOrCreateProjectUser } = await import("@/service/projectUserService");
              const projectSlug = activeProjectSlug;
              
              console.log(`💰 Deposit - Using project: ${projectSlug} (ID: ${currentProjectId})`);
              
              if (projectSlug) {
                // Generate email if not available in state
                let email = state.email;
                if (!email) {
                  email = await generateEmailFromWallet(publicKey.toString());
                  console.log(`📧 Generated email for deposit: ${email}`);
                }
                
                const projectUserResult = await getOrCreateProjectUser(
                  projectSlug,
                  publicKey.toString(),
                  {
                    email: email,
                    full_name: state.full_name,
                    username: state.username,
                    avatar: state.avatar_url
                  }
                );

                if (projectUserResult.success && projectUserResult.user) {
                  // Use project_user id instead of auth user id
                  const projectUserId = projectUserResult.user.id;
                  // Verify the project_user belongs to the correct project
                  const userProjectId = typeof projectUserResult.user.project_id === 'string' 
                    ? parseInt(projectUserResult.user.project_id) 
                    : projectUserResult.user.project_id;
                  
                  console.log(`🔍 Verifying project match: userProjectId=${userProjectId}, currentProjectId=${currentProjectId}, projectSlug=${projectSlug}`);
                  
                  if (userProjectId !== currentProjectId) {
                    console.error(`❌ CRITICAL: Project mismatch! User belongs to project ${userProjectId}, but deposit is for project ${currentProjectId}`);
                    console.error(`   Project slug: ${projectSlug}`);
                    console.error(`   User data:`, projectUserResult.user);
                    alert(`Project mismatch detected. User belongs to project ${userProjectId} but deposit is for ${currentProjectId}. Please refresh the page.`);
                    setIsProcessing(false);
                    return;
                  }
                  
                  console.log(`✅ Project verification passed: User belongs to correct project ${userProjectId}`);
                  
                  // Use balance from database, not state (state might be stale)
                  const currentBalance = projectUserResult.user.apes || 0;
                  const currentSpending = projectUserResult.user.total_spending || 0;
                  const plus = tokenAmount + currentBalance;
                  
                  console.log(`💰 Deposit balance update:`);
                  console.log(`   Project: ${projectSlug} (ID: ${currentProjectId})`);
                  console.log(`   Current balance (from DB): ${currentBalance}`);
                  console.log(`   Deposit amount: ${tokenAmount}`);
                  console.log(`   New balance: ${plus}`);
                  console.log(`   Project User ID: ${projectUserId}`);
                  
                  // Update project user balance (use project_users table for multi-tenant)
                  // IMPORTANT: Also filter by project_id to ensure we're updating the correct project's user
                  const { data: updatedUser, error: userError } = await supabase
                    .from("project_users")
                    .update({ 
            apes: plus,
                      total_spending: currentSpending + tokenAmount
                    })
                    .eq("id", projectUserId)
                    .eq("project_id", currentProjectId) // Double-check: ensure we're updating the correct project
                    .select()
                    .single();

                  if (userError) {
                    console.error("Error updating project user balance:", userError);
                    throw userError;
                  }
                  
                  // Verify the update was successful
                  if (updatedUser) {
                    console.log(`✅ Balance updated successfully. New balance in DB: ${updatedUser.apes}`);
                    if (Math.abs(updatedUser.apes - plus) > 0.01) {
                      console.warn(`⚠️ Balance mismatch! Expected: ${plus}, Got: ${updatedUser.apes}`);
                    }
                  } else {
                    console.warn("⚠️ Update returned no data, verifying balance...");
                    // Verify by fetching the user again
                    const { data: verifyUser } = await supabase
                      .from("project_users")
                      .select("apes")
                      .eq("id", projectUserId)
                      .single();
                    if (verifyUser) {
                      console.log(`   Verified balance: ${verifyUser.apes}`);
                    }
                  }

          // Save transaction (ogx field stores project token amount)
          const transactionData: any = {
            transactionId: signature,
            ogx: tokenAmount, // Store project token amount in ogx field (for backward compatibility)
                    userId: projectUserId, // Use project_user id
                    t_status: "purchase",
                    walletAddress: publicKey.toString(),
                    project_id: currentProjectId, // Use project ID from context, not localStorage
                  };
                  
                  console.log(`💾 Saving transaction with project_id: ${currentProjectId} for project: ${projectSlug}`);

                  const { error: txError } = await supabase.from("transaction").insert(transactionData);

                  if (txError) {
                    console.error("Error saving transaction:", txError);
                    throw txError;
                  }

                  // Update user spending in state - ensure we're updating for the correct project
                  const newSpending = (state.totalSpending || 0) + tokenAmount;
                  setState({ 
                    ...state, 
                    apes: plus, 
                    totalSpending: newSpending, 
                    id: projectUserId, 
                    uid: projectUserId
                  });

                  const tokenSymbol = selectedTokenInfo.symbol;
                  alert(`${tokenSymbol} deposit successful! You received ${tokenAmount.toFixed(2)} ${projectTokenSymbol}. Transaction: ${signature}`);

                  // Refresh balances and reload user data to ensure UI shows correct balance
                  await fetchTokenBalance();
                  run(projectUserId);
                  
                  // Force reload user data from database to ensure UI is in sync
                  console.log(`🔄 Reloading user data after deposit for project ${projectSlug}`);
                  // The TopNav useEffect will automatically reload when projectId changes
                } else {
                  throw new Error(projectUserResult.error || "Failed to get or create project user");
                }
              } else {
                throw new Error("Project slug not available");
              }
            } catch (projectUserError) {
              console.error("Error with project user:", projectUserError);
              // Fallback to old user table if project user creation fails
              const fallbackPlus = tokenAmount + (state.apes || 0);
              await supabase.from("user").update({
                apes: fallbackPlus,
                walletAddress: publicKey.toString()
              }).eq("uid", userId);

              const transactionData: any = {
                transactionId: signature,
                ogx: tokenAmount,
            userId: userId,
            t_status: "purchase",
            walletAddress: publicKey.toString(),
          };

              if (currentProjectId) {
                transactionData.project_id = currentProjectId;
          }

          await supabase.from("transaction").insert(transactionData);
          const newSpending = (state.totalSpending || 0) + tokenAmount;
              setState({ ...state, apes: fallbackPlus, totalSpending: newSpending });

          const tokenSymbol = selectedTokenInfo.symbol;
          alert(`${tokenSymbol} deposit successful! You received ${tokenAmount.toFixed(2)} ${projectTokenSymbol}. Transaction: ${signature}`);
              await fetchTokenBalance();
              run(userId);
            }
          } else {
            // No project context - fallback to old user table
            const fallbackPlus2 = tokenAmount + (state.apes || 0);
            await supabase.from("user").update({
              apes: fallbackPlus2,
              walletAddress: publicKey.toString()
            }).eq("uid", userId);

            const transactionData: any = {
              transactionId: signature,
              ogx: tokenAmount,
              userId: userId,
              t_status: "purchase",
              walletAddress: publicKey.toString(),
            };

            if (currentProjectId) {
              transactionData.project_id = currentProjectId;
            }

            await supabase.from("transaction").insert(transactionData);
            const newSpending = (state.totalSpending || 0) + tokenAmount;
            setState({ ...state, apes: fallbackPlus2, totalSpending: newSpending });
            
            const tokenSymbol = selectedTokenInfo.symbol;
            alert(`${tokenSymbol} deposit successful! You received ${tokenAmount.toFixed(2)} ${projectTokenSymbol}. Transaction: ${signature}`);
          await fetchTokenBalance();
          run(userId);
          }
        } catch (dbError) {
          console.error("Database error:", dbError);
          alert(`Transaction successful on blockchain but failed to update database. Please contact support with transaction ID: ${signature}`);
        }
      }

      return signature;
    } catch (error) {
      console.error(`Error making ${selectedTokenInfo?.symbol} deposit:`, error);

      if (error instanceof Error && error.message === "TRANSACTION_ALREADY_PROCESSED") {
        alert("server error try again in few seconds");
      } else if (error instanceof Error && error.message.includes("already been processed")) {
        alert("server error try again in few seconds");
      } else if (error instanceof Error && error.message.includes("already in progress")) {
        alert("Transaction already in progress. Please wait for it to complete.");
      } else if (error instanceof Error && error.message.includes("simulation failed")) {
        alert("Transaction simulation failed. This might be due to insufficient balance or network issues. Please try again.");
      } else if (error instanceof Error && error.message.includes("Insufficient")) {
        alert(error.message);
      } else if (error instanceof Error && error.message.includes("Blockhash not found")) {
        alert("Network issue detected. Please try again in a moment.");
      } else {
        const tokenSymbol = selectedTokenInfo?.symbol || selectedToken || "token";
        alert(`Error making ${tokenSymbol} deposit: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Fetch balance when token selection changes
  useEffect(() => {
    if (publicKey) {
      fetchTokenBalance();
    }
  }, [publicKey, selectedToken, fetchTokenBalance]);

  useEffect(() => {
    const userId = state.uid || state.id;
    if (userId) {
      run(userId);
    }
  }, [state.uid, state.id, run, publicKey]);

  if (!state.purchase) return null;
  return (
    <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-black/40 z-50" >
      <div className="z-50 justify-center items-center w-full max-w-2xl bg-orange-400 rounded-lg">
        {/* <div className="relative p-4 w-full"> */}
        <div className="relative bg-background rounded-lg shadow ">
          <div className="flex items-center justify-between p-4 md:p-5 border-b rounded-t dark:border-gray-600">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mx-auto -mr-5">
              Deposit Tokens
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

          <div className="flex justify-center space-x-2 border-b w-full">
            <button
              onClick={() => setActiveTab("deposit")}
               className={`flex-1 max-w-[200px] py-2 px-3 text-sm text-center whitespace-nowrap ${activeTab === "deposit"
                ? "border-b-2 border-[#ff914d] text-orange-600 bg-gray-200"
                : "text-orange-600 bg-transparent"
                }`}
            >
              Deposit Tokens
            </button>
            <button
              onClick={() => setActiveTab("history")}
             className={`flex-1 max-w-[200px] py-2 px-3 text-sm text-center whitespace-nowrap ${activeTab === "history"
                ? "border-b-2 border-[#ff914d] text-orange-600 bg-gray-200"
                : "text-orange-600 bg-transparent"
                }`}
            >
              Deposit History
            </button>
          </div>

          <div className="w-full">
            {activeTab === "deposit" && (
              <div className="p-4 md:p-5">
                {availableTokens.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                    <p className="text-yellow-800 font-semibold mb-2">⚠️ No Tokens Configured</p>
                    <p className="text-yellow-700 text-sm mb-4">
                      This project doesn&apos;t have any tokens configured yet. Please contact the project administrator to add tokens.
                    </p>
                    <p className="text-yellow-600 text-xs">
                      Admin can add tokens from: <strong>Admin Panel → Token Management</strong>
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-orange-600 mb-2">
                          Select Token
                        </label>
                        <select
                          value={selectedToken}
                          onChange={(e) => {
                            setSelectedToken(e.target.value);
                            setDepositAmount(0.01); // Reset amount when token changes
                          }}
                          className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800 focus:ring-[#ff914d]/50 focus:border-[#ff914d]/50"
                          disabled={availableTokens.length === 0}
                        >
                          {availableTokens.map((token) => (
                            <option key={token.key} value={token.symbol}>
                              {token.name} ({token.symbol})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-orange-600 mb-2">
                          Deposit Amount ({selectedTokenInfo?.symbol})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.0"
                          min="0.01"
                          value={depositAmount}
                          onChange={(e) =>
                            setDepositAmount(Number(e.target.value))
                          }
                          className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800 focus:ring-[#ff914d]/50 focus:border-[#ff914d]/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-orange-600 mb-2">
                          Estimated {projectTokenSymbol} You&apos;ll Receive
                        </label>
                        <input
                          className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800"
                          value={projectTokenEquivalent ? projectTokenEquivalent.toFixed(2) : "0.00"}
                          disabled
                        />
                      </div>
                      {/* <div>
                        <label className="block text-sm font-medium text-orange-600 mb-2">
                          Deposit Fee ({selectedTokenInfo?.symbol})
                        </label>
                        <input
                          className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800"
                          disabled
                          value={dynamicFee > 0 ? dynamicFee.toFixed(6) : "Calculating..."}
                        />
                        <p className="text-xs text-gray-600 mt-1">
                          Based on SOL fee: {BASE_SOL_FEE} SOL (≈ ${(BASE_SOL_FEE * (exchangeRates.SOL_TO_OGX / 1000 * 180)).toFixed(4)})
                        </p>
                      </div> */}
                      <div>
                        <label className="block text-sm font-medium text-orange-600 mb-2">
                          Available {selectedTokenInfo?.symbol} in Wallet
                        </label>
                        <input
                          className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800"
                          disabled
                          value={tokenBalance.toFixed(4)}
                        />
                      </div>
                      {/* <div className="bg-blue-50 p-3 rounded-lg space-y-2">
                        <p className="text-sm text-blue-800">
                          <strong>Note:</strong> {selectedTokenInfo?.symbol} tokens will be deposited and converted to {projectTokenSymbol} tokens at the current exchange rate.
                        </p>

                        {selectedToken !== "SOL" && selectedTokenInfo && (
                          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg space-y-2 mt-2">
                            <p className="text-xs text-amber-600 font-mono">
                              Token Mint: {selectedTokenInfo.mint.toString()}
                            </p>
                          </div>
                        )}
                      </div> */}
                    </div>
                    <div className="flex items-center justify-end pt-4 space-x-3 border-t border-[#ff914d]/20">
                      <button
                        onClick={makeTokenDeposit}
                        disabled={isProcessing || !connected || !selectedTokenInfo}
                        className="px-5 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-[#f74e14] to-[#ff914d] text-white hover:opacity-90 focus:ring-2 focus:ring-[#ff914d]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? "Processing..." : `Deposit ${selectedTokenInfo?.symbol || 'Token'}`}
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
                  </>
                )}
              </div>
            )}
            {activeTab === "history" && (
              <div className="p-4 md:p-5 w-full flex flex-col h-full">
                {loading ? (
                  <div className="flex justify-center items-center py-8 w-full flex-grow">
                    <div className="w-12 h-12 border-4 border-[#ff914d] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="flex-grow flex flex-col h-full">
                    {(!data || data.data?.length === 0) ? (
                      <div
                        className="flex-grow flex items-center justify-center"
                        style={{ height: "400px" }}
                      >
                        <p className="text-gray-500 dark:text-gray-400">
                          No Deposit history found
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-y-auto overflow-x-auto max-h-[400px] border border-gray-200 dark:border-gray-700 rounded-lg">
                        <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400 min-w-full table-fixed">
                          <thead className="text-xs text-gray-700 uppercase dark:text-gray-400 sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
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
                                className="px-6 py-3 bg-gray-50 dark:bg-gray-800 flex justify-center"
                              >
                                <span className="">{projectTokenSymbol}</span>
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 bg-gray-50 dark:bg-gray-800 w-1/3"
                              >
                                <span className="flex justify-center">
                                  Status
                                </span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="w-full">
                            {data?.data?.map((item) => (
                              <tr
                                key={item?.id}
                                className="border-b border-gray-200 dark:border-gray-700 w-full hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
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
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex items-center justify-end pt-4 space-x-3 border-t border-[#ff914d]/20 mt-4">
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

