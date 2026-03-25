import {
  fetchCallReadOnlyFunction,
  cvToJSON,
  uintCV,
  ClarityValue,
  ClarityType
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import { getRuntimeConfig } from '../app/lib/runtime-config';

const runtimeConfig = getRuntimeConfig();
const NETWORK = runtimeConfig.network === 'testnet' ? STACKS_TESTNET : STACKS_MAINNET;
const CONTRACT_ADDRESS = runtimeConfig.contract.address;
const CONTRACT_NAME = runtimeConfig.contract.name;

export interface Pool {
  id: number;
  title: string;
  description: string;
  creator: string;
  outcomeA: string;
  outcomeB: string;
  totalA: number;
  totalB: number;
  expiry: number;
  settled: boolean;
  winningOutcome?: number;
  status: 'active' | 'settled' | 'expired';
}

function parsePoolCV(poolCV: any, id: number): Pool {
  const data = poolCV.value.data;
  const burnHeight = 1000000; // Mock current block height if needed, or fetch it

  const expiry = Number(data.expiry.value);
  const settled = data.settled.type === ClarityType.BoolTrue;
  const winningOutcomeCV = data['winning-outcome'];
  let winningOutcome: number | undefined = undefined;

  if (winningOutcomeCV && winningOutcomeCV.type === ClarityType.OptionalSome) {
    winningOutcome = Number(winningOutcomeCV.value.value);
  }

  let status: 'active' | 'settled' | 'expired' = 'active';
  if (settled) status = 'settled';

  return {
    id,
    title: data.title.value,
    description: data.description.value,
    creator: data.creator.value,
    outcomeA: data['outcome-a-name'].value,
    outcomeB: data['outcome-b-name'].value,
    totalA: Number(data['total-a'].value),
    totalB: Number(data['total-b'].value),
    expiry: expiry,
    settled: settled,
    winningOutcome: winningOutcome,
    status: status
  };
}

export async function getPool(id: number): Promise<Pool | null> {
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-pool-details',
      functionArgs: [uintCV(id)],
      network: NETWORK,
      senderAddress: CONTRACT_ADDRESS,
    });

    if (result.type === ClarityType.OptionalSome) {
      return parsePoolCV(result, id);
    }
    return null;
  } catch (error) {
    console.error(`Error fetching pool ${id}:`, error);
    return null;
  }
}

export async function getMarkets(filter: string): Promise<Pool[]> {
  try {
    const counterResult = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-pool-counter',
      functionArgs: [],
      network: NETWORK,
      senderAddress: CONTRACT_ADDRESS,
    });

    let count = 0;
    if (counterResult.type === ClarityType.ResponseOk) {
      // @ts-ignore
      count = Number(counterResult.value.value);
    } else {
      // Fallback to manual probing if counter fails
      count = 20;
    }

    const pools: Pool[] = [];
    // pool-id starts from 1 in the contract
    for (let i = 1; i < count; i++) {
      const pool = await getPool(i);
      if (pool) {
        pools.push(pool);
      }
    }

    if (filter === 'active') return pools.filter(p => !p.settled);
    if (filter === 'settled') return pools.filter(p => p.settled);

    return pools;
  } catch (error) {
    console.error("Error fetching markets:", error);
    return [];
  }
}
export async function getTotalVolume(): Promise<number> {
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'get-total-volume',
      functionArgs: [],
      network: NETWORK,
      senderAddress: CONTRACT_ADDRESS,
    });

    if (result.type === ClarityType.ResponseOk) {
      // @ts-ignore
      return Number(result.value.value);
    }
    return 0;
  } catch (error) {
    console.error("Error fetching total volume:", error);
    return 0;
  }
}
