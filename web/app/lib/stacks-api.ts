import { STACKS_MAINNET, STACKS_TESTNET, StacksNetwork } from "@stacks/network";
import { fetchCallReadOnlyFunction, cvToValue, uintCV, principalCV, ClarityValue } from "@stacks/transactions";
import { getRuntimeConfig } from "./runtime-config";

function getStacksNetwork(): StacksNetwork {
    const cfg = getRuntimeConfig();
    return cfg.network === 'testnet' ? STACKS_TESTNET : STACKS_MAINNET;
}

export interface Pool {
    id: number;
    title: string;
    description: string;
    creator: string;
    outcomeA: string;
    outcomeB: string;
    totalA: number;
    totalB: number;
    settled: boolean;
    winningOutcome: number | null;
    expiry: number;
}

export async function getPoolCount(): Promise<number> {
    try {
        const cfg = getRuntimeConfig();
        const network: StacksNetwork = getStacksNetwork();
        const result = await fetchCallReadOnlyFunction({
            contractAddress: cfg.contract.address,
            contractName: cfg.contract.name,
            functionName: 'get-pool-count',
            functionArgs: [],
            senderAddress: cfg.contract.address,
            network,
        });

        const value = cvToValue(result);
        return Number(value);
    } catch (e) {
        console.error("Failed to fetch pool count", e);
        return 0;
    }
}

export async function getPool(poolId: number): Promise<Pool | null> {
    try {
        const cfg = getRuntimeConfig();
        const network: StacksNetwork = getStacksNetwork();
        const result = await fetchCallReadOnlyFunction({
            contractAddress: cfg.contract.address,
            contractName: cfg.contract.name,
            functionName: 'get-pool',
            functionArgs: [uintCV(poolId)],
            senderAddress: cfg.contract.address,
            network,
        });

        const value = cvToValue(result, true); // true for readable format
        if (!value) return null;

        // Handle (some {...}) vs (none)
        // cvToValue with readable=true returns null for none, object for some
        return {
            id: poolId,
            title: value.title,
            description: value.description,
            creator: value.creator,
            outcomeA: value['outcome-a-name'],
            outcomeB: value['outcome-b-name'],
            totalA: Number(value['total-a']),
            totalB: Number(value['total-b']),
            settled: value.settled,
            winningOutcome: value['winning-outcome'] ?? null,
            expiry: Number(value.expiry ?? 0),
        };
    } catch (e) {
        console.error(`Failed to fetch pool ${poolId}`, e);
        return null;
    }
}

export async function fetchActivePools(): Promise<Pool[]> {
    const count = await getPoolCount();
    const pools: Pool[] = [];

    for (let i = count - 1; i >= 0; i--) {
        const pool = await getPool(i);
        if (pool) pools.push(pool);
    }
    return pools;
}

export interface UserBetData {
    amountA: number;
    amountB: number;
    totalBet: number;
}

export async function getUserBet(poolId: number, userAddress: string): Promise<UserBetData | null> {
    try {
        const cfg = getRuntimeConfig();
        const network: StacksNetwork = getStacksNetwork();
        const result = await fetchCallReadOnlyFunction({
            contractAddress: cfg.contract.address,
            contractName: cfg.contract.name,
            functionName: 'get-user-bet',
            functionArgs: [uintCV(poolId), principalCV(userAddress)],
            senderAddress: cfg.contract.address,
            network,
        });

        const value = cvToValue(result, true);
        if (!value) return null;

        return {
            amountA: Number(value['amount-a']),
            amountB: Number(value['amount-b']),
            totalBet: Number(value['total-bet']),
        };
    } catch (e) {
        console.error(`Failed to fetch user bet for pool ${poolId}`, e);
        return null;
    }
}

// --- Activity Feed ---

export interface ActivityItem {
    txId: string;
    type: 'bet-placed' | 'winnings-claimed' | 'pool-created' | 'contract-call';
    functionName: string;
    timestamp: number;
    status: 'success' | 'pending' | 'failed';
    amount?: number;
    poolId?: number;
    explorerUrl: string;
}

/**
 * Fetches recent on-chain activity for a user address by querying the
 * Stacks blockchain API for contract-call transactions targeting the
 * Predinex contract.
 */
export async function getUserActivity(
    userAddress: string,
    limit: number = 20
): Promise<ActivityItem[]> {
    try {
        const cfg = getRuntimeConfig();
        const explorerBase = cfg.api.explorerUrl;

        const url = `${cfg.api.coreApiUrl}/extended/v1/address/${userAddress}/transactions?limit=${limit}&type=contract_call`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Stacks API error: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const results: any[] = data.results || [];

        // Filter to only Predinex contract interactions
        const predinexTxs = results.filter((tx: any) => {
            const callInfo = tx.contract_call;
            if (!callInfo) return false;
            return callInfo.contract_id?.includes(cfg.contract.address);
        });

        return predinexTxs.map((tx: any): ActivityItem => {
            const callInfo = tx.contract_call;
            const fnName: string = callInfo?.function_name || 'unknown';

            let type: ActivityItem['type'] = 'contract-call';
            if (fnName === 'place-bet') type = 'bet-placed';
            else if (fnName === 'claim-winnings') type = 'winnings-claimed';
            else if (fnName === 'create-pool') type = 'pool-created';

            let status: ActivityItem['status'] = 'pending';
            if (tx.tx_status === 'success') status = 'success';
            else if (tx.tx_status === 'abort_by_response' || tx.tx_status === 'abort_by_post_condition') status = 'failed';

            // Extract amount from function args if available
            let amount: number | undefined;
            let poolId: number | undefined;
            const args: any[] = callInfo?.function_args || [];

            for (const arg of args) {
                if (arg.name === 'amount' && arg.repr) {
                    amount = Number(arg.repr.replace('u', ''));
                }
                if (arg.name === 'pool-id' && arg.repr) {
                    poolId = Number(arg.repr.replace('u', ''));
                }
            }

            return {
                txId: tx.tx_id,
                type,
                functionName: fnName,
                timestamp: tx.burn_block_time || Math.floor(Date.now() / 1000),
                status,
                amount,
                poolId,
                explorerUrl: `${explorerBase}/txid/${tx.tx_id}`,
            };
        });
    } catch (e) {
        console.error('Failed to fetch user activity', e);
        return [];
    }
}
