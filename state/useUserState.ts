import { createGlobalState } from "react-use";

export const useUserState = createGlobalState({
    username: "",
    walletAddress: "",
    created_at: "",
    isShow: false,
    cart: false,
    purchase: false,
    apes: 0,
});
