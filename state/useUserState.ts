import { createGlobalState } from "react-use";

export const useUserState = createGlobalState({
    username: "",
    walletAddress: "",
    created_at: "",
    id: "",
    apes: 0,
    avatar_url: "",
    email: "",
    full_name: "",
    provider: "",
    uid: "",
    updated_at: "",
    isShow: false,
    cart: false,
    purchase: false,
    withdraw: false,
});
