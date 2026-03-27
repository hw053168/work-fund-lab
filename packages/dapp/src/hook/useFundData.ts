import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { readContract, readContracts, getPublicClient, watchContractEvent, getChainId } from '@wagmi/core';
import { parseAbiItem, type Address, createPublicClient, http, fallback, encodeEventTopics, decodeEventLog, toHex } from 'viem';
import { sepolia } from 'viem/chains';
import { useEffect } from 'react';
import { useChainContracts } from './wallet';
import Contracts from '@/../chain/contracts';
import { encodeRole, parseStatus, isObject } from "@/lib/util";
import { ERC20_METADATA_ABI } from "@/lib/erc20";
import { APPKIT_WAGMI, PINATA } from "@/cfg";
import { FundStaticData, FundFullData, TermsData, TokenData, FundRole } from "@/type";

// Create a dedicated public client for Sepolia that routes through our internal API proxy
// This solves CORS issues and hides API keys
const PROXY_RPC = '/api/rpc';

const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(PROXY_RPC, {
    timeout: 30000, // 30 seconds timeout
    retryCount: 3,
    retryDelay: 1000,
  }),
});

// Helper for batched async operations to prevent RPC rate limiting
async function batch<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batchItems = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batchItems.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// Helper to make direct HTTP RPC calls via our proxy
async function fetchRpc(method: string, params: any[] = [], retries = 3) {
  // console.log(`[fetchRpc] Proxying ${method} with params:`, params);
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(PROXY_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
      });

      // Handle 400 errors (Alchemy block range limits, etc.)
      // For eth_getLogs, return empty array instead of throwing
      if (response.status === 400) {
        if (method === 'eth_getLogs') {
          console.warn(`[fetchRpc] eth_getLogs returned 400 (block range limit?). Returning empty.`);
          return []; // Return empty logs instead of throwing
        }
        throw new Error(`HTTP status ${response.status}`);
      }

      if (!response.ok) {
        // Handle 429 Rate Limit specifically
        if (response.status === 429) {
          const delay = 1000 * Math.pow(2, i); // Exponential backoff: 1s, 2s, 4s
          console.warn(`[fetchRpc] Rate limited (429). Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`HTTP status ${response.status}`);
      }
      
      const data = await response.json();
      if (data.error) {
        // Handle RPC-level rate limits or temporary errors
        if (data.error.code === 429 || data.error.message?.includes('rate limit')) {
          const delay = 1000 * Math.pow(2, i);
          console.warn(`[fetchRpc] RPC Rate limit. Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        // Handle Alchemy block range errors gracefully for eth_getLogs
        if (method === 'eth_getLogs' && data.error.message?.includes('block range')) {
          console.warn(`[fetchRpc] eth_getLogs block range error. Returning empty.`);
          return []; // Return empty logs instead of throwing
        }
        throw new Error(data.error.message || 'RPC Error');
      }
      
      return data.result;
    } catch (e: any) {
      // Don't retry on fatal errors, only network/rate limits
      if (i === retries - 1) {
        console.error(`[fetchRpc] Proxy failed after ${retries} attempts:`, e);
        throw e;
      }
      // Retry on network errors
      const delay = 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Simple cache for block number to prevent spamming the RPC
let cachedBlockNumber: bigint | null = null;
let cachedBlockNumberTimestamp = 0;
let pendingBlockNumberPromise: Promise<bigint> | null = null;

async function getCachedBlockNumber(client: any): Promise<bigint> {
  const now = Date.now();
  // Return cached value if it's less than 10 seconds old
  if (cachedBlockNumber !== null && (now - cachedBlockNumberTimestamp < 10000)) {
    return cachedBlockNumber;
  }
  
  // Return pending promise if one exists to deduplicate concurrent requests
  if (pendingBlockNumberPromise) {
    return pendingBlockNumberPromise;
  }

  pendingBlockNumberPromise = (async () => {
    try {
      // Use direct HTTP fetch instead of client.getBlockNumber() to debug timeouts
      // const blockNumber = await client.getBlockNumber();
      const hexBlock = await fetchRpc('eth_blockNumber', []);
      const blockNumber = BigInt(hexBlock);
      
      cachedBlockNumber = blockNumber;
      cachedBlockNumberTimestamp = Date.now();
      return blockNumber;
    } catch (e) {
      console.warn('[getCachedBlockNumber] Failed to fetch block number', e);
      if (cachedBlockNumber !== null) return cachedBlockNumber;
      throw e; // Throw so react-query can retry instead of returning 0
    } finally {
      pendingBlockNumberPromise = null;
    }
  })();
  
  return pendingBlockNumberPromise;
}

// Simple concurrency limiter to prevent RPC rate limiting
class RequestQueue {
  private queue: (() => Promise<void>)[] = [];
  private activeCount = 0;
  private maxConcurrent = 1; // Max 1 concurrent request to be safe with free tier

  add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        this.activeCount++;
        try {
          const result = await fn();
          resolve(result);
        } catch (e) {
          reject(e);
        } finally {
          this.activeCount--;
          this.next();
        }
      };

      if (this.activeCount < this.maxConcurrent) {
        task();
      } else {
        this.queue.push(task);
      }
    });
  }

  private next() {
    if (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      task?.();
    }
  }
}

