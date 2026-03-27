'use client'

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { useBlockNumber } from 'wagmi';

export type TimeRange = '24h' | '3d' | '7d' | 'all';

interface TimeRangeContextType {
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  minBlock: bigint | undefined;
  isReady: boolean; // True when block number is available (or not needed for 'all')
}

const TimeRangeContext = createContext<TimeRangeContextType | undefined>(undefined);

export function TimeRangeProvider({ children }: { children: ReactNode }) {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const { data: currentBlock, isSuccess } = useBlockNumber({ watch: true });

  const minBlock = useMemo(() => {
    if (!currentBlock) return undefined;
    // ~7200 blocks per day (12s block time)
    if (timeRange === '24h') return currentBlock - 7200n;
    if (timeRange === '3d') return currentBlock - 21600n;
    if (timeRange === '7d') return currentBlock - 50400n;
    // 'all' -> return a sentinel value of 0n to indicate "use deployment block"
    return 0n;
  }, [currentBlock, timeRange]);

  // isReady = true when we have the block number
  const isReady = isSuccess;

  return (
    <TimeRangeContext.Provider value={{ timeRange, setTimeRange, minBlock, isReady }}>
      {children}
    </TimeRangeContext.Provider>
  );
}

export function useTimeRange() {
  const context = useContext(TimeRangeContext);
  if (context === undefined) {
    throw new Error('useTimeRange must be used within a TimeRangeProvider');
  }
  return context;
}
