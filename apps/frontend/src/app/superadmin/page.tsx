'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { 
  Shield, 
  Building, 
  User, 
  ArrowLeft, 
  Users, 
  Calendar, 
  CheckCircle2, 
  Search, 
  AlertTriangle,
  Settings,
  RefreshCw,
  Power
} from 'lucide-react';

interface Stats {
  totalTenants: number;
  totalUsers: number;
  totalEvents: number;
  totalRegistrations: number;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  membersCount: number;
  eventsCount: number;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  tenantsCount: number;
  registrationsCount: number;
}

export default function SuperadminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  
  const [activeTab, setActiveTab] = useState<'tenants' | 'users'>('tenants');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isSuperadmin = user?.email === 'valterpcjr@gmail.com';

  const fetchData = async () => {
    try {
      setLoadingData(true);
      setError(null);
      const [statsRes, tenantsRes, usersRes] = await Promise.all([
        api.get<Stats>('/superadmin/stats'),
        api.get<Tenant[]>('/superadmin/tenants'),
        api.get<UserItem[]>('/superadmin/users')
      ]);
      setStats(statsRes.data);
      setTenants(tenantsRes.data);
      setUsers(usersRes.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Falha ao carregar dados do painel de controle.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (!isSuperadmin) {
        router.push('/');
      } else {
        fetchData();
      }
    }
  }, [user, authLoading, isSuperadmin, router]);

  const toggleTenant = async (id: string) => {
    try {
      setActionLoading(id);
      await api.post(`/superadmin/tenants/${id}/toggle`);
      setTenants(prev => 
        prev.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t)
      );
      // Refresh stats
      const statsRes = await api.get<Stats>('/superadmin/stats');
      setStats(statsRes.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao alterar status da organização.');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleUser = async (id: string) => {
    if (id === user?.id) {
      alert('Você não pode desativar seu próprio usuário de administrador.');
      return;
    }
    try {
      setActionLoading(id);
      await api.post(`/superadmin/users/${id}/toggle`);
      setUsers(prev => 
        prev.map(u => u.id === id ? { ...u, isActive: !u.isActive } : u)
      );
      // Refresh stats
      const statsRes = await api.get<Stats>('/superadmin/stats');
      setStats(statsRes.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao alterar status do usuário.');
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || (!isSuperadmin && user)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-slate-200" />
      </div>
    );
  }

  if (!user || !isSuperadmin) {
    return null;
  }

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col relative pb-16">
      {/* Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[40%] -left-[10%] w-[80%] h-[80%] rounded-full bg-violet-900/10 blur-[130px]" />
        <div className="absolute -bottom-[40%] -right-[10%] w-[80%] h-[80%] rounded-full bg-indigo-900/10 blur-[130px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-slate-900 bg-slate-950/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            onClick={() => router.push('/')} 
            variant="ghost" 
            size="icon" 
            className="text-slate-400 hover:text-white hover:bg-slate-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center space-x-2">
            <Shield className="h-6 w-6 text-violet-400" />
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-350">
              Painel de Gestão Global (Superadmin)
            </h1>
          </div>
        </div>
        <div>
          <Button 
            onClick={fetchData} 
            variant="outline" 
            size="sm" 
            className="border-slate-800 bg-slate-900/30 text-slate-350 hover:text-white hover:bg-slate-850 flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>
        </div>
      </header>

      {/* Body Content */}
      <section className="relative z-10 max-w-6xl w-full mx-auto px-6 mt-8 space-y-8 flex-1">
        {error && (
          <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl flex items-start space-x-3 text-red-300">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-bold">Erro ao carregar dados</h4>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="p-6 bg-slate-900/30 rounded-xl border border-slate-900 backdrop-blur-md flex items-center space-x-4">
            <div className="p-3 bg-violet-900/20 rounded-lg text-violet-400">
              <Building className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase">Organizações</span>
              <p className="text-2xl font-extrabold mt-0.5">{stats ? stats.totalTenants : '-'}</p>
            </div>
          </div>

          <div className="p-6 bg-slate-900/30 rounded-xl border border-slate-900 backdrop-blur-md flex items-center space-x-4">
            <div className="p-3 bg-indigo-900/20 rounded-lg text-indigo-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase">Usuários</span>
              <p className="text-2xl font-extrabold mt-0.5">{stats ? stats.totalUsers : '-'}</p>
            </div>
          </div>

          <div className="p-6 bg-slate-900/30 rounded-xl border border-slate-900 backdrop-blur-md flex items-center space-x-4">
            <div className="p-3 bg-blue-900/20 rounded-lg text-blue-400">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase">Eventos</span>
              <p className="text-2xl font-extrabold mt-0.5">{stats ? stats.totalEvents : '-'}</p>
            </div>
          </div>

          <div className="p-6 bg-slate-900/30 rounded-xl border border-slate-900 backdrop-blur-md flex items-center space-x-4">
            <div className="p-3 bg-emerald-900/20 rounded-lg text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase">Inscrições</span>
              <p className="text-2xl font-extrabold mt-0.5">{stats ? stats.totalRegistrations : '-'}</p>
            </div>
          </div>
        </div>

        {/* Management Card with Table list */}
        <div className="bg-slate-900/25 border border-slate-900 rounded-2xl p-6 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Tabs */}
            <div className="flex space-x-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-900 max-w-xs">
              <button
                onClick={() => { setActiveTab('tenants'); setSearchTerm(''); }}
                className={`flex-1 py-1.5 px-4 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'tenants' 
                    ? 'bg-violet-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Organizações
              </button>
              <button
                onClick={() => { setActiveTab('users'); setSearchTerm(''); }}
                className={`flex-1 py-1.5 px-4 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'users' 
                    ? 'bg-violet-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Usuários
              </button>
            </div>

            {/* Search Input */}
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder={activeTab === 'tenants' ? 'Buscar organização...' : 'Buscar usuário...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-950 border border-slate-900 rounded-lg focus:outline-none focus:border-violet-500 text-slate-200 placeholder-slate-500 transition-all"
              />
            </div>
          </div>

          {loadingData ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-violet-500" />
              <span className="text-xs text-slate-500">Carregando listagens...</span>
            </div>
          ) : activeTab === 'tenants' ? (
            /* Tenants Table */
            <div className="overflow-x-auto border border-slate-900/60 rounded-xl">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-950/65 border-b border-slate-900 text-slate-400 text-xs font-semibold uppercase">
                    <th className="px-6 py-4">Nome</th>
                    <th className="px-6 py-4">Slug</th>
                    <th className="px-6 py-4">Data de Criação</th>
                    <th className="px-6 py-4 text-center">Membros</th>
                    <th className="px-6 py-4 text-center">Eventos</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {filteredTenants.length > 0 ? (
                    filteredTenants.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="px-6 py-4.5 font-bold text-slate-200">{t.name}</td>
                        <td className="px-6 py-4.5 text-slate-400 font-mono text-xs">{t.slug}</td>
                        <td className="px-6 py-4.5 text-slate-500 text-xs">
                          {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4.5 text-center font-semibold text-slate-350">{t.membersCount}</td>
                        <td className="px-6 py-4.5 text-center font-semibold text-slate-350">{t.eventsCount}</td>
                        <td className="px-6 py-4.5 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.isActive 
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30' 
                              : 'bg-red-950/60 text-red-400 border border-red-900/30'
                          }`}>
                            {t.isActive ? 'Ativa' : 'Inativa'}
                          </span>
                        </td>
                        <td className="px-6 py-4.5 text-right">
                          <Button
                            onClick={() => toggleTenant(t.id)}
                            disabled={actionLoading === t.id}
                            variant="ghost"
                            className={`h-8 text-xs font-semibold px-3 rounded-lg border border-slate-800 ${
                              t.isActive 
                                ? 'text-red-400 hover:text-red-300 hover:bg-red-950/10' 
                                : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/10'
                            }`}
                          >
                            {actionLoading === t.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <div className="flex items-center space-x-1.5">
                                <Power className="h-3 w-3" />
                                <span>{t.isActive ? 'Desativar' : 'Ativar'}</span>
                              </div>
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-slate-500 text-xs">
                        Nenhuma organização encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Users Table */
            <div className="overflow-x-auto border border-slate-900/60 rounded-xl">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-950/65 border-b border-slate-900 text-slate-400 text-xs font-semibold uppercase">
                    <th className="px-6 py-4">Nome</th>
                    <th className="px-6 py-4">E-mail</th>
                    <th className="px-6 py-4 text-center">Organizações</th>
                    <th className="px-6 py-4 text-center">Inscrições</th>
                    <th className="px-6 py-4 text-center">E-mail Verificado</th>
                    <th className="px-6 py-4 text-center">Conta Ativa</th>
                    <th className="px-6 py-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="px-6 py-4.5 font-bold text-slate-200">
                          <div className="flex items-center space-x-2">
                            {u.email === 'valterpcjr@gmail.com' && (
                              <span title="Superadmin">
                                <Shield className="h-3.5 w-3.5 text-violet-400" />
                              </span>
                            )}
                            <span>{u.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4.5 text-slate-400 text-xs font-mono">{u.email}</td>
                        <td className="px-6 py-4.5 text-center font-semibold text-slate-350">{u.tenantsCount}</td>
                        <td className="px-6 py-4.5 text-center font-semibold text-slate-350">{u.registrationsCount}</td>
                        <td className="px-6 py-4.5 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.emailVerified 
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30' 
                              : 'bg-yellow-950/60 text-yellow-400 border border-yellow-900/30'
                          }`}>
                            {u.emailVerified ? 'Verificado' : 'Pendente'}
                          </span>
                        </td>
                        <td className="px-6 py-4.5 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.isActive 
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30' 
                              : 'bg-red-950/60 text-red-400 border border-red-900/30'
                          }`}>
                            {u.isActive ? 'Ativo' : 'Suspenso'}
                          </span>
                        </td>
                        <td className="px-6 py-4.5 text-right">
                          <Button
                            onClick={() => toggleUser(u.id)}
                            disabled={actionLoading === u.id || u.email === 'valterpcjr@gmail.com'}
                            variant="ghost"
                            className={`h-8 text-xs font-semibold px-3 rounded-lg border border-slate-800 ${
                              u.email === 'valterpcjr@gmail.com' 
                                ? 'opacity-40 cursor-not-allowed'
                                : u.isActive 
                                  ? 'text-red-400 hover:text-red-300 hover:bg-red-950/10' 
                                  : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/10'
                            }`}
                          >
                            {actionLoading === u.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <div className="flex items-center space-x-1.5">
                                <Power className="h-3 w-3" />
                                <span>{u.isActive ? 'Bloquear' : 'Desbloquear'}</span>
                              </div>
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-slate-500 text-xs">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
