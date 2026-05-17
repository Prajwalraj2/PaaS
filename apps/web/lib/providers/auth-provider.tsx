'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../api/auth';
import { getErrorMessage } from '../api/client';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check for existing auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await authApi.me();
          setUser(response.data.data);
        } catch {
          // Token is invalid or expired
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });
      const { user: userData, token, refreshToken } = response.data.data;

      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(userData);

      router.push('/projects');
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }, [router]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    try {
      const response = await authApi.register({ email, password, name });
      const { user: userData, token, refreshToken } = response.data.data;

      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(userData);

      router.push('/projects');
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }, [router]);

  const logout = useCallback(() => {
    // Call logout endpoint (optional - for audit logging)
    authApi.logout().catch(() => {});

    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);

    router.push('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    try {
      const response = await authApi.me();
      setUser(response.data.data);
    } catch {
      logout();
    }
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
