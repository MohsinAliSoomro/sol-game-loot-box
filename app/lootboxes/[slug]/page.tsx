"use client";
import LootModal from "@/app/Components/LootModal";
import TopNav from "@/app/Components/TopNav";
import { useUserState } from "@/state/useUserState";
import { RefreshCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import "react-spin-game/dist/index.css";
import { useParams } from "next/navigation";
import { supabase } from "@/service/supabase";
// import { Metaplex } from "@metaplex-foundation/js";
import { useRequest } from "ahooks";
import Image from "next/image";
// import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import WheelSpinner from "./components/wheel";

const options = [
  { label: "Prize 1", percentage: 20 },
  { label: "Prize 2", percentage: 30 },
  { label: "Prize 3", percentage: 25 },
  { label: "Prize 4", percentage: 15 },
  { label: "Prize 5", percentage: 10 },
  { label: "Prize 5", percentage: 10 },
  { label: "Prize 5", percentage: 10 },
  { label: "Prize 5", percentage: 10 },
];

const getProducts = async () => {
  const response = await supabase.from("products").select();
  return response;
};
export default function Details() {
  const { data: products, loading, error } = useRequest(getProducts);
  // const navigate = useRouter();
  const [user, setUser] = useUserState();
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [openModal, setOpenModal] = useState(false);
  const pathname = useParams<{ slug: string }>();

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState(null);

  const totalSlices = options.length;
  const sliceAngle = 360 / totalSlices;
  const spinDuration = 5; // Spin for 5 seconds

  const spinWheel = () => {
    if (spinning) return;
    setSpinning(true);
    setWinner(null);

    const randomIndex = Math.floor(Math.random() * totalSlices); // Pick a winning slice
    const randomAngle = 360 - randomIndex * sliceAngle - sliceAngle / 2; // Stop at the winning slice
    const totalRotation = 360 * 5 + randomAngle; // Ensure multiple spins before stopping

    setRotation(totalRotation);
    setTimeout(() => {
      setSpinning(false);
      //@ts-ignore
      setWinner(options[randomIndex]);
    }, spinDuration * 1000);
  };
  const newData = useMemo(() => {
    // @ts-ignore
    return products?.data?.find((i) => i.id === Number(pathname.slug));
  }, [pathname.slug, [products]]);

  const handleSpinClick = () => {
    if (!mustSpin) {
      //@ts-ignore
      const newPrizeNumber = Math.floor(
        //@ts-ignore
        Math.random() * products?.data?.length || 0
      );
      setPrizeNumber(newPrizeNumber);
      setMustSpin(true);
    }
  };
  const handleModal = () => {
    setOpenModal(!openModal);
  };
  console.log({ user });
  // let ownerWallet = "Dw7xmScGHk74k3e8VLRZzkRAoNm1hjdQJF4wMHtxVzkB";
  const sendSolanaTokens = async (product: any) => {
    if (user.apes <= 0) {
      return alert("You need to purchae apes");
    }
    let price = Number(product.price);
    let minusPrice = user.apes - price;
    console.log({ minusPrice });
    const response = await supabase
      .from("user")
      .update({ apes: minusPrice })
      .eq("id", user.id);
    setUser({ ...user, apes: minusPrice });
    handleSpinClick();
  };

  if (loading) {
    return <div>Loading...</div>;
  }
  if (error) {
    return <div>Error</div>;
  }
  const product = products?.data?.find((i) => i.id === Number(pathname.slug));
  console.log({ product });
  //@ts-ignore
  const newProducts = products.data?.map((i) => {
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
    <div>
      <TopNav />
    
      <div className="flex items-center flex-col justify-center flex-wrap gap-4 relative">
        <div className="w-full flex items-center justify-center">
          <div
            style={{
              backgroundImage: "url(/background.png)",
              backgroundRepeat: "no-repeat",
              backgroundSize: "cover",
              backgroundPosition: "center",
              height: "50rem",
            }}
            className="w-full h-full flex flex-col items-center justify-center relative "
          >
         
         
            <div className="absolute top-1/2 left-0 right-0 z-50 -mb-20 bg-background w-full h-full ">
              {/* <div
                onClick={() => sendSolanaTokens(product)}
                className="flex justify-center items-center gap-6 cursor-pointer"
              >
                <p className="backdrop-blur-sm p-2 rounded-lg bg-foreground text-white mt-2 ">
                  Spin for{" "}
                  <span className="font-bold text-lg">{product?.price}</span>{" "}
                  Apes{" "}
                </p>
              </div> */}
              {/* <button
                onClick={handleSpinClick}
                className="mx-auto flex items-center gap-2 mt-5 bg-transprent font-bold text-foreground px-10 py-4 text-lg"
              >
                <RefreshCcw size={20} height={20} />{" "}
                <span> Try it for free</span>
              </button> */}
              <div className="text-white px-4 mt-[28rem]">
                <h1 className="font-bold text-4xl text-foreground text-center mt-">
                  Loot In the box
                </h1>
                <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-3 m-2 gap-y-6 gap-2 mb-40">
                  {
                    //@ts-ignore
                    products?.data.map((loot) => (
                      <div
                        key={loot.name}
                        className="bg-gradient-to-b from-foreground to-indigo-100 border-white/40 p-2 py-6 rounded-xl text-background flex flex-col items-center relative"
                      >
                        <span className="font-bold text-center mx-auto text-white absolute top-2 right-2 text-2xl">
                          %{loot?.percentage}
                        </span>
                        <Image
                          src={`${process.env.NEXT_PUBLIC_FRONT_URL}/${loot.image}`}
                          alt={loot.name}
                          width={200}
                          height={200}
                          className=""
                        />
                        <span className="font-bold text-center mx-auto text-foreground text-2xl mt-4">
                          {" "}
                          {loot?.name}
                        </span>
                        <span className="font-bold text-center flex mx-auto text-xl mb-4 text-foreground">
                          Apes {loot.price}
                        </span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center h-screen text-white z-50">
              <WheelSpinner />
             
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
