import { apiClient } from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  Deployment,
  DeploymentStats,
  BuildLogsResponse,
} from '../types';

export interface ListDeploymentsParams {
  page?: number;
  limit?: number;
  buildStatus?: string;
  deployStatus?: string;
  gitBranch?: string;
}

export const deploymentsApi = {
  /**
   * List deployments for a project
   */
  list: (projectId: string, params?: ListDeploymentsParams) =>
    apiClient.get<PaginatedResponse<Deployment>>(
      `/projects/${projectId}/deployments`,
      { params }
    ),

  /**
   * Get a single deployment
   */
  get: (projectId: string, deploymentId: string) =>
    apiClient.get<ApiResponse<Deployment>>(
      `/projects/${projectId}/deployments/${deploymentId}`
    ),

  /**
   * Get deployment statistics
   */
  getStats: (projectId: string) =>
    apiClient.get<ApiResponse<DeploymentStats>>(
      `/projects/${projectId}/deployments/stats`
    ),

  /**
   * Get build logs for a deployment
   */
  getLogs: (
    projectId: string,
    deploymentId: string,
    params?: { page?: number; limit?: number }
  ) =>
    apiClient.get<ApiResponse<BuildLogsResponse>>(
      `/projects/${projectId}/deployments/${deploymentId}/logs`,
      { params: { ...params, limit: params?.limit || 500 } }
    ),

  /**
   * Trigger a new deployment
   */
  trigger: (projectId: string) =>
    apiClient.post<ApiResponse<Deployment>>(
      `/projects/${projectId}/deployments`
    ),

  /**
   * Rollback to a previous deployment
   */
  rollback: (projectId: string, deploymentId: string) =>
    apiClient.post<ApiResponse<Deployment>>(
      `/projects/${projectId}/deployments/${deploymentId}/rollback`
    ),

  /**
   * Cancel a running deployment
   */
  cancel: (projectId: string, deploymentId: string) =>
    apiClient.post<ApiResponse<Deployment>>(
      `/projects/${projectId}/deployments/${deploymentId}/cancel`
    ),
};