const rpcQueue = new RequestQueue();

// Helper to fetch logs in chunks to avoid RPC range limits (e.g. 10k blocks)
async function fetchLogsChunked(
  client: any,
  params: { address: Address; event: any; args?: any; fromBlock: bigint; toBlock?: bigint | 'latest' }
): Promise<any[]> {
  // Add random jitter (0-500ms) to prevent thundering herd when multiple hooks fire at once
  await new Promise(r => setTimeout(r, Math.floor(Math.random() * 500)));

  console.log('[fetchLogsChunked] Starting, fromBlock:', params.fromBlock.toString());
  // Alchemy Free tier only allows 10 block range for eth_getLogs!
  // But we'd need ~500k calls to cover all blocks. Instead, we'll just skip
  // the timestamp fetching if it fails - funds will still be discovered.
  const MAX_BLOCK_RANGE = 10n; // Alchemy Free tier limit
  
  // Use cached block number to avoid RPC spam
  const latestBlock = await getCachedBlockNumber(client);
  
  console.log('[fetchLogsChunked] latestBlock:', latestBlock.toString());
  const endBlock = params.toBlock === 'latest' || !params.toBlock ? latestBlock : params.toBlock;
  const startBlock = params.fromBlock;

  if (startBlock > endBlock) {
    console.log('[fetchLogsChunked] startBlock > endBlock, returning []');
    return [];
  }

  // Prepare topics for raw RPC call
  const topics = encodeEventTopics({
    abi: [params.event],
    eventName: params.event.name,
    args: params.args
  });

  const fetchChunk = async (from: bigint, to: bigint) => {
    const filter = {
      address: params.address,
      fromBlock: toHex(from),
      toBlock: toHex(to),
      topics
    };

    const rawLogs = await fetchRpc('eth_getLogs', [filter]);
    
    if (!Array.isArray(rawLogs)) {
      console.warn('[fetchLogsChunked] Expected array but got:', rawLogs);
      return [];
    }

    // Decode logs using viem
    return rawLogs.map((log: any) => {
      try {
        const decoded = decodeEventLog({
          abi: [params.event],
          data: log.data,
          topics: log.topics
        }) as any;
        return {
          ...log,
          args: decoded.args,
          eventName: decoded.eventName,
          blockNumber: BigInt(log.blockNumber),
          transactionIndex: BigInt(log.transactionIndex),
          logIndex: BigInt(log.logIndex)
        };
      } catch (e) {
        console.warn('[fetchLogsChunked] Failed to decode log:', e);
        return null;
      }
    }).filter((l: any) => l !== null);
  };

  // Optimization: If range is small enough, just do one call
  if (endBlock - startBlock <= MAX_BLOCK_RANGE) {
    console.log('[fetchLogsChunked] Small range, doing single getLogs call...');
    try {
      const result = await rpcQueue.add<any[]>(() => fetchChunk(startBlock, endBlock));
      console.log('[fetchLogsChunked] Single call returned', result.length, 'logs');
      return result;
    } catch (e) {
      console.error('[fetchLogsChunked] Single call FAILED:', e);
      return [];
    }
  }

  console.log('[fetchLogsChunked] Large range, chunking...');
  
  // Create all chunk promises
  const chunkPromises: Promise<any[]>[] = [];
  let currentStart = startBlock;
  let chunkNum = 0;

  while (currentStart <= endBlock) {
    const currentEnd = currentStart + MAX_BLOCK_RANGE > endBlock ? endBlock : currentStart + MAX_BLOCK_RANGE;
    chunkNum++;
    
    // Create a closure to capture currentStart/End
    const fetchThisChunk = async (start: bigint, end: bigint, num: number) => {
      try {
        // console.log(`[fetchLogsChunked] Queueing chunk ${num}: ${start}-${end}`);
        const chunk = await rpcQueue.add<any[]>(() => fetchChunk(start, end));
        // console.log(`[fetchLogsChunked] Chunk ${num} done, got ${chunk.length} logs`);
        return chunk;
      } catch (e) {
        console.error(`[fetchLogsChunked] Chunk ${num} (${start}-${end}) FAILED:`, e);
        // Return empty array on failure to allow other chunks to succeed? 
        // Or throw to fail the whole query? 
        // For now, return empty but log error. Ideally we should retry.
        return []; 
      }
    };

    chunkPromises.push(fetchThisChunk(currentStart, currentEnd, chunkNum));
    currentStart = currentEnd + 1n;
  }

  // Execute all chunks (concurrency limited by rpcQueue)
  console.log(`[fetchLogsChunked] Created ${chunkPromises.length} chunk tasks`);
  const results = await Promise.all(chunkPromises);
  
  const allLogs = results.flat();
  console.log('[fetchLogsChunked] All chunks done, total logs:', allLogs.length);
  return allLogs;
}

