// Enhanced Stacks API integration for Market Discovery System

import { STACKS_MAINNET, STACKS_TESTNET, StacksNetwork } from "@stacks/network";
import { fetchCallReadOnlyFunction, cvToValue, uintCV } from "@stacks/transactions";
import { PoolData } from "./market-types";
import { getRuntimeConfig } from "./runtime-config";

function getStacksNetwork(): StacksNetwork {
  const { network } = getRuntimeConfig();
  return network === 'testnet' ? STACKS_TESTNET : STACKS_MAINNET;
}

/**
 * Get total number of pools from the contract
 */
export async function getPoolCount(): Promise<number> {
  try {
    const cfg = getRuntimeConfig();
    const network = getStacksNetwork();
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

/**
 * Get individual pool data with enhanced type safety
 */
export async function getEnhancedPool(poolId: number): Promise<PoolData | null> {
  try {
    const cfg = getRuntimeConfig();
    const network = getStacksNetwork();
    const result = await fetchCallReadOnlyFunction({
      contractAddress: cfg.contract.address,
      contractName: cfg.contract.name,
      functionName: 'get-pool',
      functionArgs: [uintCV(poolId)],
      senderAddress: cfg.contract.address,
      network,
    });

    const value = cvToValue(result, true);
    if (!value) return null;

    return {
      poolId,
      creator: value.creator,
      title: value.title,
      description: value.description,
      outcomeAName: value['outcome-a-name'],
      outcomeBName: value['outcome-b-name'],
      totalA: BigInt(value['total-a'] || 0),
      totalB: BigInt(value['total-b'] || 0),
      settled: value.settled,
      winningOutcome: value['winning-outcome'] ?? null,
      createdAt: Number(value['created-at'] || 0),
      settledAt: value['settled-at'] ? Number(value['settled-at']) : null,
      expiry: Number(value.expiry || 0),
    };
  } catch (e) {
    console.error(`Failed to fetch pool ${poolId}`, e);
    return null;
  }
}

/**
 * Get multiple pools efficiently using batch fetching
 */
export async function getPoolsBatch(startId: number, count: number): Promise<PoolData[]> {
  try {
    const cfg = getRuntimeConfig();
    const network = getStacksNetwork();
    // Try to use the batch function if available
    const result = await fetchCallReadOnlyFunction({
      contractAddress: cfg.contract.address,
      contractName: cfg.contract.name,
      functionName: 'get-pools-batch',
      functionArgs: [uintCV(startId), uintCV(count)],
      senderAddress: cfg.contract.address,
      network,
    });

    const value = cvToValue(result, true);
    if (!value || !Array.isArray(value)) {
      // Fallback to individual fetching
      return await getPoolsIndividually(startId, count);
    }

    const pools: PoolData[] = [];
    for (let i = 0; i < value.length; i++) {
      const poolData = value[i];
      if (poolData) {
        pools.push({
          poolId: startId + i,
          creator: poolData.creator,
          title: poolData.title,
          description: poolData.description,
          outcomeAName: poolData['outcome-a-name'],
          outcomeBName: poolData['outcome-b-name'],
          totalA: BigInt(poolData['total-a'] || 0),
          totalB: BigInt(poolData['total-b'] || 0),
          settled: poolData.settled,
          winningOutcome: poolData['winning-outcome'] ?? null,
          createdAt: Number(poolData['created-at'] || 0),
          settledAt: poolData['settled-at'] ? Number(poolData['settled-at']) : null,
          expiry: Number(poolData.expiry || 0),
        });
      }
    }

    return pools;
  } catch (e) {
    console.error(`Failed to fetch pools batch ${startId}-${startId + count}`, e);
    // Fallback to individual fetching
    return await getPoolsIndividually(startId, count);
  }
}

/**
 * Fallback method to fetch pools individually
 */
async function getPoolsIndividually(startId: number, count: number): Promise<PoolData[]> {
  const pools: PoolData[] = [];
  const promises: Promise<PoolData | null>[] = [];

  for (let i = 0; i < count; i++) {
    promises.push(getEnhancedPool(startId + i));
  }

  const results = await Promise.all(promises);
  
  for (const pool of results) {
    if (pool) {
      pools.push(pool);
    }
  }

  return pools;
}

/**
 * Fetch all pools with pagination support
 */
export async function fetchAllPools(page: number = 0, pageSize: number = 50): Promise<PoolData[]> {
  const totalCount = await getPoolCount();
  if (totalCount === 0) return [];

  const startId = Math.max(0, totalCount - 1 - (page * pageSize));
  const endId = Math.max(0, startId - pageSize + 1);
  const actualCount = startId - endId + 1;

  if (actualCount <= 0) return [];

  const pools = await getPoolsBatch(endId, actualCount);
  
  // Sort by pool ID descending (newest first)
  return pools.sort((a, b) => b.poolId - a.poolId);
}

/**
 * Get pool statistics using enhanced contract function
 */
export async function getPoolStats(poolId: number): Promise<{
  totalPool: number;
  percentageA: number;
  percentageB: number;
} | null> {
  try {
    const cfg = getRuntimeConfig();
    const network = getStacksNetwork();
    const result = await fetchCallReadOnlyFunction({
      contractAddress: cfg.contract.address,
      contractName: cfg.contract.name,
      functionName: 'get-pool-stats',
      functionArgs: [uintCV(poolId)],
      senderAddress: cfg.contract.address,
      network,
    });

    const value = cvToValue(result, true);
    if (!value) return null;

    return {
      totalPool: Number(value['total-pool'] || 0),
      percentageA: Number(value['percentage-a'] || 0),
      percentageB: Number(value['percentage-b'] || 0),
    };
  } catch (e) {
    console.error(`Failed to fetch pool stats ${poolId}`, e);
    return null;
  }
}