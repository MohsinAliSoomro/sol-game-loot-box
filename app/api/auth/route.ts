// pages/api/auth/solana-login.ts
import nacl from "tweetnacl";
import bs58 from "bs58";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.SUPABSE_URL!,
  process.env.SUPABASE_SERVICE_ROLL!
);
export async function POST(req: Request) {
  const body = await req.json();
  const { publicKey, signature, message } = body;

  if (!publicKey || !signature || !message) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const isVerified = nacl.sign.detached.verify(
    new TextEncoder().encode(message),
    bs58.decode(signature),
    bs58.decode(publicKey)
  );

  if (!isVerified) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  const hash = crypto
    .createHash("sha256")
    .update(publicKey)
    .digest("hex")
    .slice(0, 15);

  const email = `${hash}@gmail.com`;
  const password = publicKey; // dummy password, you can hash or change

  // Try login
  let { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error && error.message.includes("Invalid login credentials")) {
    // User doesn't exist, sign up
    const signUp = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { walletAddress: publicKey },
    });

    if (signUp.error) {
      return Response.json({ error: signUp.error.message }, { status: 500 });
    }
    // Confirm the user manually
    // const { data: confirmedUser, error: adminError } =
    //   await supabase.auth.admin.updateUserById(signUp.data.user?.id as string, {
    //     email: email,
    //     email_confirm: true,
    //   });
    // console.log({ confirmedUser ,adminError});
    // if (adminError) {
    //   return Response.json({ error: adminError.message }, { status: 500 });
    // }
    // Now sign them in
    const { data: sessionData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });
    console.log({ sessionData });
    return Response.json({ session: sessionData.session }, { status: 200 });
  }

  return Response.json({ session: data.session }, { status: 200 });
}
