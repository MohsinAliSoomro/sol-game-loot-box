"use client";
import TopNav from "@/app/Components/TopNav";
import Image from "next/image";
import Model from "@/app/Components/Model";
import { useRouter, useParams } from "next/navigation";
import { useRequest } from "ahooks";
import { supabase } from "@/service/supabase";
import { useProject } from "@/lib/project-context";
import { useUserState } from "@/state/useUserState";
import ImageSlider from "@/app/Components/ImageSlider";
import Loader from "@/app/Components/Loader";
import JackpotImage from "@/app/Components/JackpotImage";

// Types for the API responses
interface Product {
    id: number;
    name: string;
    price: string;
    image: string;
}

interface Transaction {
    id: number;
    winner: string;
    name: string;
    image: string;
    price: string;
}

// Helper function to convert Supabase storage path to full URL
const getLootboxImageUrl = (path: string | null | undefined): string => {
  if (!path) return '/default-item.png';
  
  // If it's already a full URL, return it
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // If it starts with '/', it's a local path
  if (path.startsWith('/')) {
    return path;
  }
  
  // Otherwise, it's a Supabase storage path - convert to full URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zkltmkbmzxvfovsgotpt.supabase.co';
  return `${supabaseUrl}/storage/v1/object/public/apes-bucket/${path}`;
};

