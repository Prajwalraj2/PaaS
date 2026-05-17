'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface ProjectTabsProps {
  projectId: string;
}

const tabs = [
  { name: 'Overview', href: '' },
  { name: 'Deployments', href: '/deployments' },
  { name: 'Environment', href: '/env' },
  { name: 'Domains', href: '/domains' },
  { name: 'Services', href: '/services' },
  { name: 'Settings', href: '/settings' },
];

export function ProjectTabs({ projectId }: ProjectTabsProps) {
  const pathname = usePathname();
  const basePath = `/projects/${projectId}`;

  return (
    <div className="border-b">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => {
          const href = `${basePath}${tab.href}`;
          const isActive =
            tab.href === ''
              ? pathname === basePath
              : pathname.startsWith(href);

          return (
            <Link
              key={tab.name}
              href={href}
              className={cn(
                'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
              )}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
