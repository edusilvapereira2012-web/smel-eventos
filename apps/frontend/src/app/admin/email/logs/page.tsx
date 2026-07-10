'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useTenant } from '@/components/tenant-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Mail,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import Link from 'next/link';

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

interface Stats {
  sent: number;
  failed: number;
  dead: number;
  pendingInQueue: number;
}

export default function EmailLogsPage() {
  const { activeTenant } = useTenant();
  const { hasPermission, role } = usePermissions();
  const router = useRouter();

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [stats, setStats] = useState<Stats>({ sent: 0, failed: 0, dead: 0, pendingInQueue: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Selected Log Modal
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  // Actions states
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingDead, setRetryingDead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchStats = useCallback(async () => {
    if (!activeTenant) return;
    try {
      setLoadingStats(true);
      const response = await api.get(`/admin/email/stats`);
      setStats(response.data);
    } catch (err: any) {
      console.error('Falha ao buscar estatísticas de email:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [activeTenant]);

  const fetchLogs = useCallback(async () => {
    if (!activeTenant) return;
    try {
      setLoading(true);
      const params: Record<string, any> = {
        page,
        limit: 10,
      };
      if (statusFilter) {
        params.status = statusFilter;
      }
      if (debouncedSearch) {
        // As search is handled in backend or frontend depending on implementation,
        // let's pass search query to the logs endpoint.
        params.search = debouncedSearch;
      }

      const response = await api.get(`/admin/email/logs`, { params });
      setLogs(response.data.data);
      setTotalPages(response.data.meta.totalPages);
      setTotalItems(response.data.meta.total);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao buscar logs de e-mail.');
    } finally {
      setLoading(false);
    }
  }, [activeTenant, page, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (activeTenant) {
      fetchStats();
    }
  }, [activeTenant, fetchStats]);

  useEffect(() => {
    if (activeTenant) {
      fetchLogs();
    }
  }, [activeTenant, fetchLogs]);

  const handleRetrySingle = async (id: string) => {
    setRetryingId(id);
    setError(null);
    setSuccess(null);
    try {
      await api.post(`/admin/email/retry/${id}`);
      setSuccess('E-mail reenviado com sucesso para a fila.');
      fetchLogs();
      fetchStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao reenviar e-mail.');
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAllDead = async () => {
    if (!confirm('Deseja realmente reenviar todos os e-mails com status DEAD para a fila?')) return;
    setRetryingDead(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await api.post(`/admin/email/retry-dead`);
      setSuccess(response.data.message || 'Todos os e-mails DEAD foram re-enfileirados.');
      fetchLogs();
      fetchStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Apenas o OWNER da organização pode reenviar e-mails DEAD.');
    } finally {
      setRetryingDead(false);
    }
  };

  if (!activeTenant) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <p>Selecione um inquilino para acessar o monitoramento de e-mails.</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            <span>Enviado</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-450 border border-amber-500/20">
            <AlertTriangle className="h-3 w-3" />
            <span>Falhou</span>
          </span>
        );
      case 'DEAD':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-450 border border-rose-500/20">
            <XCircle className="h-3 w-3" />
            <span>Dead (DLQ)</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="h-3 w-3 animate-pulse" />
            <span>Pendente</span>
          </span>
        );
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 px-6 py-12 relative">
      {/* Glow Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-violet-900/10 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-blue-900/10 blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link href="/" className="inline-flex p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-sm font-semibold text-slate-400">Voltar ao Painel</span>
          </div>

          <Button
            onClick={() => {
              fetchLogs();
              fetchStats();
            }}
            variant="ghost"
            className="text-slate-400 hover:text-white border border-slate-800 bg-slate-900/30"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Header Title */}
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-violet-500">
            Monitor de Comunicação
          </h1>
          <p className="text-slate-400">
            Acompanhe o status de envios de e-mails, retentativas e monitoramento de fila da organização <span className="text-violet-400 font-semibold">{activeTenant.name}</span>.
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="rounded-lg bg-red-950/40 border border-red-800/50 p-4 text-sm text-red-400 flex items-center space-x-2">
            <XCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/50 p-4 text-sm text-emerald-400 flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5" />
            <span>{success}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 bg-slate-900/40 rounded-xl border border-slate-800/80 backdrop-blur-xl flex items-center space-x-4 shadow-lg">
            <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-450 border border-emerald-500/20">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Enviados</span>
              <h3 className="text-2xl font-bold text-slate-100">{loadingStats ? '...' : stats.sent}</h3>
            </div>
          </div>

          <div className="p-6 bg-slate-900/40 rounded-xl border border-slate-800/80 backdrop-blur-xl flex items-center space-x-4 shadow-lg">
            <div className="p-3 bg-amber-500/10 rounded-lg text-amber-450 border border-amber-500/20">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Falhas (Tentando)</span>
              <h3 className="text-2xl font-bold text-slate-100">{loadingStats ? '...' : stats.failed}</h3>
            </div>
          </div>

          <div className="p-6 bg-slate-900/40 rounded-xl border border-slate-800/80 backdrop-blur-xl flex items-center space-x-4 shadow-lg relative overflow-hidden group">
            <div className="p-3 bg-rose-500/10 rounded-lg text-rose-450 border border-rose-500/20">
              <XCircle className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Permanentes (DEAD)</span>
              <h3 className="text-2xl font-bold text-slate-100">{loadingStats ? '...' : stats.dead}</h3>
            </div>
            {stats.dead > 0 && role === 'OWNER' && (
              <div className="absolute right-4 top-4">
                <Button
                  onClick={handleRetryAllDead}
                  disabled={retryingDead}
                  size="xs"
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] px-2 py-1 h-auto rounded transition-all"
                >
                  {retryingDead ? 'Enviando...' : 'Reenviar Todos'}
                </Button>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-900/40 rounded-xl border border-slate-800/80 backdrop-blur-xl flex items-center space-x-4 shadow-lg">
            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/20">
              <Clock className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <span className="text-xs text-slate-500 uppercase font-semibold">Fila / Pendentes</span>
              <h3 className="text-2xl font-bold text-slate-100">{loadingStats ? '...' : stats.pendingInQueue}</h3>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-900 flex flex-col md:flex-row gap-4 items-center justify-between shadow-md">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar destinatário..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div className="flex gap-4 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full md:w-48 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="">Todos os Status</option>
              <option value="PENDING">Pendentes</option>
              <option value="SENT">Enviados</option>
              <option value="FAILED">Falhou</option>
              <option value="DEAD">Dead (DLQ)</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="p-6 bg-slate-900/40 rounded-xl border border-slate-800/80 backdrop-blur-xl shadow-lg">
          {loading ? (
            <div className="space-y-4">
              <div className="h-10 w-full animate-pulse bg-slate-850 rounded-lg" />
              <div className="h-12 w-full animate-pulse bg-slate-850 rounded-lg" />
              <div className="h-12 w-full animate-pulse bg-slate-850 rounded-lg" />
              <div className="h-12 w-full animate-pulse bg-slate-850 rounded-lg" />
              <div className="h-12 w-full animate-pulse bg-slate-850 rounded-lg" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Mail className="h-12 w-12 text-slate-600 mx-auto" />
              <p className="text-slate-400 text-sm">Nenhum log de e-mail encontrado para esta busca.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="text-xs text-slate-500 uppercase border-b border-slate-850">
                    <tr>
                      <th className="py-3.5 px-4">Destinatário</th>
                      <th className="py-3.5 px-4">Assunto</th>
                      <th className="py-3.5 px-4">Template</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-center">Tentativas</th>
                      <th className="py-3.5 px-4">Data</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-900 hover:bg-slate-900/10 transition-colors">
                        <td className="py-3.5 px-4 text-slate-200 font-medium max-w-[200px] truncate">{log.to}</td>
                        <td className="py-3.5 px-4 text-slate-300 max-w-[240px] truncate">{log.subject}</td>
                        <td className="py-3.5 px-4 font-mono text-xs text-violet-400">{log.template}</td>
                        <td className="py-3.5 px-4">{getStatusBadge(log.status)}</td>
                        <td className="py-3.5 px-4 text-center font-semibold text-slate-300">{log.attempts}/3</td>
                        <td className="py-3.5 px-4 text-xs">
                          {new Date(log.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3.5 px-4 text-right flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            title="Detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {(log.status === 'FAILED' || log.status === 'DEAD') && (
                            <Button
                              onClick={() => handleRetrySingle(log.id)}
                              disabled={retryingId === log.id}
                              variant="outline"
                              size="xs"
                              className="border-slate-700 bg-slate-900/80 hover:bg-violet-950/30 hover:border-violet-800 text-slate-300 hover:text-violet-400 text-xs py-1 px-2.5 h-auto rounded transition-all"
                            >
                              {retryingId === log.id ? 'Reenviando...' : 'Reenviar'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-900 pt-4 text-sm text-slate-500">
                  <span>
                    Mostrando <span className="font-semibold text-slate-400">{logs.length}</span> de{' '}
                    <span className="font-semibold text-slate-400">{totalItems}</span> logs
                  </span>

                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      variant="outline"
                      className="border-slate-800 bg-slate-900/30 h-8 px-3 text-xs disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <span className="text-slate-400 font-semibold px-2">
                      Página {page} de {totalPages}
                    </span>
                    <Button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      variant="outline"
                      className="border-slate-800 bg-slate-900/30 h-8 px-3 text-xs disabled:opacity-30"
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl relative space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <Mail className="h-5 w-5 text-violet-400" />
                <span>Log de E-mail Detalhado</span>
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-450 hover:text-slate-200 text-lg font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 uppercase font-semibold">ID do Log</span>
                <p className="font-mono text-xs text-slate-300">{selectedLog.id}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500 uppercase font-semibold">Status</span>
                <div>{getStatusBadge(selectedLog.status)}</div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500 uppercase font-semibold">Destinatário</span>
                <p className="text-slate-200 font-semibold">{selectedLog.to}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500 uppercase font-semibold">Template</span>
                <p className="font-mono text-xs text-violet-400">{selectedLog.template}</p>
              </div>

              <div className="space-y-1 md:col-span-2">
                <span className="text-xs text-slate-500 uppercase font-semibold">Assunto</span>
                <p className="text-slate-200 font-semibold">{selectedLog.subject}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500 uppercase font-semibold">Criado em</span>
                <p className="text-slate-350">{new Date(selectedLog.createdAt).toLocaleString('pt-BR')}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500 uppercase font-semibold">Enviado em</span>
                <p className="text-slate-350">
                  {selectedLog.sentAt
                    ? new Date(selectedLog.sentAt).toLocaleString('pt-BR')
                    : 'Não enviado ainda'}
                </p>
              </div>
            </div>

            {/* Error message */}
            {selectedLog.lastError && (
              <div className="p-4 bg-rose-950/20 border border-rose-900/50 rounded-lg space-y-2">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center space-x-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Erro da última tentativa</span>
                </span>
                <p className="text-xs font-mono text-rose-300 whitespace-pre-wrap break-all bg-rose-950/40 p-3 rounded border border-rose-900/30">
                  {selectedLog.lastError}
                </p>
              </div>
            )}

            {/* Template Variables */}
            <div className="space-y-2">
              <span className="text-xs text-slate-500 uppercase font-semibold">Variáveis do Template (Payload)</span>
              <pre className="text-xs font-mono bg-slate-950 p-4 rounded-lg border border-slate-850 overflow-x-auto text-slate-300">
                {JSON.stringify(selectedLog.variables, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end space-x-3 border-t border-slate-800 pt-4">
              <Button
                onClick={() => setSelectedLog(null)}
                variant="outline"
                className="border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                Fechar
              </Button>
              {(selectedLog.status === 'FAILED' || selectedLog.status === 'DEAD') && (
                <Button
                  onClick={() => {
                    handleRetrySingle(selectedLog.id);
                    setSelectedLog(null);
                  }}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  Reenviar Agora
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
