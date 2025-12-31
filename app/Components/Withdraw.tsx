"use client";
import { useUserState } from "@/state/useUserState";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";
import { useParams } from "next/navigation";
import {
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
    clusterApiUrl,
} from "@solana/web3.js";
import { solanaProgramService, OGX_MINT, SOL_MINT, USDC_MINT, TOKEN4_MINT } from "@/lib/solana-program";
import { useWallet } from "@solana/wallet-adapter-react";
import { CONFIG, convertOGXToSOL, convertSOLToOGX, convertOGXToUSDC } from "@/lib/config";
import {
    convertOGXToTokenDynamic,
    calculateOGXToTokenRate,
    getAllExchangeRates
} from "@/lib/price-service";
import { calculateProjectTokenToTokenRate } from "@/lib/project-price-service";
import { useProject } from "@/lib/project-context";
const getWithdrawHistory = async (userId: string) => {
    const response = await supabase.from("withdraw").select("*").eq("userId", userId);
    return response.data;
};
export default function WithdrawModal() {
    const [tab, setTab] = useState("withdraw");
    const [state, setState] = useUserState();
    const { publicKey, signTransaction, sendTransaction, connected } = useWallet();
    const { run, data, loading } = useRequest(getWithdrawHistory);
    const { getProjectId, getProjectTokenSymbol } = useProject();
    const projectTokenSymbol = getProjectTokenSymbol();
    
    // Get project slug from URL params (most reliable source for main project detection)
    const params = useParams();
    const projectSlugFromUrl = (params?.projectSlug as string | undefined);
    // Main project: no projectSlug in URL (localhost:3000)
    // Sub-project: has projectSlug in URL (localhost:3000/project-slug)
    const isMainProject = !projectSlugFromUrl;
    const projectId = getProjectId();

    // Check if admin wallet is configured
    const [adminWalletConfigured, setAdminWalletConfigured] = useState<boolean | null>(null);
    
    useEffect(() => {
        const checkAdminWallet = async () => {
            try {
                console.log('[WITHDRAW CHECK] Checking admin wallet configuration...', { projectId });
                
                // For projects, ONLY check project-specific admin wallet (no fallback to website_settings)
                if (projectId) {
                    const { data, error } = await supabase
                        .from('project_settings')
                        .select('setting_value')
                        .eq('project_id', projectId)
                        .eq('setting_key', 'admin_private_key')
                        .maybeSingle();

                    if (error && error.code !== 'PGRST116') {
                        console.error('[WITHDRAW CHECK] Error fetching project admin wallet:', error);
                    }

                    if (data?.setting_value) {
                        // Validate it's a valid private key (check if it can be decoded)
                        try {
                            const bs58 = (await import('bs58')).default;
                            bs58.decode(data.setting_value.trim());
                            console.log('[WITHDRAW CHECK] ✅ Project admin wallet configured');
                            setAdminWalletConfigured(true);
                            return;
                        } catch (e) {
                            console.warn(`[WITHDRAW CHECK] ⚠️ Invalid admin private key for project ${projectId}:`, e);
                            setAdminWalletConfigured(false);
                            return;
                        }
                    } else {
                        console.log('[WITHDRAW CHECK] ❌ No project-specific admin wallet found - withdrawals disabled');
                        setAdminWalletConfigured(false);
                        return;
                    }
                }
                
                // For main project (no projectId), check website_settings
                const { data: websiteData, error: websiteError } = await supabase
                    .from('website_settings')
                    .select('value')
                    .eq('key', 'admin_private_key')
                    .maybeSingle();

                if (websiteError && websiteError.code !== 'PGRST116') {
                    console.error('[WITHDRAW CHECK] Error fetching website admin wallet:', websiteError);
                }

                if (websiteData?.value) {
                    // Validate it's a valid private key
                    try {
                        const bs58 = (await import('bs58')).default;
                        bs58.decode(websiteData.value.trim());
                        console.log('[WITHDRAW CHECK] ✅ Website admin wallet configured');
                        setAdminWalletConfigured(true);
                        return;
                    } catch (e) {
                        console.warn('[WITHDRAW CHECK] ⚠️ Invalid website admin private key:', e);
                        setAdminWalletConfigured(false);
                        return;
                    }
                } else {
                    console.log('[WITHDRAW CHECK] ❌ No admin wallet found - withdrawals will be disabled');
                    setAdminWalletConfigured(false);
                    return;
                }
            } catch (error) {
                console.error('[WITHDRAW CHECK] ❌ Error checking admin wallet:', error);
                // On error, disable withdrawals to be safe
                setAdminWalletConfigured(false);
            }
        };

        checkAdminWallet();
    }, [projectId]);

    // Available tokens for withdrawal - dynamically loaded from database
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

    // Load tokens from database on mount
    // Main project: uses legacy tokenService (tokens table or CONFIG)
    // Sub-projects: uses projectTokenService (project_tokens table - on-chain tokens only)
    useEffect(() => {
        const loadTokens = async () => {
            // Main project: no projectId or no projectSlug
            if (isMainProject || !projectId) {
                console.log("🏠 Main project: Loading tokens from legacy tokenService");
                try {
                    const { getAvailableTokens } = await import("@/service/tokenService");
                    const tokens = await getAvailableTokens();
                    setAvailableTokens(tokens);
                } catch (error) {
                    console.error("Error loading tokens:", error);
                    // Fallback to config tokens
                    const fallbackTokens = CONFIG.AVAILABLE_TOKENS.map((tokenKey: string) => {
                        const tokenInfo = CONFIG.TOKEN_INFO[tokenKey as keyof typeof CONFIG.TOKEN_INFO];
                        const tokenMint = CONFIG.TOKENS[tokenKey as keyof typeof CONFIG.TOKENS];
                        return {
                            key: tokenKey,
                            mint: new PublicKey(tokenMint),
                            ...tokenInfo,
                        };
                    });
                    setAvailableTokens(fallbackTokens);
                }
            } else {
                // Sub-project: use project-specific on-chain tokens (same as deposit)
                console.log(`📦 Sub-project: Loading on-chain tokens for project ID ${projectId}`);
                try {
                    const { getProjectAvailableTokens } = await import("@/service/projectTokenService");
                    const tokens = await getProjectAvailableTokens(projectId);

                    if (tokens && tokens.length > 0) {
                        console.log(`✅ Loaded ${tokens.length} on-chain tokens for withdrawal (SOL + project tokens)`);
                        setAvailableTokens(tokens);
                        // Always default to SOL (first token)
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
                    // Fallback to SOL only
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
            }
        };
        loadTokens();
    }, [projectId, isMainProject]);

    const [selectedToken, setSelectedToken] = useState<string>("SOL");
    const [ogxAmount, setOgxAmount] = useState<number>(0.01);
    const [tokenBalance, setTokenBalance] = useState<number>(0);

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
        CONFIG.EXCHANGE_RATES.OGX_TO_SOL
    );
    const [isLoadingRates, setIsLoadingRates] = useState(false);

    const [form, setForm] = useState({
        withdrawBalance: 0,
        availableBalance: 0,
        walletAddress: "",
        solAmount: 0,
        solBalance: 0,
        usdcAmount: 0,
        usdcBalance: 0
    });
    const [isProcessing, setIsProcessing] = useState(false);

    // Get selected token info
    const selectedTokenInfo = useMemo(() => {
        return availableTokens.find(t => t.key === selectedToken) || availableTokens[0];
    }, [selectedToken]);

    // Get selected token mint
    const selectedTokenMint = useMemo(() => {
        return selectedTokenInfo?.mint || SOL_MINT;
    }, [selectedTokenInfo]);

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

    const fetchOGXBalance = useCallback(async () => {
        if (!publicKey) return;

        try {
            const balance = await solanaProgramService.getOGXBalance(publicKey);
            // Note: We don't update form here since token balance is tracked in vault, not wallet
            // For withdrawals, we need to check the vault balance, not wallet balance
            console.log(`Current ${projectTokenSymbol} wallet balance: ${balance}`);
        } catch (error) {
            console.error(`Error fetching ${projectTokenSymbol} balance:`, error);
        }
    }, [publicKey]);

    const fetchUSDCBalance = useCallback(async () => {
        if (!publicKey) return;

        try {
            const balance = await solanaProgramService.getUSDCBalance(publicKey);
            setForm(prev => ({ ...prev, usdcBalance: balance }));
            console.log(`Current USDC balance: ${balance}`);
        } catch (error) {
            console.error("Error fetching USDC balance:", error);
        }
    }, [publicKey]);

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

    // Fetch dynamic exchange rates on component mount and when token changes
    useEffect(() => {
        const fetchExchangeRates = async () => {
            setIsLoadingRates(true);
            try {
                // Initialize price service with project tokens if sub-project
                if (projectId && !isMainProject) {
                    const { initializePriceService } = await import("@/lib/price-service");
                    await initializePriceService(CONFIG, projectId);
                }

                const rates = await getAllExchangeRates(CONFIG.BASE_EXCHANGE_RATE.SOL_TO_OGX);
                setExchangeRates({
                    SOL_TO_OGX: rates.SOL_TO_OGX,
                    USDC_TO_OGX: rates.USDC_TO_OGX,
                    TOKEN4_TO_OGX: rates.TOKEN4_TO_OGX,
                });

                // Calculate rate: Project Token to On-Chain Token (reverse of deposit)
                let tokenRate: number;
                if (isMainProject || !projectId) {
                    // Main project: use token to Token rate
                    tokenRate = await calculateOGXToTokenRate(selectedToken, CONFIG.BASE_EXCHANGE_RATE.SOL_TO_OGX);
                    console.log(`📊 Current ${projectTokenSymbol} to ${selectedToken} rate: 1 ${projectTokenSymbol} = ${tokenRate.toFixed(4)} ${selectedToken}`);
                } else {
                    // Sub-project: use Project Token to Token rate
                    tokenRate = await calculateProjectTokenToTokenRate(
                        selectedToken,
                        projectTokenSymbol,
                        CONFIG.BASE_EXCHANGE_RATE.SOL_TO_OGX
                    );
                    console.log(`📊 Current ${projectTokenSymbol} to ${selectedToken} rate: 1 ${projectTokenSymbol} = ${tokenRate.toFixed(4)} ${selectedToken}`);
                }
                setCurrentRate(tokenRate);

                console.log(`✅ Updated exchange rates:`, rates);
            } catch (error) {
                console.error("Error fetching exchange rates:", error);
                // Use fallback rates from config
                const fallbackRates: { [key: string]: number } = {
                    SOL: CONFIG.EXCHANGE_RATES.OGX_TO_SOL,
                    USDC: CONFIG.EXCHANGE_RATES.OGX_TO_USDC,
                    TOKEN4: CONFIG.EXCHANGE_RATES.OGX_TO_TOKEN4,
                };
                setCurrentRate(fallbackRates[selectedToken] || CONFIG.EXCHANGE_RATES.OGX_TO_SOL);
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
    }, [selectedToken, connected, projectId, isMainProject, projectTokenSymbol]);

    // Calculate token equivalent for withdrawal using dynamic rates
    const tokenEquivalent = useMemo(() => {
        return ogxAmount * currentRate;
    }, [ogxAmount, selectedToken, currentRate]);

    const connectWallet = async () => {
        //@ts-ignore
        const { solana } = window;
        if (solana) {
            const response = await solana.connect();
            return response.publicKey.toString();
        }
        return null;
    };
    // Calculate SOL equivalent for token withdrawal
    const solExchange = useMemo(() => {
        return convertOGXToSOL(form.withdrawBalance);
    }, [form.withdrawBalance]);

    // Calculate token equivalent for SOL withdrawal
    const ogxExchange = useMemo(() => {
        return convertSOLToOGX(form.solAmount);
    }, [form.solAmount]);

    // Calculate token equivalent for USDC withdrawal
    const ogxExchangeForUSDC = useMemo(() => {
        return convertSOLToOGX(form.usdcAmount); // Using same rate as SOL for now
    }, [form.usdcAmount]);

    // Calculate USDC equivalent for token withdrawal
    const usdcExchange = useMemo(() => {
        return convertOGXToUSDC(form.withdrawBalance);
    }, [form.withdrawBalance]);

    useEffect(() => {
        fetchSolBalance();
        fetchOGXBalance();
        fetchUSDCBalance();
        fetchTokenBalance();
        if (publicKey) {
            run(publicKey.toString());
        }
    }, [publicKey, run, fetchSolBalance, fetchOGXBalance, fetchUSDCBalance, fetchTokenBalance, selectedToken]);

    // Unified withdrawal function that works with any selected token
    const makeTokenWithdrawTransaction = async () => {
        if (!publicKey || !signTransaction) {
            return alert("Please connect your wallet first");
        }

        // Check if admin wallet is configured
        if (adminWalletConfigured === false) {
            alert("⚠️ Admin wallet is not configured. Please contact the administrator to configure an admin wallet before making withdrawals.");
            return;
        }

        // If still checking, wait a moment
        if (adminWalletConfigured === null) {
            alert("Please wait while we verify the admin wallet configuration...");
            return;
        }

        // Check for user authentication - use both state.id and state.uid
        const userId = state.id || state.uid;
        if (!userId) {
            console.error("User state:", state);
            return alert("User not authenticated. Please refresh the page and try again.");
        }

        if (!ogxAmount || ogxAmount <= 0) {
            const tokenLabel = projectTokenSymbol;
            return alert(`Please enter a valid ${tokenLabel} withdrawal amount`);
        }

        // Check if user has enough balance
        const tokenLabel = projectTokenSymbol;
        if (state.apes < ogxAmount) {
            return alert(`Insufficient ${tokenLabel} balance. You have ${state.apes.toFixed(4)} ${tokenLabel} but need ${ogxAmount.toFixed(4)} ${tokenLabel}.`);
        }

        if (isProcessing) {
            return alert("Transaction already in progress. Please wait.");
        }

        setIsProcessing(true);

        try {
            // Main project detection: Check URL params (most reliable)
            // Main project: no projectSlug in URL (localhost:3000)
            // Sub-project: has projectSlug in URL (localhost:3000/project-slug)
            const projectSlug = projectSlugFromUrl;
            const isMainProjectCheck = !projectSlug;
            
            // Also check localStorage as fallback (but URL is primary)
            const projectId = typeof window !== 'undefined'
                ? localStorage.getItem('currentProjectId')
                : null;

            // Final check: main project if no slug in URL OR no projectId in localStorage
            const isMainProject = isMainProjectCheck || !projectId || projectId === 'null' || projectId === '';

            let signature: string;
            const tokenAmount = tokenEquivalent;

            // Route to appropriate withdrawal function based on token
            if (selectedToken === "SOL") {
                // For SOL, withdrawSOL expects SOL amount and handles token conversion internally
                // But we need to verify the platform has enough SOL
                const platformBalance = await solanaProgramService.getPlatformWalletBalance();
                if (platformBalance < tokenAmount + 0.01) {
                    alert(`Platform wallet has insufficient SOL. Available: ${platformBalance.toFixed(4)} SOL, Required: ${(tokenAmount + 0.01).toFixed(4)} SOL`);
                    setIsProcessing(false);
                    return;
                }

                // Withdraw SOL - the program will handle token burning
                // Main project: use main website admin wallet (pass undefined)
                // Sub-project: use project-specific admin wallet (pass projectId)
                signature = await solanaProgramService.withdrawSOL(
                    publicKey,
                    tokenAmount, // SOL amount to withdraw
                    { publicKey, signTransaction },
                    isMainProject ? undefined : (projectId ? parseInt(projectId) : undefined)
                );
            } else {
                // Use generic withdraw function for all SPL tokens (USDC, TOKEN4, and any new tokens)
                // This works for any token mint address
                const exchangeRate = currentRate; // OGX to token rate
                // Pass database OGX balance for balance sync (if user deposited USDC/TOKEN4)
                // Main project: use main website admin wallet (pass undefined)
                // Sub-project: use project-specific admin wallet (pass projectId)
                signature = await solanaProgramService.withdrawToken(
                    publicKey,
                    selectedTokenMint,
                    ogxAmount, // OGX amount to burn
                    { publicKey, signTransaction },
                    exchangeRate, // Exchange rate (OGX to token)
                    state.apes, // Database OGX balance (for sync if needed)
                    isMainProject ? undefined : (projectId ? parseInt(projectId) : undefined)
                );
            }

            // Update database
            // Use userId which was determined at the start of the function
            console.log(`${selectedToken} Withdrawal - User state:`, {
                userId: userId,
                walletAddress: publicKey.toString(),
                ogx: ogxAmount,
                token: selectedToken,
                tokenAmount: tokenAmount
            });
            
            console.log(`🔍 Withdrawal context check:`, {
                projectSlugFromUrl: projectSlug,
                projectId: projectId,
                isMainProject: isMainProject,
                userId: userId,
                walletAddress: publicKey.toString()
            });

            // Main project: use legacy user table (no project_user_id, project_id is null)
            // Sub-project: use project_users table (project_user_id required, project_id set)
            const withdrawData: any = {
                ogx: ogxAmount,
                status: "COMPLETED",
                walletAddress: publicKey.toString(),
            };

            if (isMainProject) {
                console.log("🏠 Main project: Processing withdrawal using legacy user table");
                console.log("   - Using userId field (from legacy user table)");
                console.log("   - NOT using project_user_id (main project has nothing to do with project_users)");
                // Main project: use userId (from legacy user table), no project_user_id, project_id is null
                withdrawData.userId = userId; // Use userId field for legacy user table
                withdrawData.project_id = null;
                // Explicitly do NOT set project_user_id for main project
                // Main website has nothing to do with project_users
                // Remove it multiple times to be absolutely sure
                delete withdrawData.project_user_id;
                if ('project_user_id' in withdrawData) {
                    delete withdrawData.project_user_id;
                }
            } else {
                console.log(`📦 Sub-project: Processing withdrawal for project ID ${projectId}`);
                console.log("   - Using project_user_id field (from project_users table)");
                // Sub-project: use project_user_id and project_id
                withdrawData.project_user_id = userId; // UUID from project_users table
                withdrawData.project_id = parseInt(projectId);
                // Don't use userId field for sub-projects
                delete withdrawData.userId;
            }
            
            // Final safety check: ensure project_user_id is NOT in withdrawData for main project
            if (isMainProject && 'project_user_id' in withdrawData) {
                console.error("❌ CRITICAL: project_user_id found in withdrawData for main project! Removing it...");
                delete withdrawData.project_user_id;
            }
            
            console.log(`📝 Final withdrawData (keys only):`, Object.keys(withdrawData));
            console.log(`📝 Final withdrawData:`, JSON.stringify(withdrawData, null, 2));

            const { error: withdrawError } = await supabase.from("withdraw").insert(withdrawData);

            if (withdrawError) {
                console.error(`Error saving ${selectedToken} withdrawal:`, withdrawError);
                throw withdrawError;
            }

            // Update user balance (OGX deducted)
            const minus = state.apes - ogxAmount;
            
            if (isMainProject) {
                // Main project: update legacy user table
                console.log("🏠 Main project: Updating balance in legacy user table");
                const { error: userError } = await supabase
                    .from("user")
                    .update({ apes: minus })
                    .eq("id", userId); // userId is the UUID from user table

                if (userError) {
                    console.error("Error updating main project user balance:", userError);
                    throw userError;
                }
            } else {
                // Sub-project: update project_users table
                console.log(`📦 Sub-project: Updating balance in project_users table`);
                const { error: userError } = await supabase
                    .from("project_users")
                    .update({ apes: minus })
                    .eq("id", userId); // userId is the UUID from project_users

                if (userError) {
                    console.error("Error updating project user balance:", userError);
                    throw userError;
                }
            }

            setState({ ...state, apes: minus });

            const tokenLabel = projectTokenSymbol;
            alert(`${selectedToken} withdrawal successful! ${ogxAmount.toFixed(4)} ${tokenLabel} burned, ${tokenAmount.toFixed(4)} ${selectedTokenInfo?.symbol} sent to your wallet. Transaction: ${signature}`);

            // Refresh balances
            await fetchTokenBalance();
            await fetchOGXBalance();
            run(userId);

        } catch (error) {
            console.error(`Error making ${selectedToken} withdrawal transaction:`, error);
            if (error instanceof Error && error.message.includes("already been processed")) {
                alert("This transaction has already been processed. Please check your wallet or try again with a different amount.");
            } else if (error instanceof Error && error.message.includes("already in progress")) {
                alert("Transaction already in progress. Please wait for it to complete.");
            } else if (error instanceof Error && error.message.includes("Insufficient")) {
                alert(error.message);
            } else {
                alert(`Error making ${selectedToken} withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const makeOGXWithdrawTransaction = async () => {
        if (!publicKey || !signTransaction) {
            return alert("Please connect your wallet first");
        }

        // Check for user authentication - use both state.id and state.uid
        const userId = state.id || state.uid;
        if (!userId) {
            console.error("User state:", state);
            return alert("User not authenticated. Please refresh the page and try again.");
        }

        if (!form.withdrawBalance || form.withdrawBalance <= 0) {
            return alert(`Please enter a valid ${projectTokenSymbol} withdrawal amount`);
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
                userId: userId,
                walletAddress: publicKey.toString(),
                ogx: form.withdrawBalance
            });

            // Main project detection: Check URL params (most reliable)
            const projectSlug = projectSlugFromUrl;
            const isMainProjectCheck = !projectSlug;
            
            // Also check localStorage as fallback
            const projectId = typeof window !== 'undefined'
                ? localStorage.getItem('currentProjectId')
                : null;
            
            // Final check: main project if no slug in URL OR no projectId in localStorage
            const isMainProject = isMainProjectCheck || !projectId || projectId === 'null' || projectId === '';

            const withdrawData: any = {
                ogx: form.withdrawBalance,
                status: "COMPLETED",
                walletAddress: publicKey.toString(),
            };

            // Main project: use userId (from legacy user table), no project_user_id, project_id is null
            // Sub-project: use project_user_id, no userId, set project_id
            if (isMainProject) {
                console.log(`🏠 Main project: Processing ${projectTokenSymbol} withdrawal`);
                withdrawData.userId = userId; // Use userId field for legacy user table
                withdrawData.project_id = null;
                // Explicitly do NOT set project_user_id for main project
                delete withdrawData.project_user_id;
            } else {
                console.log(`📦 Sub-project: Processing ${projectTokenSymbol} withdrawal for project ID ${projectId}`);
                withdrawData.project_user_id = userId; // UUID from project_users table
                withdrawData.project_id = parseInt(projectId);
                // Don't use userId field for sub-projects
                delete withdrawData.userId;
            }

            const { error: withdrawError } = await supabase.from("withdraw").insert(withdrawData);

            if (withdrawError) {
                console.error(`Error saving ${projectTokenSymbol} withdrawal:`, withdrawError);
                throw withdrawError;
            }

            // Update user balance (OGX deducted)
            const minus = state.apes - form.withdrawBalance;
            
            if (isMainProject) {
                // Main project: update legacy user table
                console.log("🏠 Main project: Updating balance in legacy user table");
                const updateField = state.id ? "id" : "uid";
                const { error: userError } = await supabase.from("user").update({ apes: minus }).eq(updateField, userId);
                
                if (userError) {
                    console.error("Error updating main project user balance:", userError);
                    throw userError;
                }
            } else {
                // Sub-project: update project_users table
                console.log(`📦 Sub-project: Updating balance in project_users table`);
                const { error: userError } = await supabase
                    .from("project_users")
                    .update({ apes: minus })
                    .eq("id", userId);
                
                if (userError) {
                    console.error("Error updating project user balance:", userError);
                    throw userError;
                }
            }

            setState({ ...state, apes: minus });

            alert(`${projectTokenSymbol} withdrawal successful! ${form.withdrawBalance} ${projectTokenSymbol} burned, ${solExchange.toFixed(4)} SOL sent to your wallet. Transaction: ${signature}`);

            // Refresh balances
            await fetchOGXBalance();
            run(userId);

        } catch (error) {
            console.error(`Error making ${projectTokenSymbol} withdrawal transaction:`, error);
            if (error instanceof Error && error.message === "TRANSACTION_ALREADY_PROCESSED") {
                alert("server error try again in few seconds");
            } else if (error instanceof Error && error.message.includes("already been processed")) {
                alert("server error try again in few seconds");
            } else if (error instanceof Error && error.message.includes("already in progress")) {
                alert("Transaction already in progress. Please wait for it to complete.");
            } else if (error instanceof Error && error.message.includes("Insufficient")) {
                alert(error.message);
            } else {
                alert(`Error making ${projectTokenSymbol} withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const makeSOLWithdrawTransaction = async () => {
        if (!publicKey || !signTransaction) {
            return alert("Please connect your wallet first");
        }

        // Check if admin wallet is configured
        if (adminWalletConfigured === false) {
            alert("⚠️ Admin wallet is not configured. Please contact the administrator to configure an admin wallet before making withdrawals.");
            return;
        }

        // If still checking, wait a moment
        if (adminWalletConfigured === null) {
            alert("Please wait while we verify the admin wallet configuration...");
            return;
        }

        // Check for user authentication - use both state.id and state.uid
        const userId = state.id || state.uid;
        if (!userId) {
            console.error("User state:", state);
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
            // Main project detection: Check URL params (most reliable)
            const projectSlug = projectSlugFromUrl;
            const isMainProjectCheck = !projectSlug;
            
            // Also check localStorage as fallback
            const projectId = typeof window !== 'undefined'
                ? localStorage.getItem('currentProjectId')
                : null;

            // Final check: main project if no slug in URL OR no projectId in localStorage
            const isMainProject = isMainProjectCheck || !projectId || projectId === 'null' || projectId === '';

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
            // Main project: use main website admin wallet (pass undefined)
            // Sub-project: use project-specific admin wallet (pass projectId)
            const signature = await solanaProgramService.withdrawSOL(
                publicKey, // This is the wallet address that made the deposit
                form.solAmount,
                { publicKey, signTransaction },
                isMainProject ? undefined : (projectId ? parseInt(projectId) : undefined)
            );

            // Update database with completed withdrawal
            console.log("SOL Withdrawal - User state:", {
                userId: userId,
                walletAddress: publicKey.toString(),
                ogx: ogxExchange,
                status: "COMPLETED"
            });

            const withdrawData: any = {
                ogx: ogxExchange,
                status: "COMPLETED", // Direct withdrawal from vault
                walletAddress: publicKey.toString(),
                userId: userId,
            };

            // Main project: project_id is null
            // Sub-project: set project_id
            if (isMainProject) {
                console.log("🏠 Main project: Processing withdrawal");
                withdrawData.project_id = null;
            } else {
                console.log(`📦 Sub-project: Processing withdrawal for project ID ${projectId}`);
                withdrawData.project_id = parseInt(projectId);
            }

            const { error: withdrawError } = await supabase.from("withdraw").insert(withdrawData);

            if (withdrawError) {
                console.error("Error saving withdrawal:", withdrawError);
                throw withdrawError;
            }

            console.log("Withdrawal saved successfully to database");

            // Update user balance immediately (OGX deducted)
            const minus = state.apes - ogxExchange;
            
            if (isMainProject) {
                // Main project: update legacy user table
                console.log("🏠 Main project: Updating balance in legacy user table");
                const updateField = state.id ? "id" : "uid";
                const { error: userError } = await supabase.from("user").update({ apes: minus }).eq(updateField, userId);
                
                if (userError) {
                    console.error("Error updating main project user balance:", userError);
                    throw userError;
                }
            } else {
                // Sub-project: update project_users table
                console.log(`📦 Sub-project: Updating balance in project_users table`);
                const { error: userError } = await supabase
                    .from("project_users")
                    .update({ apes: minus })
                    .eq("id", userId);
                
                if (userError) {
                    console.error("Error updating project user balance:", userError);
                    throw userError;
                }
            }

            setState({ ...state, apes: minus });

            alert(`SOL withdrawal completed! Transaction: ${signature}\n\n✅ SOL sent to: ${publicKey.toString()}\n\nYour SOL has been withdrawn from the vault and sent to your wallet.`);

            // Refresh balances
            await fetchSolBalance();
            await fetchOGXBalance();
            run(userId);

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

    const makeUSDCWithdrawTransaction = async () => {
        if (!publicKey || !signTransaction) {
            return alert("Please connect your wallet first");
        }

        // Check for user authentication - use both state.id and state.uid
        const userId = state.id || state.uid;
        if (!userId) {
            console.error("User state:", state);
            return alert("User not authenticated. Please refresh the page and try again.");
        }

        if (!form.withdrawBalance || form.withdrawBalance <= 0) {
            return alert(`Please enter a valid ${projectTokenSymbol} withdrawal amount`);
        }

        if (isProcessing) {
            return alert("Transaction already in progress. Please wait.");
        }

        setIsProcessing(true);

        try {
            // Use the real Solana program for OGX withdrawal (burns OGX and sends USDC)
            const signature = await solanaProgramService.withdrawUSDC(
                publicKey,
                form.withdrawBalance,
                { publicKey, signTransaction }
            );

            // Update database
            console.log("USDC Withdrawal - User state:", {
                userId: userId,
                walletAddress: publicKey.toString(),
                ogx: form.withdrawBalance
            });

            // Main project detection: Check URL params (most reliable)
            const projectSlug = projectSlugFromUrl;
            const isMainProjectCheck = !projectSlug;
            
            // Also check localStorage as fallback
            const projectId = typeof window !== 'undefined'
                ? localStorage.getItem('currentProjectId')
                : null;
            
            // Final check: main project if no slug in URL OR no projectId in localStorage
            const isMainProject = isMainProjectCheck || !projectId || projectId === 'null' || projectId === '';

            const withdrawData: any = {
                ogx: form.withdrawBalance,
                status: "COMPLETED",
                walletAddress: publicKey.toString(),
                userId: userId,
            };

            // Main project: project_id is null
            // Sub-project: set project_id
            if (isMainProject) {
                console.log("🏠 Main project: Processing USDC withdrawal");
                withdrawData.project_id = null;
            } else {
                console.log(`📦 Sub-project: Processing USDC withdrawal for project ID ${projectId}`);
                withdrawData.project_id = parseInt(projectId);
            }

            const { error: withdrawError } = await supabase.from("withdraw").insert(withdrawData);

            if (withdrawError) {
                console.error("Error saving USDC withdrawal:", withdrawError);
                throw withdrawError;
            }

            // Update user balance (OGX deducted)
            const minus = state.apes - form.withdrawBalance;
            
            if (isMainProject) {
                // Main project: update legacy user table
                console.log("🏠 Main project: Updating balance in legacy user table");
                const updateField = state.id ? "id" : "uid";
                const { error: userError } = await supabase.from("user").update({ apes: minus }).eq(updateField, userId);
                
                if (userError) {
                    console.error("Error updating main project user balance:", userError);
                    throw userError;
                }
            } else {
                // Sub-project: update project_users table
                console.log(`📦 Sub-project: Updating balance in project_users table`);
                const { error: userError } = await supabase
                    .from("project_users")
                    .update({ apes: minus })
                    .eq("id", userId);
                
                if (userError) {
                    console.error("Error updating project user balance:", userError);
                    throw userError;
                }
            }

            setState({ ...state, apes: minus });

            alert(`USDC withdrawal successful! ${form.withdrawBalance} OGX burned, ${usdcExchange.toFixed(4)} USDC sent to your wallet. Transaction: ${signature}`);

            // Refresh balances
            await fetchUSDCBalance();
            run(userId);

        } catch (error) {
            console.error("Error making USDC withdrawal transaction:", error);
            if (error instanceof Error && error.message === "TRANSACTION_ALREADY_PROCESSED") {
                alert("server error try again in few seconds");
            } else if (error instanceof Error && error.message.includes("already been processed")) {
                alert("server error try again in few seconds");
            } else if (error instanceof Error && error.message.includes("already in progress")) {
                alert("Transaction already in progress. Please wait for it to complete.");
            } else if (error instanceof Error && error.message.includes("Insufficient")) {
                alert(error.message);
            } else {
                alert(`Error making USDC withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    if (!state.withdraw) return null;

    return (
        <div className="fixed top-0 left-0 w-screen h-screen flex items-center 
        justify-center bg-black/40 z-50">            <div className="z-50 flex justify-center items-center w-full">
                <div className="relative p-4 w-full max-w-2xl">
                    <div className="relative bg-orange-400 rounded-lg shadow dark:bg-gray-700 h-full overflow-hidden">
                        <div className="flex items-center justify-between p-4 md:p-5 border-b rounded-t dark:border-gray-600">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mx-auto -mr-5">Withdraw Tokens</h3>
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
                        <div className="flex justify-center space-x-2 border-b w-full">
                            <button
                                onClick={() => setTab("withdraw")}
                             className={`flex-1 max-w-[200px] py-2 px-3 text-sm text-center whitespace-nowrap ${tab === "withdraw"
                                        ? "border-b-2 border-[#ff914d] text-orange-600 bg-gray-200"
                                        : "text-orange-600 bg-transparent"
                                    }`}
                            >
                                Withdraw Tokens
                            </button>
                            <button
                                onClick={() => setTab("history")}
                            className={`flex-1 max-w-[200px] py-2 px-3 text-sm text-center whitespace-nowrap ${tab === "history"
                                        ? "border-b-2 border-[#ff914d] text-orange-600 bg-gray-200"
                                        : "text-orange-600 bg-transparent"
                                    }`}
                            >
                                Withdraw History
                            </button>
                        </div>
                        {tab === "withdraw" && (
                            <div className="p-4 md:p-5 ">
                                {/* <p className="text-base leading-relaxed text-orange-600 mb-3">
                                    Withdraw tokens by burning OGX. Select the token you want to receive. Your OGX tokens will be burned and converted to the selected token at the current exchange rate.
                                </p> */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-orange-600 mb-2">
                                            Select Token to Withdraw
                                        </label>
                                        <select
                                            value={selectedToken}
                                            onChange={(e) => {
                                                setSelectedToken(e.target.value);
                                                setOgxAmount(0.01); // Reset amount when token changes
                                            }}
                                            className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800 focus:ring-[#ff914d]/50 focus:border-[#ff914d]/50"
                                        >
                                            {availableTokens.map((token) => (
                                                <option key={token.key} value={token.key}>
                                                    {token.name} ({token.symbol})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-orange-600 mb-2">
                                            Available {projectTokenSymbol} Balance
                                        </label>
                                        <input
                                            className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800"
                                            value={state.apes || 0}
                                            disabled
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-orange-600 mb-2">
                                            {projectTokenSymbol} Amount to Withdraw
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.0"
                                            min="0.01"
                                            value={ogxAmount}
                                            onChange={(e) => setOgxAmount(Number(e.target.value))}
                                            className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800 focus:ring-[#ff914d]/50 focus:border-[#ff914d]/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-orange-600 mb-2">
                                            You Will Receive ({selectedTokenInfo?.symbol})
                                        </label>
                                        <input
                                            className="w-full p-2.5 bg-white border border-[#ff914d]/20 rounded-lg text-gray-800"
                                            value={tokenEquivalent.toFixed(4)}
                                            disabled
                                        />
                                    </div>
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
                                            <strong>Note:</strong> OGX tokens will be burned and {selectedTokenInfo?.symbol} will be sent to your connected wallet address.
                                        </p>

                                        {selectedToken !== "SOL" && (
                                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg mt-2">
                                                <p className="text-sm text-amber-800 font-semibold mb-1">
                                                    ⚠️ Phantom Wallet Display Note:
                                                </p>
                                                <p className="text-xs text-amber-700">
                                                    For devnet tokens, Phantom wallet may display "Unknown" in the confirmation dialog. This is normal for devnet test tokens and does not affect the transaction. Your {selectedTokenInfo?.symbol} tokens will be withdrawn correctly.
                                                </p>
                                                <p className="text-xs text-amber-600 mt-2 font-mono">
                                                    Token Mint: {CONFIG.TOKENS[selectedToken as keyof typeof CONFIG.TOKENS]}
                                                </p>
                                            </div>
                                        )}
                                    </div> */}
                                </div>
                                <div className="flex items-center justify-end pt-4 space-x-3 border-t border-[#ff914d]/20">
                                    {adminWalletConfigured === false && (
                                        <div className="flex-1 mr-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                            <p className="text-xs text-yellow-800">
                                                <strong>⚠️ Withdrawal Disabled:</strong> Admin wallet is not configured. Please contact the administrator.
                                            </p>
                                        </div>
                                    )}
                                    <button
                                        onClick={makeTokenWithdrawTransaction}
                                        disabled={isProcessing || !connected || adminWalletConfigured === false || adminWalletConfigured === null}
                                        className="px-5 py-2.5 text-sm font-medium rounded-lg bg-gradient-to-r from-[#f74e14] to-[#ff914d] text-white hover:opacity-90 focus:ring-2 focus:ring-[#ff914d]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isProcessing ? "Processing..." : adminWalletConfigured === false ? "Withdrawal Disabled" : adminWalletConfigured === null ? "Checking..." : `Withdraw ${selectedTokenInfo?.symbol}`}
                                    </button>
                                    <button
                                        onClick={() => setState({ ...state, withdraw: false })}
                                        className="px-5 py-2.5 text-sm font-medium rounded-lg border border-[#ff914d]/20 text-gray-300 hover:bg-[#ff914d]/20 focus:ring-2 focus:ring-[#ff914d]/50"
                                    >
                                        Cancel
                                    </button>
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

                    </div>
                </div>
            </div>
        </div>
    );
}
