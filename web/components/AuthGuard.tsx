import { useWalletState } from '@/app/hooks/useWalletConnection';
import { ReactNode } from 'react';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { isConnected } = useWalletState();

  if (!isConnected) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 border border-border rounded-xl bg-muted/10 mx-auto max-w-lg mt-12">
            <h2 className="text-2xl font-bold mb-4">Connect Wallet</h2>
            <p className="text-muted-foreground mb-6 text-center">You need to connect your Stacks wallet to view this content.</p>
        </div>
    );
  }

  return <>{children}</>;
}
