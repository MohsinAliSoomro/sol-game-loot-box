import { createGlobalState } from "react-use";

export const useUserState = createGlobalState({
    username: "",
    walletAddress: "",
    created_at: "",
    id: "",
    isShow: false,
    cart: false,
    purchase: false,
    withdraw: false,
    apes: 0,
});
