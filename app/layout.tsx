import type { Metadata } from "next";
// import { Princess_Sofia } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "./Components/ThemeProvider";
import Footer from "./Components/Footer";
import SidebarCart from "./Components/SidebarCart";
import PurchaseModal from "./Components/Purchase";
import WithdrawModal from "./Components/Withdraw";

// const fontSans = Princess_Sofia({
//     subsets: ["latin"],
//     variable: "--font-sans",
//     weight: ["400"],
// });
const myFont = localFont({ src: "../fonts/waltograph/waltographUI.ttf" });
export const metadata: Metadata = {
    title: "Spinloot",
    description: "Generated by create next app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={cn("min-h-screen bg-orange-500 antialiased", myFont.className)}>
                <ThemeProvider
                    attribute="class"
                    // defaultTheme="system"
                    // enableSystem
                    // disableTransitionOnChange
                    >
                    {children}
                    <Footer />
                    <SidebarCart />
                    <PurchaseModal />
                    <WithdrawModal />
                </ThemeProvider>
            </body>
        </html>
    );
}
