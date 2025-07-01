import React, { useState } from 'react';
// import './App.css';

const SpinWheel = () => {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  // Define the items on the wheel (you can replace these with your own)
  const wheelItems = [
    { id: 1, name: 'Lawnmower', icon: '🚜' },
    { id: 2, name: 'Rake', icon: '🧹' },
    { id: 3, name: 'Seeds', icon: '🌱' },
    { id: 4, name: 'Lawnmower', icon: '🚜' },
    { id: 5, name: 'Bird', icon: '🐦' },
  ];

  // Function to handle the spin
  const handleSpin = () => {
    if (isSpinning) return; // Prevent multiple spins at once

    setIsSpinning(true);
    // Generate a random rotation (between 360 and 3600 degrees for multiple spins)
    const newRotation = rotation + Math.floor(Math.random() * 3600) + 360;
    setRotation(newRotation);

    // Simulate the spinning duration (e.g., 3 seconds)
    setTimeout(() => {
      setIsSpinning(false);
      // Calculate the winning item based on the final rotation
      const finalAngle = newRotation % 360;
      const sectionAngle = 180 / wheelItems.length; // 180 degrees for semi-circle
      const winningIndex = Math.floor(finalAngle / sectionAngle);
      alert(`You won: ${wheelItems[winningIndex].name}!`);
    }, 3000);
  };

  return (
    <div className="spin-wheel-container">
      <h1>Touch Some Grass</h1>
      <div className="wheel-wrapper">
        <div
          className="wheel"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning ? 'transform 3s ease-out' : 'none',
          }}
        >
          {wheelItems.map((item, index) => {
            const angle = (180 / (wheelItems.length - 1)) * index; // Spread items across 180 degrees
            return (
              <div
                key={item.id}
                className="wheel-section"
                style={{
                  transform: `rotate(${angle}deg)`,
                }}
              >
                <div className="slot-box">
                  <div className="wheel-item">
                    <span role="img" aria-label={item.name}>
                      {item.icon}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="wheel-pointer">▼</div>
      </div>
      <button
        className="spin-button"
        onClick={handleSpin}
        disabled={isSpinning}
      >
        Spin for 150 credits
      </button>
      <button className="try-free-button">Try for Free</button>
    </div>
  );
};

export default SpinWheel;