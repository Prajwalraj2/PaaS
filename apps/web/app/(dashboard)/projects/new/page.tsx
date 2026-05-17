'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Loader2, GitBranch, Terminal } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
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
import { projectsApi } from '@/lib/api/projects';
import { getErrorMessage } from '@/lib/api/client';
import type { CreateProjectInput } from '@/lib/types';

export default function NewProjectPage() {
  const router = useRouter();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    defaultValues: {
      gitBranch: 'main',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateProjectInput) => projectsApi.create(data),
    onSuccess: (response) => {
      toast.success('Project created successfully!');
      router.push(`/projects/${response.data.data.id}`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const onSubmit = (data: CreateProjectInput) => {
    createMutation.mutate(data);
  };

  const projectName = watch('name');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create New Project</h1>
          <p className="text-muted-foreground mt-1">
            Deploy your application from a Git repository
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              Enter the basic information for your project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="my-awesome-app"
                disabled={createMutation.isPending}
                {...register('name', {
                  required: 'Project name is required',
                  minLength: {
                    value: 3,
                    message: 'Name must be at least 3 characters',
                  },
                  maxLength: {
                    value: 50,
                    message: 'Name must be at most 50 characters',
                  },
                  pattern: {
                    value: /^[a-z0-9-]+$/,
                    message:
                      'Only lowercase letters, numbers, and hyphens allowed',
                  },
                })}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
              {projectName && !errors.name && (
                <p className="text-sm text-muted-foreground">
                  Your app will be available at:{' '}
                  <span className="text-primary">
                    {projectName}.paas.localhost
                  </span>
                </p>
              )}
            </div>

            {/* Git Repository URL */}
            <div className="space-y-2">
              <Label htmlFor="gitRepoUrl">Git Repository URL</Label>
              <Input
                id="gitRepoUrl"
                placeholder="https://github.com/username/repo"
                disabled={createMutation.isPending}
                {...register('gitRepoUrl', {
                  required: 'Repository URL is required',
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Must be a valid URL starting with http:// or https://',
                  },
                })}
              />
              {errors.gitRepoUrl && (
                <p className="text-sm text-destructive">
                  {errors.gitRepoUrl.message}
                </p>
              )}
            </div>

            {/* Git Branch */}
            <div className="space-y-2">
              <Label htmlFor="gitBranch" className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Branch
              </Label>
              <Input
                id="gitBranch"
                placeholder="main"
                disabled={createMutation.isPending}
                {...register('gitBranch')}
              />
            </div>

            {/* Advanced Settings Toggle */}
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Terminal className="mr-2 h-4 w-4" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
            </Button>

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label htmlFor="buildCommand">Build Command (optional)</Label>
                  <Input
                    id="buildCommand"
                    placeholder="npm run build"
                    disabled={createMutation.isPending}
                    {...register('buildCommand')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Override the auto-detected build command
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startCommand">Start Command (optional)</Label>
                  <Input
                    id="startCommand"
                    placeholder="npm start"
                    disabled={createMutation.isPending}
                    {...register('startCommand')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Override the auto-detected start command
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gitRootDir">Root Directory (optional)</Label>
                  <Input
                    id="gitRootDir"
                    placeholder="/"
                    disabled={createMutation.isPending}
                    {...register('gitRootDir')}
                  />
                  <p className="text-xs text-muted-foreground">
                    If your app is in a subdirectory (e.g., /apps/web)
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Project
          </Button>
        </div>
      </form>
    </div>
  );
}