// Block numbers for when contracts were deployed on each chain
// This prevents slow queries from block 0 on public networks
export const DEPLOYMENT_BLOCKS: Record<number, bigint> = {
  11155111: 5000000n, // Sepolia - Lowered to cover legacy funds
  1: 0n, // Mainnet - update when deployed
};

// Legacy FundFactory addresses that still have funds we want to display
// These are previous deployments before contract upgrades
const LEGACY_FACTORY_ADDRESSES: Record<number, Address[]> = {
  11155111: [
    '0x0fFBB917970CD533714D67eC79897C12d54a3bD5', // Original Sepolia deployment (7 funds)
    '0x1816313C1b0381ED86cAFE7ae4037BFe5b6b830F', // Version 2 (2 funds)
    '0x4d462b917582331811De6A32DE4D4Fe7735f8950', // Old v3 - had mainnet addresses (1 fund)
    '0x9786331bfFaE2bF8E3fa561483bD2F5080b5E761', // Old v4 - had mainnet addresses (0 funds)
  ],
  1: [], // Mainnet - add legacy addresses when needed
};

export interface DepositEvent {
  token: Address;
  funder: Address;
  amount: bigint;
  blockNumber: bigint;
  transactionHash: string;
  timestamp?: number;
}

export interface WithdrawalEvent {
  amount: bigint;
  blockNumber: bigint;
  transactionHash: string;
  timestamp?: number;
}

export interface RefundEvent {
  refunder: Address;
  amount: bigint;
  blockNumber: bigint;
  transactionHash: string;
  timestamp?: number;
}

export interface FundBasicInfo {
  address: Address;
  timestamp: number;
  blockNumber: bigint;
}

