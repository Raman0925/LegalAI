'use client';

import Link from 'next/link';
import { SignOutButton } from '@/components/SignOutButton';
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Settings,
  FolderOpen,
  Briefcase,
  Search,
} from 'lucide-react';

export type DashboardTab = 'overview' | 'chat' | 'reviewer' | 'profile';
export type DashboardSection = DashboardTab | 'documents' | 'matters' | 'research';

interface SidebarProps {
  active: DashboardSection;
  userProfile: { fullName: string; email: string };
  // Pass onSelectTab when rendering inside the tabbed /dashboard page so the
  // four tab links switch in-place instead of navigating. Omit it (e.g. from
  // /dashboard/documents) and they become links back to /dashboard.
  onSelectTab?: (tab: DashboardTab) => void;
}

const TAB_ITEMS: { key: DashboardTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'chat', label: 'AI Chat Assistant', icon: MessageSquare },
  { key: 'reviewer', label: 'Document Reviewer', icon: FileText },
  { key: 'profile', label: 'Settings', icon: Settings },
];

function navClasses(isActive: boolean) {
  return `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
    isActive
      ? 'bg-zinc-800 text-white shadow-inner border border-zinc-700/50'
      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
  }`;
}

export function Sidebar({ active, userProfile, onSelectTab }: SidebarProps) {
  return (
    <aside className="w-full md:w-64 bg-zinc-900/60 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col justify-between backdrop-blur-xl shrink-0">
      <div>
        {/* Brand header */}
        <div className="p-6 flex items-center gap-3 border-b border-zinc-800/60">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/10">
            <span className="text-lg text-white" role="img" aria-label="gavel">
              ⚖️
            </span>
          </div>
          <div>
            <h2 className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              LegalAI
            </h2>
            <span className="text-[10px] text-violet-400 font-mono tracking-wider uppercase font-semibold">
              Enterprise v1.0
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1">
          {TAB_ITEMS.map(({ key, label, icon: Icon }) =>
            onSelectTab ? (
              <button
                key={key}
                onClick={() => onSelectTab(key)}
                className={navClasses(active === key)}
              >
                <Icon className="h-4.5 w-4.5" />
                <span>{label}</span>
              </button>
            ) : (
              <Link key={key} href="/dashboard" className={navClasses(active === key)}>
                <Icon className="h-4.5 w-4.5" />
                <span>{label}</span>
              </Link>
            ),
          )}
          <Link href="/dashboard/documents" className={navClasses(active === 'documents')}>
            <FolderOpen className="h-4.5 w-4.5" />
            <span>Document Library</span>
          </Link>
          <Link href="/dashboard/matters" className={navClasses(active === 'matters')}>
            <Briefcase className="h-4.5 w-4.5" />
            <span>Matters</span>
          </Link>
          <Link href="/research" className={navClasses(active === 'research')}>
            <Search className="h-4.5 w-4.5" />
            <span>Research Sessions</span>
          </Link>
        </nav>
      </div>

      {/* User Footer Panel */}
      <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/40">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-inner uppercase">
            {userProfile.fullName
              ? userProfile.fullName[0]
              : userProfile.email
                ? userProfile.email[0]
                : 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-zinc-200 truncate">
              {userProfile.fullName || 'Authorized User'}
            </p>
            <p className="text-[10px] text-zinc-500 truncate">{userProfile.email}</p>
          </div>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
