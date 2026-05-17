'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  GitBranch,
  Clock,
  Server,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { projectsApi } from '@/lib/api/projects';
import { deploymentsApi } from '@/lib/api/deployments';

export default function ProjectOverviewPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const { data: statsData } = useQuery({
    queryKey: ['deployment-stats', projectId],
    queryFn: () => deploymentsApi.getStats(projectId),
  });

  const { data: deploymentsData } = useQuery({
    queryKey: ['deployments', projectId, { limit: 5 }],
    queryFn: () => deploymentsApi.list(projectId, { limit: 5 }),
  });

  const project = projectData?.data.data;
  const stats = statsData?.data.data;
  const recentDeployments = deploymentsData?.data.data || [];

  if (!project) return null;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deploys</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.successful || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.failed || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.inProgress || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Project Info */}
        <Card>
          <CardHeader>
            <CardTitle>Project Info</CardTitle>
            <CardDescription>Configuration and settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <GitBranch className="h-4 w-4" />
                Branch
              </span>
              <span className="font-medium">{project.gitBranch}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Server className="h-4 w-4" />
                Instance
              </span>
              <Badge variant="secondary" className="capitalize">
                {project.instanceType}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                Created
              </span>
              <span className="text-sm">
                {formatDistanceToNow(new Date(project.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>

            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground mb-1">Repository</p>
              <a
                href={project.gitRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline break-all"
              >
                {project.gitRepoUrl}
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Recent Deployments */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Deployments</CardTitle>
            <CardDescription>Last 5 deployment attempts</CardDescription>
          </CardHeader>
          <CardContent>
            {recentDeployments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No deployments yet
              </p>
            ) : (
              <div className="space-y-3">
                {recentDeployments.map((deployment) => (
                  <div
                    key={deployment.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {deployment.gitCommitSha?.slice(0, 7) || 'N/A'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(deployment.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <Badge
                      variant={
                        deployment.deployStatus === 'live'
                          ? 'default'
                          : deployment.buildStatus === 'failed' ||
                            deployment.deployStatus === 'failed'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {deployment.deployStatus === 'live'
                        ? 'Live'
                        : deployment.buildStatus === 'building'
                        ? 'Building'
                        : deployment.buildStatus === 'failed'
                        ? 'Build Failed'
                        : deployment.deployStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
