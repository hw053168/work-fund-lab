'use client'
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from './ConnectButton';
import { useTimeRange } from './TimeRangeProvider';

export function Navigation() {
  const pathname = usePathname();
  const { timeRange, setTimeRange } = useTimeRange();

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + '/');
  };

  const linkClass = (path: string) => {
    const base = 'px-4 py-2 rounded-md transition-colors duration-200';
    return isActive(path)
      ? `${base} bg-black text-white`
      : `${base} hover:bg-gray-200`;
  };

  return (
    <nav className="sticky top-0 z-40 bg-gray-50 border-b-2 border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-2xl font-bold">
              work-fund-lab
            </Link>
            <div className="hidden md:flex space-x-2">
              <Link href="/tracker" className={linkClass('/tracker')}>
                Global Browser
              </Link>
              <Link href="/dashboard/worker" className={linkClass('/dashboard/worker')}>
                Worker
              </Link>
              <Link href="/dashboard/oracle" className={linkClass('/dashboard/oracle')}>
                Oracle
              </Link>
              <Link href="/dashboard/funder" className={linkClass('/dashboard/funder')}>
                Funder
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600 hidden sm:inline">Time Range:</span>
              <select 
                value={timeRange} 
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="bg-white border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-black"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="3d">Last 3 Days</option>
                <option value="7d">Last 7 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
