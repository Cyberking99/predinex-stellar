/**
 * useWalletConnection - Production hook for wallet connection status
 * Provides real wallet availability and connection state from Stacks context
 */

import { useEffect, useState, useCallback } from 'react';
import { isWalletAvailable, WalletType } from '../lib/wallet-connector';
import { useStacks } from '../components/StacksProvider';

export interface WalletConnectionStatus {
    leather: boolean;
    xverse: boolean;
    walletconnect: boolean;
    hasAnyWallet: boolean;
}

export interface WalletConnectionState {
    isConnected: boolean;
    address: string | null;
    connect: () => void;
    disconnect: () => void;
}

export function useWalletConnection(): WalletConnectionStatus {
    const [status, setStatus] = useState<WalletConnectionStatus>({
        leather: false,
        xverse: false,
        walletconnect: true,
        hasAnyWallet: true,
    });

    useEffect(() => {
        const checkWallets = () => {
            const leather = isWalletAvailable('leather');
            const xverse = isWalletAvailable('xverse');
            const walletconnect = isWalletAvailable('walletconnect');
            
            setStatus({
                leather,
                xverse,
                walletconnect,
                hasAnyWallet: leather || xverse || walletconnect,
            });
        };

        checkWallets();
        
        const interval = setInterval(checkWallets, 2000);
        
        return () => clearInterval(interval);
    }, []);

    return status;
}

export function useWalletState(): WalletConnectionState {
    const { userData, authenticate, signOut } = useStacks();
    
    const isConnected = !!userData;
    const address = userData?.profile?.stxAddress?.mainnet || null;
    
    const connect = useCallback(() => {
        authenticate();
    }, [authenticate]);
    
    const disconnect = useCallback(() => {
        signOut();
    }, [signOut]);
    
    return { isConnected, address, connect, disconnect };
}
