'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Terminal } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { deploymentsApi } from '@/lib/api/deployments';

interface BuildLogsProps {
  projectId: string;
  deploymentId: string;
  isBuilding: boolean;
}

const levelColors: Record<string, string> = {
  info: 'text-gray-300',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  debug: 'text-gray-500',
};

export function BuildLogs({ projectId, deploymentId, isBuilding }: BuildLogsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['build-logs', projectId, deploymentId],
    queryFn: () => deploymentsApi.getLogs(projectId, deploymentId, { limit: 1000 }),
    refetchInterval: isBuilding ? 2000 : false,
  });

  const logs = data?.data.data?.logs || [];

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Card className="bg-gray-950 border-gray-800">
      <CardHeader className="border-b border-gray-800 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-gray-200 flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Build Logs
            {isBuilding && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            )}
          </CardTitle>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800"
            />
            Auto-scroll
          </label>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-[400px] overflow-y-auto font-mono text-sm"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No logs available
            </div>
          ) : (
            <div className="p-4 space-y-0.5">
              {logs.map((log) => (
                <div key={log.id} className="flex">
                  <span className="text-gray-600 mr-3 select-none shrink-0">
                    [{formatTimestamp(log.timestamp)}]
                  </span>
                  <span className={levelColors[log.level] || 'text-gray-300'}>
                    {log.message}
                  </span>
                </div>
              ))}
              {isBuilding && (
                <div className="flex items-center gap-2 text-gray-400 pt-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Waiting for more logs...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
