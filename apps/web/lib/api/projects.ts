import { apiClient } from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  EnvVar,
  SetEnvVarInput,
  Deployment,
} from '../types';

export const projectsApi = {
  /**
   * List all projects for the current user
   */
  list: (page = 1, limit = 20) =>
    apiClient.get<PaginatedResponse<Project>>('/projects', {
      params: { page, limit },
    }),

  /**
   * Get a single project by ID
   */
  get: (id: string) =>
    apiClient.get<ApiResponse<Project>>(`/projects/${id}`),

  /**
   * Create a new project
   */
  create: (data: CreateProjectInput) =>
    apiClient.post<ApiResponse<Project>>('/projects', data),

  /**
   * Update a project
   */
  update: (id: string, data: UpdateProjectInput) =>
    apiClient.patch<ApiResponse<Project>>(`/projects/${id}`, data),

  /**
   * Delete a project
   */
  delete: (id: string) =>
    apiClient.delete<ApiResponse<{ message: string }>>(`/projects/${id}`),

  /**
   * Trigger a new deployment
   */
  deploy: (id: string) =>
    apiClient.post<ApiResponse<Deployment>>(`/projects/${id}/deploy`),

  // Environment Variables
  /**
   * List environment variables for a project
   */
  listEnvVars: (projectId: string) =>
    apiClient.get<ApiResponse<EnvVar[]>>(`/projects/${projectId}/env`),

  /**
   * Set (create or update) an environment variable
   */
  setEnvVar: (projectId: string, data: SetEnvVarInput) =>
    apiClient.post<ApiResponse<EnvVar>>(`/projects/${projectId}/env`, data),

  /**
   * Delete an environment variable
   */
  deleteEnvVar: (projectId: string, key: string) =>
    apiClient.delete<ApiResponse<{ message: string }>>(
      `/projects/${projectId}/env/${key}`
    ),
};
