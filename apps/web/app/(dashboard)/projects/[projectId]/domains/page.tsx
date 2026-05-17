'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  Globe,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  Copy,
  Shield,
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
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { domainsApi } from '@/lib/api/domains';
import { getErrorMessage } from '@/lib/api/client';

interface AddDomainForm {
  domain: string;
}

export default function DomainsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['domains', projectId],
    queryFn: () => domainsApi.list(projectId),
  });

  const domains = data?.data.data || [];

  const { data: domainDetails } = useQuery({
    queryKey: ['domain-details', projectId, selectedDomainId],
    queryFn: () =>
      selectedDomainId ? domainsApi.get(projectId, selectedDomainId) : null,
    enabled: !!selectedDomainId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddDomainForm>();

  const addMutation = useMutation({
    mutationFn: (domain: string) => domainsApi.add(projectId, domain),
    onSuccess: (response) => {
      toast.success('Domain added! Configure your DNS records.');
      queryClient.invalidateQueries({ queryKey: ['domains', projectId] });
      setIsDialogOpen(false);
      setSelectedDomainId(response.data.data.domain.id);
      reset();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (domainId: string) => domainsApi.verify(projectId, domainId),
    onSuccess: (response) => {
      if (response.data.data.verified) {
        toast.success('Domain verified successfully!');
      } else {
        toast.error('Verification failed. Check your DNS records.');
      }
      queryClient.invalidateQueries({ queryKey: ['domains', projectId] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (domainId: string) => domainsApi.delete(projectId, domainId),
    onSuccess: () => {
      toast.success('Domain removed');
      queryClient.invalidateQueries({ queryKey: ['domains', projectId] });
      setSelectedDomainId(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const onSubmit = (data: AddDomainForm) => {
    addMutation.mutate(data.domain);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
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
              <CardTitle>Custom Domains</CardTitle>
              <CardDescription>
                Add custom domains to your project
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Domain
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSubmit(onSubmit)}>
                  <DialogHeader>
                    <DialogTitle>Add Custom Domain</DialogTitle>
                    <DialogDescription>
                      Enter your custom domain. You&apos;ll need to configure DNS
                      records after adding.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="domain">Domain</Label>
                      <Input
                        id="domain"
                        placeholder="app.example.com"
                        {...register('domain', {
                          required: 'Domain is required',
                          pattern: {
                            value: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i,
                            message: 'Invalid domain format',
                          },
                        })}
                      />
                      {errors.domain && (
                        <p className="text-sm text-destructive">
                          {errors.domain.message}
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
                    <Button type="submit" disabled={addMutation.isPending}>
                      {addMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Add Domain
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {domains.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="mx-auto h-8 w-8 mb-2" />
              <p>No custom domains configured</p>
              <p className="text-sm mt-1">
                Add a domain like app.example.com
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {domains.map((domain) => (
                <div
                  key={domain.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{domain.domain}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {domain.verified ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Pending Verification
                          </Badge>
                        )}
                        <Badge
                          variant={
                            domain.sslStatus === 'active'
                              ? 'default'
                              : 'secondary'
                          }
                          className="gap-1"
                        >
                          <Shield className="h-3 w-3" />
                          SSL: {domain.sslStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!domain.verified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDomainId(domain.id);
                          verifyMutation.mutate(domain.id);
                        }}
                        disabled={verifyMutation.isPending}
                      >
                        {verifyMutation.isPending &&
                        selectedDomainId === domain.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Verify
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setSelectedDomainId(
                          selectedDomainId === domain.id ? null : domain.id
                        )
                      }
                    >
                      <AlertCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(domain.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DNS Instructions */}
      {selectedDomainId && domainDetails?.data.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">DNS Configuration</CardTitle>
            <CardDescription>
              Add these records to your DNS provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue="txt">
              <AccordionItem value="txt">
                <AccordionTrigger>
                  TXT Record (Verification)
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <code className="text-sm">
                          {domainDetails.data.data.dnsInstructions.txtRecord.name}
                        </code>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          copyToClipboard(
                            domainDetails.data.data.dnsInstructions.txtRecord.name
                          )
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Value</p>
                        <code className="text-sm break-all">
                          {domainDetails.data.data.dnsInstructions.txtRecord.value}
                        </code>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          copyToClipboard(
                            domainDetails.data.data.dnsInstructions.txtRecord.value
                          )
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="cname">
                <AccordionTrigger>
                  CNAME Record (Routing)
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <code className="text-sm">
                          {domainDetails.data.data.dnsInstructions.cnameRecord.name}
                        </code>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          copyToClipboard(
                            domainDetails.data.data.dnsInstructions.cnameRecord.name
                          )
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Value</p>
                        <code className="text-sm">
                          {domainDetails.data.data.dnsInstructions.cnameRecord.value}
                        </code>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          copyToClipboard(
                            domainDetails.data.data.dnsInstructions.cnameRecord.value
                          )
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
