import React, { useState, useRef, useEffect } from "react";
import img from "../../../../public/lv.jpg";
import { supabase } from "@/service/supabase";
import Image from "next/image";

interface WheelItem {
  id: number;
  name: string;
  image: any;
  color: string;
  textColor: string;
  percentage: number;
  price: string;
}

const WheelSpinner = ({ data, item, user, setUser }: any) => {

  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<WheelItem | null>(null);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  const totalProbability = data?.reduce((sum:any, item:any) => sum + item.percentage, 0);
  const segmentCount = data?.length;
  const segmentAngle = 360 / segmentCount;
  const outerRadius = 50;
  const innerRadius = 25;

  const spinWheel = async () => {
    if (user.apes <= 0) {
      return alert("You need to purchase apes");
    }
    
    let price = Number(item.price);
    let minusPrice = user.apes - price;
    
    try {
      await supabase.from("user").update({ apes: minusPrice }).eq("id", user.id);
      setUser({ ...user, apes: minusPrice });
    } catch (error) {
      console.error("Error updating user balance:", error);
      return;
    }

    if (isSpinning) return;

    setIsSpinning(true);
    setWinner(null);
    setShowWinnerDialog(false);

    const random = Math.random() * totalProbability;
    let cumulativeProbability = 0;
    let selectedItem = data[0];

    for (const item of data) {
      cumulativeProbability += item.percentage;
      if (random <= cumulativeProbability) {
        selectedItem = item;
        break;
      }
    }

    let itemIndex = data?.findIndex((item:any) => item.id === selectedItem.id);
    let itemAngleSum = 0;

    for (let i = 0; i < itemIndex; i++) {
      itemAngleSum += segmentAngle;
    }

    itemAngleSum += segmentAngle / 2;

    const spinAngle = 4320 + (360 - itemAngleSum);
    const newRotation = rotation + spinAngle;

    setRotation(newRotation);

    setTimeout(() => {
      setWinner(selectedItem);
      setShowWinnerDialog(true);
      setIsSpinning(false);
    }, 5000);
  };

  useEffect(() => {
    async function addResult() {
      if (!winner) return;
      
      let prices = Number(winner.price);
      let plusPrice = user.apes + prices;
      
      try {
        await supabase.from("user").update({ apes: plusPrice }).eq("id", user.id);
        setUser({ ...user, apes: plusPrice });
      } catch (error) {
        console.error("Error updating user balance with winnings:", error);
      }
    }
    
    if (winner) {
      addResult();
    }
  },[winner]);

  const resetWheel = () => {
    setShowWinnerDialog(false);
    setWinner(null);
  };

  return (
    <div className="w-full bg-[#ff914d]/10 ">
      <div className="w-full">
        <div className="flex flex-col items-center justify-center"
        //  style={{ height: '58vh' }}
         >
          {/* Wheel Container */}
          <div className="relative w-full flex justify-center overflow-hidden h-[30vw] " >
            {/* Background Pattern */}
            <div
              className="absolute inset-0 z-0"
              style={{
                backgroundImage: `url(${img.src})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            />

            {/* Pointer */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-30">
              <div
                className="w-4 h-6 sm:w-6 sm:h-8 md:w-8 md:h-10 lg:w-10 lg:h-12 bg-[#f74e14]"
                style={{
                  clipPath: 'polygon(0 100%, 100% 100%, 50% 0)',
                  // filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                  transform: 'rotate(180deg)'
                }}
              />
            </div>

            {/* Main Wheel - Single SVG with all segments */}
            <div className="relative left-1/2 bottom-[14vw] transform -translate-x-1/2 translate-y-1/2">
              <svg
                ref={wheelRef as any}
                className="w-[120vw] h-[90vw] max-w-[100vw] z-10"
                style={{
                  transform: `rotate(${rotation}deg)` ,
                  transition: isSpinning
                    ? "transform 5s cubic-bezier(0.1, 0.2, 0.1, 1)"
                    : "none",
                  // boxShadow: "0 0 40px rgba(247, 78, 20, 0.2)",
                }}
                viewBox="0 0 100 100"
              >
                {Array.from({ length: segmentCount }).map((_, i) => {
                  const startAngle = i * segmentAngle;
                  const endAngle = startAngle + segmentAngle;
                  const largeArcFlag = segmentAngle > 180 ? 1 : 0;
                  const startRad = (startAngle * Math.PI) / 180;
                  const endRad = (endAngle * Math.PI) / 180;
                  const outerX1 = 50 + outerRadius * Math.cos(startRad);
                  const outerY1 = 50 + outerRadius * Math.sin(startRad);
                  const outerX2 = 50 + outerRadius * Math.cos(endRad);
                  const outerY2 = 50 + outerRadius * Math.sin(endRad);
                  const innerX1 = 50 + innerRadius * Math.cos(endRad);
                  const innerY1 = 50 + innerRadius * Math.sin(endRad);
                  const innerX2 = 50 + innerRadius * Math.cos(startRad);
                  const innerY2 = 50 + innerRadius * Math.sin(startRad);
                  const pathData =
                    `M${outerX1},${outerY1}` +
                    ` A${outerRadius},${outerRadius} 0 ${largeArcFlag},1 ${outerX2},${outerY2}` +
                    ` L${innerX1},${innerY1}` +
                    ` A${innerRadius},${innerRadius} 0 ${largeArcFlag},0 ${innerX2},${innerY2}` +
                    ' Z';
                  // Image position and rotation
                  const midAngle = startAngle + segmentAngle / 2;
                  const midRad = (midAngle * Math.PI) / 180;
                  const imgRadius = 37;
                  const imgX = 50 + imgRadius * Math.cos(midRad);
                  const imgY = 50 + imgRadius * Math.sin(midRad);
                  return (
                    <g key={i}>
                      <path
                        d={pathData}
                        fill="#ff914d"
                        stroke="#f74e14"
                        strokeWidth="0.5"
                        // filter="drop-shadow(0px 0px 8px #f74e14)"
                      />
                      {/* Image at segment midpoint, facing outward */}
                      {data[i] && (
                        <image
                          href={`${process.env.NEXT_PUBLIC_FRONT_URL}/${data[i]?.image}`}
                          x={imgX - 5}
                          y={imgY - 5}
                          width="10"
                          height="10"
                          transform={`rotate(${midAngle + 90}, ${imgX}, ${imgY})`}
                          // style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 sm:gap-4 mt-10">
          <button
            onClick={spinWheel}
            disabled={isSpinning}
            className="px-4 sm:px-5 py-2 sm:py-1 bg-[#f74e14] hover:bg-[#e63900] text-white rounded-sm font-bold text-sm sm:text-sm md:text-sm transition-all shadow-lg whitespace-nowrap"
          >
            SPIN FOR {item.price} OGX
          </button>

          <button className="text-[#f74e14] hover:text-[#e63900] font-bold text-base sm:text-lg">
            TRY FOR FREE
          </button>
        </div>
      </div>

      {/* Winner Dialog */}
      {showWinnerDialog && winner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-[90%] max-w-lg border-2 border-[#f74e14]">
            <b className="flex justify-end" style={{ color: 'black', cursor: 'pointer' }}>
              <p onClick={resetWheel}>X</p>
            </b>
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[#f74e14]">Congratulations!</h2>
              <div className="flex items-center justify-center mb-4 sm:mb-6">
                <Image src={`${process.env.NEXT_PUBLIC_FRONT_URL}/${winner.image}`} alt={winner.name} className="w-24 h-24 sm:w-32 sm:h-32 object-contain" 
                width={300}
                height={300}
                />
              </div>
              <p className="text-lg sm:text-xl mb-2 text-gray-800">{winner.name}</p>
              <p className="text-sm text-gray-600 mb-4 sm:mb-6">Price: {winner.price}</p>
              <div className="flex justify-center gap-3 sm:gap-4">
                <button
                  onClick={resetWheel}
                  className="px-4 sm:px-6 py-2 border-2 border-[#f74e14] text-[#f74e14] rounded-lg hover:bg-[#f74e14] hover:text-white transition-colors text-sm sm:text-base font-medium"
                >
                  Spin Again
                </button>
                <button
                  onClick={() => {
                    const message = winner
                      ? `I just won ${winner.name} on the OGX Spin Wheel!`
                      : "Check out this awesome OGX Spin Wheel!";
                    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(window.location.href)}&hashtags=OGX,Giveaway`;
                    window.open(url, '_blank', 'width=550,height=420');
                  }}
                  className="px-4 sm:px-6 py-2 bg-[#f74e14] text-white rounded-lg hover:bg-[#e63900] transition-colors text-sm sm:text-base font-medium"
                >
                  Share on X
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WheelSpinner;