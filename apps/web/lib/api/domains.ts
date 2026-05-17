import { apiClient } from './client';
import type { ApiResponse, CustomDomain, DnsInstructions } from '../types';

export interface AddDomainResponse {
  domain: CustomDomain;
  dnsInstructions: DnsInstructions;
}

export interface VerifyDomainResponse {
  verified: boolean;
  domain: CustomDomain;
  message: string;
  dnsCheck?: {
    expectedToken: string;
    foundRecords: string[];
    error?: string;
  };
}

export const domainsApi = {
  /**
   * List all custom domains for a project
   */
  list: (projectId: string) =>
    apiClient.get<ApiResponse<CustomDomain[]>>(`/projects/${projectId}/domains`),

  /**
   * Add a custom domain to a project
   */
  add: (projectId: string, domain: string) =>
    apiClient.post<ApiResponse<AddDomainResponse>>(
      `/projects/${projectId}/domains`,
      { domain }
    ),

  /**
   * Get domain details with DNS instructions
   */
  get: (projectId: string, domainId: string) =>
    apiClient.get<ApiResponse<AddDomainResponse>>(
      `/projects/${projectId}/domains/${domainId}`
    ),

  /**
   * Verify domain ownership via DNS
   */
  verify: (projectId: string, domainId: string) =>
    apiClient.post<ApiResponse<VerifyDomainResponse>>(
      `/projects/${projectId}/domains/${domainId}/verify`
    ),

  /**
   * Refresh SSL certificate
   */
  refreshSsl: (projectId: string, domainId: string) =>
    apiClient.post<ApiResponse<CustomDomain>>(
      `/projects/${projectId}/domains/${domainId}/refresh-ssl`
    ),

  /**
   * Delete a custom domain
   */
  delete: (projectId: string, domainId: string) =>
    apiClient.delete<ApiResponse<{ message: string }>>(
      `/projects/${projectId}/domains/${domainId}`
    ),
};
