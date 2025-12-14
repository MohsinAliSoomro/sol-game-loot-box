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
  const { publicKey, signature, message, project_id } = body;
  
  // Try to get project_id from body, headers, or URL
  const projectId = project_id || 
    req.headers.get('x-project-id') || 
    (typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null);

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
    
    // Create user record in database with proper UUID
    if (sessionData.session?.user) {
      try {
        const userData: any = {
          id: sessionData.session.user.id, // Use the auth UUID
          uid: sessionData.session.user.id,
          email: sessionData.session.user.email,
          walletAddress: publicKey,
          provider: 'wallet',
          apes: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Add project_id if available
        if (projectId) {
          userData.project_id = parseInt(projectId);
          console.log(`Creating user with project_id: ${projectId}`);
        }

        // Insert or update user record
        const { error: upsertError } = await supabase
          .from("user")
          .upsert(userData, { onConflict: 'id' });
        
        if (upsertError) {
          console.error("Error creating user record:", upsertError);
        } else {
          console.log("User record created successfully with UUID:", userData.id);
        }
      } catch (dbError) {
        console.error("Database error:", dbError);
      }
    }
    
    console.log({ sessionData });
    return Response.json({ session: sessionData.session }, { status: 200 });
  }

  // Also ensure existing wallet users have proper database records
  if (data.session?.user) {
    try {
      // Check if user record exists
      const { data: existingUser, error: fetchError } = await supabase
        .from("user")
        .select()
        .eq("id", data.session.user.id)
        .single();
      
      // If no user record exists, create one
      if (fetchError && fetchError.code === "PGRST116") {
        const userData: any = {
          id: data.session.user.id, // Use the auth UUID
          uid: data.session.user.id,
          email: data.session.user.email,
          walletAddress: publicKey,
          provider: 'wallet',
          apes: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Add project_id if available
        if (projectId) {
          userData.project_id = parseInt(projectId);
          console.log(`Creating existing user with project_id: ${projectId}`);
        }

        const { error: insertError } = await supabase
          .from("user")
          .insert(userData);
        
        if (insertError) {
          console.error("Error creating user record for existing user:", insertError);
        } else {
          console.log("User record created for existing wallet user:", userData.id);
        }
      }
    } catch (dbError) {
      console.error("Database error for existing user:", dbError);
    }
  }

  return Response.json({ session: data.session }, { status: 200 });
}
