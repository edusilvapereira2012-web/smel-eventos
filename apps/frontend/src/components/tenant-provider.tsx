'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, getActiveTenantId, setActiveTenantId } from '@/lib/api';
import { useAuth } from './auth-provider';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  role: string;
}

interface TenantContextType {
  tenants: Tenant[];
  activeTenant: Tenant | null;
  loading: boolean;
  selectTenant: (tenantId: string | null) => void;
  refetchTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenants = async () => {
    if (!user) {
      setTenants([]);
      setActiveTenant(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/tenants');
      const tenantList: Tenant[] = response.data;
      setTenants(tenantList);

      const savedId = getActiveTenantId();
      let active = tenantList.find((t) => t.id === savedId) || null;
      if (!active && tenantList.length > 0) {
        active = tenantList[0];
        setActiveTenantId(active.id);
      }
      setActiveTenant(active);
    } catch (error) {
      console.error('Falha ao buscar tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectTenant = (tenantId: string | null) => {
    setActiveTenantId(tenantId);
    const active = tenants.find((t) => t.id === tenantId) || null;
    setActiveTenant(active);
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [user]);

  return (
    <TenantContext.Provider value={{ tenants, activeTenant, loading, selectTenant, refetchTenants: fetchTenants }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
