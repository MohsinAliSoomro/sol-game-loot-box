"use client";
import TopNav from "../Components/TopNav";

export default function LiveDrawLayout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            <TopNav />
            {children}
        </div>
    );
}
