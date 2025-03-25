import { baseSepolia } from 'wagmi/chains'
import { QueryClient } from "@tanstack/react-query";
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
import { createConfig, http } from "wagmi";
import { createClient } from "viem";



export const wagmiConfig = createConfig({
  chains: [ baseSepolia],
  connectors: [
    farcasterFrame()
   
  ],
  client({ chain }) {
    return createClient({
      chain,
      batch: { multicall: true },
      pollingInterval: 12_000,
      transport: http("https://base-sepolia.g.alchemy.com/v2/23jsJTJNwRJR6RJBcO6NCcgBuK01TNdX" ), // Corrected this line
    });
  },
});

export const queryClient = new QueryClient();


export const projectId = import.meta.env.VITE_PROJECT_ID;



