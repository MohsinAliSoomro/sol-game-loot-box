import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, RefreshCcw, Trophy } from "lucide-react";
import img from "../../../../public/lv.jpg";
import { supabase } from "@/service/supabase";
interface WheelItem {
  id: number;
  name: string;
  image: string;
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

  const totalProbability = data.reduce(
    (sum: any, item: any) => sum + item.percentage,
    0
  );

  const getSliceAngle = (probability: number) =>
    (probability / totalProbability) * 360;

  const spinWheel = async () => {
    if (user.apes <= 0) {
      return alert("You need to purchae apes");
    }
    let price = Number(item.price);
    let minusPrice = user.apes - price;
    await supabase.from("user").update({ apes: minusPrice }).eq("id", user.id);
    setUser({ ...user, apes: minusPrice });
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

    let itemIndex = data.findIndex((item: any) => item.id === selectedItem.id);
    let itemAngleSum = 0;

    for (let i = 0; i < itemIndex; i++) {
      itemAngleSum += getSliceAngle(data[i].percentage);
    }

    itemAngleSum += getSliceAngle(selectedItem.percentage) / 2;

    const spinAngle = 4320 + (360 - itemAngleSum);
    const newRotation = rotation + spinAngle;

    setRotation(newRotation);

    setTimeout(() => {
      setWinner(selectedItem);
      setShowWinnerDialog(true);
      setIsSpinning(false);
    }, 5000); // Reduced spin time for testing
  };

  useEffect(() => {
    async function addResult() {
      let prices = Number(winner?.price);
      let plusPrice = user.apes - prices;
      await supabase.from("user").update({ apes: plusPrice }).eq("id", user.id);
      setUser({ ...user, apes: plusPrice });
    }
    if (winner) {
      addResult();
    }
  }, [winner]);

  const resetWheel = () => {
    setShowWinnerDialog(false);
    setWinner(null);
  };

