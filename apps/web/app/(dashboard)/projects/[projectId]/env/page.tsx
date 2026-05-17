'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { projectsApi } from '@/lib/api/projects';
import { getErrorMessage } from '@/lib/api/client';
import type { SetEnvVarInput } from '@/lib/types';

export default function EnvVarsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['env-vars', projectId],
    queryFn: () => projectsApi.listEnvVars(projectId),
  });

  const envVars = data?.data.data || [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SetEnvVarInput>();

  const createMutation = useMutation({
    mutationFn: (data: SetEnvVarInput) => projectsApi.setEnvVar(projectId, data),
    onSuccess: () => {
      toast.success('Environment variable saved');
      queryClient.invalidateQueries({ queryKey: ['env-vars', projectId] });
      setIsDialogOpen(false);
      reset();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => projectsApi.deleteEnvVar(projectId, key),
    onSuccess: () => {
      toast.success('Environment variable deleted');
      queryClient.invalidateQueries({ queryKey: ['env-vars', projectId] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const toggleVisibility = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const onSubmit = (data: SetEnvVarInput) => {
    createMutation.mutate({ ...data, isSecret: true });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Environment Variables</CardTitle>
              <CardDescription>
                Manage environment variables for your application
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Variable
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSubmit(onSubmit)}>
                  <DialogHeader>
                    <DialogTitle>Add Environment Variable</DialogTitle>
                    <DialogDescription>
                      Add a new environment variable to your project
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="key">Key</Label>
                      <Input
                        id="key"
                        placeholder="DATABASE_URL"
                        {...register('key', {
                          required: 'Key is required',
                          pattern: {
                            value: /^[A-Z][A-Z0-9_]*$/,
                            message:
                              'Must start with uppercase letter, only uppercase letters, numbers, underscores',
                          },
                        })}
                      />
                      {errors.key && (
                        <p className="text-sm text-destructive">
                          {errors.key.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="value">Value</Label>
                      <Input
                        id="value"
                        placeholder="postgres://..."
                        {...register('value', {
                          required: 'Value is required',
                        })}
                      />
                      {errors.value && (
                        <p className="text-sm text-destructive">
                          {errors.value.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {envVars.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="mx-auto h-8 w-8 mb-2" />
              <p>No environment variables configured</p>
              <p className="text-sm mt-1">
                Add variables like DATABASE_URL, API_KEY, etc.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {envVars.map((envVar) => (
                    <TableRow key={envVar.id}>
                      <TableCell className="font-mono text-sm">
                        {envVar.key}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {envVar.isSecret && !visibleKeys.has(envVar.key) ? (
                          <span className="text-muted-foreground">••••••••</span>
                        ) : (
                          <span className="break-all">{envVar.value}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={envVar.isSecret ? 'secondary' : 'outline'}>
                          {envVar.isSecret ? 'Secret' : 'Visible'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {envVar.isSecret && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleVisibility(envVar.key)}
                            >
                              {visibleKeys.has(envVar.key) ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(envVar.key)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-4">
                Changes require a new deployment to take effect.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
