export default function Footer() {
    return (
        <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 m-4">
            <div className="w-full mx-auto max-w-screen-xl p-4 md:flex md:items-center md:justify-around">
                <span className="text-sm text-gray-600 dark:text-gray-400 sm:text-center">
                    © 2025{" "}
                    <a
                        className="hover:underline text-orange-600 dark:text-orange-400">
                        OGX
                    </a>
                    . All Rights Reserved.
                </span>
                <ul className="flex flex-wrap items-center mt-3 text-sm font-medium text-gray-600 dark:text-gray-400 sm:mt-0">
                    <li>
                        <a
                            href="#"
                            className="hover:underline hover:text-orange-600 dark:hover:text-orange-400 me-1 md:me-6">
                            About
                        </a>
                    </li>
                    <li>
                        <a
                            href="#"
                            className="hover:underline hover:text-orange-600 dark:hover:text-orange-400 me-1 md:me-6">
                            Privacy Policy
                        </a>
                    </li>
                    <li>
                        <a
                            href="#"
                            className="hover:underline hover:text-orange-600 dark:hover:text-orange-400 me-1 md:me-6">
                            Licensing
                        </a>
                    </li>
                    <li>
                        <a
                            href="#"
                            className="hover:underline hover:text-orange-600 dark:hover:text-orange-400">
                            Contact
                        </a>
                    </li>
                </ul>
            </div>
        </footer>
    );
}