export default function ProjectHomePage() {
    const params = useParams();
    const { currentProject, getProjectId } = useProject();
    const [user] = useUserState();
    // Get project slug from params OR from currentProject context (for root page)
    const projectSlug = (params?.projectSlug as string) || currentProject?.slug;
    const navigate = useRouter();

    // Check if we're on the root page (main project) - no projectSlug in URL params
    // Main project uses legacy tables without project_id filtering
    const isMainProject = !params?.projectSlug;
    const projectId = getProjectId();

    const getProducts = async () => {
        let query = supabase.from("products").select();
        // Only filter by project_id if NOT main project (main project uses legacy tables)
        if (!isMainProject && projectId) {
            query = query.eq("project_id", projectId);
        } else if (isMainProject) {
            // For main project, ONLY show products where project_id IS NULL (legacy main project data)
            // This isolates main project from sub-projects
            query = query.is("project_id", null);
        }
        return query;
    };

    const getLatestTransaction = async () => {
        let query = supabase
            .from("prizeWin")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(20);
        // Only filter by project_id if NOT main project
        if (!isMainProject && projectId) {
            query = query.eq("project_id", projectId);
        }
        // For main project, return all prize wins (legacy data without project_id)
        return query;
    };

    const getDepositTotal = async () => {
        const userId = typeof window !== 'undefined'
            ? localStorage.getItem('currentUserId') || user?.id || user?.uid
            : null;

        if (!userId) return 0;

        let query = supabase
            .from("transaction")
            .select("ogx")
            .eq("userId", userId)
            .eq("t_status", "purchase");

        // Only filter by project_id if NOT main project
        if (!isMainProject && projectId) {
            query = query.eq("project_id", projectId);
        }
        // For main project, return all transactions (legacy data without project_id)

        const { data } = await query;
        return data?.reduce((sum, tx) => sum + (parseFloat(tx.ogx) || 0), 0) || 0;
    };

    const getWithdrawTotal = async () => {
        const userId = typeof window !== 'undefined'
            ? localStorage.getItem('currentUserId') || user?.id || user?.uid
            : null;

        if (!userId) return 0;

        let query = supabase
            .from("withdraw")
            .select("ogx")
            .eq("userId", userId);

        // Only filter by project_id if NOT main project
        if (!isMainProject && projectId) {
            query = query.eq("project_id", projectId);
        }
        // For main project, return all withdrawals (legacy data without project_id)

        const { data } = await query;
        return data?.reduce((sum, w) => sum + (parseFloat(w.ogx) || 0), 0) || 0;
    };

    const { data: productsData, loading, error } = useRequest(getProducts);
    const { data: transactions, loading: transactionLoading, error: transactionError } = useRequest(getLatestTransaction);

    // Helper function to get product image by product_id
    const getProductImage = (productId: number) => {
        if (!productId) return null;
        const product = productsData?.data?.find((p: any) => p.id === productId);
        if (!product || !product.image) return null;
        
        // If image is already a full URL, return it
        if (product.image.startsWith('http://') || product.image.startsWith('https://')) {
            return product.image;
        }
        
        // If image starts with '/', it's a local path
        if (product.image.startsWith('/')) {
            return product.image;
        }
        
        // Check if it's a Supabase storage path
        if (product.image.includes('supabase.co') || product.image.includes('storage/v1')) {
            return product.image;
        }
        
        // Otherwise, prepend the front URL
        const frontUrl = process.env.NEXT_PUBLIC_FRONT_URL || '';
        if (!frontUrl) {
            console.warn('⚠️ NEXT_PUBLIC_FRONT_URL not set, using relative path');
            return `/${product.image}`;
        }
        return `${frontUrl}/${product.image}`;
    };

    // Helper function to create navigation URL with project slug
    // For main project (no projectSlug in URL), don't add project slug
    // For sub-projects, add the project slug
    const createUrl = (path: string) => {
        if (isMainProject) {
            // Main project: no project slug in URL
            return path;
        } else if (projectSlug) {
            // Sub-project: add project slug
        return `/${projectSlug}${path}`;
        }
        return path;
    };

    // If no project is loaded AND we're not on main project, show a message
    // Main project works independently without needing currentProject
    if (!currentProject && !isMainProject) {
        return (
            <div className="min-h-screen bg-orange-500 text-white">
                <div className="flex items-center justify-center h-screen">
                    <div className="text-center p-8">
                        <h1 className="text-3xl font-bold mb-4">No Project Found</h1>
                        <p className="text-lg opacity-80">
                            Unable to load project data.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Check for loading and error states
    if (loading || transactionLoading) {
        return (
            <div className="min-h-screen bg-orange-500">
                <Loader />
            </div>
        );
    }

    if (error || transactionError) {
        return (
            <div className="min-h-screen bg-orange-500">
                <div className="nav-top z-50 relative">
                    <TopNav />

                </div>
                <div className="flex items-center justify-center h-[calc(100vh-64px)] text-white text-xl">
                    Error loading data...
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden bg-orange-500 text-white">
            <div className="nav-top z-50 relative">
                <TopNav />

            </div>
            <ImageSlider />

            {/* Live Draw Section */}
            <div className="flex justify-center items-center my-8">
                <p className="text-3xl font-bold w-full text-center">Live draw</p>
            </div>
            <div className="w-full mb-8"  >
                <div className="overflow-x-auto scrollbar-hide ">
                    <div className="flex gap-4 flex-grow min-w-max px-4 h-56" >
                        {transactions?.data?.map((win, index) => {
                            // Determine image source based on reward type
                            let imageSource: string | null = null;
                            let fallbackImage: string = "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";
                            
                            // Check reward type
                            const rewardType = (win?.reward_type || '').toLowerCase();
                            const hasMint = !!win?.mint && win.mint.trim() !== '';
                            
                            // Check if image field contains a mint address (legacy entries)
                            const imageIsMint = win?.image && 
                                typeof win.image === 'string' && 
                                win.image.length >= 32 && 
                                win.image.length <= 44 && 
                                !win.image.includes('/') &&
                                !win.image.includes('.') &&
                                !win.image.includes('http');
                            
                            // Determine if this is an NFT
                            const isNFT = rewardType === 'nft' || 
                                         (hasMint && rewardType !== 'sol') ||
                                         (imageIsMint && !(win?.name || '').toLowerCase().includes('sol'));
                            
                            // Determine if this is SOL
                            const isSOL = rewardType === 'sol' || 
                                         (!hasMint && !imageIsMint && (win?.name || '').toLowerCase().includes('sol'));
                            
                            // Debug logging
                            console.log(`🎯 Prize card ${index}:`, {
                                name: win?.name,
                                reward_type: rewardType,
                                hasMint: hasMint,
                                mint: win?.mint,
                                image: win?.image,
                                imageIsMint: imageIsMint,
                                isNFT: isNFT,
                                isSOL: isSOL
                            });
                            
                            if (isNFT) {
                                // NFT reward - use mint address to fetch NFT image
                                // Prefer mint field, fallback to image if it's a mint address
                                imageSource = hasMint ? win.mint : (imageIsMint ? win.image : null);
                                fallbackImage = "/NFT-Logo.png"; // NFT fallback
                                console.log(`🎨 Using NFT image source:`, imageSource);
                            } else if (isSOL) {
                                // SOL/token reward - use SOL logo
                                imageSource = "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";
                                fallbackImage = "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";
                                console.log(`💰 Using SOL logo`);
                            } else if (win?.image && !imageIsMint) {
                                // Use image field if available and it's not a mint address
                                imageSource = win.image;
                                console.log(`🖼️ Using image field:`, imageSource);
                            }
                            
                            return (
                            <div key={index} className="w-[150px] flex-shrink-0 cursor-pointer"
                                onClick={() => navigate.push(createUrl("/lootboxes/" + (win?.product_id)))}
                            >
                                <div className="w-full aspect-square bg-white border border-orange-300 rounded-lg shadow-md text-orange-800 flex flex-col items-center relative overflow-hidden group">
                                    <div className="relative w-full h-full flex flex-col items-center">
                                        {/* Main content - slides up on hover */}
                                        <div className="absolute inset-0 flex flex-col items-center transition-transform duration-500 ease-in-out group-hover:-translate-y-full">
                                            <p className="text-sm font-bold truncate text-orange-700 mt-2">
                                                {win?.name?.slice(0, 10) || "Unknown"}
                                            </p>
                                            <div className="relative w-full h-24 overflow-hidden">
                                                <JackpotImage
                                                    image={imageSource}
                                                    name={win?.name || 'Reward'}
                                                    width={100}
                                                    height={100}
                                                    className="object-contain w-full h-full"
                                                    fallbackSrc={fallbackImage}
                                                />
                                            </div>
                                            <span className="font-bold text-sm mt-1 text-center mx-auto text-orange-700 mb-1 truncate w-full">
                                                {win?.name || 'Reward'}
                                            </span>
                                        </div>
                                        {/* Secondary content - revealed on hover */}
                                        <div className="absolute inset-0 flex flex-col items-center transition-transform duration-500 ease-in-out translate-y-full group-hover:translate-y-0">
                                            <div className="relative w-full h-24 mt-5 overflow-hidden">
                                                {/* Show same reward image on hover (NFT shows NFT, SOL shows SOL) */}
                                                <JackpotImage
                                                    image={imageSource}
                                                    name={win?.name || 'Reward'}
                                                    width={100}
                                                    height={100}
                                                    className="object-contain mt-3 w-full h-full"
                                                    fallbackSrc={fallbackImage}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Feature OGX Lootbox Section */}
            <div className="flex justify-center items-center my-8">
                <p className="text-3xl font-bold w-full text-center">Feature OGX Lootbox</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 px-4 mb-40">
                {productsData?.data?.map((loot, index) => (
                    <div
                        key={index}
                        className="border border-orange-300 rounded-lg shadow-md text-orange-800 flex flex-col items-center justify-between relative
                        transition-all duration-300 hover:shadow-lg group  aspect-square w-full mt-5"
                        style={{
                            backgroundColor: 'var(--lootbox-box-bg-color, #FFFFFF)'
                        }}
                    >
                        <span className="font-bold text-center  bottom-7 w-full py-2 px-3 text-xs rounded-lg shadow-lg
                                            bg-gradient-to-r from-orange-500 to-orange-700 border border-orange-300 text-white
                                          hover:from-orange-600 hover:to-orange-800 transition-all
                                            active:scale-95 flex justify-center items-center gap-2">
                            {loot.name}
                        </span>
                        <div className="flex-1 flex flex-col items-center justify-center w-full">
                            <div className="relative w-24 h-24 mb-3 group-hover:scale-105 transition-transform duration-300">
                                <Image
                                    src={getLootboxImageUrl(loot.image)}
                                    alt={loot.name}
                                    className="object-contain drop-shadow-md w-full h-full"
                                    sizes="(max-width: 768px) 100vw, 200px"
                                    width={500}
                                    height={300}
                                    onError={(e) => {
                                        console.error('❌ Lootbox image failed to load:', loot.image);
                                        (e.target as HTMLImageElement).src = '/default-item.png';
                                    }}
                                />
                            </div>
                        </div>

                        <div className="w-full">
                            <button
                                onClick={() => navigate.push(createUrl("/lootboxes/" + loot.id))}
                                className="w-full py-2 text-xs rounded-lg shadow-lg
                                            bg-gradient-to-r from-orange-500 to-orange-700 border border-orange-300 text-white
                                            font-medium hover:from-orange-600 hover:to-orange-800 transition-all
                                            active:scale-95 flex justify-center items-center gap-2 relative top-3"
                            >
                                <span>Open</span>
                                <span className="bg-white bg-clip-text text-transparent">
                                    {loot.price}
                                </span>
                                <div className="relative w-3 h-3">
                                    <Image
                                        src={"/logo.png"}
                                        alt="ogx"
                                        className="rounded-full object-cover ring-2 ring-orange-300"
                                        width={300}
                                        height={300}
                                    />
                                </div>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <Model />
        </div>
    );
}


