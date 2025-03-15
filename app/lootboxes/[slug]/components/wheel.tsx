import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, RefreshCcw, Trophy } from "lucide-react";

const WheelSpinner = () => {
  // Sample data with 6 items and configurable win probabilities
  const [items, setItems] = useState([
    {
      id: 1,
      name: "10% Off",
      image: "/1.png",
      color: "bg-white-500",
      textColor: "text-white",
      probability: 30,
    },
    {
      id: 2,
      name: "Free Item",
      image: "/1.png",
      color: "bg-white-500",
      textColor: "text-white",
      probability: 10,
    },
    {
      id: 3,
      name: "25% Off",
      image: "/1.png",
      color: "bg-white-500",
      textColor: "text-white",
      probability: 20,
    },
    {
      id: 4,
      name: "Try Again",
      image: "/1.png",
      color: "bg-white-500",
      textColor: "text-white",
      probability: 15,
    },
    {
      id: 5,
      name: "50% Off",
      image: "/1.png",
      color: "bg-white-500",
      textColor: "text-white",
      probability: 5,
    },
    {
      id: 6,
      name: "Gift Card",
      image: "/1.png",
      color: "bg-white-500",
      textColor: "text-white",
      probability: 20,
    },
  ]);

  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<any>(null);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const wheelRef = useRef(null);

  // Calculate total probability
  const totalProbability = items.reduce(
    (sum, item) => sum + item.probability,
    0
  );

  // Function to determine the slice angle based on probability
  const getSliceAngle = (probability: any) => {
    return (17 / totalProbability) * 360;
  };

  // Function to spin the wheel
  const spinWheel = () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setWinner(null);
    setShowWinnerDialog(false);

    // Generate random number based on probability weights
    const random = Math.random() * totalProbability;
    let cumulativeProbability = 0;
    let selectedItem = items[0];

    for (const item of items) {
      cumulativeProbability += item.probability;
      if (random <= cumulativeProbability) {
        selectedItem = item;
        break;
      }
    }

    // Calculate ending rotation
    let itemIndex = items.findIndex((item) => item.id === selectedItem.id);
    let itemAngleSum = 0;

    // Sum angles of items before the selected one
    for (let i = 0; i < itemIndex; i++) {
      itemAngleSum += getSliceAngle(items[i].probability);
    }

    // Add half the angle of the selected item to point to its center
    itemAngleSum += getSliceAngle(selectedItem.probability) / 2;

    // Final rotation: current + 12 full rotations + angle to selected item
    // We subtract from 360 because we want the item to land at the top
    const spinAngle = 4320 + (360 - itemAngleSum);
    const newRotation = rotation + spinAngle;

    setRotation(newRotation);

    // Set winner after animation completes (30 seconds)
    setTimeout(() => {
      setWinner(selectedItem);
      setShowWinnerDialog(true);
      setIsSpinning(false);
    }, 30000); // 30 seconds spin duration
  };

  // Reset the wheel
  const resetWheel = () => {
    setShowWinnerDialog(false);
    setWinner(null);
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="mb-6">
        {/* <div className="text-center">
          <div className="text-2xl">Prize Wheel Spinner</div>
        </div> */}
        <div className="flex flex-col items-center">
          {/* Wheel container with pointer */}
          <div className="relative w-96 h-96 mb-8">
            {/* Fixed pointer at top */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-30 flex flex-col items-center">
              <div className="w-6 h-6 bg-red-600 rotate-45 transform origin-bottom-left"></div>
              <div className="w-1 h-8 bg-red-600"></div>
            </div>

            {/* Outer wheel border */}
            <div className="absolute inset-0 rounded-full border-2 border-foreground z-10"></div>

            {/* Wheel */}
            <div
              ref={wheelRef}
              className="w-full h-full rounded-full overflow-hidden relative"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning
                  ? "transform 30s cubic-bezier(0.1, 0.2, 0.1, 1)"
                  : "none",
                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
              }}
            >
              {/* Center circle */}
              <div className="absolute w-12 h-12 bg-foreground rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 border-4 border-foreground flex items-center justify-center">
                <div className="w-2 h-2 bg-background rounded-full"></div>
              </div>

              {/* Slices - Exactly 6 items */}
              {items.map((item, index) => {
                // Calculate accumulated angle for positioning this slice
                let startAngle = 0;
                for (let i = 0; i < index; i++) {
                  startAngle += getSliceAngle(items[i].probability);
                }

                const angle = getSliceAngle(item.probability);
                const endAngle = startAngle + angle;

                // Convert angles to radians for calculations
                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;

                // Calculate SVG path for a clean pie slice
                const x1 = 50 + 50 * Math.cos(startRad);
                const y1 = 50 + 50 * Math.sin(startRad);
                const x2 = 50 + 50 * Math.cos(endRad);
                const y2 = 50 + 50 * Math.sin(endRad);

                // Determine if the slice spans more than 180 degrees
                const largeArcFlag = angle > 180 ? 1 : 0;

                const pathData = `M50,50 L${x1},${y1} A50,50 0 ${largeArcFlag},1 ${x2},${y2} Z`;

                // Calculate position for label
                const labelAngle = startAngle + angle / 2;
                const labelRad = (labelAngle * Math.PI) / 180;
                const labelDistance = 35; // Distance from center (0-50)
                const labelX = 50 + labelDistance * Math.cos(labelRad);
                const labelY = 50 + labelDistance * Math.sin(labelRad);

                return (
                  <div
                    key={item.id}
                    className={`absolute inset-0 ${item.color} ${
                      winner && winner.id === item.id
                        ? "ring-4 ring-yellow-300 ring-inset"
                        : ""
                    }`}
                  >
                    <svg width="100%" height="100%" viewBox="0 0 100 100">
                      <path d={pathData} fill="#ff914d" />
                      {/* Add divider lines between slices */}
                      <line
                        x1="50"
                        y1="50"
                        x2={x1}
                        y2={y1}
                        stroke="#ff914d"
                        strokeWidth="1"
                      />
                    </svg>

                    {/* Label */}
                    <div
                      className={`absolute text-white font-bold text-sm w-28 text-center flex`}
                      style={{
                        left: `${labelX}%`,
                        top: `${labelY}%`,
                        transform: `translate(-50%, -50%) rotate(${labelAngle}deg)`,
                      }}
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        width={10}
                        height={10}
                        className="w-10 h-10 object-contain"
                      />
                      <div>
                        {item.name} {item.probability}
                      </div>
                      {/* <div className="text-xs opacity-80">{item.probability}%</div> */}
                    </div>

                    {/* Winner indicator */}
                    {winner && winner.id === item.id && !isSpinning && (
                      <div className="absolute inset-0 flex items-center justify-center z-20">
                        <div className="absolute w-full h-full bg-yellow-300 opacity-20 animate-pulse"></div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add visible divider lines between all 6 slices */}
              <svg
                className="absolute inset-0 z-5"
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
              >
                {items.map((_, index) => {
                  // Calculate angle for this divider
                  let dividerAngle = 0;
                  for (let i = 0; i <= index; i++) {
                    dividerAngle += getSliceAngle(items[i].probability);
                  }

                  // Convert angle to radians
                  const dividerRad = (dividerAngle * Math.PI) / 180;

                  // Calculate end point of line
                  const endX = 50 + 50 * Math.cos(dividerRad);
                  const endY = 50 + 50 * Math.sin(dividerRad);

                  return (
                    <line
                      key={`divider-${index}`}
                      x1="50"
                      y1="50"
                      x2={endX}
                      y2={endY}
                      stroke="#f74e14"
                      strokeWidth="1"
                    />
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Spin button */}
          <Button
            onClick={spinWheel}
            disabled={isSpinning}
            className="px-6 py-2 mb-4 bg-foreground"
            size="lg"
          >
            {isSpinning ? "Spinning... (30 sec)" : "Spin the Wheel!"}
          </Button>
        </div>
      </div>

      {/* Winner display section */}
      {showWinnerDialog && winner && (
        <div className="absolute top-auto right-auto bottom-72 max-w-lg w-96 h-96 rounded-lg left-auto items-center bg-foreground border-2 border-yellow-300 z-50">
          <div className="text-center pb-2 mt-20">
            <div className="flex items-center justify-center text-xl">
              <Trophy className="mr-2 text-yellow-500 h-6 w-6" />
              Winner Announcement
            </div>
          </div>
          <div className="text-center">
            <div className="flex flex-col items-center justify-center mb-4">
              <div
                className={`w-16 h-16 rounded-full ${winner.color} mb-2 flex items-center justify-center ${winner.textColor} text-lg font-bold`}
              >
                #{winner.id}
              </div>
              <span className="text-2xl font-bold">{winner.name}</span>
              <span className="text-sm text-gray-600">
                Win Probability: {winner.probability}%
              </span>
            </div>
            <div className="flex justify-center gap-4">
              <button onClick={resetWheel} className=" bg-white text-background flex gap-4 items-center justify-center rounded-lg p-2">
                <RefreshCcw className="mr-1 h-4 w-4" /> Play Again
              </button>
              <button  className=" bg-white text-background flex gap-4 items-center justify-center rounded-lg p-2">
                <Check className="mr-1 h-4 w-4" /> Claim Prize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WheelSpinner;
