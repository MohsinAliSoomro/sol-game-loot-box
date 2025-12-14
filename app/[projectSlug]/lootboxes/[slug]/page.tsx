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
import DepositedNFTs from "./components/DepositedNFTs";
import Loader from "@/app/Components/Loader";
import { useProject } from "@/lib/project-context";

export default function Details() {
  const params = useParams();
  const { getProjectId } = useProject();
  const projectSlug = params?.projectSlug as string;
  const projectId = getProjectId();
  
  // Check if this is the main project (no projectSlug in URL)
  const isMainProject = !projectSlug;
  
const getProducts = async () => {
  let query = supabase.from("products").select();
    
    if (isMainProject) {
      // Main project: only show products where project_id IS NULL
      query = query.is("project_id", null);
    } else if (projectId) {
      // Sub-project: filter by project_id
      query = query.eq("project_id", projectId);
  }
    
  return query;
};

  const { data: products, loading, error } = useRequest(getProducts, {
    refreshDeps: [projectId, projectSlug]
  });
  const [user, setUser] = useUserState();
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [openModal, setOpenModal] = useState(false);
  const pathname = useParams();

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
  if (loading) {
    return <Loader />;
  }
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
          <DepositedNFTs productId={newData?.id} />
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