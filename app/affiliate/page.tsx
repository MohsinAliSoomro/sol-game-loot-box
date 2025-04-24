import Link from "next/link";

export default function Page() {
    return (
        <div className="max-w-7xl mx-auto px-4 py-12">
            <div className="bg-[#2e1506]/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-[#f74e14]/30 overflow-hidden mb-10 relative">
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: `url('/lv-pattern.png')`,
                    backgroundSize: '120px',
                    backgroundRepeat: 'repeat',
                }}></div>
                
                {/* Header */}
                <div className="text-center mb-12 relative z-10">
                    <h3 className="text-[#ff914d] text-lg font-medium mb-2">AFFILIATE PROGRAM</h3>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-[#f74e14] to-[#ff914d] bg-clip-text text-transparent mb-4">
                        Four Steps To Earn Rewards
                    </h1>
                    <div className="h-px w-24 bg-gradient-to-r from-[#f74e14] to-[#ff914d] mx-auto"></div>
                </div>

                {/* Steps */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 relative z-10">
                    {/* Step 1 */}
                    <div className="bg-[#3d1c08] border border-[#f74e14]/30 rounded-xl p-6 flex flex-col items-center text-center transform transition-all duration-300 hover:translate-y-[-5px] hover:shadow-xl">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#f74e14] to-[#ff914d] flex items-center justify-center mb-6">
                            <span className="text-2xl font-bold text-white">1</span>
                        </div>
                        <h3 className="text-xl font-bold text-[#fff2e6] mb-3">Sign Up</h3>
                        <p className="text-[#ffcea6]">Register in no time and wait for your account to be verified</p>
                    </div>
                    
                    {/* Step 2 */}
                    <div className="bg-[#3d1c08] border border-[#f74e14]/30 rounded-xl p-6 flex flex-col items-center text-center transform transition-all duration-300 hover:translate-y-[-5px] hover:shadow-xl">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#f74e14] to-[#ff914d] flex items-center justify-center mb-6">
                            <span className="text-2xl font-bold text-white">2</span>
                        </div>
                        <h3 className="text-xl font-bold text-[#fff2e6] mb-3">Post Advertisements</h3>
                        <p className="text-[#ffcea6]">Post promotional materials with your affiliate link on your platform</p>
                    </div>
                    
                    {/* Step 3 */}
                    <div className="bg-[#3d1c08] border border-[#f74e14]/30 rounded-xl p-6 flex flex-col items-center text-center transform transition-all duration-300 hover:translate-y-[-5px] hover:shadow-xl">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#f74e14] to-[#ff914d] flex items-center justify-center mb-6">
                            <span className="text-2xl font-bold text-white">3</span>
                        </div>
                        <h3 className="text-xl font-bold text-[#fff2e6] mb-3">Refer New Customers</h3>
                        <p className="text-[#ffcea6]">Every new customer who is referred via your link is permanently assigned to you</p>
                    </div>
                    
                    {/* Step 4 */}
                    <div className="bg-[#3d1c08] border border-[#f74e14]/30 rounded-xl p-6 flex flex-col items-center text-center transform transition-all duration-300 hover:translate-y-[-5px] hover:shadow-xl">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#f74e14] to-[#ff914d] flex items-center justify-center mb-6">
                            <span className="text-2xl font-bold text-white">4</span>
                        </div>
                        <h3 className="text-xl font-bold text-[#fff2e6] mb-3">Withdraw Money</h3>
                        <p className="text-[#ffcea6]">Get up to 40% of our net revenue from every customer you refer</p>
                    </div>
                </div>
                
                {/* Benefits */}
                <div className="bg-[#3a2613] border border-[#f74e14]/30 rounded-xl p-6 mb-12 relative z-10">
                    <h2 className="text-2xl font-bold text-[#ff914d] mb-6 text-center">Why Join Our Affiliate Program?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-[#f74e14]/20 flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#ff914d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-[#fff2e6] mb-2">High Commission Rates</h3>
                            <p className="text-[#ffcea6]">Earn up to 40% commission on every referral</p>
                        </div>
                        
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-[#f74e14]/20 flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#ff914d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-[#fff2e6] mb-2">Lifetime Attribution</h3>
                            <p className="text-[#ffcea6]">Customers are permanently assigned to your account</p>
                        </div>
                        
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-[#f74e14]/20 flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#ff914d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-[#fff2e6] mb-2">Marketing Materials</h3>
                            <p className="text-[#ffcea6]">Access to premium promotional resources</p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* CTA Section */}
            <div className="text-center">
                <Link
                    href={"/affiliate/register"}
                    className="inline-block px-12 py-4 bg-gradient-to-r from-[#f74e14] to-[#ff914d] text-white font-medium rounded-xl hover:opacity-90 transition-all duration-200 shadow-lg"
                >
                    Get Started Now
                </Link>
                <p className="text-[#ffcea6] mt-4">Join over 2,000+ affiliates already earning with us</p>
            </div>
        </div>
    );
}
