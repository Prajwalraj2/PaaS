import { apiClient } from './client';
import type { ApiResponse, AuthResponse, User } from '../types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export const authApi = {
  /**
   * Register a new user
   */
  register: (data: RegisterInput) =>
    apiClient.post<ApiResponse<AuthResponse>>('/auth/register', data),

  /**
   * Login with email and password
   */
  login: (data: LoginInput) =>
    apiClient.post<ApiResponse<AuthResponse>>('/auth/login', data),

  /**
   * Get current authenticated user
   */
  me: () =>
    apiClient.get<ApiResponse<User>>('/auth/me'),

  /**
   * Logout (server-side token invalidation)
   */
  logout: () =>
    apiClient.post<ApiResponse<{ message: string }>>('/auth/logout'),

  /**
   * Refresh access token using refresh token
   */
  refresh: (refreshToken: string) =>
    apiClient.post<ApiResponse<{ token: string }>>('/auth/refresh', { refreshToken }),

  /**
   * Update user profile
   */
  updateProfile: (data: UpdateProfileInput) =>
    apiClient.patch<ApiResponse<User>>('/auth/profile', data),

  /**
   * Change password
   */
  changePassword: (data: ChangePasswordInput) =>
    apiClient.post<ApiResponse<{ message: string }>>('/auth/password', data),
};
