import { supabase } from "@/service/supabase";
import { useUserState } from "@/state/useUserState";
import { memo, useState } from "react";

const Model = () => {
    const [user, setUser] = useUserState();
    const [username, setUsername] = useState("");
    const [discord, setDiscord] = useState("");

    const handleClose = () => {
        setUser({ ...user, isShow: false });
    };
    const handleSubmit = async () => {
        if (user.walletAddress) {
            await supabase.from("user").update({ username: username, discord: discord }).eq("walletAddress", user.walletAddress);
            setUser({ ...user, username, isShow: false });
        }
    };
    if (!user.isShow) return null;
    return (
        <div className="overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-50 bg-black/20 flex justify-center items-center w-full md:inset-0 h-[calc(100%)] max-h-full">
            <div className="relative p-4 w-full max-w-2xl max-h-full">
                <div className="relative bg-background backdrop-blur-lg rounded-lg shadow dark:bg-gray-700">
                    <div className="flex items-center justify-between p-4 md:p-5 border-b rounded-t dark:border-gray-600">
                        <h3 className="text-xl font-semibold text-foreground dark:text-white">Profile</h3>
                        <button
                            type="button"
                            className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
                            data-modal-hide="default-modal">
                            <svg
                                className="w-3 h-3"
                                aria-hidden="true"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 14 14">
                                <path
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                                />
                            </svg>
                            <span className="sr-only">Close modal</span>
                        </button>
                    </div>
                    <div className="p-4 md:p-5 space-y-4">
                        <label className="flex font-bold">Username</label>
                        <input
                            type="text"
                            placeholder="username"
                            className="w-full border rounded-lg p-3 font-bold"
                            value={username}
                            onChange={(t) => setUsername(t.target.value)}
                        />
                    </div>
                    <div className="p-4 md:p-5 space-y-4">
                        <label className="flex font-bold">Discord Username</label>
                        <input
                            type="text"
                            placeholder="username"
                            className="w-full border rounded-lg p-3 font-bold"
                            value={discord}
                            onChange={(t) => setDiscord(t.target.value)}
                        />
                    </div>
                    <div className="flex items-center p-4 md:p-5 border-t border-gray-200 rounded-b dark:border-gray-600">
                        <button
                            onClick={handleSubmit}
                            type="button"
                            className="bg-foreground text-white border focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                            Update
                        </button>
                        <button
                            onClick={handleClose}
                            type="button"
                            className="py-2.5 px-5 ms-3 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default memo(Model);