// Hook to get all deployed fund addresses from FundFactory (including legacy factories)
// Note: fromBlockOverride is accepted but NOT used for filtering fund discovery.
// All funds are always returned. The time range is only used elsewhere for event queries.
export function useAllFunds(fromBlockOverride?: bigint) {
  const chainContracts = useChainContracts();
  // Fallback to Sepolia contracts if wallet is not connected
  const contracts = chainContracts || Contracts[11155111];
  
  console.log('[useAllFunds] Hook called, contracts available:', !!contracts, 'fromBlockOverride:', fromBlockOverride?.toString());

  return useQuery({
    queryKey: ['allFunds'], // No time range in key - we always fetch all funds
    queryFn: async () => {
      console.log('[useAllFunds] queryFn STARTED');
      if (!contracts) throw new Error('Chain contracts not loaded');

      // Use dedicated Sepolia client instead of wagmi's getPublicClient
      const publicClient = sepoliaClient;
      const chainId = 11155111; // Sepolia
      
      const currentFactoryAddress = contracts.FundFactory.address as Address;
      const legacyFactories = LEGACY_FACTORY_ADDRESSES[chainId] ?? [];
      // Always use deployment block to find ALL funds (not filtered by time range)
      const fromBlock = DEPLOYMENT_BLOCKS[chainId] ?? 0n;
      
      console.log('[useAllFunds] chainId:', chainId, 'fromBlock:', fromBlock.toString(), 'currentFactory:', currentFactoryAddress);
      
      // Query all factories in chronological order (Legacy -> Current)
      // This ensures that when we reverse the final list, we get Newest -> Oldest
      const allFactories = [...legacyFactories, currentFactoryAddress];
      // const allFactories = [currentFactoryAddress];
      console.log('[useAllFunds] allFactories:', allFactories);
      
      // Process factories SEQUENTIALLY to avoid RPC rate limiting
      const results: FundBasicInfo[][] = [];
      for (const factoryAddress of allFactories) {
        try {
          console.log('[useAllFunds] Fetching instances from factory:', factoryAddress);
          // 1. Get all instances using publicClient directly (more reliable than wagmi readContract)
          let instances: Address[];
          try {
            instances = await publicClient.readContract({
              address: factoryAddress,
              abi: [{ inputs: [], name: 'instances', outputs: [{ type: 'address[]' }], stateMutability: 'view', type: 'function' }],
              functionName: 'instances',
              args: [],
            }) as Address[];
          } catch (contractError) {
            // Contract might be destroyed, have different ABI, or not exist
            console.warn('[useAllFunds] Failed to read from factory', factoryAddress, '- skipping:', contractError);
            results.push([]);
            continue;
          }
          console.log('[useAllFunds] Got', instances.length, 'instances from', factoryAddress);

          if (instances.length === 0) {
            results.push([]);
            continue;
          }

          // SKIP event log fetching - Alchemy Free tier only allows 10 block range
          // which makes timestamp fetching impractical (would need 500k+ calls).
          // Just return instances without timestamps.
          console.log('[useAllFunds] Returning', instances.length, 'instances without timestamps (RPC limited)');
          results.push(instances.map(addr => ({ address: addr, timestamp: 0, blockNumber: 0n })));
          continue; // Skip to next factory

          /* DISABLED: Log-based timestamp fetching (requires paid RPC)
          // 2. Get logs to determine creation time
          let logs: any[] = [];
          try {
            console.log('[useAllFunds] Fetching logs for factory:', factoryAddress, 'fromBlock:', fromBlock.toString());
            logs = await fetchLogsChunked(publicClient, {
              address: factoryAddress,
              event: parseAbiItem('event Deploy(address indexed worker, address indexed oracle)'),
              fromBlock,
              toBlock: 'latest',
            });
            console.log('[useAllFunds] Got', logs.length, 'logs from', factoryAddress);
          } catch (logError) {
            console.warn(`Failed to fetch logs for factory ${factoryAddress}`, logError);
            // Still return instances even without timestamps
            results.push(instances.map(addr => ({ address: addr, timestamp: 0, blockNumber: 0n })));
            continue;
          }

          // 3. Fetch block timestamps (Batched!)
          const blockNumbers = [...new Set(logs.map(l => l.blockNumber))];
          const blockTimestamps = new Map<bigint, number>();
          
          try {
            // Batch getBlock calls to avoid rate limiting (batch size 5)
            await batch(blockNumbers, 5, async (bn) => {
               const block = await publicClient.getBlock({ blockNumber: bn });
               blockTimestamps.set(bn, Number(block.timestamp));
            });
          } catch (blockError) {
             console.warn(`Failed to fetch block timestamps for factory ${factoryAddress}`, blockError);
          }

          // 4. Map logs to instances (from the end)
          // We assume the logs found correspond to the most recent instances
          const count = Math.min(logs.length, instances.length);
          const startIndex = instances.length - count;
          
          // Funds with logs (Recent)
          const factoryFunds = logs.map((log, i) => {
             if (i >= count) return null;
             const instanceIndex = startIndex + i;
             const addr = instances[instanceIndex];
             const timestamp = blockTimestamps.get(log.blockNumber) || 0;
             return { address: addr, timestamp, blockNumber: log.blockNumber };
          }).filter((item): item is FundBasicInfo => item !== null);

          // Funds without logs (Older than fromBlock)
          const olderFunds = [];
          for (let i = 0; i < startIndex; i++) {
            olderFunds.push({
              address: instances[i],
              timestamp: 0, // Unknown timestamp
              blockNumber: 0n // Unknown block
            });
          }
          
          console.log(`[useAllFunds] Factory ${factoryAddress}: ${olderFunds.length} older funds, ${factoryFunds.length} recent funds`);
          results.push([...olderFunds, ...factoryFunds]);
          /* END DISABLED */

        } catch (e) {
          console.error(`Failed to fetch funds for factory ${factoryAddress}`, e);
          results.push([]);
        }
      }

      // Flatten and dedupe
      const allFunds = results.flat();
      
      // Reverse to get Newest -> Oldest (Structural sort fallback)
      // Since we processed factories Oldest -> Newest, and instances are Oldest -> Newest,
      // reversing gives us Newest -> Oldest.
      allFunds.reverse();

      const uniqueFunds = new Map<string, FundBasicInfo>();
      
      allFunds.forEach(f => {
        if (!uniqueFunds.has(f.address)) {
            uniqueFunds.set(f.address, f);
        }
      });
      
      const finalResult = Array.from(uniqueFunds.values());
      console.log('[useAllFunds] queryFn COMPLETED, returning', finalResult.length, 'funds');
      return finalResult;
    },
    enabled: !!contracts, // Enable if we have contracts (either from wallet or fallback)
    staleTime: 300000, // Cache for 5 minutes to reduce RPC calls
    refetchOnWindowFocus: false, // Disable to reduce RPC spam
  });
}

