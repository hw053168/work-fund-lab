import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, sepolia, hardhat } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { http } from 'viem'
import { PinataSDK } from 'pinata'

export const PINATA = new PinataSDK({
  pinataJwt: process.env.NEXT_PUBLIC_PINATA_JWT!,
  pinataGateway: process.env.NEXT_PUBLIC_GATEWAY_URL!,
});

export const APPKIT_PID = process.env.NEXT_PUBLIC_PROJECT_ID!;

export const APPKIT_NETWORKS = [mainnet, sepolia, hardhat] as [AppKitNetwork, ...AppKitNetwork[]];

// Use internal proxy for Sepolia RPC to avoid CORS and rate limiting
// The proxy at /api/rpc forwards to Alchemy with proper error handling
const SEPOLIA_RPC = '/api/rpc';

export const APPKIT_WAGMI = new WagmiAdapter({
  ssr: true,
  projectId: APPKIT_PID,
  networks: APPKIT_NETWORKS,
  transports: {
    [sepolia.id]: http(SEPOLIA_RPC, {
      timeout: 30000,
      retryCount: 3,
      retryDelay: 1000,
    }),
    [mainnet.id]: http(),
    [hardhat.id]: http('http://127.0.0.1:8545'),
  },
});
