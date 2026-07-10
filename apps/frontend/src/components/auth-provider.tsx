'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setAccessToken } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      setUser(null);
      setAccessToken(null);
    }
  };

  const refreshSession = async () => {
    try {
      const response = await api.post('/auth/refresh');
      const { access_token } = response.data;
      setAccessToken(access_token);
      await fetchCurrentUser();
    } catch (error) {
      setUser(null);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { access_token } = response.data;
    setAccessToken(access_token);
    await fetchCurrentUser();
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignora falha de logout na API (ex. se o cookie/token já expirou)
    } finally {
      setUser(null);
      setAccessToken(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshSession }}>
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