export function useRoleFunds(address: Address | null, role: FundRole, fromBlockOverride?: bigint) {
  const chainContracts = useChainContracts();
  const contracts = chainContracts || Contracts[11155111];

  return useQuery({
    queryKey: ['roleFunds', address, role, fromBlockOverride?.toString()],
    queryFn: async () => {
      if (!contracts || !address) throw new Error('Missing dependencies');

      const chainId = 11155111; // Default to Sepolia
      const publicClient = sepoliaClient;

      const currentFactoryAddress = contracts.FundFactory.address as Address;
      const legacyFactories = LEGACY_FACTORY_ADDRESSES[chainId] ?? [];
      
      // const allFactories = [...legacyFactories, currentFactoryAddress];
      const allFactories = [currentFactoryAddress];

      const results: Address[][] = [];
      for (const factoryAddress of allFactories) {
        try {
          // 1. Get all instances for this user & role
          // Use publicClient (Proxy) instead of wagmi readContract to avoid wallet dependency
          let allInstances: Address[];
          try {
            allInstances = await publicClient.readContract({
              address: factoryAddress,
              abi: [{
                inputs: [
                  { type: 'address', name: 'account' },
                  { type: 'uint8', name: 'role' }
                ],
                name: 'instances',
                outputs: [{ type: 'address[]' }],
                stateMutability: 'view',
                type: 'function'
              }],
              functionName: 'instances',
              args: [address, encodeRole(role)],
            }) as Address[];
          } catch (contractError) {
            // Contract might be destroyed, have different ABI, or not exist
            console.warn('[useRoleFunds] Failed to read from factory', factoryAddress, '- skipping:', contractError);
            results.push([]);
            continue;
          }

          if (allInstances.length === 0) {
            results.push([]);
            continue;
          }

          // SKIP log-based filtering - Alchemy Free tier block range limits make this impractical
          // Just return all instances for this user & role
          results.push(allInstances);
          continue;

          /* DISABLED: Log-based time filtering (requires paid RPC)
          // 2. If no filter, return all
          if (!fromBlockOverride) {
            results.push(allInstances);
            continue;
          }

          // 3. If filter exists, fetch logs to count how many are in range
          const logs = await fetchLogsChunked(publicClient, {
            address: factoryAddress,
            event: parseAbiItem('event Deploy(address indexed worker, address indexed oracle)'),
            args: role === 'worker' ? { worker: address } : { oracle: address },
            fromBlock: fromBlockOverride,
            toBlock: 'latest',
          });

          // Return the last N instances, where N is the number of logs found in range
          if (logs.length === 0) {
            // If we are filtering by time and found no logs, return empty
            // UNLESS the filter is very old (e.g. 0), in which case we might want to show everything?
            // For now, strict filtering is safer for "Recent Activity" views.
            results.push([]);
            continue;
          }
          
          // Safety check: don't slice more than available
          const count = Math.min(logs.length, allInstances.length);
          results.push(allInstances.slice(allInstances.length - count));
          /* END DISABLED */

        } catch (e) {
          console.warn(`Failed to fetch role funds for factory ${factoryAddress}`, e);
          results.push([]);
        }
      }

      // Flatten and dedupe
      const flat = results.flat();
      return flat.reverse();
    },
    enabled: !!contracts && !!address,
    staleTime: 300000, // Cache for 5 minutes to reduce RPC calls
    refetchOnWindowFocus: false, // Disable to reduce RPC spam
  });
}

export function useRoleFundsFull(address: Address | null, role: FundRole, fromBlockOverride?: bigint) {
  const chainContracts = useChainContracts();
  const contracts = chainContracts || Contracts[11155111];
  
  const { data: roleFunds, isSuccess: isRoleFundsAvailable, isPending: isRoleFundsPending, isLoading: isRoleFundsLoading, isError: isRoleFundsError } = useRoleFunds(address, role, fromBlockOverride);

  const { data: roleFullFunds, isSuccess: isRoleFullFundsAvailable, ...rolesFullQuery } = useQueries({
    queries: (roleFunds || [])?.map((fundAddress) => ({
      queryKey: ['fundStatic', fundAddress],
      queryFn: async () => {
        if (!contracts || !fundAddress) throw new Error('Missing dependencies');
        const fundData = await queryFundStaticData({
          address: fundAddress,
          contracts: contracts,
        });
        return fundData;
      },
      enabled: !!contracts && isRoleFundsAvailable,
      staleTime: 300000, // Cache for 5 minutes to reduce RPC calls
    })),
    combine: (results) => ({
      data: results.map((result) => result.data),
      isPending: results.some((result) => result.isPending),
      isLoading: results.some((result) => (!result.data || result.isLoading)),
      isSuccess: results.every((result, i) => (!!result.data && result.isSuccess)),
      isError: results.some((result) => result.isError),
    }),
  });

  const { data: roleFundTerms, ...rolesFundTermsQuery } = useQueries({
    queries: (roleFullFunds || [])?.map((fund) => ({
      queryKey: ['terms', fund?.terms],
      queryFn: async () => {
        if (!fund?.terms) throw new Error('Missing dependencies');
        const termsData = await queryTermsData({ cid: fund.terms });
        return termsData;
      },
      enabled: isRoleFullFundsAvailable,
      staleTime: 300000, // Cache for 5 minute (static data doesn't change often)
    })),
    combine: (results) => ({
      data: results.map((result) => result.data),
      errors: results.map((result) => result.error),
      isPending: results.some((result) => result.isPending),
      isLoading: results.some((result) => (!result.data || result.isLoading)),
      isSuccess: results.every((result) => (!!result.data && result.isSuccess)),
      isError: results.some((result) => result.isError),
    }),
  });
  const { data: roleFundTokens, ...rolesFundTokensQuery } = useQueries({
    queries: (roleFullFunds || [])?.map((fund) => ({
      queryKey: ['token', fund?.payoutToken],
      queryFn: async () => {
        if (!contracts || !fund?.payoutToken) throw new Error('Missing dependencies');
        const tokenData = await queryTokenData({
          address: fund.payoutToken,
          contracts: contracts,
        });
        return tokenData;
      },
      enabled: !!contracts && isRoleFullFundsAvailable,
      staleTime: 300000, // Cache for 5 minute (static data doesn't change often)
    })),
    combine: (results) => ({
      data: results.map((result) => result.data),
      errors: results.map((result) => result.error),
      isPending: results.some((result) => result.isPending),
      isLoading: results.some((result) => (!result.data || result.isLoading)),
      isSuccess: results.every((result) => (!!result.data && result.isSuccess)),
      isError: results.some((result) => result.isError),
    }),
  });

  return {
    data: (roleFullFunds || []).map((f, i) => ({
      termsData: (roleFundTerms || [])?.[i],
      tokenData: (roleFundTokens || [])?.[i],
      ...f,
    })),
    isPending: isRoleFundsPending || [rolesFullQuery, rolesFundTermsQuery, rolesFundTokensQuery].some((q) => q.isPending),
    isLoading: isRoleFundsLoading || [rolesFullQuery, rolesFundTermsQuery, rolesFundTokensQuery].some((q) => q.isLoading),
    isSuccess: isRoleFundsAvailable && [rolesFullQuery, rolesFundTermsQuery, rolesFundTokensQuery].every((q) => !q.isPending && !q.isError),
    isError: isRoleFundsError || [rolesFullQuery, rolesFundTermsQuery, rolesFundTokensQuery].some((q) => q.isError),
  };
}

