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
  Power,
  Mail,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  Info,
  Trash2,
  X
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

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'DEAD';
  attempts: number;
  lastError: string | null;
  variables: Record<string, any>;
  createdAt: string;
  sentAt: string | null;
}

interface EmailStats {
  sent: number;
  failed: number;
  dead: number;
  pendingInQueue: number;
}

export default function SuperadminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  
  const [activeTab, setActiveTab] = useState<'tenants' | 'users' | 'emails'>('tenants');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // --- PREMIUM CONFIRMATION MODAL STATE ---
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    isDestructive: false,
    onConfirm: () => {},
  });

  const openConfirm = (title: string, message: string, onConfirm: () => void, isDestructive = false) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      isDestructive,
      onConfirm,
    });
  };

  // Email state variables
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [emailPage, setEmailPage] = useState(1);
  const [emailTotalPages, setEmailTotalPages] = useState(1);
  const [emailTotalItems, setEmailTotalItems] = useState(0);
  const [emailStatusFilter, setEmailStatusFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

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

  const fetchEmails = async () => {
    try {
      setLoadingData(true);
      setError(null);
      const [logsRes, statsRes] = await Promise.all([
        api.get('/superadmin/email/logs', {
          params: {
            page: emailPage,
            limit: 10,
            status: emailStatusFilter || undefined,
            search: debouncedSearch || undefined,
          }
        }),
        api.get<EmailStats>('/superadmin/email/stats')
      ]);
      setEmailLogs(logsRes.data.data);
      setEmailTotalPages(logsRes.data.meta.totalPages);
      setEmailTotalItems(logsRes.data.meta.total);
      setEmailStats(statsRes.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Falha ao carregar logs de e-mail.');
    } finally {
      setLoadingData(false);
    }
  };

  const retryEmail = async (id: string) => {
    try {
      setRetryingId(id);
      await api.post(`/superadmin/email/retry/${id}`);
      await fetchEmails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao reenviar e-mail.');
    } finally {
      setRetryingId(null);
    }
  };

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      if (activeTab === 'emails') {
        setEmailPage(1);
      }
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm, activeTab]);

  // Combined fetch trigger
  useEffect(() => {
    if (!authLoading && user && isSuperadmin) {
      if (activeTab === 'emails') {
        fetchEmails();
      } else {
        fetchData();
      }
    }
  }, [user, authLoading, isSuperadmin, activeTab, emailPage, emailStatusFilter, debouncedSearch]);

  const handleRefresh = () => {
    if (activeTab === 'emails') {
      fetchEmails();
    } else {
      fetchData();
    }
  };

  const toggleTenant = async (id: string) => {
    try {
      setActionLoading(id);
      await api.post(`/superadmin/tenants/${id}/toggle`);
      setTenants(prev => 
        prev.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t)
      );
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
      const statsRes = await api.get<Stats>('/superadmin/stats');
      setStats(statsRes.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao alterar status do usuário.');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (id: string) => {
    if (id === user?.id) {
      alert('Você não pode excluir seu próprio usuário de administrador.');
      return;
    }
    openConfirm(
      'Excluir Usuário',
      'Tem certeza de que deseja excluir definitivamente este usuário do sistema? Esta ação é irreversível e apagará todas as associações a organizações e inscrições de eventos.',
      async () => {
        try {
          setActionLoading(id);
          await api.delete(`/superadmin/users/${id}`);
          setUsers(prev => prev.filter(u => u.id !== id));
          const statsRes = await api.get<Stats>('/superadmin/stats');
          setStats(statsRes.data);
        } catch (err: any) {
          alert(err.response?.data?.message || 'Erro ao excluir o usuário.');
        } finally {
          setActionLoading(null);
        }
      },
      true
    );
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
            onClick={handleRefresh} 
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
          
          {/* Email Stats Row (Specific to Email Tab) */}
          {activeTab === 'emails' && emailStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-950/40 rounded-xl border border-slate-900/80">
              <div className="p-3 bg-slate-900/55 rounded-lg border border-slate-900/60 flex items-center space-x-3">
                <div className="p-2 bg-emerald-950/60 rounded text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Enviados</span>
                  <p className="text-lg font-bold mt-0.5 text-emerald-400">{emailStats.sent}</p>
                </div>
              </div>

              <div className="p-3 bg-slate-900/55 rounded-lg border border-slate-900/60 flex items-center space-x-3">
                <div className="p-2 bg-blue-950/60 rounded text-blue-400">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fila (Queue)</span>
                  <p className="text-lg font-bold mt-0.5 text-blue-400">{emailStats.pendingInQueue}</p>
                </div>
              </div>

              <div className="p-3 bg-slate-900/55 rounded-lg border border-slate-900/60 flex items-center space-x-3">
                <div className="p-2 bg-yellow-950/60 rounded text-yellow-400">
                  <XCircle className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Falhas</span>
                  <p className="text-lg font-bold mt-0.5 text-yellow-400">{emailStats.failed}</p>
                </div>
              </div>

              <div className="p-3 bg-slate-900/55 rounded-lg border border-slate-900/60 flex items-center space-x-3">
                <div className="p-2 bg-red-950/60 rounded text-red-500">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Mortos (DLQ)</span>
                  <p className="text-lg font-bold mt-0.5 text-red-400">{emailStats.dead}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Tabs */}
            <div className="flex space-x-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-900 w-full lg:max-w-md">
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
              <button
                onClick={() => { setActiveTab('emails'); setSearchTerm(''); }}
                className={`flex-1 py-1.5 px-4 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'emails' 
                    ? 'bg-violet-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Logs de E-mail
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full lg:max-w-xl justify-end">
              {/* Status Filter for Email tab */}
              {activeTab === 'emails' && (
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-900 overflow-x-auto whitespace-nowrap scrollbar-none">
                  <button
                    onClick={() => { setEmailStatusFilter(''); setEmailPage(1); }}
                    className={`py-1 px-2.5 rounded-md text-[10px] font-semibold transition-all ${
                      emailStatusFilter === '' 
                        ? 'bg-slate-800 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => { setEmailStatusFilter('SENT'); setEmailPage(1); }}
                    className={`py-1 px-2.5 rounded-md text-[10px] font-semibold transition-all ${
                      emailStatusFilter === 'SENT' 
                        ? 'bg-emerald-950 text-emerald-400 shadow-sm border border-emerald-900/30' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Enviados
                  </button>
                  <button
                    onClick={() => { setEmailStatusFilter('PENDING'); setEmailPage(1); }}
                    className={`py-1 px-2.5 rounded-md text-[10px] font-semibold transition-all ${
                      emailStatusFilter === 'PENDING' 
                        ? 'bg-blue-950 text-blue-400 shadow-sm border border-blue-900/30' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Fila
                  </button>
                  <button
                    onClick={() => { setEmailStatusFilter('FAILED'); setEmailPage(1); }}
                    className={`py-1 px-2.5 rounded-md text-[10px] font-semibold transition-all ${
                      emailStatusFilter === 'FAILED' 
                        ? 'bg-yellow-950 text-yellow-400 shadow-sm border border-yellow-900/30' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Falhas
                  </button>
                  <button
                    onClick={() => { setEmailStatusFilter('DEAD'); setEmailPage(1); }}
                    className={`py-1 px-2.5 rounded-md text-[10px] font-semibold transition-all ${
                      emailStatusFilter === 'DEAD' 
                        ? 'bg-red-950 text-red-400 shadow-sm border border-red-900/30' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Mortos
                  </button>
                </div>
              )}

              {/* Search Input */}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder={
                    activeTab === 'tenants' 
                      ? 'Buscar organização...' 
                      : activeTab === 'users' 
                        ? 'Buscar usuário...' 
                        : 'Buscar por destinatário, assunto...'
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-950 border border-slate-900 rounded-lg focus:outline-none focus:border-violet-500 text-slate-200 placeholder-slate-500 transition-all"
                />
              </div>
            </div>
          </div>

          {loadingData ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-violet-500" />
              <span className="text-xs text-slate-500">Carregando dados...</span>
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
          ) : activeTab === 'users' ? (
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
                        <td className="px-6 py-4.5 text-right font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <Button
                              onClick={() => toggleUser(u.id)}
                              disabled={actionLoading === u.id || u.email === 'valterpcjr@gmail.com'}
                              variant="ghost"
                              className={`h-8 text-xs font-semibold px-3 rounded-lg border border-slate-800 ${
                                u.email === 'valterpcjr@gmail.com' 
                                  ? 'opacity-45 cursor-not-allowed'
                                  : u.isActive 
                                    ? 'text-red-450 hover:text-red-300 hover:bg-red-950/10' 
                                    : 'text-emerald-450 hover:text-emerald-300 hover:bg-emerald-950/10'
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
                            <Button
                              onClick={() => deleteUser(u.id)}
                              disabled={actionLoading === u.id || u.email === 'valterpcjr@gmail.com'}
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 rounded-lg border border-slate-800 text-red-500 hover:text-red-400 hover:bg-red-955/15 ${
                                u.email === 'valterpcjr@gmail.com' ? 'opacity-40 cursor-not-allowed' : ''
                              }`}
                              title="Excluir Usuário definitivamente do sistema"
                            >
                              {actionLoading === u.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
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
          ) : (
            /* Email Logs Table */
            <div className="space-y-4">
              <div className="overflow-x-auto border border-slate-900/60 rounded-xl">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-slate-950/65 border-b border-slate-900 text-slate-400 text-xs font-semibold uppercase">
                      <th className="px-6 py-4">Destinatário</th>
                      <th className="px-6 py-4">Assunto</th>
                      <th className="px-6 py-4">Template</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-center">Tentativas</th>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {emailLogs.length > 0 ? (
                      emailLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-900/10 transition-colors">
                          <td className="px-6 py-4.5 font-semibold text-slate-200 select-all">{log.to}</td>
                          <td className="px-6 py-4.5 text-slate-300 max-w-[200px] truncate" title={log.subject}>{log.subject}</td>
                          <td className="px-6 py-4.5 text-slate-500 font-mono text-xs">{log.template}</td>
                          <td className="px-6 py-4.5 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.status === 'SENT' 
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30' 
                                : log.status === 'FAILED'
                                  ? 'bg-yellow-950/60 text-yellow-400 border border-yellow-900/30'
                                  : log.status === 'DEAD'
                                    ? 'bg-red-950/60 text-red-400 border border-red-900/30'
                                    : 'bg-blue-950/60 text-blue-400 border border-blue-900/30'
                            }`}>
                              {log.status === 'SENT' 
                                ? 'Enviado' 
                                : log.status === 'FAILED' 
                                  ? 'Falhou' 
                                  : log.status === 'DEAD' 
                                    ? 'Morto (DLQ)' 
                                    : 'Fila (Queue)'}
                            </span>
                          </td>
                          <td className="px-6 py-4.5 text-center text-slate-400 font-semibold">{log.attempts}</td>
                          <td className="px-6 py-4.5 text-slate-500 text-xs">
                            {new Date(log.createdAt).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-6 py-4.5 text-right flex items-center justify-end space-x-2">
                            <Button
                              onClick={() => setSelectedLog(log)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900"
                              title="Visualizar Detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {log.status !== 'SENT' && (
                              <Button
                                onClick={() => retryEmail(log.id)}
                                disabled={retryingId === log.id}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg border border-slate-800 text-violet-400 hover:text-violet-300 hover:bg-violet-950/15"
                                title="Re-enfileirar E-mail"
                              >
                                <RefreshCw className={`h-4 w-4 ${retryingId === log.id ? 'animate-spin' : ''}`} />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-slate-500 text-xs">
                          Nenhum log de e-mail encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls for emails */}
              {emailTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4 border-t border-slate-900/60 pt-4">
                  <span className="text-xs text-slate-500">
                    Mostrando {(emailPage - 1) * 10 + 1} a {Math.min(emailPage * 10, emailTotalItems)} de {emailTotalItems} e-mails
                  </span>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => setEmailPage(prev => Math.max(prev - 1, 1))}
                      disabled={emailPage === 1}
                      variant="outline"
                      size="sm"
                      className="border-slate-800 bg-slate-900/30 text-slate-350 hover:text-white"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-slate-450 self-center px-1">
                      Página {emailPage} de {emailTotalPages}
                    </span>
                    <Button
                      onClick={() => setEmailPage(prev => Math.min(prev + 1, emailTotalPages))}
                      disabled={emailPage === emailTotalPages}
                      variant="outline"
                      size="sm"
                      className="border-slate-800 bg-slate-900/30 text-slate-350 hover:text-white"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Modal de Detalhes do E-mail */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center space-x-2">
                <Mail className="h-5 w-5 text-violet-400" />
                <h3 className="font-bold text-slate-200">Detalhes do E-mail</h3>
              </div>
              <button 
                onClick={() => setSelectedLog(null)} 
                className="text-slate-400 hover:text-white transition-colors"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            {/* Content */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-2 text-sm border-b border-slate-800/50 pb-4">
                <span className="text-slate-400 font-medium">Destinatário:</span>
                <span className="col-span-2 text-slate-200 font-mono select-all break-all">{selectedLog.to}</span>
                
                <span className="text-slate-400 font-medium">Assunto:</span>
                <span className="col-span-2 text-slate-200 font-semibold">{selectedLog.subject}</span>
                
                <span className="text-slate-400 font-medium">Template:</span>
                <span className="col-span-2 text-slate-350 font-mono text-xs">{selectedLog.template}</span>
                
                <span className="text-slate-400 font-medium">Status:</span>
                <span className="col-span-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedLog.status === 'SENT' 
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30' 
                      : selectedLog.status === 'FAILED'
                        ? 'bg-yellow-950/60 text-yellow-400 border border-yellow-900/30'
                        : selectedLog.status === 'DEAD'
                          ? 'bg-red-950/60 text-red-400 border border-red-900/30'
                          : 'bg-blue-950/60 text-blue-400 border border-blue-900/30'
                  }`}>
                    {selectedLog.status === 'SENT' 
                      ? 'Enviado' 
                      : selectedLog.status === 'FAILED' 
                        ? 'Falhou' 
                        : selectedLog.status === 'DEAD' 
                          ? 'Morto (DLQ)' 
                          : 'Fila (Queue)'}
                  </span>
                </span>
                
                <span className="text-slate-400 font-medium">Tentativas:</span>
                <span className="col-span-2 text-slate-200">{selectedLog.attempts}</span>

                <span className="text-slate-400 font-medium">Criado em:</span>
                <span className="col-span-2 text-slate-350 text-xs">
                  {new Date(selectedLog.createdAt).toLocaleString('pt-BR')}
                </span>

                {selectedLog.sentAt && (
                  <>
                    <span className="text-slate-400 font-medium">Enviado em:</span>
                    <span className="col-span-2 text-slate-350 text-xs">
                      {new Date(selectedLog.sentAt).toLocaleString('pt-BR')}
                    </span>
                  </>
                )}
              </div>

              {selectedLog.lastError && (
                <div className="space-y-1.5 p-3.5 bg-red-950/20 border border-red-900/40 rounded-xl text-red-300">
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Último Erro</span>
                  </div>
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-black/35 p-2.5 rounded-lg border border-red-900/20 overflow-x-auto max-h-40">
                    {selectedLog.lastError}
                  </pre>
                </div>
              )}

              <div className="space-y-1.5">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Variáveis do Template (JSON)</span>
                <pre className="text-xs font-mono bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-300 overflow-x-auto max-h-60">
                  {JSON.stringify(selectedLog.variables, null, 2)}
                </pre>
              </div>
            </div>
            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/20 flex justify-end space-x-3">
              <Button 
                onClick={() => setSelectedLog(null)} 
                variant="outline" 
                className="border-slate-800 bg-slate-900/30 text-slate-300 hover:text-white"
              >
                Fechar
              </Button>
              {selectedLog.status !== 'SENT' && (
                <Button
                  onClick={() => {
                    retryEmail(selectedLog.id);
                    setSelectedLog(null);
                  }}
                  disabled={retryingId === selectedLog.id}
                  className="bg-violet-600 hover:bg-violet-500 text-white flex items-center space-x-2"
                >
                  <RefreshCw className={`h-4 w-4 ${retryingId === selectedLog.id ? 'animate-spin' : ''}`} />
                  <span>Reenviar Agora</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: PREMIUM CONFIRMATION --- */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
              className="absolute top-4 right-4 text-slate-450 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center text-center space-y-3">
              <div className={`p-3 rounded-full ${confirmModal.isDestructive ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'}`}>
                {confirmModal.isDestructive ? (
                  <AlertTriangle className="h-6 w-6 animate-pulse" />
                ) : (
                  <CheckCircle2 className="h-6 w-6" />
                )}
              </div>
              
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-white text-base">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="w-full bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold text-xs py-2.5 rounded-xl border border-slate-750 transition-all duration-150"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                }}
                className={`w-full text-white font-bold text-xs py-2.5 rounded-xl transition-all duration-150 shadow-lg ${
                  confirmModal.isDestructive
                    ? 'bg-red-600 hover:bg-red-750 shadow-red-950/20'
                    : 'bg-violet-600 hover:bg-violet-750 shadow-violet-950/20'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

