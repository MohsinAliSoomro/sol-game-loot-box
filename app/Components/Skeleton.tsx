"use client";
import React from 'react';
import { useThemeColor } from '@/lib/hooks/useThemeColor';

// Helper to create lighter/darker shades
const adjustColorBrightness = (color: string, percent: number): string => {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
};

// Base skeleton element
export const SkeletonBox = ({ className = "", style = {} }: { className?: string; style?: React.CSSProperties }) => {
  const themeColor = useThemeColor();
  const lighterColor = adjustColorBrightness(themeColor, 40);
  
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{
        backgroundColor: lighterColor + '40',
        ...style
      }}
    />
  );
};

// Skeleton for product/lootbox cards
export const ProductCardSkeleton = () => {
  return (
    <div className="border border-orange-300 rounded-lg shadow-md flex flex-col items-center justify-between relative aspect-square w-full mt-5 bg-white/10">
      <SkeletonBox className="w-full h-8 mb-2 rounded-t-lg" />
      <div className="flex-1 flex flex-col items-center justify-center w-full p-4">
        <SkeletonBox className="w-24 h-24 rounded-lg mb-3" />
      </div>
      <div className="w-full p-3">
        <SkeletonBox className="w-full h-10 rounded-lg" />
      </div>
    </div>
  );
};

// Skeleton for transaction/prize cards
export const PrizeCardSkeleton = () => {
  return (
    <div className="w-[150px] flex-shrink-0">
      <div className="w-full aspect-square bg-white/10 border border-orange-300 rounded-lg shadow-md flex flex-col items-center relative overflow-hidden">
        <SkeletonBox className="w-full h-6 mt-2 mx-2 rounded" />
        <SkeletonBox className="w-full h-24 mt-2 mx-2 rounded" />
        <SkeletonBox className="w-full h-4 mt-1 mx-2 rounded" />
      </div>
    </div>
  );
};

// Skeleton for project cards
export const ProjectCardSkeleton = () => {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
      <div className="flex items-center gap-4 mb-3">
        <SkeletonBox className="w-12 h-12 rounded-lg" />
        <SkeletonBox className="h-6 w-32 rounded" />
      </div>
      <SkeletonBox className="h-4 w-full mb-2 rounded" />
      <SkeletonBox className="h-4 w-3/4 mb-4 rounded" />
      <div className="flex items-center justify-between">
        <SkeletonBox className="h-3 w-24 rounded" />
        <SkeletonBox className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
};

// Skeleton for leaderboard rows
export const LeaderboardRowSkeleton = () => {
  return (
    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg">
      <SkeletonBox className="w-8 h-8 rounded-full" />
      <SkeletonBox className="w-10 h-10 rounded-full" />
      <div className="flex-1">
        <SkeletonBox className="h-4 w-32 mb-2 rounded" />
        <SkeletonBox className="h-3 w-24 rounded" />
      </div>
      <SkeletonBox className="h-5 w-20 rounded" />
    </div>
  );
};

// Skeleton for table rows
export const TableRowSkeleton = ({ columns = 4 }: { columns?: number }) => {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <SkeletonBox className="h-4 w-full rounded" />
        </td>
      ))}
    </tr>
  );
};

// Skeleton for image
export const ImageSkeleton = ({ width = 100, height = 100, className = "" }: { width?: number; height?: number; className?: string }) => {
  return (
    <SkeletonBox 
      className={`rounded ${className}`}
      style={{ width, height }}
    />
  );
};

// Skeleton for text lines
export const TextSkeleton = ({ lines = 1, className = "" }: { lines?: number; className?: string }) => {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox 
          key={i} 
          className={`h-4 rounded mb-2 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
};

// Skeleton for button
export const ButtonSkeleton = ({ className = "" }: { className?: string }) => {
  return (
    <SkeletonBox className={`h-10 rounded-lg ${className}`} />
  );
};

