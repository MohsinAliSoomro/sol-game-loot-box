import { Scroll } from "lucide-react";

export default function Banner() {
    let text =
        "Complete the Bronitiation today and commit to a clan. Duke it out for points each week with the winning clan receiving a 30% bonus. Points are converterted to Bronuts weekly which can be used for RAGNAROK spins, instant SOL liquidity, or saved for later adventures. Let the games begin, bros! ⚔️💰";
    return (
        <div className="flex items-center justify-evenly bg-foreground text-background rounded-3xl my-4 py-10">
            <div>
                <Scroll size={200} />
            </div>
            <div className="max-w-lg items-center justify-center flex flex-col gap-8">
                <h1 className="text-4xl font-bold">Join the Fight</h1>
                <p className="text-center font-semibold">{text}</p>
            </div>
        </div>
    );
}
