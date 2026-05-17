'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { GitBranch, ExternalLink, Circle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Project } from '@/lib/types';

interface ProjectCardProps {
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

export function ProjectCard({ project }: ProjectCardProps) {
  const projectUrl = project.subdomain
    ? `http://${project.subdomain}.paas.localhost`
    : null;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="transition-all hover:border-primary/50 hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">{project.name}</CardTitle>
              <CardDescription className="text-xs">
                {project.slug}
              </CardDescription>
            </div>
            <Badge variant="outline" className="flex items-center gap-1.5">
              <Circle
                className={`h-2 w-2 fill-current ${statusColors[project.status]}`}
              />
              {statusLabels[project.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            <span className="truncate">{project.gitBranch}</span>
          </div>

          {projectUrl && project.status === 'running' && (
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <span className="truncate text-primary">{projectUrl}</span>
            </div>
          )}

          <div className="pt-2 text-xs text-muted-foreground">
            Created {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
