"use client";
import LootModal from "@/app/Components/LootModal";
import TopNav from "@/app/Components/TopNav";
import { useUserState } from "@/state/useUserState";
import { useMemo, useState } from "react";
import "react-spin-game/dist/index.css";
import { useParams } from "next/navigation";
import { supabase } from "@/service/supabase";
import { useRequest } from "ahooks";
import Image from "next/image";
import WheelSpinner from "./components/wheel";
import Loader from "../../Components/Loader";
const getProducts = async () => {
  const response = await supabase.from("products").select();
  return response;
};

export default function Details() {
  const { data: products, loading, error } = useRequest(getProducts);
  const [user, setUser] = useUserState();
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [openModal, setOpenModal] = useState(false);
  const pathname = useParams();

  // const [spinning, setSpinning] = useState(false);
  // const [rotation, setRotation] = useState(0);
  // const [winner, setWinner] = useState(null);

  // const totalSlices = 8;
  // const sliceAngle = 360 / totalSlices;
  // const spinDuration = 5; // Spin for 5 seconds

  // const spinWheel = () => {
  //   if (spinning) return;
  //   setSpinning(true);
  //   setWinner(null);

  //   const randomIndex = Math.floor(Math.random() * totalSlices); // Pick a winning slice
  //   const randomAngle = 360 - randomIndex * sliceAngle - sliceAngle / 2; // Stop at the winning slice
  //   const totalRotation = 360 * 5 + randomAngle; // Ensure multiple spins before stopping

  //   setRotation(totalRotation);
  //   setTimeout(() => {
  //     setSpinning(false);

  //     setWinner(newProducts[randomIndex]);
  //   }, spinDuration * 1000);
  // };

  const newData = useMemo(() => {
    return products?.data?.find((i) => i.id === Number(pathname.slug));
  }, [pathname.slug, products]);

  const handleSpinClick = () => {
    if (!mustSpin) {
      //@ts-ignore
      const newPrizeNumber = Math.floor(Math.random() * products?.data?.length || 0);
      setPrizeNumber(newPrizeNumber);
      setMustSpin(true);
    }
  };

  const handleModal = () => {
    setOpenModal(!openModal);
  };

  const sendSolanaTokens = async (product: any) => {
    if (user.apes <= 0) {
      return alert("You need to purchase OGX");
    }
    let price = Number(product.price);
    let minusPrice = user.apes - price;
    const response = await supabase
      .from("user")
      .update({ apes: minusPrice })
      .eq("id", user.id);
    setUser({ ...user, apes: minusPrice });
    handleSpinClick();
  };

  if (loading) {
    return <Loader />;
  }
  if (error) {
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

  const newProducts = products?.data?.map((i) => {
    return {
      option: i.name,
      image: {
        uri: i.image,
        offsetX: 0,
        offsetY: 230,
        sizeMultiplier: 0.8,
      },
      percentage: i?.percentage,
    };
  });

  return (
    <div className="overflow-hidden bg-orange-500 text-white">
      <div className="nav-top z-50 relative">
        <TopNav />

      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-center items-center">
          <WheelSpinner data={products?.data} item={newData} user={user} setUser={setUser} />

        </div>

        <div className="flex justify-center items-center">
          <p className="text-3xl font-bold w-full text-center mt-10">Loot In the Box</p>
        </div>
        <div className="w-full mt-5">
          <div className="w-full px-4">
            <div className="overflow-x-auto py- scrollbar-hide">
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 flex-col">
                {products?.data?.map((loot, index) => (

                  <>
                    <div
                      key={index}
                      className="w-full bg-white border border-orange-300  rounded-lg shadow-md text-orange-800 flex flex-col items-center relative
                              transition-all duration-300 hover:shadow-lg group  p-0 sm:p-3"
                    >
                      <div className="box-header flex justify-between w-[80%]  items-center mb-">
                        <div className="box-badge   ">
                          <div className="font-bold text-center mx-auto text-lg mb-2 text-orange-800 flex justify-center items-center space-x-1">
                            <span className="mt-1 bg-gradient-to-r from-orange-500 to-orange-700 bg-clip-text text-transparent">
                              {loot.price}
                            </span>
                            <div className="relative w-4 h-4">
                              <Image
                                src={"/logo.png"}
                                alt="OGX"
                                className="rounded-full object-cover ring-2 ring-orange-300"
                                width={300}
                                height={300}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="box-badge ">
                          <p>0.5%</p>
                        </div>
                      </div>
                      <div className="relative w-32 md:h-24 h-26 mt-0 sm:mt-8  group-hover:scale-105 transition-transform duration-300 ml-0">
                        <Image
                          src={`${process.env.NEXT_PUBLIC_FRONT_URL}/${loot.image}`}
                          alt={loot.name}
                          width={300}
                          height={300}
                          className="object-contain drop-shadow-md relative md:bottom-8"
                        />

                      </div>

                      <span className="font-bold text-center mx-auto text-orange-700 mt-1 mt-8  text-lg tracking-tight">
                        {loot.name}
                      </span>



                      {/* <button
                      onClick={() => sendSolanaTokens(loot)}
                      className="text-sm rounded-full px-3 py-1 absolute -bottom-3 left-3 right-3 shadow-lg
                                bg-gradient-to-r from-orange-500 to-orange-700 border border-orange-300 text-white
                                font-medium hover:from-orange-600 hover:to-orange-800 transition-all
                                active:scale-95"
                    >
                      Ope
                    </button> */}

                    </div>
                  </>

                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {openModal && (
        <LootModal
          close={handleModal}
          image={
            products && products.data && Array.isArray(products.data)
              ? (products?.data[prizeNumber]?.image as string)
              : "/1.png"
          }
        />
      )}
    </div>
  );
}
