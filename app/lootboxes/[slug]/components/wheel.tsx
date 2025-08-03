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
  console.log({user})
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<WheelItem | null>(null);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [shuffledData, setShuffledData] = useState<WheelItem[]>([]);
  const segmentCount = shuffledData.length;
  const segmentAngle = 360 / segmentCount;

  useEffect(() => {
    // Shuffle rewards on mount
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    setShuffledData(shuffled);
  }, [data]);

  const getRandomReward = () => {
    const totalProbability = data.reduce((sum: any, item: any) => sum + item.percentage, 0);
    const random = Math.random() * totalProbability;
    let cumulative = 0;
    for (const reward of data) {
      cumulative += reward.percentage;
      if (random <= cumulative) return reward;
    }
    return data[0];
  };

  const spinWheel = async () => {
    if (user.apes < Number(item.price)) {
      alert("You need to purchase OGX");
      return;
    }
    const price = Number(item.price);

    try {
      await supabase.from("user").update({ apes: user.apes - price }).eq("id", user.id);
      setUser({ ...user, apes: user.apes - price });
    } catch (e) {
      console.error("Update error", e);
      return;
    }

    // Spin a random amount: 5-8 full spins + random offset
    const fullSpins = Math.floor(Math.random() * 4) + 5; // 5,6,7,8
    const randomOffset = Math.random() * 460;
    const spinAngle = fullSpins * 360 + randomOffset;
    const newRotation = rotation + spinAngle;

    setIsSpinning(true);
    setRotation(newRotation);

    setTimeout(async () => {
      // After spin, determine which segment is under the pointer (-90°)
      const normalizedRotation = ((newRotation % 360) + 360) % 360;
      const pointerAngle = -90;
      const angleAtPointer = (pointerAngle - normalizedRotation + 360) % 360;
      let pointerSegmentIndex = Math.floor(angleAtPointer / segmentAngle) % segmentCount;
      if (pointerSegmentIndex < 0) pointerSegmentIndex += segmentCount;
      if (pointerSegmentIndex >= segmentCount) pointerSegmentIndex = 0;
      const winnerItem = shuffledData[pointerSegmentIndex];
      setWinner(winnerItem);
      setShowWinnerDialog(true);
      setIsSpinning(false);

      // Reward payout
      const rewardAmount = Number(winnerItem?.price);
      try {
        await supabase.from("user").update({ apes: user.apes - price + rewardAmount }).eq("id", user.id);
        setUser({ ...user, apes: user.apes - price + rewardAmount });
      } catch (e) {
        console.error("Reward update failed", e);
      }
      console.log(winnerItem, 'winnerItem')
    }, 5000);
  };

  const handleFreeTry = async () => {
    // Spin a random amount: 5-8 full spins + random offset
    const fullSpins = Math.floor(Math.random() * 4) + 5; // 5,6,7,8
    const randomOffset = Math.random() * 360;
    const spinAngle = fullSpins * 360 + randomOffset;
    const newRotation = rotation + spinAngle;

    setIsSpinning(true);
    setRotation(newRotation);

    setTimeout(async () => {
      // After spin, determine which segment is under the pointer (-90°)
      const normalizedRotation = ((newRotation % 360) + 360) % 360;
      const pointerAngle = -90;
      const angleAtPointer = (pointerAngle - normalizedRotation + 360) % 360;
      let pointerSegmentIndex = Math.floor(angleAtPointer / segmentAngle) % segmentCount;
      if (pointerSegmentIndex < 0) pointerSegmentIndex += segmentCount;
      if (pointerSegmentIndex >= segmentCount) pointerSegmentIndex = 0;
      const winnerItem = shuffledData[pointerSegmentIndex];
      setWinner(winnerItem);
      setShowWinnerDialog(true);
      setIsSpinning(false);
      // Only add the reward (no deduction)
      // const rewardAmount = Number(winnerItem?.price);
      // try {
      //   await supabase.from("user").update({ apes: user.apes + rewardAmount }).eq("id", user.id);
      //   setUser({ ...user, apes: user.apes + rewardAmount });
      // } catch (e) {
      //   console.error("Reward update failed (free spin)", e);
      // }
      console.log(winnerItem, 'winnerItem (free)');
    }, 5000);
  };

  const resetWheel = () => {
    setShowWinnerDialog(false);
    setWinner(null);
  };
