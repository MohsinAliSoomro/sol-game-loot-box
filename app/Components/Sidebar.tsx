import Link from "next/link";

export default function Sidebar() {
    let SIDEBAR_DATA = [
        {
            name: "Dashboard",
            href: "/",
            icon: "",
        },
        {
            name: "Loot Boxes",
            href: "/lootboxes",
            icon: "",
        },
    ];
    return (
        <aside
            id="default-sidebar"
            className="fixed top-0 left-0 z-40 w-64 h-screen transition-transform -translate-x-full sm:translate-x-0"
            aria-label="Sidebar">
            <div className="h-full px-3 py-4 overflow-y-auto">
                <ul className="space-y-2 font-medium">
                    <li
                        key={1}
                        className="text-center mb-20">
                        Icon
                    </li>
                    {SIDEBAR_DATA.map((link) => {
                        return (
                            <li className="bg-foreground text-background rounded-2xl text-xl font-bold px-8 hover:bg-foreground group">
                                <Link
                                    href={link.href}
                                    key={link.name}
                                    className="flex items-center p-2 ">
                                    <svg
                                        className="w-5 h-5 transition duration-75 dark:text-gray-400 group-hover dark:group-hover:text-white"
                                        aria-hidden="true"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="currentColor"
                                        viewBox="0 0 22 21">
                                        <path d="M16.975 11H10V4.025a1 1 0 0 0-1.066-.998 8.5 8.5 0 1 0 9.039 9.039.999.999 0 0 0-1-1.066h.002Z" />
                                        <path d="M12.5 0c-.157 0-.311.01-.565.027A1 1 0 0 0 11 1.02V10h8.975a1 1 0 0 0 1-.935c.013-.188.028-.374.028-.565A8.51 8.51 0 0 0 12.5 0Z" />
                                    </svg>
                                    <span className="ms-3">{link.name}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </aside>
    );
}
