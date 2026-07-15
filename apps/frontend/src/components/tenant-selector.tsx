'use client';

import React from 'react';
import { useTenant } from './tenant-provider';
import { useAuth } from './auth-provider';
import { useRouter } from 'next/navigation';
import { Settings, Plus } from 'lucide-react';

export function TenantSelector() {
  const { tenants, activeTenant, selectTenant, loading } = useTenant();
  const { user } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="h-10 w-44 animate-pulse rounded bg-slate-800/50 border border-slate-700/50" />
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <div className="relative">
        <select
          value={activeTenant?.id || ''}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'new') {
              router.push('/tenants/new');
            } else {
              selectTenant(val || null);
            }
          }}
          className="appearance-none bg-slate-900/80 border border-slate-800/90 text-slate-200 text-sm font-semibold rounded-lg block w-full pl-3 pr-10 py-2.5 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer backdrop-blur-md transition-all hover:bg-slate-900/90"
        >
          {tenants.length === 0 ? (
            <option value="" disabled>Sem Organizações</option>
          ) : (
            tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.role})
              </option>
            ))
          )}
          {user?.email === 'valterpcjr@gmail.com' && (
            <option value="new" className="text-violet-400 font-semibold">+ Criar Organização</option>
          )}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>

      {activeTenant && (
        <button
          onClick={() => router.push(`/tenants/${activeTenant.slug}/settings`)}
          title="Configurações da Organização"
          className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors backdrop-blur-md"
        >
          <Settings className="h-4.5 w-4.5" />
        </button>
      )}
    </div>
  );
}