  return (
    <div className="w-full bg-[#ff914d]/10  py-4 sm:py-8">
      <div className="w-full">
        <div
          className="flex flex-col items-center justify-center"
          style={{ height: "58vh" }}
        >
          {/* Wheel Container */}
          <div className="relative w-full h-[47.5vw] sm:h-[42.5vw] md:h-[37.5vw] max-w-[1265px] max-h-[450px] mb-4 sm:mb-8 overflow-hidden">
            {/* Background Pattern */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{
                backgroundImage: `url(${img.src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />

            {/* Pointer */}
            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 z-30">
              <div
                className="w-4 h-6 sm:w-6 sm:h-10 bg-[#f74e14]"
                style={{
                  clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                }}
              />
            </div>

            {/* Main Wheel */}
            <div
              ref={wheelRef}
              className="absolute -bottom-[47.5vw] sm:-bottom-[42.5vw] md:-bottom-[37.5vw] left-1/2 w-[125vw] sm:w-[115vw] md:w-[105vw] h-[125vw] sm:h-[115vw] md:h-[105vw] max-w-[1100px] max-h-[1100px] rounded-full"
              style={{
                transform: `translate(-50%, 25%) rotate(${rotation}deg)`,
                transition: isSpinning
                  ? "transform 5s cubic-bezier(0.1, 0.2, 0.1, 1)"
                  : "none",
                boxShadow: "0 0 40px rgba(247, 78, 20, 0.2)",
              }}
            >
              {/* Center Circle */}
              <div className="absolute w-1/3 h-1/3 bg-white rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 border-4 border-[#f74e14]" />

              {/* Wheel Segments */}
              {data.map((item: any, index: number) => {
                let startAngle = 0;
                for (let i = 0; i < index; i++) {
                  startAngle += getSliceAngle(data[i].percentage);
                }

                const angle = getSliceAngle(item.percentage);
                const endAngle = startAngle + angle;

                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;

                const outerX1 = 50 + 50 * Math.cos(startRad);
                const outerY1 = 50 + 50 * Math.sin(startRad);
                const outerX2 = 50 + 50 * Math.cos(endRad);
                const outerY2 = 50 + 50 * Math.sin(endRad);

                const innerRadius = 25;
                const innerX1 = 50 + innerRadius * Math.cos(endRad);
                const innerY1 = 50 + innerRadius * Math.sin(endRad);
                const innerX2 = 50 + innerRadius * Math.cos(startRad);
                const innerY2 = 50 + innerRadius * Math.sin(startRad);

                const largeArcFlag = angle > 180 ? 1 : 0;

                const pathData = `
                  M${outerX1},${outerY1}
                  A50,50 0 ${largeArcFlag},1 ${outerX2},${outerY2}
                  L${innerX1},${innerY1}
                  A${innerRadius},${innerRadius} 0 ${largeArcFlag},0 ${innerX2},${innerY2}
                  Z
                `;

                const labelAngle = startAngle + angle / 2;
                const labelRad = (labelAngle * Math.PI) / 180;
                const labelDistance = 37;
                const labelX = 50 + labelDistance * Math.cos(labelRad);
                const labelY = 50 + labelDistance * Math.sin(labelRad);

                return (
                  <div key={item.id} className="absolute inset-0">
                    <svg width="100%" height="100%" viewBox="0 0 100 100">
                      <path
                        d={pathData}
                        fill="#ff914d"
                        stroke="#f74e14"
                        strokeWidth="0.5"
                      />
                    </svg>

                    <div
                      className="absolute w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 flex items-center justify-center bg-white/80 rounded-lg shadow-lg border border-[#f74e14]/20"
                      style={{
                        left: `${labelX}%`,
                        top: `${labelY}%`,
                        transform: `translate(-50%, -50%) rotate(${-rotation}deg)`,
                      }}
                    >
                      <img
                        src={`${process.env.NEXT_PUBLIC_FRONT_URL}/${item.image}`}
                        alt={item.name}
                        className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 object-contain p-1 sm:p-2"
                      />
                    </div>
                  </div>
                );
              })}

              {/* Divider Lines */}
              <svg
                className="absolute inset-0"
                width="100%"
                height="100%"
                viewBox="0 0 0 0"
              >
                {data?.map((_: any, index: number) => {
                  let dividerAngle = 0;
                  for (let i = 0; i <= index; i++) {
                    dividerAngle += getSliceAngle(data[i].percentage);
                  }

                  const dividerRad = (dividerAngle * Math.PI) / 180;
                  const startX = 50 + 25 * Math.cos(dividerRad);
                  const startY = 50 + 25 * Math.sin(dividerRad);
                  const endX = 50 + 50 * Math.cos(dividerRad);
                  const endY = 50 + 50 * Math.sin(dividerRad);

                  return (
                    <line
                      key={`divider-${index}`}
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke="#f74e14"
                      strokeWidth="2"
                    />
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Buttons */}
        </div>
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          <button
            onClick={spinWheel}
            disabled={isSpinning}
            className="px-2 sm:px-4  py-3 sm:py-3 bg-[#f74e14] hover:bg-[#e63900] text-white rounded-xl font-bold text-sm sm:text-sm md:text-sm transition-all shadow-lg whitespace-nowrap"
          >
            SPIN FOR 850 OGX
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
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[#f74e14]">
                Congratulations!
              </h2>
              <div className="flex items-center justify-center mb-4 sm:mb-6">
                <img
                  src={`${process.env.NEXT_PUBLIC_FRONT_URL}/${winner.image}`}
                  alt={winner.name}
                  className="w-24 h-24 sm:w-32 sm:h-32 object-contain"
                />
              </div>
              <p className="text-lg sm:text-xl mb-2 text-gray-800">
                {winner.name}
              </p>
              <p className="text-sm text-gray-600 mb-4 sm:mb-6">
                Price: {winner.price}
              </p>
              <div className="flex justify-center gap-3 sm:gap-4">
                <button
                  onClick={resetWheel}
                  className="px-4 sm:px-6 py-2 border-2 border-[#f74e14] text-[#f74e14] rounded-lg hover:bg-[#f74e14] hover:text-white transition-colors text-sm sm:text-base font-medium"
                >
                  Spin Again
                </button>
                <button className="px-4 sm:px-6 py-2 bg-[#f74e14] text-white rounded-lg hover:bg-[#e63900] transition-colors text-sm sm:text-base font-medium">
                  Claim Prize
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
