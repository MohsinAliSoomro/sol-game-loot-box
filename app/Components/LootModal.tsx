interface IProps {
    close: () => void;
}
export default function LootModal({ close }: IProps) {
    return (
        <div className="fixed top-0 left-0 w-screen h-screen flex items-center justify-center z-50">
            <div className="bg-foreground p-4 max-w-2xl w-full text-white rounded-xl">
                <h1 className="text-center text-2xl font-bold">Congratulations</h1>
                <p className="text-center my-4 font-bold">You win the jackpot of 10000 BTC </p>
                <button
                    onClick={close}
                    className="border rounded-lg px-6 py-2 border-white/10 flex items-center justify-center mx-auto mt-10">
                    Okay
                </button>
            </div>
        </div>
    );
}
