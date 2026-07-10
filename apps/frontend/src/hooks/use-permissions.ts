import { useEffect, useState } from 'react';
import { api, getActiveTenantId } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

export function usePermissions() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const tenantId = getActiveTenantId();

  const fetchPermissions = async () => {
    if (!user || !tenantId) {
      setRole(null);
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/auth/me/permissions');
      setRole(response.data.role);
      setPermissions(response.data.permissions || []);
    } catch (err) {
      setRole(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [user, tenantId]);

  const hasPermission = (permission: string) => {
    return permissions.includes(permission);
  };

  return {
    role,
    permissions,
    loading,
    hasPermission,
    refetch: fetchPermissions,
  };
}
