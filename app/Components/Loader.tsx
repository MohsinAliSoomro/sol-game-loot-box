import React from 'react';
import TopNav from './TopNav';

export default function Loader() {
    return (
        <div className="min-h-screen bg-orange-500">
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