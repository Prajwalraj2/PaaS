'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { Loader2, Clock, GitCommit, User, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { deploymentsApi } from '@/lib/api/deployments';
import type { Deployment } from '@/lib/types';

const buildStatusColors: Record<Deployment['buildStatus'], string> = {
  queued: 'bg-gray-500',
  building: 'bg-yellow-500',
  success: 'bg-green-500',
  failed: 'bg-red-500',
  cancelled: 'bg-gray-500',
};

const deployStatusColors: Record<Deployment['deployStatus'], string> = {
  pending: 'bg-gray-500',
  deploying: 'bg-blue-500',
  live: 'bg-green-500',
  failed: 'bg-red-500',
  rolled_back: 'bg-orange-500',
};

export default function DeploymentsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { data, isLoading } = useQuery({
    queryKey: ['deployments', projectId],
    queryFn: () => deploymentsApi.list(projectId, { limit: 50 }),
    refetchInterval: 5000,
  });

  const deployments = data?.data.data || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (deployments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No deployments yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Click the Deploy button to create your first deployment
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deployment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Triggered</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deployments.map((deployment) => (
              <TableRow key={deployment.id}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <GitCommit className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">
                        {deployment.gitCommitSha?.slice(0, 7) || 'N/A'}
                      </span>
                      {deployment.isCurrent && (
                        <Badge variant="default" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    {deployment.gitCommitMessage && (
                      <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                        {deployment.gitCommitMessage}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge
                      variant="outline"
                      className="w-fit flex items-center gap-1.5"
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          buildStatusColors[deployment.buildStatus]
                        }`}
                      />
                      Build: {deployment.buildStatus}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="w-fit flex items-center gap-1.5"
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          deployStatusColors[deployment.deployStatus]
                        }`}
                      />
                      Deploy: {deployment.deployStatus}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  {deployment.buildDurationMs ? (
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {Math.round(deployment.buildDurationMs / 1000)}s
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="capitalize">
                        {deployment.triggeredBy || 'unknown'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(deployment.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/projects/${projectId}/deployments/${deployment.id}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