console.log(item?.price,'price item')
  return (
    <div className="w-full bg-[#ff914d]/10">
      <div className="w-full flex flex-col items-center justify-center">
        <div className="relative w-full flex justify-center overflow-hidden h-[30vw]">
          <div className="absolute inset-0 z-0" style={{
            backgroundImage: `url(${img.src})`,
            backgroundSize: "cover",
            backgroundPosition: "center"
          }} />

          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-30">
            <div className="w-6 h-8 bg-[#f74e14]" style={{
              clipPath: "polygon(0 100%, 100% 100%, 50% 0)",
              transform: "rotate(180deg)"
            }} />
          </div>

          <div className="relative left-1/2 bottom-[14vw] transform -translate-x-1/2 translate-y-1/2">
            <svg
              className="w-[120vw] h-[90vw] max-w-[100vw] z-10"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning ? "transform 5s cubic-bezier(0.1, 0.2, 0.1, 1)" : "none",
              }}
              viewBox="0 0 100 100"
            >
              {shuffledData.map((item, i) => {
                const startAngle = i * segmentAngle;
                const endAngle = startAngle + segmentAngle;
                const largeArcFlag = segmentAngle > 180 ? 1 : 0;
                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;
                const outerRadius = 50;
                const innerRadius = 25;

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
                  " Z";

                const midAngle = startAngle + segmentAngle / 2;
                const midRad = (midAngle * Math.PI) / 180;
                const imgX = 50 + 37 * Math.cos(midRad);
                const imgY = 50 + 37 * Math.sin(midRad);
                // For angle text
                const textRadius = 43;
                const textX = 50 + textRadius * Math.cos(midRad);
                const textY = 50 + textRadius * Math.sin(midRad);

                return (
                  <g key={i}>
                    <path d={pathData} fill="#ff914d" stroke="#f74e14" strokeWidth="0.5" />
                    <image
                      href={`${process.env.NEXT_PUBLIC_FRONT_URL}/${item.image}`}
                      x={imgX - 5}
                      y={imgY - 5}
                      width="10"
                      height="10"
                      transform={`rotate(${midAngle + 90}, ${imgX}, ${imgY})`}
                      className=""
                    />
                    {/* <text
                      x={textX}
                      y={textY}
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      fontSize="4"
                      fill="#222"
                      fontWeight="bold"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                      transform={`rotate(${midAngle}, ${textX}, ${textY})`}
                    >
                      {midAngle.toFixed(0)}°
                    </text> */}
                    {/* <text
                      x={imgX}
                      y={imgY + 10}
                      textAnchor="middle"
                      fontSize="3"
                      fill="#000"
                    >
                      {item.name}
                    </text> */}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <button
          onClick={spinWheel}
          disabled={isSpinning}
          className="mt-10 px-4 py-2 bg-[#f74e14] hover:bg-[#e63900] text-white rounded font-bold"
        >
          SPIN FOR {item?.price} OGX
        </button>
        <button
          onClick={handleFreeTry}
          disabled={isSpinning}
          className="mt-4 px-4 py-2 text-[#f74e14] rounded font-bold "
        >
          TRY FOR FREE
        </button>
      </div>

      {showWinnerDialog && winner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-[90%] max-w-lg border-2 border-[#f74e14]">
            <div className="text-end text-black cursor-pointer" onClick={resetWheel}>X</div>
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4 text-[#f74e14]">Congratulations!</h2>
              <div className="flex items-center justify-center mb-6">
                <Image
                  src={`${process.env.NEXT_PUBLIC_FRONT_URL}/${winner.image}`}
                  alt={winner.name}
                  className="w-32 h-32 object-contain"
                  width={300}
                  height={300}
                />
              </div>
              <p className="text-xl mb-2 text-gray-800">{winner.name}</p>
              <p className="text-sm text-gray-600 mb-6">Price: {winner.price}</p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={resetWheel}
                  className="px-6 py-2 border-2 border-[#f74e14] text-[#f74e14] rounded-lg hover:bg-[#f74e14] hover:text-white"
                >
                  Spin Again
                </button>
                <button
                  onClick={() => {
                    const message = winner
                      ? `🎉 I just hit Reward 6 on the OGX Spin Wheel 🌀
One spin, one win — this is how we do it over at SpinLoots!
Try your luck 👇`
                      : "Check out this awesome OGX Spin Wheel!";
                    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(window.location.href)} Stake. Spin. Win. Repeat.`;
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
