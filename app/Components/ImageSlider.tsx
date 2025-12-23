'use client'
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getSliderImages, SliderImage } from '@/service/websiteSettings';
import { useProject } from '@/lib/project-context';

// Fallback images if no slider images are found in database
const fallbackImages = [
    "/beta.jpg",
    "/live.jpg",
    "/ads.jpg",
];

export default function ImageSlider() {
    const { getProjectId } = useProject();
    const projectId = getProjectId();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [sliderImages, setSliderImages] = useState<SliderImage[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSliderImages = async () => {
        try {
            setLoading(true);
            // Pass project ID to fetch project-specific slider images
            const images = await getSliderImages(projectId || undefined);
            console.log('Fetched slider images:', images); // Debug log
            if (images && images.length > 0) {
                setSliderImages(images);
            } else {
                // Use fallback images if no slider images in database
                setSliderImages(fallbackImages.map((img, idx) => ({
                    id: `fallback-${idx}`,
                    image_path: img,
                    order_index: idx,
                    is_active: true,
                })));
            }
        } catch (error) {
            console.error('Error fetching slider images:', error);
            // Use fallback on error
            setSliderImages(fallbackImages.map((img, idx) => ({
                id: `fallback-${idx}`,
                image_path: img,
                order_index: idx,
                is_active: true,
            })));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSliderImages();
        
        // Refresh slider images every 30 seconds to pick up new uploads
        const refreshInterval = setInterval(() => {
            fetchSliderImages();
        }, 30000);

        return () => clearInterval(refreshInterval);
    }, [projectId]); // Refetch when project changes

    // Reset to first image when sliderImages change
    useEffect(() => {
        if (sliderImages.length > 0) {
            setCurrentIndex(0);
        }
    }, [sliderImages.length]);

    useEffect(() => {
        if (sliderImages.length === 0 || sliderImages.length === 1) return;
        
        const interval = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % sliderImages.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [sliderImages.length]);

    if (loading) {
        return (
            <div className="relative w-full h-[50vh] overflow-hidden bg-gray-200 animate-pulse" />
        );
    }

    if (sliderImages.length === 0) {
        return null;
    }

    return (
        <div className="relative w-full h-[50vh] overflow-hidden">
            {sliderImages.map((slide, index) => (
                <div
                    key={slide.id}
                    className="absolute w-full h-full transition-opacity duration-1000"
                    style={{
                        opacity: index === currentIndex ? 1 : 0,
                    }}
                >
                    <Image
                        src={slide.image_path || '/beta.jpg'}
                        alt={`Slide ${index + 1}`}
                        className="object-cover"
                        priority={index === 0}
                        fill
                        unoptimized={slide.image_path?.startsWith('http') || false}
                    />
                </div>
            ))}
            
            {/* Navigation Dots */}
            {sliderImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                    {sliderImages.map((_, index) => (
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
            )}
        </div>
    );
} 