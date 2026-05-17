'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink, Circle, Rocket, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { deploymentsApi } from '@/lib/api/deployments';
import { getErrorMessage } from '@/lib/api/client';
import type { Project } from '@/lib/types';

interface ProjectHeaderProps {
  project: Project;
}

const statusColors: Record<Project['status'], string> = {
  inactive: 'bg-gray-500',
  building: 'bg-yellow-500 animate-pulse',
  deploying: 'bg-blue-500 animate-pulse',
  running: 'bg-green-500',
  failed: 'bg-red-500',
  stopped: 'bg-gray-500',
};

const statusLabels: Record<Project['status'], string> = {
  inactive: 'Inactive',
  building: 'Building',
  deploying: 'Deploying',
  running: 'Running',
  failed: 'Failed',
  stopped: 'Stopped',
};

export function ProjectHeader({ project }: ProjectHeaderProps) {
  const queryClient = useQueryClient();

  const deployMutation = useMutation({
    mutationFn: () => deploymentsApi.trigger(project.id),
    onSuccess: () => {
      toast.success('Deployment started!');
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      queryClient.invalidateQueries({ queryKey: ['deployments', project.id] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const projectUrl = project.subdomain
    ? `http://${project.subdomain}.paas.localhost`
    : null;

  const isDeploying = project.status === 'building' || project.status === 'deploying';

  return (
    <div className="space-y-4">
      {/* Back Button & Title */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/projects">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{project.name}</h1>
              <Badge variant="outline" className="flex items-center gap-1.5">
                <Circle
                  className={`h-2 w-2 fill-current ${statusColors[project.status]}`}
                />
                {statusLabels[project.status]}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">{project.slug}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {projectUrl && project.status === 'running' && (
            <Button variant="outline" asChild>
              <a href={projectUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open App
              </a>
            </Button>
          )}
          <Button
            onClick={() => deployMutation.mutate()}
            disabled={deployMutation.isPending || isDeploying}
          >
            {deployMutation.isPending || isDeploying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="mr-2 h-4 w-4" />
            )}
            {isDeploying ? 'Deploying...' : 'Deploy'}
          </Button>
        </div>
      </div>

      {/* Project URL */}
      {projectUrl && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">URL:</span>
          <a
            href={projectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {projectUrl}
          </a>
        </div>
      )}
    </div>
  );
}
