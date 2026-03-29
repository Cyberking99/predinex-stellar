'use client';

import { useWallet } from './WalletAdapterProvider';
import { useDisputeManagement } from '../lib/disputes/useDisputeManagement';
import { DisputePageHeader } from './disputes/DisputePageHeader';
import { DisputeTabNav } from './disputes/DisputeTabNav';
import { ActiveDisputesSection } from './disputes/ActiveDisputesSection';
import { ResolvedDisputesSection } from './disputes/ResolvedDisputesSection';
import { CreateDisputeSection } from './disputes/CreateDisputeSection';

export default function DisputeManagement() {
  const { address } = useWallet();
  const {
    disputes,
    selectedTab,
    setSelectedTab,
    isLoading,
    now,
    hasUserVoted,
    getUserVote,
    handleVote,
  } = useDisputeManagement(address);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <DisputePageHeader />
      <DisputeTabNav selected={selectedTab} onSelect={setSelectedTab} />

      <div>
        {selectedTab === 'active' && (
          <ActiveDisputesSection
            disputes={disputes}
            now={now}
            isLoading={isLoading}
            hasUserVoted={hasUserVoted}
            getUserVote={getUserVote}
            onVote={handleVote}
          />
        )}
        {selectedTab === 'resolved' && <ResolvedDisputesSection disputes={disputes} />}
        {selectedTab === 'create' && <CreateDisputeSection isLoading={isLoading} />}
      </div>
    </div>
  );
}
