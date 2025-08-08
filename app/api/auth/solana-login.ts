// pages/api/auth/solana-login.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Keep this secret!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { publicKey, signature, message } = req.body;

  if (!publicKey || !signature || !message) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const isVerified = nacl.sign.detached.verify(
    new TextEncoder().encode(message),
    bs58.decode(signature),
    bs58.decode(publicKey)
  );

  if (!isVerified) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const email = `${publicKey}@solana-wallet.auth`; // Fake but unique
  const password = publicKey; // dummy password, you can hash or change

  // Try login
  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error && error.message.includes('Invalid login credentials')) {
    // User doesn't exist, sign up
    const signUp = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUp.error) {
      return res.status(500).json({ error: signUp.error.message });
    }

    return res.status(200).json({ session: signUp.data.session });
  }

  return res.status(200).json({ session: data.session });
}
