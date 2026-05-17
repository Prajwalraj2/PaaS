'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { projectsApi } from '@/lib/api/projects';
import { getErrorMessage } from '@/lib/api/client';
import type { UpdateProjectInput } from '@/lib/types';

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
  });

  const project = data?.data.data;

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateProjectInput>({
    values: project
      ? {
          gitBranch: project.gitBranch,
          buildCommand: project.buildCommand || '',
          startCommand: project.startCommand || '',
          instanceType: project.instanceType,
          port: project.port,
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateProjectInput) =>
      projectsApi.update(projectId, data),
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.delete(projectId),
    onSuccess: () => {
      toast.success('Project deleted');
      router.push('/projects');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const onSubmit = (data: UpdateProjectInput) => {
    updateMutation.mutate(data);
  };

  const handleDelete = () => {
    if (deleteConfirmation === project?.name) {
      deleteMutation.mutate();
    }
  };

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>
              Configure your project&apos;s build and runtime settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gitBranch">Git Branch</Label>
                <Input
                  id="gitBranch"
                  placeholder="main"
                  {...register('gitBranch')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  placeholder="3000"
                  {...register('port', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buildCommand">Build Command</Label>
              <Input
                id="buildCommand"
                placeholder="npm run build"
                {...register('buildCommand')}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use auto-detected command
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startCommand">Start Command</Label>
              <Input
                id="startCommand"
                placeholder="npm start"
                {...register('startCommand')}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use auto-detected command
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instanceType">Instance Type</Label>
              <Select
                defaultValue={project.instanceType}
                onValueChange={(value) => {
                  updateMutation.mutate({
                    instanceType: value as 'small' | 'medium' | 'large',
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small (0.5 CPU, 512MB RAM)</SelectItem>
                  <SelectItem value="medium">Medium (1 CPU, 1GB RAM)</SelectItem>
                  <SelectItem value="large">Large (2 CPU, 2GB RAM)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              disabled={!isDirty || updateMutation.isPending}
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Repository Info */}
      <Card>
        <CardHeader>
          <CardTitle>Repository</CardTitle>
          <CardDescription>Connected Git repository</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <Label className="text-muted-foreground">Repository URL</Label>
            <p className="text-sm font-mono break-all">{project.gitRepoUrl}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Provider</Label>
            <p className="text-sm capitalize">{project.gitProvider}</p>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions for this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Project</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete the
                  project <strong>{project.name}</strong> and all its
                  deployments.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>
                    Type <strong>{project.name}</strong> to confirm
                  </Label>
                  <Input
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder={project.name}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={
                    deleteConfirmation !== project.name ||
                    deleteMutation.isPending
                  }
                >
                  {deleteMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Delete Project
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
