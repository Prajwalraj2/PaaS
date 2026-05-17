'use client';

import { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { projectsApi } from '@/lib/api/projects';
import { ProjectHeader } from '@/components/projects/project-header';
import { ProjectTabs } from '@/components/projects/project-tabs';

interface ProjectLayoutProps {
  children: ReactNode;
}

export default function ProjectLayout({ children }: ProjectLayoutProps) {
  const params = useParams();
  const projectId = params.projectId as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    refetchInterval: 5000, // Poll every 5 seconds for status updates
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.data.data) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-destructive">Project not found</p>
      </div>
    );
  }

  const project = data.data.data;

  return (
    <div className="space-y-6">
      <ProjectHeader project={project} />
      <ProjectTabs projectId={projectId} />
      <div className="pt-4">{children}</div>
    </div>
  );
}
