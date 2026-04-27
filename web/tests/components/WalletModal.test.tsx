import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import WalletModal from '../../app/components/WalletModal';

describe('WalletModal Component', () => {
    const mockOnClose = vi.fn();
    const mockOnSelectWallet = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        cleanup();
    });

    it('renders the modal when isOpen is true', () => {
        render(
            <WalletModal
                isOpen={true}
                onClose={mockOnClose}
                onSelectWallet={mockOnSelectWallet}
            />
        );
        expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
        const { container } = render(
            <WalletModal
                isOpen={false}
                onClose={mockOnClose}
                onSelectWallet={mockOnSelectWallet}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('marks Leather and Xverse as unsupported and disables their buttons', () => {
        render(
            <WalletModal
                isOpen={true}
                onClose={mockOnClose}
                onSelectWallet={mockOnSelectWallet}
            />
        );

        const leatherButton = screen.getByRole('button', { name: /Connect using Leather \(Unsupported\)/i });
        const xverseButton = screen.getByRole('button', { name: /Connect using Xverse \(Unsupported\)/i });

        expect(leatherButton).toBeDisabled();
        expect(xverseButton).toBeDisabled();

        expect(screen.getAllByText('Unsupported').length).toBe(2);
        expect(screen.getAllByText('Not supported on Stellar').length).toBe(2);
    });

    it('keeps WalletConnect available as an active choice', () => {
        render(
            <WalletModal
                isOpen={true}
                onClose={mockOnClose}
                onSelectWallet={mockOnSelectWallet}
            />
        );

        const walletConnectButton = screen.getByRole('button', { name: /Connect using WalletConnect \(Available\)/i });
        expect(walletConnectButton).not.toBeDisabled();
        expect(screen.getByText('Connect with Stellar-compatible wallet via QR code')).toBeInTheDocument();
    });

    it('calls onSelectWallet when WalletConnect is clicked', () => {
        render(
            <WalletModal
                isOpen={true}
                onClose={mockOnClose}
                onSelectWallet={mockOnSelectWallet}
            />
        );

        const walletConnectButton = screen.getByRole('button', { name: /Connect using WalletConnect \(Available\)/i });
        fireEvent.click(walletConnectButton);

        expect(mockOnSelectWallet).toHaveBeenCalledWith('walletconnect');
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('displays error gracefully when error prop is provided', () => {
        const errorMessage = 'Unsupported provider. Please use a Stellar-compatible wallet.';
        render(
            <WalletModal
                isOpen={true}
                onClose={mockOnClose}
                onSelectWallet={mockOnSelectWallet}
                error={errorMessage}
            />
        );

        expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
});
