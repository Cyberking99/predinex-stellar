'use client';

import { useState } from 'react';
import { openContractCall } from '@stacks/connect';
import { stringAsciiCV, uintCV } from '@stacks/transactions';
import Navbar from '../../components/Navbar';
import AuthGuard from '../../components/AuthGuard';
import { useStacks } from '../components/StacksProvider';
import { useToast } from '../../providers/ToastProvider';
import { validatePoolCreationForm } from '../lib/validators';
import { getRuntimeConfig } from '../lib/runtime-config';
import { useTxStatus } from '../lib/hooks/useTxStatus';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface FormData {
    title: string;
    description: string;
    outcomeA: string;
    outcomeB: string;
    duration: string;
}

type FormErrors = Partial<Record<keyof FormData, string>>;

const EMPTY_FORM: FormData = { title: '', description: '', outcomeA: '', outcomeB: '', duration: '' };

export default function CreateMarket() {
    const { userData, authenticate } = useStacks();
    const { showToast } = useToast();
    const [form, setForm] = useState<FormData>(EMPTY_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [txState, trackTx] = useTxStatus();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        // Clear field error on change
        if (errors[name as keyof FormData]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userData) {
            authenticate();
            return;
        }

        const duration = parseInt(form.duration, 10);
        const validation = validatePoolCreationForm({
            title: form.title,
            description: form.description,
            outcomeA: form.outcomeA,
            outcomeB: form.outcomeB,
            duration: isNaN(duration) ? 0 : duration,
        });

        if (!validation.valid) {
            setErrors(validation.errors as FormErrors);
            return;
        }

        setIsSubmitting(true);
        try {
            const { contract } = getRuntimeConfig();
            await openContractCall({
                contractAddress: contract.address,
                contractName: contract.name,
                functionName: 'create-pool',
                functionArgs: [
                    stringAsciiCV(form.title),
                    stringAsciiCV(form.description),
                    stringAsciiCV(form.outcomeA),
                    stringAsciiCV(form.outcomeB),
                    uintCV(duration),
                ],
                onFinish: (data) => {
                    trackTx(data.txId);
                    setForm(EMPTY_FORM);
                    showToast('Market submitted! Tracking confirmation…', 'success');
                    setIsSubmitting(false);
                },
                onCancel: () => {
                    showToast('Transaction cancelled.', 'info');
                    setIsSubmitting(false);
                },
            });
        } catch (error) {
            showToast(`Failed to create market: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            setIsSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-background">
            <Navbar />
            <AuthGuard>
                <div className="container mx-auto px-4 py-12 max-w-2xl">
                    <h1 className="text-3xl font-bold mb-8">Create New Market</h1>

                    {txState.status === 'pending' && (
                        <div role="status" className="mb-6 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            <span>Transaction pending… <span className="font-mono text-sm">{txState.txId?.slice(0, 16)}…</span></span>
                        </div>
                    )}
                    {txState.status === 'success' && (
                        <div role="status" className="mb-6 p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <div>
                                <p className="font-semibold">Market confirmed on-chain!</p>
                                <p className="text-sm font-mono break-all mt-1">Tx: {txState.txId}</p>
                            </div>
                        </div>
                    )}
                    {txState.status === 'failed' && (
                        <div role="alert" className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 flex items-center gap-2">
                            <XCircle className="w-4 h-4 shrink-0" />
                            <span>{txState.error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} noValidate className="space-y-6">
                        <div className="p-6 rounded-xl border border-border space-y-5">

                            {/* Title */}
                            <div>
                                <label htmlFor="title" className="block text-sm font-medium mb-1">Question / Title</label>
                                <input
                                    id="title"
                                    name="title"
                                    type="text"
                                    value={form.title}
                                    onChange={handleChange}
                                    placeholder="e.g. Will Bitcoin be above $100k by end of 2025?"
                                    className="w-full px-4 py-2 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    aria-describedby={errors.title ? 'title-error' : undefined}
                                />
                                {errors.title && <p id="title-error" role="alert" className="mt-1 text-sm text-red-500">{errors.title}</p>}
                            </div>

                            {/* Description */}
                            <div>
                                <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
                                <textarea
                                    id="description"
                                    name="description"
                                    rows={3}
                                    value={form.description}
                                    onChange={handleChange}
                                    placeholder="Provide context and resolution criteria for this market."
                                    className="w-full px-4 py-2 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                    aria-describedby={errors.description ? 'description-error' : undefined}
                                />
                                {errors.description && <p id="description-error" role="alert" className="mt-1 text-sm text-red-500">{errors.description}</p>}
                            </div>

                            {/* Outcomes */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="outcomeA" className="block text-sm font-medium mb-1">Outcome A</label>
                                    <input
                                        id="outcomeA"
                                        name="outcomeA"
                                        type="text"
                                        value={form.outcomeA}
                                        onChange={handleChange}
                                        placeholder="e.g. Yes"
                                        className="w-full px-4 py-2 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        aria-describedby={errors.outcomeA ? 'outcomeA-error' : undefined}
                                    />
                                    {errors.outcomeA && <p id="outcomeA-error" role="alert" className="mt-1 text-sm text-red-500">{errors.outcomeA}</p>}
                                </div>
                                <div>
                                    <label htmlFor="outcomeB" className="block text-sm font-medium mb-1">Outcome B</label>
                                    <input
                                        id="outcomeB"
                                        name="outcomeB"
                                        type="text"
                                        value={form.outcomeB}
                                        onChange={handleChange}
                                        placeholder="e.g. No"
                                        className="w-full px-4 py-2 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        aria-describedby={errors.outcomeB ? 'outcomeB-error' : undefined}
                                    />
                                    {errors.outcomeB && <p id="outcomeB-error" role="alert" className="mt-1 text-sm text-red-500">{errors.outcomeB}</p>}
                                </div>
                            </div>

                            {/* Duration */}
                            <div>
                                <label htmlFor="duration" className="block text-sm font-medium mb-1">Duration (blocks)</label>
                                <input
                                    id="duration"
                                    name="duration"
                                    type="number"
                                    min={10}
                                    value={form.duration}
                                    onChange={handleChange}
                                    placeholder="e.g. 1440 (~10 days on Stacks)"
                                    className="w-full px-4 py-2 rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    aria-describedby={errors.duration ? 'duration-error' : undefined}
                                />
                                {errors.duration && <p id="duration-error" role="alert" className="mt-1 text-sm text-red-500">{errors.duration}</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
                            >
                                {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                                {isSubmitting ? 'Submitting…' : 'Create Market'}
                            </button>
                        </div>
                    </form>
                </div>
            </AuthGuard>
        </main>
    );
}