export function useFundFullData(fundAddress: Address | null) {
  return null; // TODO
}

// Hook to get static fund data (cached with React Query)
export function useFundStaticData(fundAddress: Address | null) {
  const chainContracts = useChainContracts();

  return useQuery({
    queryKey: ['fundStatic', fundAddress],
    queryFn: async () => {
      if (!chainContracts || !fundAddress) throw new Error('Missing dependencies');
      const fundData = await queryFundStaticData({
        address: fundAddress,
        contracts: chainContracts,
      });
      return fundData;
    },
    enabled: !!chainContracts && !!fundAddress,
    staleTime: 300000, // Cache for 5 minutes (static data doesn't change often)
  });
}

export function useTermsData(termsCid: string | null) {
  return useQuery({
    queryKey: ['terms', termsCid],
    queryFn: async () => {
      if (!termsCid) throw new Error('Missing dependencies');
      const termsData = await queryTermsData({ cid: termsCid });
      return termsData;
    },
    enabled: !!termsCid,
    staleTime: 300000, // Cache for 5 minute (static data doesn't change often)
  });
}

// Hook to get token data (cached)
export function useTokenData(tokenAddress: Address | null) {
  const chainContracts = useChainContracts();
  const contracts = chainContracts || Contracts[11155111];

  return useQuery({
    queryKey: ['token', tokenAddress],
    queryFn: async () => {
      if (!contracts || !tokenAddress) throw new Error('Missing dependencies');
      const tokenData = await queryTokenData({
        address: tokenAddress,
        contracts: contracts,
      });
      return tokenData;
    },
    enabled: !!contracts && !!tokenAddress,
    staleTime: Infinity, // Token data never changes
  });
}

