export default function Footer() {
    return (
        <footer className=" border-t border-white/10 m-4 dark:bg-gray-800">
            <div className="w-full mx-auto max-w-screen-xl p-4 md:flex md:items-center md:justify-around">
                <span className="text-sm  sm:text-center dark:text-gray-400">
                    © 2025{" "}
                    <a
                        className="hover:underline">
                        OGX
                    </a>
                    . All Rights Reserved.
                </span>
                <ul className="flex flex-wrap items-center mt-3 text-sm font-medium sm:mt-0">
                    <li>
                        <a
                            href="#"
                            className="hover:underline me-1 md:me-6">
                            About
                        </a>
                    </li>
                    <li>
                        <a
                            href="#"
                            className="hover:underline me-1 md:me-6">
                            Privacy Policy
                        </a>
                    </li>
                    <li>
                        <a
                            href="#"
                            className="hover:underline me-1 md:me-6">
                            Licensing
                        </a>
                    </li>
                    <li>
                        <a
                            href="#"
                            className="hover:underline">
                            Contact
                        </a>
                    </li>
                </ul>
            </div>
        </footer>
    );
}
