'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  Database,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Copy,
  Circle,
  Key,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { servicesApi } from '@/lib/api/services';
import { getErrorMessage } from '@/lib/api/client';
import type { CreateServiceInput, Service } from '@/lib/types';

const serviceIcons: Record<string, string> = {
  postgres: '🐘',
  redis: '🔴',
  mysql: '🐬',
  mongodb: '🍃',
};

const statusColors: Record<Service['status'], string> = {
  provisioning: 'bg-yellow-500 animate-pulse',
  running: 'bg-green-500',
  stopped: 'bg-gray-500',
  failed: 'bg-red-500',
};

export default function ServicesPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState<Set<string>>(new Set());

  const { data: supportedData } = useQuery({
    queryKey: ['supported-services'],
    queryFn: () => servicesApi.getSupportedServices(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['services', projectId],
    queryFn: () => servicesApi.list(projectId),
  });

  const { data: credentialsData } = useQuery({
    queryKey: ['service-credentials', projectId, selectedServiceId],
    queryFn: () =>
      selectedServiceId
        ? servicesApi.getCredentials(projectId, selectedServiceId)
        : null,
    enabled: !!selectedServiceId,
  });

  const supportedServices = supportedData?.data.data || [];
  const services = data?.data.data || [];
  const credentials = credentialsData?.data.data;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateServiceInput>({
    defaultValues: {
      storageGb: 1,
    },
  });

  const selectedType = watch('type');

  const createMutation = useMutation({
    mutationFn: (data: CreateServiceInput) =>
      servicesApi.create(projectId, data),
    onSuccess: (response) => {
      toast.success(`${response.data.data.type} service created!`);
      queryClient.invalidateQueries({ queryKey: ['services', projectId] });
      setIsDialogOpen(false);
      setSelectedServiceId(response.data.data.id);
      reset();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const restartMutation = useMutation({
    mutationFn: (serviceId: string) =>
      servicesApi.restart(projectId, serviceId),
    onSuccess: () => {
      toast.success('Service restart initiated');
      queryClient.invalidateQueries({ queryKey: ['services', projectId] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (serviceId: string) =>
      servicesApi.delete(projectId, serviceId),
    onSuccess: () => {
      toast.success('Service deleted');
      queryClient.invalidateQueries({ queryKey: ['services', projectId] });
      setSelectedServiceId(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const onSubmit = (data: CreateServiceInput) => {
    createMutation.mutate(data);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const toggleCredentials = (serviceId: string) => {
    setShowCredentials((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
    if (!showCredentials.has(serviceId)) {
      setSelectedServiceId(serviceId);
    }
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
              <CardTitle>Add-on Services</CardTitle>
              <CardDescription>
                Provision databases and other services
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Service
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSubmit(onSubmit)}>
                  <DialogHeader>
                    <DialogTitle>Create Service</DialogTitle>
                    <DialogDescription>
                      Provision a new database or cache service
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Service Name</Label>
                      <Input
                        id="name"
                        placeholder="main-db"
                        {...register('name', {
                          required: 'Name is required',
                          pattern: {
                            value: /^[a-zA-Z][a-zA-Z0-9-]*$/,
                            message:
                              'Must start with letter, only letters, numbers, hyphens',
                          },
                        })}
                      />
                      {errors.name && (
                        <p className="text-sm text-destructive">
                          {errors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Service Type</Label>
                      <Select
                        onValueChange={(value) =>
                          setValue('type', value as CreateServiceInput['type'])
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a service type" />
                        </SelectTrigger>
                        <SelectContent>
                          {supportedServices.map((svc) => (
                            <SelectItem key={svc.type} value={svc.type}>
                              <span className="flex items-center gap-2">
                                <span>{serviceIcons[svc.type]}</span>
                                <span>{svc.name}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedType && (
                        <p className="text-xs text-muted-foreground">
                          {
                            supportedServices.find((s) => s.type === selectedType)
                              ?.description
                          }
                        </p>
                      )}
                    </div>

                    {selectedType && (
                      <div className="space-y-2">
                        <Label>Version</Label>
                        <Select
                          onValueChange={(value) => setValue('version', value)}
                          defaultValue={
                            supportedServices.find((s) => s.type === selectedType)
                              ?.defaultVersion
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {supportedServices
                              .find((s) => s.type === selectedType)
                              ?.versions.map((v) => (
                                <SelectItem key={v} value={v}>
                                  {v}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="storageGb">Storage (GB)</Label>
                      <Input
                        id="storageGb"
                        type="number"
                        min={1}
                        max={100}
                        {...register('storageGb', { valueAsNumber: true })}
                      />
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
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || !selectedType}
                    >
                      {createMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create Service
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="mx-auto h-8 w-8 mb-2" />
              <p>No services provisioned</p>
              <p className="text-sm mt-1">
                Add PostgreSQL, Redis, MySQL, or MongoDB
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {services.map((service) => (
                <Card key={service.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {serviceIcons[service.type]}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{service.name}</p>
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              <Circle
                                className={`h-2 w-2 fill-current ${
                                  statusColors[service.status]
                                }`}
                              />
                              {service.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {service.type} {service.version} • {service.storageGb}
                            GB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleCredentials(service.id)}
                        >
                          <Key className="mr-2 h-4 w-4" />
                          Credentials
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => restartMutation.mutate(service.id)}
                          disabled={restartMutation.isPending}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(service.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {showCredentials.has(service.id) &&
                      selectedServiceId === service.id &&
                      credentials && (
                        <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Connection URL
                              </p>
                              <code className="text-sm break-all">
                                {credentials.connectionUrl}
                              </code>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                copyToClipboard(credentials.connectionUrl)
                              }
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Host</p>
                              <code>{credentials.host}</code>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Port</p>
                              <code>{credentials.port}</code>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Username
                              </p>
                              <code>{credentials.username}</code>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Database
                              </p>
                              <code>{credentials.database}</code>
                            </div>
                          </div>
                        </div>
                      )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
