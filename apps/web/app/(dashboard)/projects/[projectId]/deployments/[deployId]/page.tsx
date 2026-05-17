'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  GitCommit,
  GitBranch,
  User,
  Clock,
  ExternalLink,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { deploymentsApi } from '@/lib/api/deployments';
import { getErrorMessage } from '@/lib/api/client';
import { BuildLogs } from '@/components/deployments/build-logs';

export default function DeploymentDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const deployId = params.deployId as string;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['deployment', projectId, deployId],
    queryFn: () => deploymentsApi.get(projectId, deployId),
    refetchInterval: (query) => {
      const deployment = query.state.data?.data.data;
      if (
        deployment?.buildStatus === 'building' ||
        deployment?.buildStatus === 'queued' ||
        deployment?.deployStatus === 'deploying'
      ) {
        return 3000;
      }
      return false;
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: () => deploymentsApi.rollback(projectId, deployId),
    onSuccess: () => {
      toast.success('Rollback initiated');
      queryClient.invalidateQueries({ queryKey: ['deployments', projectId] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => deploymentsApi.cancel(projectId, deployId),
    onSuccess: () => {
      toast.success('Deployment cancelled');
      queryClient.invalidateQueries({ queryKey: ['deployment', projectId, deployId] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const deployment = data?.data.data;

  if (!deployment) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Deployment not found</p>
      </div>
    );
  }

  const isInProgress =
    deployment.buildStatus === 'building' ||
    deployment.buildStatus === 'queued' ||
    deployment.deployStatus === 'deploying';

  const canRollback =
    deployment.buildStatus === 'success' &&
    deployment.deployStatus === 'live' &&
    !deployment.isCurrent;

  const canCancel = isInProgress;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectId}/deployments`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">
                Deployment {deployment.gitCommitSha?.slice(0, 7) || deployment.id.slice(0, 8)}
              </h2>
              {deployment.isCurrent && (
                <Badge variant="default">Current</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              {format(new Date(deployment.createdAt), 'PPpp')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canCancel && (
            <Button
              variant="outline"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Cancel
            </Button>
          )}
          {canRollback && (
            <Button
              variant="outline"
              onClick={() => rollbackMutation.mutate()}
              disabled={rollbackMutation.isPending}
            >
              {rollbackMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Rollback
            </Button>
          )}
          {deployment.appUrl && deployment.deployStatus === 'live' && (
            <Button asChild>
              <a href={deployment.appUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open App
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Build Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge
                variant={
                  deployment.buildStatus === 'success'
                    ? 'default'
                    : deployment.buildStatus === 'failed'
                    ? 'destructive'
                    : 'secondary'
                }
                className="text-sm"
              >
                {deployment.buildStatus}
              </Badge>
              {deployment.buildDurationMs && (
                <span className="text-sm text-muted-foreground">
                  {Math.round(deployment.buildDurationMs / 1000)}s
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deploy Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                deployment.deployStatus === 'live'
                  ? 'default'
                  : deployment.deployStatus === 'failed'
                  ? 'destructive'
                  : 'secondary'
              }
              className="text-sm"
            >
              {deployment.deployStatus}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Git Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Git Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <GitCommit className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Commit:</span>
              <code className="text-sm font-mono">
                {deployment.gitCommitSha || 'N/A'}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Branch:</span>
              <span className="text-sm">{deployment.gitBranch || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Author:</span>
              <span className="text-sm">{deployment.gitAuthor || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Triggered:</span>
              <span className="text-sm capitalize">
                {deployment.triggeredBy || 'unknown'}
              </span>
            </div>
          </div>
          {deployment.gitCommitMessage && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-1">Commit Message</p>
              <p className="text-sm">{deployment.gitCommitMessage}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Build Logs */}
      <BuildLogs
        projectId={projectId}
        deploymentId={deployId}
        isBuilding={isInProgress}
      />
    </div>
  );
}
