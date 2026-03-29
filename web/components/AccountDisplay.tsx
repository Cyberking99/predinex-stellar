'use client';
import { useStacksAccount } from '../lib/hooks/useStacksAccount';
import { TruncatedAddress } from './TruncatedAddress';
import CopyButton from './ui/CopyButton';

export function AccountDisplay() {
  const { address, balance, isConnected } = useStacksAccount();

  if (!isConnected || !address) return null;

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <div className="flex items-center gap-2">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Address</p>
          <TruncatedAddress address={address} className="font-mono text-sm" />
        </div>
        <CopyButton value={address} className="shrink-0" />
      </div>
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Balance</p>
        <p className="font-semibold">{balance} STX</p>
      </div>
    </div>
  );
}
