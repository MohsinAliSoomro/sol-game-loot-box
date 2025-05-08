import React from 'react';
import TopNav from './TopNav';

export default function Loader() {
    return (
        <div className="min-h-screen bg-orange-500">
            <TopNav />
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