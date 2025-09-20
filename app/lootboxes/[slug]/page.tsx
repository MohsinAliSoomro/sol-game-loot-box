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

  // const sendSolanaTokens = async (product: any) => {
  //   if (user.apes <= 0) {
  //     return alert("You need to purchase OGX");
  //   }
  //   let price = Number(product.price);
  //   let minusPrice = user.apes - price;
  //   const response = await supabase
  //     .from("user")
  //     .update({ apes: minusPrice })
  //     .eq("id", user.id);
  //   setUser({ ...user, apes: minusPrice });
  //   handleSpinClick();
  // };

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

  // const newProducts = products?.data?.map((i) => {
  //   return {
  //     option: i.name,
  //     image: {
  //       uri: i.image,
  //       offsetX: 0,
  //       offsetY: 230,
  //       sizeMultiplier: 0.8,
  //     },
  //     percentage: i?.percentage,
  //   };
  // });

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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-5 flex-col justify-center items-center">
                {products?.data?.map((loot, index) => (

                  <>
                    <div
                      key={index}
                      className=" h-48 bg-white border border-orange-300  rounded-lg shadow-md text-orange-800 flex flex-col items-center
                              transition-all duration-300 hover:shadow-lg group overflow-hidden"
                      style={{ minWidth: '14.8vw' }}
                    >
                      <div className="box-header flex justify-between w-full  items-center mb-1 p-2">
                        <div className="">
                          <div className="font-bold text-center mx-auto text-sm text-orange-800 flex justify-center items-center ">
                         
                  <svg width="30" height="30" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 256 256" xmlSpace="preserve">
                   <style>{`.st0{fill:#3a312a}.st2{fill:#87796f}.st48{fill:#d4db56}`}</style>
                   <path className="st2" d="m207.199 31.647-80.357-16.262a19.365 19.365 0 0 0-7.682 0L38.801 31.647c-9.8 1.983-16.479 11.101-15.414 21.042l5.591 52.223 1.513 14.137.516 4.819a136.456 136.456 0 0 0 72.102 106.215 42.694 42.694 0 0 0 39.783 0 136.458 136.458 0 0 0 72.102-106.215l7.62-71.178c1.063-9.943-5.616-19.06-15.415-21.043z"/>
                   <path className="st0" d="m207.496 30.176-80.357-16.262a20.745 20.745 0 0 0-8.277 0L38.504 30.176c-10.622 2.15-17.762 11.897-16.609 22.672l5.591 52.223a1.509 1.509 0 0 0 1.651 1.332 1.5 1.5 0 0 0 1.332-1.651l-5.591-52.223a17.788 17.788 0 0 1 14.22-19.413l80.358-16.262a17.77 17.77 0 0 1 7.088 0l80.357 16.262a17.788 17.788 0 0 1 14.22 19.413l-7.62 71.178c-4.794 44.79-31.452 84.06-71.309 105.048a41.182 41.182 0 0 1-38.386 0c-39.857-20.988-66.515-60.258-71.309-105.048l-.516-4.818a1.5 1.5 0 0 0-2.983.319l.516 4.818c4.901 45.785 32.151 85.928 72.895 107.383a44.168 44.168 0 0 0 41.181 0c40.743-21.455 67.993-61.598 72.895-107.383l7.62-71.178c1.153-10.775-5.987-20.522-16.609-22.672z"/>
                   <path d="m191.12 49.473-26.822-5.428-13.488-2.729-24.703-4.999a15.668 15.668 0 0 0-6.215 0L54.88 49.473c-7.928 1.604-13.332 8.981-12.471 17.024l6.165 57.586a110.403 110.403 0 0 0 58.333 85.933 34.541 34.541 0 0 0 32.186 0 110.4 110.4 0 0 0 58.333-85.933l6.165-57.586c.861-8.043-4.542-15.419-12.471-17.024z" style={{fill:"#ed6e7a"}}/>
                   <path className="st0" d="m191.417 48.003-26.822-5.428a1.5 1.5 0 1 0-.595 2.941l26.822 5.428a14.104 14.104 0 0 1 11.276 15.394l-6.164 57.586c-3.869 36.141-25.38 67.829-57.541 84.766a33.032 33.032 0 0 1-30.789 0c-32.161-16.936-53.671-48.624-57.541-84.765L43.9 66.337a14.106 14.106 0 0 1 11.277-15.394l65.012-13.157a14.11 14.11 0 0 1 5.621 0l24.703 5a1.5 1.5 0 1 0 .595-2.941l-24.703-5a17.085 17.085 0 0 0-6.81 0L54.583 48.003a17.095 17.095 0 0 0-13.666 18.654l6.164 57.586c3.976 37.137 26.079 69.698 59.127 87.101A35.998 35.998 0 0 0 123 215.496a36.01 36.01 0 0 0 16.792-4.153c33.047-17.402 55.15-49.963 59.127-87.1l6.164-57.586a17.092 17.092 0 0 0-13.666-18.654z"/>
                   <path className="st48" d="M42.651 200.23c-.974 11.564-13.024 13.389-13.024 13.389 10.347.487 12.925 14.059 12.925 14.059.221-9.677 13.321-14.202 13.321-14.202-9.814-.587-13.222-13.246-13.222-13.246z"/>
                   <path className="st0" d="M55.962 211.979c-8.604-.514-11.832-12.024-11.864-12.14a1.5 1.5 0 0 0-2.942.265c-.86 10.215-11.314 11.963-11.754 12.032a1.5 1.5 0 0 0 .155 2.982c9.028.425 11.499 12.719 11.522 12.843a1.5 1.5 0 0 0 2.973-.247c.195-8.509 12.192-12.777 12.313-12.819a1.502 1.502 0 0 0-.403-2.916zm-13.566 10.346c-1.356-3.13-3.709-6.908-7.587-8.877 2.931-1.404 6.409-3.913 8.202-8.272 1.551 3.071 4.199 6.88 8.334 8.722-3.007 1.64-6.923 4.406-8.949 8.427z"/>
                   <path className="st48" d="M20.952 217.21c-.689 8.179-9.212 9.47-9.212 9.47 7.318.344 9.142 9.944 9.142 9.944.156-6.844 9.422-10.045 9.422-10.045-6.941-.415-9.352-9.369-9.352-9.369z"/>
                   <path className="st0" d="M30.393 225.082c-5.766-.345-7.972-8.185-7.993-8.264a1.499 1.499 0 0 0-2.942.266c-.579 6.87-7.647 8.066-7.942 8.113a1.5 1.5 0 0 0 .154 2.982c6.035.284 7.724 8.644 7.739 8.726a1.5 1.5 0 0 0 2.973-.246c.13-5.709 8.332-8.634 8.412-8.662a1.499 1.499 0 0 0-.401-2.915zm-9.584 6.795c-.924-1.886-2.34-3.947-4.447-5.28 1.855-1.042 3.697-2.63 4.871-4.917 1.057 1.874 2.654 3.955 4.941 5.224-1.85 1.101-3.989 2.741-5.365 4.973z"/>
                   <path className="st48" d="M20.914 190.553c-.657 8.182-9.175 9.507-9.175 9.507 7.319.316 9.181 9.909 9.181 9.909.129-6.845 9.383-10.082 9.383-10.082-6.943-.389-9.389-9.334-9.389-9.334z"/>
                   <path className="st0" d="M30.386 198.389c-5.747-.322-7.988-8.098-8.026-8.232a1.5 1.5 0 0 0-2.942.277c-.552 6.873-7.615 8.096-7.911 8.144a1.5 1.5 0 0 0 .166 2.981c6.036.261 7.757 8.614 7.773 8.696a1.5 1.5 0 0 0 2.972-.257c.108-5.71 8.297-8.666 8.378-8.694a1.5 1.5 0 0 0 .99-1.626 1.496 1.496 0 0 0-1.4-1.289zm-9.557 6.832c-.932-1.882-2.356-3.938-4.468-5.262 1.851-1.049 3.687-2.645 4.851-4.936 1.064 1.87 2.67 3.944 4.961 5.204-1.845 1.108-3.977 2.756-5.344 4.994z"/>
                   <ellipse transform="rotate(-84.347 189.496 191.357)" cx="189.496" cy="191.35" rx="44.766" ry="44.765" style={{fill:"#d7e057"}}/>
                   <path className="st0" d="M189.496 145.084c-25.511 0-46.266 20.755-46.266 46.266s20.755 46.266 46.266 46.266 46.265-20.755 46.265-46.266-20.754-46.266-46.265-46.266zm0 89.532c-23.857 0-43.266-19.409-43.266-43.266s19.409-43.266 43.266-43.266c23.856 0 43.265 19.409 43.265 43.266s-19.409 43.266-43.265 43.266z"/>
                   <path className="st2" d="M218.354 171.752a5.469 5.469 0 0 0-7.724-.397l-30.759 27.748-10.71-15.123a5.468 5.468 0 0 0-7.623-1.302 5.468 5.468 0 0 0-1.302 7.623l14.267 20.145a5.467 5.467 0 0 0 8.125.9l35.328-31.87a5.469 5.469 0 0 0 .398-7.724z"/>
                   <path className="st0" d="M219.468 170.748a6.925 6.925 0 0 0-4.816-2.292 6.905 6.905 0 0 0-5.027 1.786l-29.505 26.617-9.734-13.746a6.924 6.924 0 0 0-4.515-2.841 6.917 6.917 0 0 0-5.199 1.182c-1.519 1.076-2.528 2.679-2.842 4.514s.106 3.682 1.183 5.2l14.267 20.145a6.97 6.97 0 0 0 10.355 1.148l35.328-31.87c2.852-2.576 3.079-6.99.505-9.843zm-2.516 7.614-35.328 31.87a3.998 3.998 0 0 1-3.096.998 3.971 3.971 0 0 1-2.801-1.651l-14.267-20.146a3.942 3.942 0 0 1-.674-2.961 3.94 3.94 0 0 1 1.619-2.57 3.939 3.939 0 0 1 2.961-.673 3.94 3.94 0 0 1 2.571 1.618l10.71 15.123a1.497 1.497 0 0 0 2.229.247l30.759-27.748a3.978 3.978 0 0 1 2.863-1.017 3.942 3.942 0 0 1 2.743 1.306 3.973 3.973 0 0 1-.289 5.604z"/>
                   <path d="m190.82 50.94-6.63-1.34c1.76 2.9 2.6 6.39 2.21 10.02l-6.97 65.16c-.83 7.78-2.4 15.37-4.64 22.7a45.91 45.91 0 0 1 14.71-2.4c.67 0 1.33.03 1.99.06 2.16-6.84 3.67-13.94 4.45-21.22l6.16-57.58c.78-7.32-4.07-13.94-11.28-15.4z" style={{fill:"#d34e5c"}}/>
                   <text x="118" y="130" textAnchor="middle" fontSize="62" fill="white" fontWeight="bold" className="text-orange-800">
                   {/* <span  className=" text-white bg-clip-text  relative left-6 top-0 text-[8px]"> */}
                              100
                            {/* </span> */}
                        </text>
                 </svg>



                            {/* <div className="relative w-6 h-6">
                              <Image
                                src={"/logo.png"}
                                alt="OGX"
                                className="rounded-full object-cover "
                                width={300}
                                height={300}
                              />
                            </div> */}

                          </div>
                        </div>
                       
                     <svg height="30px" width="30px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 256 256"  xmlSpace="preserve"><style>{`.st0{fill:#3a312a}.st1{fill:#d6df58}.st2{fill:#87796f}.st13{fill:#8ac2d9}`}</style><path className="st2" d="M222.394 16.135H33.605c-9.447 0-17.105 7.658-17.105 17.106V163.53c0 9.447 7.658 17.105 17.105 17.105h188.789c9.447 0 17.106-7.658 17.106-17.105V33.241c0-9.447-7.658-17.106-17.106-17.106z"/><path className="st0" d="M222.394 14.636H33.605C23.346 14.636 15 22.982 15 33.241V163.53c0 10.259 8.346 18.605 18.605 18.605h188.789c10.259 0 18.606-8.347 18.606-18.605V33.241c0-10.259-8.347-18.605-18.606-18.605zM238 163.53c0 8.604-7.001 15.605-15.606 15.605H33.605C25 179.136 18 172.135 18 163.53V33.241c0-8.604 7-15.605 15.605-15.605h188.789c8.605 0 15.606 7.001 15.606 15.605V163.53z"/><path className="st1" d="M214.969 28.635H41.031c-6.583 0-11.92 5.337-11.92 11.92v115.66c0 6.583 5.337 11.92 11.92 11.92h173.938c6.583 0 11.92-5.336 11.92-11.92V40.555c0-6.583-5.337-11.92-11.92-11.92z" style={{fill:"rgb(237, 110, 122)"}}/><path className="st0" d="M214.969 27.136H99.798a1.5 1.5 0 1 0 0 3h115.171c5.745 0 10.42 4.675 10.42 10.42v115.66c0 5.745-4.675 10.42-10.42 10.42H41.031c-5.746 0-10.42-4.675-10.42-10.42V40.556c0-5.745 4.674-10.42 10.42-10.42h45.17a1.5 1.5 0 1 0 0-3h-45.17c-7.4 0-13.42 6.021-13.42 13.42v115.66c0 7.399 6.02 13.42 13.42 13.42h173.938c7.399 0 13.42-6.021 13.42-13.42V40.556c0-7.4-6.021-13.42-13.42-13.42z"/><path className="st2" d="M113.688 180.635h28.625v35.593h-28.625z"/><path className="st0" d="M142.313 179.136h-28.625a1.5 1.5 0 0 0-1.5 1.5v35.593a1.5 1.5 0 0 0 1.5 1.5h28.625a1.5 1.5 0 0 0 1.5-1.5v-35.593a1.5 1.5 0 0 0-1.5-1.5zm-1.5 35.593h-25.625v-32.593h25.625v32.593z"/><path className="st2" d="M148.296 216.229h-40.593c-12.927 0-23.407 10.479-23.407 23.407h87.406c.001-12.928-10.478-23.407-23.406-23.407z"/><path className="st0" d="M148.296 214.729h-40.592c-13.733 0-24.907 11.173-24.907 24.907a1.5 1.5 0 0 0 1.5 1.5h37.584a1.5 1.5 0 1 0 0-3H85.848c.773-11.383 10.281-20.407 21.856-20.407h40.592c11.575 0 21.083 9.024 21.856 20.407h-34.701a1.5 1.5 0 0 0 0 3h36.252a1.5 1.5 0 0 0 1.5-1.5c0-13.735-11.173-24.907-24.907-24.907z"/><path className="st1" d="M47.671 203.469c-.974 11.564-13.025 13.39-13.025 13.39 10.346.487 12.925 14.059 12.925 14.059.221-9.677 13.321-14.202 13.321-14.202-9.813-.587-13.221-13.247-13.221-13.247z"/><path className="st0" d="M60.982 215.219c-8.604-.515-11.831-12.024-11.863-12.141a1.513 1.513 0 0 0-1.583-1.102 1.5 1.5 0 0 0-1.359 1.367c-.86 10.215-11.313 11.963-11.755 12.031a1.5 1.5 0 0 0 .154 2.982c9.028.426 11.499 12.719 11.523 12.844a1.5 1.5 0 0 0 2.973-.248c.195-8.509 12.192-12.777 12.313-12.819a1.5 1.5 0 0 0-.403-2.914zm-13.565 10.345c-1.356-3.131-3.709-6.908-7.587-8.877 2.931-1.404 6.409-3.913 8.202-8.272 1.551 3.071 4.199 6.88 8.334 8.723-3.008 1.639-6.923 4.405-8.949 8.426z"/><path className="st1" d="M25.972 220.45c-.689 8.179-9.212 9.471-9.212 9.471 7.318.344 9.142 9.944 9.142 9.944.156-6.845 9.422-10.045 9.422-10.045-6.941-.416-9.352-9.37-9.352-9.37z"/><path className="st0" d="M35.414 228.322c-5.766-.345-7.972-8.186-7.994-8.265a1.5 1.5 0 0 0-2.942.266c-.579 6.87-7.646 8.066-7.942 8.113a1.5 1.5 0 0 0 .155 2.982c6.035.284 7.723 8.644 7.739 8.726a1.5 1.5 0 0 0 2.973-.246c.131-5.708 8.332-8.633 8.413-8.661a1.499 1.499 0 0 0-.402-2.915zm-9.585 6.795c-.924-1.886-2.339-3.947-4.447-5.28 1.856-1.041 3.697-2.629 4.87-4.916 1.057 1.874 2.654 3.955 4.941 5.224-1.849 1.1-3.987 2.74-5.364 4.972z"/><path className="st1" d="M25.972 193.792c-.689 8.179-9.212 9.47-9.212 9.47 7.318.345 9.142 9.944 9.142 9.944.156-6.844 9.422-10.045 9.422-10.045-6.941-.414-9.352-9.369-9.352-9.369z"/><path className="st0" d="M35.414 201.665c-5.766-.345-7.972-8.187-7.994-8.266a1.5 1.5 0 0 0-2.942.266c-.579 6.871-7.646 8.066-7.942 8.113a1.5 1.5 0 0 0 .154 2.982c6.036.284 7.724 8.645 7.739 8.727a1.5 1.5 0 0 0 2.973-.246c.131-5.709 8.332-8.633 8.413-8.661a1.5 1.5 0 0 0-.401-2.915zm-9.585 6.794c-.924-1.885-2.34-3.947-4.447-5.279 1.856-1.041 3.697-2.63 4.87-4.916 1.057 1.873 2.654 3.954 4.941 5.224-1.849 1.1-3.988 2.74-5.364 4.971z"/><path d="M214.97 30.135h-15c5.74 0 10.42 4.67 10.42 10.42v115.66c0 5.75-4.68 10.42-10.42 10.42h15c5.74 0 10.42-4.67 10.42-10.42V40.555c0-5.75-4.68-10.42-10.42-10.42z" style={{fill:"rgb(237, 110, 122)"}}/>
                     <text x="128" y="120" textAnchor="middle" fontSize="59" fill="white" fontWeight="bold" className="text-orange-800">
                        10.5%
                        </text>
                     </svg>
                      </div>
                      <div className=" w-28 md:h-28 h-16 relative bottom-2  group-hover:scale-105 transition-transform duration-300 ml-0">
                        <Image
                          src={`${process.env.NEXT_PUBLIC_FRONT_URL}/${loot.image}`}
                          alt={loot.name}
                          width={300}
                          height={200}
                          className="object-contain drop-shadow-md"
                        />

                      </div>

                      {/* <div className="font-bold text-center mx-auto text-orange-700 text-sm tracking-tight">
                      </div> */}



                      <div className="reward font-bold text-center relative  bottom-9 w-full py-2  text-xs rounded-lg shadow-lg
                                                        bg-gradient-to-r from-orange-500 to-orange-700 border border-orange-300 text-white
                                                      hover:from-orange-600 hover:to-orange-800 transition-all
                                                        active:scale-95 flex justify-center items-center gap-2 md:-top-1 top-11">
                        <button
                          disabled
                          // onClick={() => sendSolanaTokens(loot)}
                          className=""
                        >
                          {loot.name}

                        </button>
                      </div>

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
