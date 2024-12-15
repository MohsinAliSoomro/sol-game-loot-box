import Link from "next/link";

export default function Page() {
    return (
        <div className="container mx-auto h-screen">
            <h3 className="text-center text-lg font-bold">How it works</h3>
            <h1 className="text-2xl text-center border-b border-white/40">Four steps to get your earned</h1>

            <div className="grid grid-flow-row grid-cols-4 gap-4 border-b border-white/40 pb-10">
                <div className="text-center border border-white/60 p-4 h-80 rounded-full flex flex-col items-center justify-center mt-10 gap-4">
                    <p className="text-5xl">1</p>
                    <p className="text-xl">Sign up</p>
                    <p className="text-sm">Register is no time and wait for your account to be verified</p>
                </div>
                <div className="text-center border border-white/60 p-4 h-80 rounded-full flex flex-col items-center justify-center mt-10 gap-4">
                    <p className="text-5xl">2</p>
                    <p className="text-xl">Post Advertisements</p>
                    <p className="text-sm">Post promotional materials with your affiliate link on your platform</p>
                </div>
                <div className="text-center border border-white/60 p-4 h-80 rounded-full flex flex-col items-center justify-center mt-10 gap-4">
                    <p className="text-5xl">3</p>
                    <p className="text-xl">Refer new customers</p>
                    <p className="text-sm">Every new customer who is refered via your link is permanently assignment to you</p>
                </div>
                <div className="text-center border border-white/60 p-4 h-80 rounded-full flex flex-col items-center justify-center mt-10 gap-4">
                    <p className="text-5xl">4</p>
                    <p className="text-xl">Withdraw money</p>
                    <p className="text-sm">Get up to 40% of our net revenue from every customer you refer</p>
                </div>
            </div>
            <Link
                href={"/affiliate/register"}
                className="flex mx-auto mt-10 bg-foreground text-white rounded-full py-4 px-11 text-center w-52">
                <span className="text-center">Get Started</span>
            </Link>
        </div>
    );
}
