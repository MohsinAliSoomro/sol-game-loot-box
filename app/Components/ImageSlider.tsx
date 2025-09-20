'use client'
import { useState, useEffect } from 'react';
import Image from 'next/image';

const images = [
    "/beta.jpg",
    "/live.jpg",
    "/ads.jpg", // Add more images as needed
];

export default function ImageSlider() {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative w-full h-[50vh] overflow-hidden">
            {images.map((image, index) => (
                <div
                    key={index}
                    className="absolute w-full h-full transition-opacity duration-1000"
                    style={{
                        opacity: index === currentIndex ? 1 : 0,
                    }}
                >
                    <Image
                        src={image}
                        alt={`Slide ${index + 1}`}
                        className="object-cover"
                        priority={index === 0}
                        fill
                        // width={300}
                        // height={300}
                    />
                </div>
            ))}
            
            {/* Navigation Dots */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                {images.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => setCurrentIndex(index)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                            index === currentIndex 
                                ? 'bg-white w-4' 
                                : 'bg-white/50 hover:bg-white/75'
                        }`}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>
        </div>
    );
} 