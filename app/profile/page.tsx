"use client";
import TopNav from "../Components/TopNav";
import WithdrawHistory from "./components/withdraw";

export default function Withdraw() {
    return (
        <div className=" container">
            <TopNav />
            <h1 className="text-4xl font-bold text-center">Profile</h1>
            <div className="grid grid-cols-2 gap-2">
                <WithdrawHistory />
                <WithdrawHistory />
            </div>
        </div>
    );
}