// Hook to get fund events (deposits, withdrawals, refunds)
// Uses limited block range (100 blocks) to work with Alchemy Free tier
// The server-side proxy caches responses to reduce rate limiting
export function useFundEvents(fundAddress: Address | null, fromBlockOverride?: bigint) {
  const chainContracts = useChainContracts();
  const contracts = chainContracts || Contracts[11155111];

  return useQuery({
    queryKey: ['fundEvents', fundAddress, fromBlockOverride?.toString()],
    queryFn: async () => {
      if (!contracts || !fundAddress) {
        return { deposits: [] as DepositEvent[], withdrawals: [] as WithdrawalEvent[], refunds: [] as RefundEvent[] };
      }

      try {
        // Get current block number
        const currentBlockHex = await fetchRpc('eth_blockNumber');
        const currentBlock = BigInt(currentBlockHex);
        
        // Fetch last 1000 blocks (~2.5 hours on Sepolia) - single request to minimize RPC calls
        // Alchemy Free tier has a 2000 block limit, so 1000 is safe
        const TOTAL_BLOCKS = 1000n;
        const fromBlock = fromBlockOverride ?? (currentBlock > TOTAL_BLOCKS ? currentBlock - TOTAL_BLOCKS : 0n);
        
        console.log(`[useFundEvents] Fetching events for ${fundAddress} from block ${fromBlock} to ${currentBlock}`);

        const fundAbi = contracts.Fund.abi;

        // Encode event topics
        const depositTopic = encodeEventTopics({
          abi: fundAbi,
          eventName: 'Deposit'
        })[0];
        const withdrawalTopic = encodeEventTopics({
          abi: fundAbi,
          eventName: 'Withdrawal'
        })[0];
        const refundTopic = encodeEventTopics({
          abi: fundAbi,
          eventName: 'Refund'
        })[0];

        // Fetch all event types - single request per type (1000 blocks is within Alchemy limits)
        const deposits: DepositEvent[] = [];
        const withdrawals: WithdrawalEvent[] = [];
        const refunds: RefundEvent[] = [];

        // Fetch Deposits
        const depositLogs = await fetchRpc('eth_getLogs', [{
          address: fundAddress,
          topics: [depositTopic],
          fromBlock: toHex(fromBlock),
          toBlock: toHex(currentBlock),
        }]);

        for (const log of depositLogs || []) {
          try {
            const decoded = decodeEventLog({
              abi: fundAbi,
              data: log.data,
              topics: log.topics,
            }) as { eventName: string; args?: { token: Address; from: Address; amount: bigint } };
            if (decoded.eventName === 'Deposit' && decoded.args) {
              deposits.push({
                funder: decoded.args.from,
                token: decoded.args.token,
                amount: decoded.args.amount,
                blockNumber: BigInt(log.blockNumber),
                transactionHash: log.transactionHash,
              });
            }
          } catch (e) {
            console.warn('[useFundEvents] Failed to decode deposit log:', e);
          }
        }

        // Fetch Withdrawals
        const withdrawalLogs = await fetchRpc('eth_getLogs', [{
          address: fundAddress,
          topics: [withdrawalTopic],
          fromBlock: toHex(fromBlock),
          toBlock: toHex(currentBlock),
        }]);

        for (const log of withdrawalLogs || []) {
          try {
            const decoded = decodeEventLog({
              abi: fundAbi,
              data: log.data,
              topics: log.topics,
            }) as { eventName: string; args?: { amount: bigint } };
            if (decoded.eventName === 'Withdrawal' && decoded.args) {
              withdrawals.push({
                amount: decoded.args.amount,
                blockNumber: BigInt(log.blockNumber),
                transactionHash: log.transactionHash,
              });
            }
          } catch (e) {
            console.warn('[useFundEvents] Failed to decode withdrawal log:', e);
          }
        }

        // Fetch Refunds
        const refundLogs = await fetchRpc('eth_getLogs', [{
          address: fundAddress,
          topics: [refundTopic],
          fromBlock: toHex(fromBlock),
          toBlock: toHex(currentBlock),
        }]);

        for (const log of refundLogs || []) {
          try {
            const decoded = decodeEventLog({
              abi: fundAbi,
              data: log.data,
              topics: log.topics,
            }) as { eventName: string; args?: { refunder: Address; amount: bigint } };
            if (decoded.eventName === 'Refund' && decoded.args) {
              refunds.push({
                refunder: decoded.args.refunder,
                amount: decoded.args.amount,
                blockNumber: BigInt(log.blockNumber),
                transactionHash: log.transactionHash,
              });
            }
          } catch (e) {
            console.warn('[useFundEvents] Failed to decode refund log:', e);
          }
        }

        console.log(`[useFundEvents] Found ${deposits.length} deposits, ${withdrawals.length} withdrawals, ${refunds.length} refunds`);
        return { deposits, withdrawals, refunds };
      } catch (error) {
        console.error('[useFundEvents] Error fetching events:', error);
        // Return empty on error instead of throwing
        return { deposits: [] as DepositEvent[], withdrawals: [] as WithdrawalEvent[], refunds: [] as RefundEvent[] };
      }
    },
    enabled: !!contracts && !!fundAddress,
    staleTime: 300000, // Cache for 5 minutes to reduce RPC calls
    refetchOnWindowFocus: false, // Don't refetch on focus to reduce RPC calls
  });
}

// Hook to watch for real-time events
export function useFundEventWatcher(fundAddress: Address | null) {
  const chainContracts = useChainContracts();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!chainContracts || !fundAddress) return;

    // Watch for Deposit events
    const unwatchDeposit = watchContractEvent(APPKIT_WAGMI.wagmiConfig, {
      address: fundAddress,
      abi: chainContracts.Fund.abi,
      eventName: 'Deposit',
      onLogs: (logs) => {
        console.log('New Deposit event:', logs);
        // Invalidate queries to refetch data
        queryClient.invalidateQueries({ queryKey: ['fundEvents', fundAddress] });
      },
    });

    // Watch for Withdrawal events
    const unwatchWithdrawal = watchContractEvent(APPKIT_WAGMI.wagmiConfig, {
      address: fundAddress,
      abi: chainContracts.Fund.abi,
      eventName: 'Withdrawal',
      onLogs: (logs) => {
        console.log('New Withdrawal event:', logs);
        queryClient.invalidateQueries({ queryKey: ['fundEvents', fundAddress] });
      },
    });

    // Watch for Refund events
    const unwatchRefund = watchContractEvent(APPKIT_WAGMI.wagmiConfig, {
      address: fundAddress,
      abi: chainContracts.Fund.abi,
      eventName: 'Refund',
      onLogs: (logs) => {
        console.log('New Refund event:', logs);
        queryClient.invalidateQueries({ queryKey: ['fundEvents', fundAddress] });
      },
    });

    // Cleanup watchers on unmount
    return () => {
      unwatchDeposit();
      unwatchWithdrawal();
      unwatchRefund();
    };
  }, [chainContracts, fundAddress, queryClient]);
}

