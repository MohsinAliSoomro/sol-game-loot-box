export default function Footer() {
    return (
        <footer className="border-t border-white/20 bg-black/20 backdrop-blur-sm m-4">
            <div className="w-full mx-auto max-w-screen-xl p-4 md:flex md:items-center md:justify-around">
                <span className="text-sm text-white sm:text-center">
                    © 2025{" "}
                    <a
                        className="hover:underline text-white font-semibold">
                        OGX
                    </a>
                    . All Rights Reserved.
                </span>
                <ul className="flex flex-wrap items-center mt-3 text-sm font-medium text-white sm:mt-0">
                    <li>
                        <a
                            href="#"
                            className="hover:underline hover:text-white/80 me-1 md:me-6">
                            About
                        </a>
                    </li>
                    <li>
                        <a
                            href="#"
                            className="hover:underline hover:text-white/80 me-1 md:me-6">
                            Privacy Policy
                        </a>
                    </li>
                    <li>
                        <a
                            href="#"
                            className="hover:underline hover:text-white/80 me-1 md:me-6">
                            Licensing
                        </a>
                    </li>
                    <li>
                        <a
                            href="#"
                            className="hover:underline hover:text-white/80">
                            Contact
                        </a>
                    </li>
                </ul>
            </div>
        </footer>
    );
}
