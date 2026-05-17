import { apiClient } from './client';
import type {
  ApiResponse,
  Service,
  ServiceCredentials,
  CreateServiceInput,
  SupportedService,
} from '../types';

export const servicesApi = {
  /**
   * Get list of supported service types
   */
  getSupportedServices: () =>
    apiClient.get<ApiResponse<SupportedService[]>>('/services/supported'),

  /**
   * List all services for a project
   */
  list: (projectId: string) =>
    apiClient.get<ApiResponse<Service[]>>(`/projects/${projectId}/services`),

  /**
   * Create a new service
   */
  create: (projectId: string, data: CreateServiceInput) =>
    apiClient.post<ApiResponse<Service & { credentials: ServiceCredentials }>>(
      `/projects/${projectId}/services`,
      data
    ),

  /**
   * Get service details
   */
  get: (projectId: string, serviceId: string) =>
    apiClient.get<ApiResponse<Service>>(
      `/projects/${projectId}/services/${serviceId}`
    ),

  /**
   * Get service credentials
   */
  getCredentials: (projectId: string, serviceId: string) =>
    apiClient.get<ApiResponse<ServiceCredentials>>(
      `/projects/${projectId}/services/${serviceId}/credentials`
    ),

  /**
   * Restart a service
   */
  restart: (projectId: string, serviceId: string) =>
    apiClient.post<ApiResponse<Service>>(
      `/projects/${projectId}/services/${serviceId}/restart`
    ),

  /**
   * Regenerate service credentials
   */
  regenerateCredentials: (projectId: string, serviceId: string) =>
    apiClient.post<ApiResponse<Service & { credentials: ServiceCredentials }>>(
      `/projects/${projectId}/services/${serviceId}/regenerate-credentials`
    ),

  /**
   * Delete a service
   */
  delete: (projectId: string, serviceId: string) =>
    apiClient.delete<ApiResponse<{ message: string }>>(
      `/projects/${projectId}/services/${serviceId}`
    ),
};
