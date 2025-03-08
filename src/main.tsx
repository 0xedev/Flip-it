import FrameSDK from '@farcaster/frame-sdk';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {  wagmiConfig } from './config/config';
import { StrictMode, useEffect } from 'react';
import { ApolloProvider} from '@apollo/client';
import  client  from './components/PvcSection/client/apollo-client'
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

function FarcasterFrameProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
  const init = async () => {
      FrameSDK.actions.ready();
    };

    init();
  }, []);

  return <>{children}</>;
 }




// Create a new query client
const queryClient = new QueryClient();



// Render the app with WagmiProvider and QueryClientProvider
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={client}>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
      
      <FarcasterFrameProvider>
          <App />
    </FarcasterFrameProvider>
   
      </QueryClientProvider>
    </WagmiProvider> 
    </ApolloProvider>
  </StrictMode>
);
