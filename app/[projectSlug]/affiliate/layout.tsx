"use client";
import TopNav from "@/app/Components/TopNav";

export default function LiveDrawLayout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            <div className="nav-top z-50 relative">
            <TopNav />

            </div>
            {children}
        </div>
    );
}
