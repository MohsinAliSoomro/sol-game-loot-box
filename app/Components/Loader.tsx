"use client";
import React from 'react';
import TopNav from './TopNav';
import { useThemeColor } from '@/lib/hooks/useThemeColor';

export default function Loader() {
    const themeColor = useThemeColor(); // Get theme color immediately
    
    return (
        <div 
            className="min-h-screen"
            style={{ backgroundColor: themeColor }}
        >
          <div className="nav-top z-50 relative">
            {/* <TopNav /> */}

            </div>
            <div className="loader">
                <div className="circle">
                    <div className="dot"></div>
                    <div className="outline"></div>
                </div>
                <div className="circle">
                    <div className="dot"></div>
                    <div className="outline"></div>
                </div>
                <div className="circle">
                    <div className="dot"></div>
                    <div className="outline"></div>
                </div>
                <div className="circle">
                    <div className="dot"></div>
                    <div className="outline"></div>
                </div>
            </div>
        </div>
    );
} 