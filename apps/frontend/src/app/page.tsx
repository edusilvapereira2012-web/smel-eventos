'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useTenant } from '@/components/tenant-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { TenantSelector } from '@/components/tenant-selector';
import { PwaInstallButton } from '@/components/pwa-install-button';
import { Shield, Building, User, LogOut, CheckCircle2, BookOpen } from 'lucide-react';

export default function Home() {
  const { user, loading: authLoading, logout } = useAuth();
  const { activeTenant, loading: tenantLoading } = useTenant();
  const { role, permissions, loading: permLoading, hasPermission } = usePermissions();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading || tenantLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-slate-200" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col relative">
      {/* Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[45%] -left-[20%] w-[90%] h-[90%] rounded-full bg-violet-900/10 blur-[130px]" />
        <div className="absolute -bottom-[45%] -right-[20%] w-[90%] h-[90%] rounded-full bg-blue-900/10 blur-[130px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-slate-900 bg-slate-950/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg">
            SM
          </div>
          <span className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            SMEL-Plataforma de Eventos
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <PwaInstallButton />
          <TenantSelector />
          <div className="h-6 w-px bg-slate-800" />
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-slate-300">{user.name}</span>
            <Button
              onClick={() => logout()}
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-slate-450 hover:text-red-400 hover:bg-slate-900/50"
              title="Sair"
            >
              <LogOut className="h-4.5 w-4.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="p-8 bg-slate-900/30 rounded-2xl border border-slate-900 backdrop-blur-xl space-y-6 shadow-2xl">
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-350">
                Olá, {user.name}!
              </h1>
              <p className="text-slate-400 text-sm">
                Organizações isoladas, cache Redis/Valkey, controle de acessos RBAC granular e logs de auditoria em conformidade com LGPD.
              </p>
            </div>

            {activeTenant ? (
              <div className="p-6 bg-slate-900/60 rounded-xl border border-slate-800/60 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-violet-900/30 rounded-lg text-violet-400">
                    <Building className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-200">{activeTenant.name}</h3>
                    <p className="text-xs text-slate-500">Slug: {activeTenant.slug}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm pt-2">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-900">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Papel do Usuário</span>
                    <p className="font-bold text-violet-400 mt-1">{role || 'Membro'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-900">
                    <span className="text-xs text-slate-500 uppercase font-semibold">Status da Organização</span>
                    <p className="font-bold text-emerald-400 mt-1">Ativo e Seguro</p>
                  </div>
                </div>

                <div className="pt-4 flex justify-end space-x-3 flex-wrap gap-2">
                  <Button onClick={() => router.push('/manual')} variant="outline" className="border-slate-800 bg-slate-900/30 hover:bg-slate-850 text-slate-350 hover:text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2">
                    <BookOpen className="h-4.5 w-4.5 text-violet-400" />
                    Manual do Sistema
                  </Button>
                  {user.email === 'valterpcjr@gmail.com' && (
                    <Button onClick={() => router.push('/superadmin')} variant="outline" className="border-violet-850/50 bg-violet-950/20 hover:bg-violet-900/35 text-violet-300 hover:text-white font-bold py-2 px-6 rounded-lg">
                      Painel Superadmin
                    </Button>
                  )}
                  {hasPermission('tenants.update') && (
                    <Button onClick={() => router.push('/admin/email/logs')} variant="outline" className="border-slate-800 bg-slate-900/30 hover:bg-slate-850 text-slate-300 hover:text-white font-bold py-2 px-6 rounded-lg">
                      Monitor de E-mails
                    </Button>
                  )}
                  <Button onClick={() => router.push('/events')} className="bg-violet-600 hover:bg-violet-700 text-white font-bold py-2 px-6 rounded-lg shadow-lg shadow-violet-900/30">
                    Gerenciar Eventos
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-900/60 rounded-xl border border-slate-800/60 text-center space-y-3">
                <p className="text-sm text-slate-400">Você ainda não faz parte de nenhuma organização.</p>
                <div className="flex justify-center space-x-3">
                  {user.email === 'valterpcjr@gmail.com' ? (
                    <>
                      <Button onClick={() => router.push('/superadmin')} className="bg-violet-800 hover:bg-violet-700 text-white text-xs font-semibold py-1.5 px-4 rounded-lg">
                        Painel Superadmin
                      </Button>
                      <Button onClick={() => router.push('/tenants/new')} className="bg-slate-700 hover:bg-slate-650 text-white text-xs font-semibold py-1.5 px-4 rounded-lg">
                        Criar Primeira Organização
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">Por favor, entre em contato com o administrador para ser convidado a uma organização.</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-900/30 rounded-xl border border-slate-900 space-y-2">
              <h3 className="font-bold text-slate-200">Isolamento de Organizações</h3>
              <p className="text-xs text-slate-400">Dados do banco e logs isolados a nível de consulta e controle com interceptadores e middleware robustos.</p>
            </div>
            <div className="p-6 bg-slate-900/30 rounded-xl border border-slate-900 space-y-2">
              <h3 className="font-bold text-slate-200">Cache com Redis/Valkey</h3>
              <p className="text-xs text-slate-400">Os dados da organização são validados e cacheados por 5 minutos para otimização de latência e chamadas ao banco.</p>
            </div>
          </div>
        </div>

        {/* Sidebar permissions list */}
        <div className="space-y-6">
          <div className="p-6 bg-slate-900/30 rounded-2xl border border-slate-900 backdrop-blur-xl space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-slate-200 flex items-center space-x-2">
              <Shield className="h-5 w-5 text-violet-400" />
              <span>Suas Permissões</span>
            </h3>
            {permLoading ? (
              <div className="h-20 w-full animate-pulse bg-slate-800/30 rounded-lg" />
            ) : permissions.length > 0 ? (
              <ul className="space-y-2.5">
                {permissions.map((perm) => (
                  <li key={perm} className="flex items-center space-x-2 text-xs text-slate-350 bg-slate-950/60 border border-slate-900 px-3 py-2 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span>{perm}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">Nenhuma permissão especial concedida neste tenant.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
