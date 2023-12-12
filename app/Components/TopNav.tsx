import {
    FileLock,
    Flame,
    Layers3,
    PanelTop,
    Users,
    Wallet2,
} from "lucide-react";

export default function TopNav() {
    let DATA = [
        {
            name: "Volume",
            value: "123123 sol",
            icon: <Users className="w-10 h-10" />,
        },
        {
            name: "Listed",
            value: "123123 sol",
            icon: <Wallet2 className="w-10 h-10" />,
        },
        {
            name: "Floor",
            value: "123123 sol",
            icon: <PanelTop className="w-10 h-10" />,
        },
        {
            name: "Uniqui Holders",
            value: "123123 sol",
            icon: <Users className="w-10 h-10" />,
        },
        {
            name: "Stacked",
            value: "123123 sol",
            icon: <Layers3 className="w-10 h-10" />,
        },
        {
            name: "Burned",
            value: "123123 sol",
            icon: <Flame className="w-10 h-10" />,
        },
        {
            name: "Value Looked",
            value: "123123 sol",
            icon: <FileLock className="w-10 h-10" />,
        },
    ];
    return (
        <div className="flex justify-between items-center flex-wrap mt-3 border-b  border-foreground pb-5">
            <div className="flex items-center gap-4 flex-wrap">
                {DATA.map((item) => (
                    <div
                        key={item.name}
                        className="flex items-start gap-3">
                        {item.icon}
                        <div className="text-sm font-black">
                            <span className="flex">{item.name}</span>
                            <span>{item.value}</span>
                        </div>
                    </div>
                ))}
            </div>
            <button className="bg-foreground text-background px-8 py-2 rounded-full">
                Login
            </button>
        </div>
    );
}
