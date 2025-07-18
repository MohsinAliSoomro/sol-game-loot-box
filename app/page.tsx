import TopNav from "./Components/TopNav";
import Image from "next/image";
import Model from "./Components/Model";
import { supabase } from "@/service/supabase";
import ImageSlider from "./Components/ImageSlider";
import Loader from "./Components/Loader";
import { Suspense } from "react";
import Link from "next/link";

const getProducts = async () => {
  const response = await supabase.from("products").select();
  return response;
};

const getLatestTransaction = async () => {
  const response = await supabase
    .from("liveDraw")
    .select(
      `*, user (email,full_name,avatar_url,id), products(id, name, price, image)`
    )
    .order("created_at", { ascending: false })
    .limit(10);
  return response;
};

export default async function Home() {
  const data = await getProducts();
  const transactions = await getLatestTransaction();
  // const {
  //   data: transactions,
  //   loading: transactionLoading,
  //   error: transactionError,
  // } = useRequest(getLatestTransaction);
  // const navigate = useRouter();

  // if (loading || transactionLoading) {
  //   return <Loader />;
  // }

  // if (error || transactionError) {
  //   return (
  //     <div className="min-h-screen bg-orange-500">
  //       <div className="nav-top z-50 relative">
  //         <TopNav />
  //       </div>
  //       <div className="flex items-center justify-center h-[calc(100vh-64px)] text-white text-xl">
  //         Error loading data...
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="overflow-hidden bg-orange-500 text-white">
      <div className="nav-top z-50 relative">
        <Suspense fallback={null}>
          <TopNav />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <ImageSlider />
      </Suspense>
      {/* Live Draw Section */}
      <div className="flex justify-center items-center my-8">
        <p className="text-3xl font-bold w-full text-center">Live draw</p>
      </div>
      <div className="w-full mb-8">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 min-w-max px-4">
            {transactions?.data?.map((loot, index) => (
              <div key={index} className="w-[150px] flex-shrink-0">
                <p className="text-sm font-bold mb-1 truncate text-orange-700">
                  {loot?.user?.full_name}
                </p>
                <div className="w-full aspect-square bg-white border border-orange-300 p-2 rounded-lg shadow-md text-orange-800 flex flex-col items-center relative">
                  <Image
                    src={`${process.env.NEXT_PUBLIC_FRONT_URL}/${loot?.products?.image}`}
                    alt={loot?.name}
                    className="object-contain p-4"
                    width={300}
                    height={300}
                  />
                  <span className="font-bold text-xs text-center mx-auto text-orange-700 mt-1 truncate w-full">
                    {loot?.products?.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature OGX Lootbox Section */}
      <div className="flex justify-center items-center my-8">
        <p className="text-3xl font-bold w-full text-center">
          Feature OGX Lootbox
        </p>
      </div>
      <div className="w-full mb-40">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-4">
          {data?.data?.map((loot, index) => (
            <div
              key={index}
              className="w-full bg-white border border-orange-300 p-3 py-4 rounded-lg shadow-md text-orange-800 flex flex-col items-center justify-center relative
                            transition-all duration-300 hover:shadow-lg group"
            >
              <div className="relative w-24 h-24 mb-3 group-hover:scale-105 transition-transform duration-300">
                <Image
                  src={`${process.env.NEXT_PUBLIC_FRONT_URL}/${loot.image}`}
                  alt={loot.name}
                  className="object-contain drop-shadow-md"
                  sizes="(max-width: 768px) 100vw, 200px"
                  width={300}
                  height={300}
                />
              </div>

              <span className="font-bold text-center mx-auto text-orange-700 mt-1 text-sm tracking-tight w-full">
                {loot.name}
              </span>

              <div className="button flex justify-center items-center">
                <Link
                  href={`/lootboxes/${loot.id}`}
                  className="sm:w-44 text-sm rounded-full shadow-lg
                              bg-gradient-to-r from-orange-500 to-orange-700 border border-orange-300 text-white
                              font-medium hover:from-orange-600 hover:to-orange-800 transition-all
                              active:scale-95 flex justify-around items-center"
                >
                  <div className="font-bold text-center mx-auto text-sm text-white flex justify-center items-center space-x-1 w-full px-4">
                    <p className="me-2">Open</p>
                    <span className="mt-1 bg-white bg-clip-text text-transparent">
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
                  </div>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Suspense fallback={null}>
        <Model />
      </Suspense>
    </div>
  );
}
