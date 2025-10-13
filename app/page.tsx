"use client";
import TopNav from "./Components/TopNav";
import Image from "next/image";
import Model from "./Components/Model";
import { useRouter } from "next/navigation";
import { useRequest } from "ahooks";
import { supabase } from "@/service/supabase";
import ImageSlider from "./Components/ImageSlider";
import Loader from "./Components/Loader";

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

const getProducts = async () => {
    const response = await supabase.from("products").select();
    return response;
};

// const getLatestTransaction = async () => {
//     const response = await supabase.from("prizeWin").select("*").order("created_at", { ascending: false }).limit(8);
//     return response;
// };

const getLatestTransaction = async () => {
  const response = await supabase
    .from("prizeWin")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  return response;
};
export default function Home() {
    const { data: productsData, loading, error } = useRequest(getProducts);
    const { data: transactions, loading: transactionLoading, error: transactionError } = useRequest(getLatestTransaction);
    const navigate = useRouter();
    
    // Helper function to get product image by product_id
    const getProductImage = (productId: number) => {
        const product = productsData?.data?.find((p: any) => p.id === productId);
        return `${process.env.NEXT_PUBLIC_FRONT_URL}/${product?.image}`;
    };

    // Check for loading and error states
    if (loading || transactionLoading) {
        return <Loader />;
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
console.log(transactions?.data,'transactions')
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
                        {transactions?.data?.map((win, index) => (
                            
                            <div key={index} className="w-[150px] flex-shrink-0 cursor-pointer"
                            onClick={() => navigate.push("/lootboxes/" + (win?.product_id))}
                            >
                                <div className="w-full aspect-square bg-white border border-orange-300 rounded-lg shadow-md text-orange-800 flex flex-col items-center relative overflow-hidden group">
                                    <div className="relative w-full h-full flex flex-col items-center">
                                        {/* Main content - slides up on hover */}
                                        <div className="absolute inset-0 flex flex-col items-center transition-transform duration-500 ease-in-out group-hover:-translate-y-full">
                                            <p className="text-sm font-bold truncate text-orange-700 mt-2">
                                                {win?.name?.slice(0, 10) || "Unknown"}
                                            </p>
                                            <div className="relative w-full h-24 overflow-hidden">
                                                <Image
                                                    src={getProductImage(win?.product_id) && win?.image}
                                                    alt={win?.name || 'Reward'}
                                                    className="object-contain w-full h-full"
                                                    width={100}
                                                    height={100}
                                                />
                                            </div>
                                            <span className="font-bold text-sm mt-1 text-center mx-auto text-orange-700 mb-1 truncate w-full">
                                                {win?.name || 'Reward'}
                                            </span>
                                            {/* Show SOL amount badge */}
                                            {/* {win?.sol && (
                                                <div className="absolute top-1 right-1 bg-green-500 text-white text-xs px-1 py-0.5 rounded">
                                                    {win.sol} SOL
                                                </div>
                                            )} */}
                                        </div>
                                        {/* Secondary content - revealed on hover */}
                                        <div className="absolute inset-0 flex flex-col items-center transition-transform duration-500 ease-in-out translate-y-full group-hover:translate-y-0">
                                            <div className="relative w-full h-24 mt-5 overflow-hidden">
                                                <Image
                                                    src={getProductImage(win?.product_id)}
                                                    alt={win?.name || 'Reward'}
                                                    className="object-contain mt-3 w-full h-full"
                                                    width={100}
                                                    height={100}
                                                />
                                            </div>
                                            {/* Show reward details on hover */}
                                            <div className="text-center mt-2">
                                                {/* {win?.sol && (
                                                    <p className="text-xs font-bold text-green-600">
                                                        {win.sol} SOL Won
                                                    </p>
                                                )} */}
                                                {/* {win?.created_at && (
                                                    <p className="text-xs text-gray-500">
                                                        {new Date(win.created_at).toLocaleDateString()}
                                                    </p>
                                                )} */}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
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
                        className="bg-white border border-orange-300 rounded-lg shadow-md text-orange-800 flex flex-col items-center justify-between relative
                        transition-all duration-300 hover:shadow-lg group  aspect-square w-full mt-5"
                    >
                        <div className="flex-1 flex flex-col items-center justify-center w-full">
                            <span className="font-bold text-center relative bottom-7 w-full py-2 px-3 text-xs rounded-lg shadow-lg
                                            bg-gradient-to-r from-orange-500 to-orange-700 border border-orange-300 text-white
                                          hover:from-orange-600 hover:to-orange-800 transition-all
                                            active:scale-95 flex justify-center items-center gap-2">
                                {loot.name}
                            </span>
                            <div className="relative w-24 h-24 mb-3 group-hover:scale-105 transition-transform duration-300">
                                <Image
                                    src={`${process.env.NEXT_PUBLIC_FRONT_URL}/${loot.image}`}
                                    alt={loot.name}
                                    className="object-contain drop-shadow-md w-full h-full"
                                    sizes="(max-width: 768px) 100vw, 200px"
                                    width={500}
                                    height={300}
                                />
                            </div>
                        </div>

                        <div className="w-full">
                            <button
                                onClick={() => navigate.push("/lootboxes/" + loot.id)}
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
            {/* <div className="flex justify-center items-center my-8">
                <p className="text-3xl font-bold w-full text-center">Feature OGX Lootbox</p>
            </div>
       
            <div className="w-full">
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-4">
                    {data?.data?.map((loot, index) => (
                        <div
                            key={index}
                            className="w-full bg-white border border-orange-300 p-3  rounded-lg shadow-md text-orange-800 flex flex-col items-center justify-center relative
                            transition-all duration-300 hover:shadow-lg group"
            >
              <div className="relative w-36 h-36 mb-3 group-hover:scale-105 transition-transform duration-300">
                <Image
                  src={`${process.env.NEXT_PUBLIC_FRONT_URL}/${loot.image}`}
                  alt={loot.name}
                  className="object-contain drop-shadow-md"
                  sizes="(max-width: 768px) 100vw, 200px"
                  width={500}
                  height={300}
                />
              </div>

              <span className="font-bold text-center mx-auto text-orange-700  top-5 relative text-lg tracking-tight w-full  ">
                {loot.name}
              </span>

              <div className="button flex justify-center items-center relative top-7">
                <button
                  onClick={() => navigate.push("/lootboxes/" + loot.id)}
                  className="sm:w-44 text-sm rounded-full shadow-lg
                              bg-gradient-to-r from-orange-500 to-orange-700 border border-orange-300 text-white
                              font-medium hover:from-orange-600 hover:to-orange-800 transition-all
                              active:scale-95 flex justify-around items-center"
                >
                  <div className="font-bold text-center mx-auto text-sm text-white flex justify-center items-center space-x-1 w-full px-4 mt-1">
                    <p className="me-2">Open</p>
                    <span className=" bg-white bg-clip-text text-transparent">
                      {loot.price}
                    </span>
                    <div className="relative w-3 h-3" style={{bottom:'2px'}}>
                      <Image
                        src={"/logo.png"}
                        alt="ogx"
                        className="rounded-full object-cover ring-2 ring-orange-300"
                        width={300}
                        height={300}
                      />
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div> */}
            {/* Tab Content */}
         

            <Model />
        </div>
    );
}