async function queryFundStaticData({
  address,
  contracts,
}: {
  address: Address;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contracts: any;
}): Promise<FundStaticData | null> {
  console.log('[queryFundStaticData] Fetching for', address);
  try {
    const results = await readContracts(APPKIT_WAGMI.wagmiConfig, {
      allowFailure: true,
      contracts: [
        { address, abi: contracts.Fund.abi, functionName: 'worker', args: [] },
        { address, abi: contracts.Fund.abi, functionName: 'oracle', args: [] },
        { address, abi: contracts.Fund.abi, functionName: 'oracleCut', args: [] },
        { address, abi: contracts.Fund.abi, functionName: 'payoutToken', args: [] },
        { address, abi: contracts.Fund.abi, functionName: 'funds', args: [] },
        { address, abi: contracts.Fund.abi, functionName: 'terms', args: [] },
        { address, abi: contracts.Fund.abi, functionName: 'status', args: [] },
      ]
    });

    // Check if the critical calls failed (worker, oracle, payoutToken, terms, status)
    // If these fail, the fund contract is likely destroyed or incompatible
    const criticalIndices = [0, 1, 3, 5, 6]; // worker, oracle, payoutToken, terms, status
    const criticalFailures = criticalIndices.filter(i => results[i].status === 'failure');
    if (criticalFailures.length > 0) {
      console.warn(`[queryFundStaticData] Fund ${address} has ${criticalFailures.length} critical failures - likely destroyed or incompatible`);
      return null;
    }

    // Check for non-critical failures (log but don't fail)
    results.forEach((r, i) => {
      if (r.status === 'failure') {
        // Don't log error for 'funds' (index 4) as it's expected to fail for legacy funds
        if (i !== 4) {
          console.error(`[queryFundStaticData] Failed to fetch index ${i} for ${address}:`, r.error);
        }
      }
    });

    return {
      address: address,
      worker: results[0].result as Address,
      oracle: results[1].result as Address,
      oracleCut: results[2].result as bigint,
      payoutToken: results[3].result as Address,
      // If 'funds' call succeeds, use it. If it fails (legacy), default to 0n.
      fundsAvailable: results[4].status === 'success' ? results[4].result as bigint : 0n,
      terms: results[5].result as string,
      status: parseStatus(results[6].result as number),
    } as FundStaticData;
  } catch (e) {
    // Multicall can fail entirely if the contract doesn't exist
    console.error('[queryFundStaticData] CRITICAL FAILURE for', address, ':', e);
    return null;
  }
}

async function queryTermsData({
  cid,
}: {
  cid: string;
}): Promise<TermsData> {
  let termsData: TermsData = { cid: cid, text: cid };

  try {
    const { data, contentType: mime } = await PINATA.gateways.public.get(cid);
    if (mime === "application/json" && isObject(data)) {
      const dataUrl = await PINATA.gateways.public.convert(cid);
      termsData.url = dataUrl;

      const jsonData = data as any;
      if (jsonData?.schema === "fund-plaintext" && jsonData?.version === 0) {
        termsData = {
          ...termsData,
          title: jsonData?.terms?.title,
          text: jsonData?.terms?.text ?? termsData.text,
        };
      } else if (jsonData?.schema === "fund-milestones" && jsonData?.version === 0) {
        const summary = jsonData.meta?.summary;
        const milestones = jsonData.meta?.milestones || [];
        // Format the milestones text
        const milestonesList = milestones.map((m: any, idx: number) => {
          return `${idx + 1}. ${m.terms} (Target: ${m.target})`;
        }).join('\n');

        const termsText = `${
          !summary ? '' : `${`Summary: ${summary}\n\n`}`
        }Milestones:\n${milestonesList}`;

        termsData = {
          ...termsData,
          title: jsonData.meta?.title,
          text: termsText,
        };
      }
    }
  } catch (err: any) {
    console.error('Unable to fetch terms:', err);
  }

  return termsData;
}

export async function queryTokenData({
  address,
}: {
  address: Address;
  contracts?: unknown; // kept for backwards compatibility, but not used
}): Promise<TokenData> {
  try {
    const results = await readContracts(APPKIT_WAGMI.wagmiConfig, {
      allowFailure: true,
      contracts: [
        { address, abi: ERC20_METADATA_ABI, functionName: 'name', args: [] },
        { address, abi: ERC20_METADATA_ABI, functionName: 'symbol', args: [] },
        { address, abi: ERC20_METADATA_ABI, functionName: 'decimals', args: [] },
      ]
    });

    return {
      name: results[0].result as string,
      symbol: results[1].result as string,
      decimals: BigInt(results[2].result as number | bigint || 18),
    } as TokenData;
  } catch (e) {
    console.error('[queryTokenData] Failed:', e);
    return { name: 'Unknown', symbol: '???', decimals: 18n };
  }
}
