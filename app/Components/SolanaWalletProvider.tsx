'use client';

import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import {
  WalletModalProvider,
} from '@solana/wallet-adapter-react-ui';

import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
//   BackpackWalletAdapter,
//   GlowWalletAdapter,
  TorusWalletAdapter,
  TrustWalletAdapter,
} from '@solana/wallet-adapter-wallets';

import { clusterApiUrl } from '@solana/web3.js';
import { FC, ReactNode, useMemo } from 'react';
require('@solana/wallet-adapter-react-ui/styles.css');

export const SolanaWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const endpoint = clusterApiUrl('mainnet-beta'); // or 'mainnet-beta'

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    //   new BackpackWalletAdapter(),
    //   new GlowWalletAdapter(),
      new TorusWalletAdapter(),
      new TrustWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
