'use client';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User } from 'next-auth';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, CircleUserRound, LogOut, Settings, UserRound } from 'lucide-react';

export default function DashboardHeader({ user }: { user?: User }) {
  const router = useRouter();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    signOut({ redirect: false }).then(() => router.push('/login'));
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setIsAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const displayName = user?.name || 'Account';
  const initials = displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header className="bg-white border-b border-slate-200 px-4 py-4 sm:px-6 flex justify-between items-center gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">JengaSafi</p>
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900">Construction carbon intelligence</h1>
      </div>
      <div className="relative" ref={accountRef}>
        <button
          type="button"
          aria-expanded={isAccountOpen}
          aria-haspopup="menu"
          aria-label={`Open account menu for ${displayName}`}
          onClick={() => setIsAccountOpen((open) => !open)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800" aria-hidden="true">{initials || <CircleUserRound className="h-5 w-5" />}</span>
          <span className="hidden sm:block">
            <span className="block text-sm font-semibold text-slate-900">{displayName}</span>
            <span className="block text-xs text-slate-500">{user?.role || 'Account'}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
        </button>
        {isAccountOpen && (
          <div role="menu" aria-label="Account options" className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
            <Link href="/dashboard/profile" role="menuitem" onClick={() => setIsAccountOpen(false)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              <UserRound className="h-4 w-4" aria-hidden="true" /> My Profile
            </Link>
            <button type="button" role="menuitem" onClick={() => setIsAccountOpen(false)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              <Settings className="h-4 w-4" aria-hidden="true" /> Account Settings <span className="ml-auto text-[10px] uppercase tracking-wide">Soon</span>
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button type="button" role="menuitem" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
              <LogOut className="h-4 w-4" aria-hidden="true" /> Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}