import { FundStatus, FundRole } from "@/type";

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function trimAddress(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-4)}`;
}

export function formatNumber(x: string | number, maxDecimals: number = 8): string {
  // Parse the number
  const num = typeof x === 'number' ? x : parseFloat(x);
  if (isNaN(num)) return String(x);
  
  // For zero, just return "0"
  if (num === 0) return "0";
  
  // Determine appropriate decimal places based on value magnitude
  // Show more decimals for smaller values, fewer for larger values
  let decimals: number;
  const absNum = Math.abs(num);
  
  if (absNum >= 1000) {
    decimals = 2; // Large values: 2 decimals
  } else if (absNum >= 1) {
    decimals = 4; // Medium values: 4 decimals
  } else if (absNum >= 0.0001) {
    decimals = 6; // Small values: 6 decimals
  } else {
    decimals = maxDecimals; // Very small values: use max decimals
  }
  
  // Cap at maxDecimals
  decimals = Math.min(decimals, maxDecimals);
  
  // Format with calculated decimals, then trim trailing zeros
  const rounded = num.toFixed(decimals);
  // Remove trailing zeros after decimal, but keep at least 2 decimals for readability
  const trimmed = rounded.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  
  // Add thousand separators
  const parts = trimmed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join('.');
}

export function isObject(v: any): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function encodeRole(s: FundRole): number {
  if (s === 'worker') {
    return 0;
  } else if (s === 'oracle') {
    return 1;
  } else if (s === 'funder') {
    return 2;
  } else {
    return 3;
  }
}

export function parseStatus(s: number): FundStatus {
  if (s === 0) {
    return 'pending';
  } else if (s === 1) {
    return 'active';
  } else {
    return 'closed';
  }
}

export function nextPermitTime(): bigint {
  // const nowTime = Date.now();
  // const tomTime = new Date(Date.UTC(nowTime.getUTCFullYear(), nowTime.getUTCMonth(), nowTime.getUTCDate() + 1, 0, 0, 0, 0));
  // const timestamp = Math.floor(tomTime.getTime() / 1000);
  const timestamp = Math.floor(Date.now() / 1000) + 3600;
  return BigInt(timestamp);
}
