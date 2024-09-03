"use client";
import LootModal from "@/app/Components/LootModal";
import TopNav from "@/app/Components/TopNav";
import { useUserState } from "@/state/useUserState";
import { RefreshCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import "react-spin-game/dist/index.css";
import { useParams } from "next/navigation";
import { supabase } from "@/service/supabase";
import { Metaplex } from "@metaplex-foundation/js";
import { useRequest } from "ahooks";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
// const solanaConnections = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");
// const metaplex = new Metaplex(solanaConnections);
const Wheel = dynamic(() => import("react-custom-roulette").then((r) => r.Wheel), {
    ssr: false,
});

const getProducts = async () => {
    const response = await supabase.from("products").select();
    return response;
};
export default function Details() {
    const { data: products, loading, error } = useRequest(getProducts);
    const navigate = useRouter();
    const [user] = useUserState();
    const [mustSpin, setMustSpin] = useState(false);
    const [prizeNumber, setPrizeNumber] = useState(0);
    const [openModal, setOpenModal] = useState(false);
    const pathname = useParams<{ slug: string }>();
    console.log({ user });
    const newData = useMemo(() => {
        // @ts-ignore
        return products?.data?.find((i) => i.id === Number(pathname.slug));
    }, [pathname.slug, [products]]);

    const handleSpinClick = () => {
        // sendSolanaTokens();
        if (!mustSpin) {
            //@ts-ignore
            const newPrizeNumber = Math.floor(Math.random() * products?.data?.length || 0);
            setPrizeNumber(newPrizeNumber);
            setMustSpin(true);
        }
    };
    const handleModal = () => {
        setOpenModal(!openModal);
    };
    let ownerWallet = "Dw7xmScGHk74k3e8VLRZzkRAoNm1hjdQJF4wMHtxVzkB";
    const sendSolanaTokens = async () => {
        //@ts-ignore
        const { solana } = window;

        if (solana && newData) {
            try {
                const toWalletAddress = ownerWallet; // Replace with your wallet address
                const amountToSend = newData?.price; // Amount in SOL

                // Use testnet connection with commitment
                const connection = new Connection("https://api.devnet.solana.com", "confirmed");

                // Check account balance
                const balance = await connection.getBalance(new PublicKey(user.walletAddress));
                console.log("Account balance:", balance / LAMPORTS_PER_SOL, "SOL");

                // Set a fixed fee (in lamports)
                const fixedFee = 5000; // Adjust this value as needed

                // Check if there's enough balance
                if (balance < LAMPORTS_PER_SOL * amountToSend + fixedFee) {
                    throw new Error(`Insufficient balance. You need at least ${amountToSend + fixedFee / LAMPORTS_PER_SOL} SOL`);
                }

                // Create transaction
                const transaction = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: new PublicKey(user.walletAddress),
                        toPubkey: new PublicKey(toWalletAddress),
                        lamports: LAMPORTS_PER_SOL * amountToSend,
                    })
                );

                // Get latest blockhash
                const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = new PublicKey(user.walletAddress);

                // Sign and send transaction
                try {
                    const signedTransaction = await solana.signTransaction(transaction);
                    const signature = await connection.sendRawTransaction(signedTransaction.serialize());

                    console.log("Transaction sent. Awaiting confirmation...");
                    const confirmation = await connection.confirmTransaction({
                        signature,
                        blockhash,
                        lastValidBlockHeight,
                    });

                    if (confirmation.value.err) {
                        throw new Error("Transaction failed to confirm.");
                    }
                    await supabase.from("transaction").insert({
                        transactionId: signature,
                        sol: newData.price,
                        name: newData.name,
                    });
                    handleSpinClick();
                    console.log("Transaction confirmed. Signature:", signature);
                    // alert("Thank you for sending SOL on devnet!");
                } catch (error) {
                    console.error("Error during transaction signing or sending:", error);
                    throw new Error(`Failed to send transaction: ${error}`);
                }
            } catch (error) {
                console.error("Error sending Solana tokens:", error);
                alert(error || "Failed to send Solana tokens. Please try again.");
            }
        }
    };
    if (loading) {
        return <div>Loading...</div>;
    }
    if (error) {
        return <div>Error</div>;
    }
    const product = products?.data?.find((i) => i.id === Number(pathname.slug));
    console.log({ product, products });
    //@ts-ignore
    const newProducts = products.data?.map((i) => {
        return {
            option: i.name,
            image: {
                uri: i.image,
                offsetX: 0,
                offsetY: 230,
                sizeMultiplier: 0.8,
            },
        };
    });

    return (
        <div>
            <TopNav />
            <div className="flex items-center flex-col justify-center flex-wrap gap-4 relative">
                <div className="w-full flex items-center justify-center">
                    <div
                        style={{
                            backgroundImage: "url(/background.png)",
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                        }}
                        className="w-full h-full flex flex-col items-center justify-center relative">
                        <Wheel
                            mustStartSpinning={mustSpin}
                            prizeNumber={prizeNumber}
                            data={newProducts as any}
                            onStopSpinning={async () => {
                                const data = {
                                    //@ts-ignore
                                    name: products?.data[prizeNumber]?.name,
                                    //@ts-ignore
                                    sol: products?.data[prizeNumber]?.price,
                                    //@ts-ignore
                                    isWithdraw: false,
                                    //@ts-ignore
                                    image: products?.data[prizeNumber]?.image,
                                    //@ts-ignore
                                    percentage: products?.data[prizeNumber]?.winProb,
                                    userId: user?.walletAddress,
                                };
                                await supabase.from("prizeWin").insert(data);
                                handleModal();
                                setMustSpin(false);
                            }}
                            outerBorderWidth={8}
                            outerBorderColor="#eb7ec3"
                            backgroundColors={["#ef71b0", "#ef71c9", "#ef71b0", "#ef71c9", "#ef71b0", "#ef71c9"]}
                            innerBorderColor="pink"
                            innerBorderWidth={4}
                            radiusLineWidth={3}
                            radiusLineColor="#f38cbf"
                            spinDuration={1}
                            textColors={["#eeb1d0"]}
                            fontSize={14}
                            // pointerProps={{
                            //     src: "/frame.png",
                            // }}
                        />
                        <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center z-50">
                            <span className=" w-40 h-40 md:h-96 md:w-96 rounded-full bg-background border-2 border-white/40"></span>
                        </div>
                        <div className="absolute top-1/2 left-0 right-0 z-50 -mb-20 bg-background w-full h-full">
                            <div
                                onClick={sendSolanaTokens}
                                className="flex justify-center items-center gap-6 cursor-pointer">
                                <p className="backdrop-blur-sm p-2 rounded-lg bg-foreground text-white mt-2 ">
                                    Spin for <span className="font-bold text-lg">{product?.price}</span> Sol{" "}
                                </p>
                            </div>
                            <button
                                onClick={handleSpinClick}
                                className="mx-auto flex items-center gap-2 mt-5 bg-transprent font-bold text-foreground px-10 py-4 text-lg">
                                <RefreshCcw
                                    size={20}
                                    height={20}
                                />{" "}
                                <span> Try it for free</span>
                            </button>
                            <div className="text-white px-4">
                                <h1 className="font-bold text-4xl text-foreground">Item</h1>
                                <h1 className="font-bold text-4xl text-foreground">In the box</h1>
                                <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-3 m-2 gap-y-6 gap-2 mb-40">
                                    {
                                        //@ts-ignore
                                        products?.data.map((loot) => (
                                            <div
                                                key={loot.name}
                                                className="bg-gradient-to-b from-foreground to-secondary border-white/40 p-2 py-10 rounded-xl text-background flex flex-col items-center relative">
                                                <Image
                                                    src={loot.image}
                                                    alt={loot.name}
                                                    width={200}
                                                    height={200}
                                                    className=""
                                                />
                                                <span className="font-bold text-center mx-auto text-white"> {loot.name}</span>
                                                <span className="font-bold text-center flex mx-auto text-xl mb-4 text-white">Sol {loot.price}</span>
                                                <button
                                                    onClick={() => {
                                                        navigate.push("/lootboxes/" + loot.id);
                                                    }}
                                                    className="text-xl rounded-full px-2 lg:px-5 py-1 lg:py-2 absolute -bottom-4 left-4 right-4 shadow-lg backdrop-blur-md bg-foreground border border-white/40 text-white text-center">
                                                    Open
                                                </button>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {openModal && <LootModal close={handleModal} />}
        </div>
    );
}
