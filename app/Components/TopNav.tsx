"use client";
import { supabase } from "@/service/supabase";
import { useUserState } from "@/state/useUserState";
import { useWallet } from "@solana/wallet-adapter-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { useEffectOnce } from "react-use";
// @ts-ignore
import bs58 from "bs58";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { getWebsiteLogo } from "@/service/websiteSettings";
import { useProject } from "@/lib/project-context";
import { getOrCreateProjectUser, getProjectUser } from "@/service/projectUserService";
import { generateEmailFromWallet } from "@/lib/email-utils";

function formatNumber(num: number | undefined) {
  if (num === undefined || num === null) return 0;
  if (num >= 1000000)
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return num;
}

export default function TopNav() {
  const [user, setUser] = useUserState();
  const { getProjectTokenSymbol, getProjectId, currentProject, loading: projectLoading } = useProject();
  const projectTokenSymbol = getProjectTokenSymbol();
  const projectId = getProjectId();
  const [open, setOpen] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [totalVolumeOGX, setTotalVolumeOGX] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("/logo.png");
  const [isLogoLoading, setIsLogoLoading] = useState<boolean>(true);
  const hasAttemptedLogin = useRef(false);
  const isLoadingUser = useRef(false); // Prevent duplicate API calls
  const lastLoadedProjectId = useRef<number | null>(null); // Track which project we last loaded
  const router = useRouter();
  const params = useParams();
  // Get project slug ONLY from URL params (not from currentProject context)
  // For main project (root URL), params?.projectSlug will be undefined
  // For sub-projects, params?.projectSlug will contain the project slug
  const projectSlug = params?.projectSlug as string | undefined;
  const isMainProject = !projectSlug; // True if no projectSlug in URL (main project)
  const { publicKey, connect, signMessage, connected, disconnect } = useWallet();

  // Build navigation paths with project slug if available
  // For main project, don't add project slug to paths
  const getNavPath = (path: string) => {
    if (projectSlug && !isMainProject) {
      return `/${projectSlug}${path}`;
    }
    return path;
  };

  // Fetch dynamic logo - refetch when projectId changes
  useEffect(() => {
    const fetchLogo = async () => {
      setIsLogoLoading(true);
      try {
        // Only fetch logo if we have a projectId (for project-specific pages)
        // For main project, projectId will be null/undefined, so it will use legacy website_settings
        const logo = await getWebsiteLogo(projectId || undefined);
        if (logo) {
          setLogoUrl(logo);
        } else {
          // Fallback to default logo if no custom logo found
          setLogoUrl("/logo.png");
        }
      } finally {
        setIsLogoLoading(false);
      }
    };
    fetchLogo();
  }, [projectId]);

  const handleSocialLogin = async (provider: "google" | "discord") => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `https://spin2win.vibingapes.com/`,
      },
    });
  };

  const handleSimpleWalletLogin = useCallback(async () => {
    if (!connected || !publicKey || isAutoLoggingIn || isLogin) {
      return;
    }

    // For sub-projects, wait for project context to load before proceeding
    // This prevents treating sub-project as main project due to race condition
    if (projectSlug && projectLoading) {
      console.log("⏳ Waiting for project context to load before login...");
      return;
    }

    // Get project slug from context if not in URL (for root page)
    const activeProjectSlug = projectSlug || currentProject?.slug;
    
    setIsAutoLoggingIn(true);
    
    try {
      const walletAddress = publicKey.toBase58();
      
      // Main project works independently - use legacy user table
      if (isMainProject || !activeProjectSlug) {
        console.log(`🏠 Main project: Creating/loading user for wallet: ${walletAddress}`);
        
        // Get email from auth session, or generate from wallet address
        const sessionResponse = await supabase.auth.getSession();
        let email = sessionResponse.data.session?.user.email || null;
        
        // If no email from session, generate one from wallet address
        if (!email) {
          email = await generateEmailFromWallet(walletAddress);
          console.log(`📧 Generated email from wallet: ${email}`);
        }
        
        // Check if user exists in legacy user table by walletAddress (main project uses walletAddress)
        let legacyUser = null;
        const { data: existingUser } = await supabase
          .from('user')
          .select('*')
          .eq('walletAddress', walletAddress)
          .single();
        
        legacyUser = existingUser;
        
        // If user doesn't exist, create one (generate UUID for id/uid)
        // NOTE: Main project user table doesn't have total_spending column
        if (!legacyUser) {
          // Generate UUID for id and uid columns
          const userId = crypto.randomUUID();
          const { data: newUser, error: createError } = await supabase
            .from('user')
            .insert({
              id: userId,
              uid: userId,
              walletAddress: walletAddress,
              email: email,
              apes: 0,
              provider: 'wallet'
            })
            .select()
            .single();
          
          if (createError) {
            console.error('Error creating user:', createError);
            alert('Login failed. Please try again.');
            return;
          }
          
          legacyUser = newUser;
          console.log(`✅ Created new user for wallet: ${walletAddress}, ID: ${legacyUser.id || legacyUser.uid}`);
        } else {
          // If existing user has NULL id/uid, backfill with generated UUID
          if (!legacyUser.id || !legacyUser.uid) {
            const userId = crypto.randomUUID();
            const { data: updatedUser, error: updateError } = await supabase
              .from('user')
              .update({
                id: userId,
                uid: userId,
              })
              .eq('walletAddress', walletAddress)
              .select()
              .single();
            
            if (!updateError && updatedUser) {
              legacyUser = updatedUser;
              console.log(`✅ Backfilled id/uid for wallet: ${walletAddress}, new ID: ${userId}`);
            } else if (updateError) {
              console.warn('⚠️ Failed to backfill id/uid:', updateError);
            }
          }
          console.log(`✅ Found existing user for wallet: ${walletAddress}, balance: ${legacyUser.apes}, ID: ${legacyUser.id || legacyUser.uid}`);
        }
        
        // Set user state
        // NOTE: Main project user table doesn't have total_spending, so set to 0
        setUser({
          ...user,
          id: legacyUser.id || walletAddress,
          uid: legacyUser.uid || walletAddress,
          walletAddress: walletAddress,
          apes: legacyUser.apes || 0,
          totalSpending: 0, // Main project user table doesn't have total_spending column
          email: legacyUser.email,
          full_name: legacyUser.full_name,
          username: legacyUser.username,
          avatar_url: legacyUser.avatar_url,
          provider: legacyUser.provider,
          created_at: legacyUser.created_at,
          updated_at: legacyUser.updated_at
        });
        console.log(`🔐 User state set - ID: ${legacyUser.id}, Wallet: ${walletAddress}`);
        
        // Load user volume for main project
        try {
          const { data: txs } = await supabase
            .from('transaction')
            .select('ogx')
            .eq('userId', legacyUser.id)
            .is('project_id', null); // Main project transactions have NULL project_id
          
          const volume = (txs || []).reduce((sum: number, t: any) => sum + (Number(t?.ogx) || 0), 0);
          setTotalVolumeOGX(volume);
          console.log(`📊 Loaded volume for main project: ${volume}`);
        } catch (volErr) {
          console.warn('Failed to load user volume:', volErr);
          setTotalVolumeOGX(0);
        }
        
        setIsLogin(true);
        setOpen(false);
        console.log("✅ Main project wallet login completed successfully!");
        
      } else {
        // Sub-project: use project-specific API
        console.log(`🔐 Creating/loading project user for wallet: ${walletAddress} in project: ${activeProjectSlug}`);
        
        // Get email from auth session, or generate from wallet address
        const sessionResponse = await supabase.auth.getSession();
        let email = sessionResponse.data.session?.user.email || null;
        
        // If no email from session, generate one from wallet address
        if (!email) {
          email = await generateEmailFromWallet(walletAddress);
          console.log(`📧 Generated email from wallet: ${email}`);
        }
        
        // Use new multi-tenant project_users system
        const result = await getOrCreateProjectUser(
          activeProjectSlug,
          walletAddress,
          {
            email: email,
            username: undefined,
            avatar: undefined,
            full_name: undefined
          }
        );

        if (result.success && result.user) {
          console.log(`✅ ${result.isNew ? 'Created' : 'Found'} project user:`, result.user);
          
          // Map project_user to user state format
          const projectUser = result.user;
          setUser({
            ...user,
            id: projectUser.id,
            uid: projectUser.id,
            walletAddress: projectUser.wallet_address,
            apes: projectUser.apes || 0,
            totalSpending: projectUser.total_spending || 0,
            email: projectUser.email || "",
            full_name: projectUser.full_name || "",
            username: projectUser.username || "",
            avatar_url: projectUser.avatar || "",
            provider: projectUser.provider,
            created_at: projectUser.created_at,
            updated_at: projectUser.updated_at
          });

          // Load user volume for this project
          try {
            const { data: txs } = await supabase
              .from('transaction')
              .select('ogx')
              .eq('userId', projectUser.id)
              .eq('project_id', projectUser.project_id);
            
            const volume = (txs || []).reduce((sum: number, t: any) => sum + (Number(t?.ogx) || 0), 0);
            setTotalVolumeOGX(volume);
            console.log(`📊 Loaded volume for project ${projectUser.project_id}: ${volume}`);
          } catch (volErr) {
            console.warn('Failed to load user volume:', volErr);
            setTotalVolumeOGX(0);
          }
        } else {
          console.error('Failed to get or create project user:', result.error);
          const errorMsg = result.error || 'Unknown error';
          console.error('Full error details:', { result, walletAddress, activeProjectSlug });
          alert(`Login failed: ${errorMsg}`);
          return;
        }
        
        setIsLogin(true);
        setOpen(false);
        console.log("✅ Project-specific wallet login completed successfully!");
      }
      
    } catch (error) {
      console.error("Error during wallet login:", error);
      alert('Login failed. Please try again.');
    } finally {
      setIsAutoLoggingIn(false);
    }
  }, [connected, publicKey, isAutoLoggingIn, isLogin, projectSlug, currentProject, projectLoading, isMainProject, setUser, setTotalVolumeOGX]);

  const handleLogin = async () => {
    // This is now just a wrapper for manual login if needed
    await handleSimpleWalletLogin();
  };
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "INITIAL_SESSION" && session?.user) {
        await saveUserToDatabase(session.user);
      }
    });
    return () => data?.subscription.unsubscribe();
  }, []);

  const saveUserToDatabase = async (user: any) => {
    try {
      const { data: existingUser, error: fetchError } = await supabase
        .from("user")
        .select()
        .eq("id", user.id)
        .single();
      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError;
      }

      const userData = {
        uid: user.id,
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name,
        avatar_url: user.user_metadata?.avatar_url,
        provider: user.app_metadata?.provider,
        updated_at: new Date().toISOString(),
        apes: 0,
      };

      if (!existingUser) {
        // Get project ID from context
        const activeProjectId = currentProject?.id || projectId || 
          (typeof window !== 'undefined' ? parseInt(localStorage.getItem('currentProjectId') || '0') : null);
        
        const insertData: any = {
          ...userData,
          created_at: new Date().toISOString(),
        };
        
        // Add project_id if available
        if (activeProjectId) {
          insertData.project_id = activeProjectId;
        }
        
        const { error: insertError } = await supabase.from("user").insert(insertData);
        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error("Error saving user:", error);
    }
  };
  //@ts-ignore
  useEffectOnce(() => {
    const onLoad = async () => {
      try {
        const response = await supabase.auth.getSession();
        const userId = response.data.session?.user.id;
        // Load project-specific user if project slug is available
        // Get project slug from context if not in URL (for root page)
        const activeProjectSlug = projectSlug || currentProject?.slug;
        
        // Main project works independently - use legacy user table
        // Sub-projects use project_users table via API
        if (publicKey) {
          const walletAddress = publicKey.toBase58();
          
          // For main project (no projectSlug), use legacy user table
          if (isMainProject || !activeProjectSlug) {
            console.log('🏠 Main project: Using legacy user table');
            
            // Try to load by userId first (if user has session)
            let legacyUser = null;
            if (userId) {
              const { data: userById } = await supabase
                .from('user')
                .select('*')
                .eq('id', userId)
                .single();
              legacyUser = userById;
            }
            
            // If not found by userId, try by walletAddress (main project uses walletAddress)
            if (!legacyUser && walletAddress) {
              const { data: userByWallet } = await supabase
                .from('user')
                .select('*')
                .eq('walletAddress', walletAddress)
                .single();
              legacyUser = userByWallet;
            }
            
            if (legacyUser) {
              setUser({
                ...user,
                id: legacyUser.id,
                uid: legacyUser.id,
                walletAddress: walletAddress,
                apes: legacyUser.apes || 0,
                totalSpending: 0, // Main project user table doesn't have total_spending column
                email: legacyUser.email,
                full_name: legacyUser.full_name,
                username: legacyUser.username,
                avatar_url: legacyUser.avatar_url,
                provider: legacyUser.provider,
                created_at: legacyUser.created_at,
                updated_at: legacyUser.updated_at
              });
              // Set login state for main project
              setIsLogin(true);
              
              // Load user volume for main project
              try {
                const { data: txs } = await supabase
                  .from('transaction')
                  .select('ogx')
                  .eq('userId', legacyUser.id)
                  .is('project_id', null); // Main project transactions have NULL project_id
                
                const volume = (txs || []).reduce((sum: number, t: any) => sum + (Number(t?.ogx) || 0), 0);
                setTotalVolumeOGX(volume);
                console.log(`📊 Loaded volume for main project: ${volume}`);
              } catch (volErr) {
                console.warn('Failed to load user volume:', volErr);
                setTotalVolumeOGX(0);
              }
            }
          } else if (activeProjectSlug && userId) {
            // For sub-projects, use project-specific API
            console.log(`📦 Sub-project: Using project_users for ${activeProjectSlug}`);
            // Get email from session or generate from wallet address
            let email = response.data.session?.user.email || null;
            
            // If no email from session, generate one from wallet address
            if (!email) {
              email = await generateEmailFromWallet(walletAddress);
              console.log(`📧 Generated email from wallet on load: ${email}`);
            }
            
            // Use new multi-tenant system - create user if doesn't exist
            const result = await getOrCreateProjectUser(
              activeProjectSlug,
              walletAddress,
              {
                email: email,
                full_name: undefined,
                username: undefined,
                avatar: undefined
              }
            );
            
            if (result.success && result.user) {
              const projectUser = result.user;
              setUser({
                ...user,
                id: projectUser.id,
                uid: projectUser.id,
                walletAddress: projectUser.wallet_address,
                apes: projectUser.apes || 0,
                totalSpending: projectUser.total_spending || 0,
                email: projectUser.email || "",
                full_name: projectUser.full_name || "",
                username: projectUser.username || "",
                avatar_url: projectUser.avatar || "",
                provider: projectUser.provider,
                created_at: projectUser.created_at,
                updated_at: projectUser.updated_at
              });
              
              // Load user's spending volume (sum of project token from transactions)
              try {
                const { data: txs } = await supabase
                  .from('transaction')
                  .select('ogx')
                  .eq('userId', projectUser.id)
                  .eq('project_id', projectUser.project_id);
                
                const volume = (txs || []).reduce((sum: number, t: any) => sum + (Number(t?.ogx) || 0), 0);
                setTotalVolumeOGX(volume);
              } catch (volErr) {
                console.warn('Failed to load user volume:', volErr);
                setTotalVolumeOGX(0);
              }
            }
          }
        }
        // Only set login state based on Supabase session if wallet is not connected
        // If wallet is connected, let the wallet connection effect handle the login state
        if (!connected) {
          setIsLogin(response.data.session ? true : false);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };
    onLoad();
  });

  // Load project-specific user data when wallet connects OR when project changes
  useEffect(() => {
    const loadUserData = async () => {
      // Prevent duplicate calls
      if (isLoadingUser.current) {
        console.log("⏸️ Already loading user, skipping...");
        return;
      }
      
      // Get project slug from URL params first (most reliable), then fallback to currentProject or localStorage
      let activeProjectSlug = projectSlug || currentProject?.slug || 
        (typeof window !== 'undefined' ? localStorage.getItem('currentProjectSlug') : null);
      let activeProjectId = projectId || 
        (typeof window !== 'undefined' ? parseInt(localStorage.getItem('currentProjectId') || '0') || null : null);
      
      // Main project works independently - doesn't need project slug or ID
      // For main project, use legacy user table
      if (isMainProject || (!activeProjectSlug && !activeProjectId)) {
        // Main project: use legacy user table
        if (connected && publicKey) {
          isLoadingUser.current = true;
          try {
            const walletAddress = publicKey.toBase58();
            const sessionResponse = await supabase.auth.getSession();
            const userId = sessionResponse.data.session?.user.id;
            
            if (userId) {
              // Load from legacy user table
              const { data: legacyUser, error: legacyError } = await supabase
                .from('user')
                .select('*')
                .eq('id', userId)
                .single();
              
              if (legacyUser && !legacyError) {
                setUser({
                  ...user,
                  id: legacyUser.id,
                  uid: legacyUser.id,
                  walletAddress: walletAddress,
                  apes: legacyUser.apes || 0,
                  totalSpending: 0, // Main project user table doesn't have total_spending column
                  email: legacyUser.email,
                  full_name: legacyUser.full_name,
                  username: legacyUser.username,
                  avatar_url: legacyUser.avatar_url,
                  provider: legacyUser.provider,
                  created_at: legacyUser.created_at,
                  updated_at: legacyUser.updated_at
                });
                // Set login state for main project
                setIsLogin(true);
                
                // Load user volume for main project
                try {
                  const { data: txs } = await supabase
                    .from('transaction')
                    .select('ogx')
                    .eq('userId', legacyUser.id)
                    .is('project_id', null); // Main project transactions have NULL project_id
                  
                  const volume = (txs || []).reduce((sum: number, t: any) => sum + (Number(t?.ogx) || 0), 0);
                  setTotalVolumeOGX(volume);
                  console.log(`📊 Loaded volume for main project: ${volume}`);
                } catch (volErr) {
                  console.warn('Failed to load user volume:', volErr);
                  setTotalVolumeOGX(0);
                }
              } else {
                // No user found - user needs to login
                setIsLogin(false);
              }
            } else {
              // No session - user needs to login
              setIsLogin(false);
            }
          } catch (error) {
            console.error('Error loading main project user:', error);
            setIsLogin(false);
          } finally {
            isLoadingUser.current = false;
          }
        } else {
          // Wallet not connected
          setIsLogin(false);
          isLoadingUser.current = false;
        }
        return;
      }
      
      // For sub-projects, we need both slug and ID
      if (!activeProjectSlug || !activeProjectId) {
        // If we have a projectSlug in URL but no projectId, we can't proceed
        if (projectSlug && !activeProjectId) {
          console.log('⏳ Waiting for project ID to load...', { projectSlug, activeProjectId });
          isLoadingUser.current = false;
          return;
        }
        
        console.log('⏳ Missing project context, cannot load user data', { activeProjectSlug, activeProjectId });
        isLoadingUser.current = false;
        return;
      }
      
      // Always reload user data to ensure we have the latest balance
      // Don't skip reload - balance might have changed from other operations
      // Only skip if we're in the middle of loading to prevent duplicate calls
      if (isLoadingUser.current) {
        console.log(`⏳ Already loading user, skipping duplicate call...`);
        return;
      }
      
      // Clear user state when project changes to prevent showing wrong project's balance
      if (lastLoadedProjectId.current && lastLoadedProjectId.current !== activeProjectId) {
        console.log(`🔄 Project changed from ${lastLoadedProjectId.current} to ${activeProjectId}, clearing user state`);
        setUser({
          ...user,
          apes: 0,
          totalSpending: 0
        });
        lastLoadedProjectId.current = null; // Reset so we reload for new project
      }
      
      // Load user data if wallet is connected (regardless of isLogin state)
      // This ensures users stay logged in after page refresh
      if (connected && publicKey && activeProjectSlug && activeProjectId) {
        isLoadingUser.current = true;
        try {
          // Get email from auth session, or generate from wallet address
          const sessionResponse = await supabase.auth.getSession();
          let email = sessionResponse.data.session?.user.email || null;
          const walletAddress = publicKey.toBase58();
          
          // If no email from session, generate one from wallet address
          if (!email) {
            email = await generateEmailFromWallet(walletAddress);
            console.log(`📧 Generated email from wallet on refresh: ${email}`);
          }
          
          console.log(`🔄 Loading user for project: ${activeProjectSlug} (ID: ${activeProjectId})`);
          console.log(`🔍 Wallet address: ${walletAddress}`);
          
          // Use getOrCreateProjectUser to ensure user exists and is up-to-date
          const result = await getOrCreateProjectUser(
            activeProjectSlug,
            walletAddress,
            {
              email: email,
              username: undefined,
              avatar: undefined,
              full_name: undefined
            }
          );
          
          // If project not found, clear stale localStorage data
          if (!result.success && result.error?.includes('Project not found')) {
            console.warn(`⚠️ Project ${activeProjectSlug} not found, clearing stale data`);
            if (typeof window !== 'undefined') {
              localStorage.removeItem('currentProjectSlug');
              localStorage.removeItem('currentProjectId');
            }
            isLoadingUser.current = false;
            return;
          }
          
          if (result.success && result.user) {
            const projectUser = result.user;
            const userProjectId = typeof projectUser.project_id === 'string' 
              ? parseInt(projectUser.project_id) 
              : projectUser.project_id;
            
            console.log(`📊 User data from API:`, {
              userId: projectUser.id,
              projectId: userProjectId,
              expectedProjectId: activeProjectId,
              apes: projectUser.apes,
              wallet: projectUser.wallet_address
            });
            
            // Verify this user belongs to the current project
            if (userProjectId !== activeProjectId) {
              console.error(`❌ Project mismatch! User belongs to project ${userProjectId}, but current project is ${activeProjectId}`);
              console.error(`   This can cause balance inconsistencies. User record:`, projectUser);
              // Clear user state and return
              setUser({
                ...user,
                apes: 0,
                totalSpending: 0
              });
              return;
            }
            
            // Double-check: Fetch directly from database to ensure we have the latest balance
            console.log(`🔍 Double-checking balance from database for project_id=${userProjectId}, wallet=${walletAddress}`);
            const { data: verifyUser, error: verifyError } = await supabase
              .from('project_users')
              .select('id, project_id, wallet_address, apes, total_spending')
              .eq('project_id', userProjectId)
              .eq('wallet_address', walletAddress)
              .single();
            
            if (verifyError) {
              console.error(`⚠️ Error verifying user balance:`, verifyError);
            } else if (verifyUser) {
              console.log(`✅ Verified balance from DB:`, {
                userId: verifyUser.id,
                projectId: verifyUser.project_id,
                apes: verifyUser.apes,
                totalSpending: verifyUser.total_spending
              });
              
              // Use verified balance from database (most up-to-date)
              if (verifyUser.apes !== projectUser.apes) {
                console.warn(`⚠️ Balance mismatch! API returned ${projectUser.apes}, but DB has ${verifyUser.apes}. Using DB value.`);
              }
              
              // Map project_user to user state format using verified data
              setUser({
                ...user,
                id: verifyUser.id,
                uid: verifyUser.id,
                walletAddress: verifyUser.wallet_address,
                apes: verifyUser.apes || 0,
                totalSpending: verifyUser.total_spending || 0,
                email: projectUser.email || "",
                full_name: projectUser.full_name || "",
                username: projectUser.username || "",
                avatar_url: projectUser.avatar || "",
                provider: projectUser.provider,
                created_at: projectUser.created_at,
                updated_at: projectUser.updated_at
              });
            } else {
              // Fallback to API data if verification fails
              console.warn(`⚠️ Could not verify user from DB, using API data`);
              setUser({
                ...user,
                id: projectUser.id,
                uid: projectUser.id,
                walletAddress: projectUser.wallet_address,
                apes: projectUser.apes || 0,
                totalSpending: projectUser.total_spending || 0,
                email: projectUser.email || "",
                full_name: projectUser.full_name || "",
                username: projectUser.username || "",
                avatar_url: projectUser.avatar || "",
                provider: projectUser.provider,
                created_at: projectUser.created_at,
                updated_at: projectUser.updated_at
              });
            }
            
            // Set login state to true when user data is successfully loaded
            // This ensures users stay logged in after page refresh
            setIsLogin(true);
            
            // Mark this project as loaded
            lastLoadedProjectId.current = activeProjectId;
            
            // Load user volume for this project
            try {
              const { data: txs } = await supabase
                .from('transaction')
                .select('ogx')
                .eq('userId', projectUser.id)
                .eq('project_id', userProjectId);
              
              const volume = (txs || []).reduce((sum: number, t: any) => sum + (Number(t?.ogx) || 0), 0);
              setTotalVolumeOGX(volume);
              console.log(`📊 Loaded volume for project ${userProjectId}: ${volume}`);
            } catch (volErr) {
              console.warn('Failed to load user volume:', volErr);
              setTotalVolumeOGX(0);
            }
          } else {
            console.log("No project user found - will be created on next action");
            // Clear user state if no user found for this project
            setUser({
              ...user,
              apes: 0,
              totalSpending: 0
            });
            lastLoadedProjectId.current = null;
          }
        } catch (error) {
          console.error("Error loading project user data:", error);
        } finally {
          isLoadingUser.current = false;
        }
      } else if (!connected || !publicKey) {
        // Wallet disconnected - clear login state and user data
        console.log("Wallet disconnected, clearing login state");
        setIsLogin(false);
        setUser({
          ...user,
          apes: 0,
          totalSpending: 0,
          id: "",
          uid: "",
          walletAddress: ""
        });
        lastLoadedProjectId.current = null;
        isLoadingUser.current = false;
      } else if (!activeProjectSlug || !activeProjectId) {
        // Clear user state if no project context
        if (user.apes > 0 || user.totalSpending > 0) {
          console.log("No project context, clearing user state");
          setUser({
            ...user,
            apes: 0,
            totalSpending: 0
          });
          lastLoadedProjectId.current = null;
        }
        isLoadingUser.current = false;
      } else {
        isLoadingUser.current = false;
      }
    };

    loadUserData();
  }, [connected, publicKey, projectSlug, currentProject, projectId, setUser]); // Removed isLogin from deps to allow auto-login on wallet connect

  const logout = async () => {
    try {
      // Disconnect wallet if connected
      try {
        // @ts-ignore - some adapters may not implement disconnect
        await disconnect?.();
      } catch (e) {
        console.warn("Wallet disconnect failed or not supported:", e);
      }

      await supabase.auth.signOut();
      // Redirect to root or project home based on current route
      if (projectSlug) {
        router.push(`/${projectSlug}`);
      } else {
        router.push("/");
      }
      setIsLogin(false);
      setIsAutoLoggingIn(false);
      hasAttemptedLogin.current = false;
      setOpen(false);
    } catch (error) {
      console.log("error", { error });
    }
  };

  const handleOpenModal = async () => {
    // await router.push('/');
    setOpen(true);
  };

  const handleCloseModal = () => {
    setOpen(false);
  };
  // Handle wallet connection - create user without signature
  useEffect(() => {
    if (connected && publicKey && !isLogin && !hasAttemptedLogin.current) {
      console.log("Wallet connected for first time:", publicKey.toBase58());
      hasAttemptedLogin.current = true;
      handleSimpleWalletLogin();
    } else if (!connected) {
      console.log("Wallet disconnected, resetting login state");
      setIsLogin(false);
      setIsAutoLoggingIn(false);
      hasAttemptedLogin.current = false; // Reset for next connection
    }
  }, [connected, publicKey, isLogin, handleSimpleWalletLogin]);
  
  console.log({
    isLogin,
    connected,
    isAutoLoggingIn,
    hasAttemptedLogin: hasAttemptedLogin.current,
    publicKey: publicKey?.toBase58()
  });
  
  // Add wallet address to console for debugging
  if (connected && publicKey) {
    console.log("Current wallet address:", publicKey.toBase58());
  }
  
  // Make wallet address available globally for debugging
  if (typeof window !== 'undefined') {
    (window as any).getCurrentWalletAddress = () => {
      return connected && publicKey ? publicKey.toBase58() : "No wallet connected";
    };
  }
  
  // Derived balances
  const userOGX = Number(user?.apes || 0);
  const userSOL = userOGX / 1000; // 1 SOL = 1000 OGX
  
  return (
    <div className="flex flex-col md:flex-row justify-between items-center border-white py-4 px-2 md:px-4 backdrop-blur-sm relative">
      {open && <div className="backdrop-blur"></div>}
      {/* Logo and Mobile Menu Button */}
      <div className="w-full md:w-1/4 flex items-center justify-between md:justify-start">
        <Link href={getNavPath("/")} className="relative inline-block">
          {isLogoLoading ? (
            <div className="w-full h-16 md:h-24 flex items-center justify-center">
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-white/20 animate-pulse" />
            </div>
          ) : (
            <Image
              src={logoUrl}
              alt="logo"
              width={600}
              height={400}
              className="w-full h-16 md:h-24 object-contain"
              unoptimized={logoUrl.startsWith("http")}
            />
          )}
          <span className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-red-600 text-white text-[10px] md:text-[11px] leading-none px-1 md:mt-4 mt-0  py-0.5 rounded">BETA</span>
        </Link>
        {/* Mobile menu button */}
        <button
          className="md:hidden text-white"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {mobileMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation links */}
      <div
        className={`${
          mobileMenuOpen ? "flex" : "hidden"
        } md:flex w-full md:w-2/4 flex-col md:flex-row justify-center items-center mt-4 md:mt-0`}
      >
        <div className="flex flex-col md:flex-row gap-4 md:gap-8 w-full md:w-auto items-center">
          <Link
            href={getNavPath("/")}
            className="text-base font-bold text-white hover:text-gray-300 transition-colors w-full text-center py-2 md:py-0"
          >
            Spinloot
          </Link>
          <Link
            href={getNavPath("/live-draw")}
            className="text-base font-bold text-white hover:text-gray-300 transition-colors w-full text-center py-2 md:py-0"
          >
            Jackpot
          </Link>
          <Link
            href={getNavPath("/leaderboard")}
            className="text-base font-bold text-white hover:text-gray-300 transition-colors w-full text-center py-2 md:py-0"
          >
            Leaderboard
          </Link>
        </div>
      </div>

      {/* Auth section */}
      <div
        className={`${
          mobileMenuOpen ? "flex" : "hidden"
        } md:flex w-full md:w-1/4 flex-col items-center md:items-end mt-4 md:mt-0`}
      >
        {isLogin ? (
          <div className="flex flex-col items-center md:items-end gap-4">
            <div className="flex items-center gap-4 w-full">
              <div className="border border-white flex-1 flex justify-between flex-col  rounded-lg px-6 md:px-10   relative  ">
                <div className="w-32 relative bottom-3 text-center bg-orange-500 text-white left-[20%]">
                  My Account
                </div>
                <div className="items flex justify-between text-white">
                  <div className="text-xs pt-2 pb-2">
                    <p>{projectTokenSymbol}</p>
                    <p className="text-center">{Number(user?.apes || 0).toFixed(1)}</p>
                  </div>
                  <div className="text-xs pt-2">
                    <p className="text-center">Volume ({projectTokenSymbol})</p>
                    <p className="text-center">{totalVolumeOGX.toFixed(3)}</p>
                  </div>
                  <div className="text-xs pt-2">
                    <p>SOL</p>
                    <p className="text-center">{userSOL.toFixed(3)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex  justify-center md:justify-end gap-2 text-xs text-white">
              <button
                onClick={() => setUser({ ...user, cart: true })}
                className="hover:text-gray-300 transition-colors"
              >
                Reward
              </button>
              <span>|</span>
              <button
                onClick={() => setUser({ ...user, purchase: true })}
                className="hover:text-gray-300 transition-colors"
              >
                Deposit
              </button>
              <span>|</span>
              <button
                onClick={() => setUser({ ...user, withdraw: true })}
                className="hover:text-gray-300 transition-colors"
              >
                Withdraw
              </button>

              <span>|</span>

              <button onClick={logout} className="flex justify-around">
                Logout
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleOpenModal}
            className="text-white px-8 py-2 rounded-full hover:bg-opacity-90 transition-colors w-full md:w-auto bg-orange-500"
          >
            Login
          </button>
        )}
      </div>

      {/* Login modal */}
      {open && (
        <div
          style={{ zIndex: 9999 }}
          className=" fixed top-0 left-0 backdrop-blur-md bg-black/60 z-50 flex justify-center items-center h-screen w-screen "
        >
          <div className="bg-background bg-orange-500 w-full md:w-[400px] rounded-2xl p-6 relative shadow-xl border border-foreground/20 mx-4 overflow-hidden">
            {/* Background pattern */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `url('/lv-pattern.png')`,
                backgroundSize: "120px",
                backgroundRepeat: "repeat",
              }}
            ></div>

            {/* Close button */}
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors duration-200 text-foreground"
            >
              <p className="ms-5">x</p>
            </button>

            {/* Header */}
            <div className="mb-8 text-center relative z-10">
              <h1 className="text-3xl font-bold text-foreground">SIGN IN</h1>
              <p className="text-foreground/60 mt-2">
                Connect to access your account
              </p>
            </div>

            {/* Buttons */}
            <div className="space-y-4 relative z-10">
              <button
                onClick={() => handleSocialLogin("google")}
                className="flex items-center justify-center gap-3 w-full bg-white text-black py-3 px-6 rounded-lg hover:bg-gray-100 transition-colors duration-200 font-medium"
              >
                {/* Google SVG */}
                <svg
                  width="24px"
                  height="24px"
                  viewBox="-3 0 262 262"
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="xMidYMid"
                >
                  <path
                    d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
                    fill="#4285F4"
                  />
                  <path
                    d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
                    fill="#34A853"
                  />
                  <path
                    d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782"
                    fill="#FBBC05"
                  />
                  <path
                    d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
                    fill="#EB4335"
                  />
                </svg>
                Continue with Google
              </button>

              <button
                onClick={() => handleSocialLogin("discord")}
                className="flex items-center justify-center gap-3 w-full bg-[#5865F2] text-white py-3 px-6 rounded-lg hover:bg-[#4752c4] transition-colors duration-200 font-medium"
              >
                {/* Discord SVG */}
                <svg
                  width="24px"
                  height="24px"
                  viewBox="0 -28.5 256 256"
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="xMidYMid"
                >
                  <g>
                    <path
                      d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"
                      fill="white"
                      fillRule="nonzero"
                    ></path>
                  </g>
                </svg>
                Continue with Discord
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center my-6 relative z-10">
              <div className="flex-grow bg-gray-700 h-px"></div>
              <span className="mx-3 text-gray-400 text-sm">OR</span>
              <div className="flex-grow bg-gray-700 h-px"></div>
            </div>

            {/* Wallet connection */}
            {!connected ? (
              <div className="space-y-3 relative z-10">
                <div className="wallet-button-wrapper w-full max-w-full overflow-hidden">
                  <WalletMultiButton />
                  <style jsx>{`
                     .wallet-button-wrapper {
                       width: 100% !important;
                       max-width: 100% !important;
                       overflow: hidden !important;
                     }
                     .wallet-button-wrapper :global(.wallet-adapter-button) {
                       width: 100% !important;
                       max-width: 100% !important;
                       box-sizing: border-box !important;
                       background-color: #4B5563 !important;
                       color: white !important;
                       border: 1px solid #6B7280 !important;
                       border-radius: 8px !important;
                       padding: 12px 24px !important;
                       font-weight: 500 !important;
                       font-family: inherit !important;
                       transition: all 0.2s !important;
                       align-items: center !important;
                       text-align: center !important;
                       justify-content: center !important;
                     }
                     .wallet-button-wrapper :global(.wallet-adapter-dropdown) {
                       width: 100% !important;
                       max-width: 100% !important;
                     }
                    .wallet-button-wrapper :global(.wallet-adapter-button:hover) {
                      background-color: #374151 !important;
                    }
                  `}</style>
                </div>
                {/* <p className="text-xs text-gray-400 text-center">
                  Connect your wallet to automatically create your account
                </p> */}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-center text-sm text-green-400 mb-2">
                  ✓ Wallet Connected: {publicKey?.toBase58().slice(0, 8)}...
                </div>
                {isAutoLoggingIn ? (
                  <div className="w-full border border-green-600 text-green-400 py-3 px-6 rounded-lg bg-green-900/20 transition-colors duration-200 font-medium relative z-10 text-center">
                    🔄 Creating your account...
                  </div>
                ) : (
                <div className="w-full border border-green-600 text-green-400 py-3 px-6 rounded-lg bg-green-900/20 transition-colors duration-200 font-medium relative z-10 text-center">
                    ✓ Account created successfully!
                </div>
                )}
                <p className="text-xs text-gray-400 text-center">
                  {isAutoLoggingIn 
                    ? "Setting up your account in the database..."
                    : "You're now logged in and ready to use the app"
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
