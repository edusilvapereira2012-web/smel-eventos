'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useEventStats, LiveCheckIn } from '@/hooks/use-event-stats';
import {
  Users,
  CheckCircle,
  Clock,
  TrendingUp,
  Download,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface EventDashboardProps {
  eventId: string;
}

interface EventStats {
  registrationsOverTime: Array<{ date: string; count: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
  checkinsByHour: Array<{ hour: string; count: number }>;
  attendanceRate: number;
}

const COLORS = {
  CONFIRMED: '#10B981',   // Emerald
  WAITLIST: '#F59E0B',    // Amber
  CANCELLED: '#EF4444',   // Red
  TRANSFERRED: '#6366F1', // Indigo
};

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmado',
  WAITLIST: 'Lista de Espera',
  CANCELLED: 'Cancelado',
  TRANSFERRED: 'Transferido',
};

export default function EventDashboard({ eventId }: EventDashboardProps) {
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [includeSensitive, setIncludeSensitive] = useState(false);

  // Fetch dashboard statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get(`/dashboard/events/${eventId}`);
      setStats(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao buscar estatísticas do evento:', err);
      setError('Falha ao carregar métricas em tempo real.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Connect to websocket room for real-time live events
  const { isConnected, liveCheckins } = useEventStats(eventId, fetchStats);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Export handlers
  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      const response = await api.get(`/reports/events/${eventId}/export`, {
        params: { format, sensitive: includeSensitive },
        responseType: 'blob',
      });

      const mimeType =
        format === 'csv'
          ? 'text/csv;charset=utf-8;'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `event-registrations-${eventId}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err: any) {
      console.error('Erro ao exportar:', err);
      alert('Erro na exportação. Certifique-se de que possui permissão de exportar dados sensíveis.');
    } finally {
      setExporting(false);
    }
  };

  const handlePresenceList = async () => {
    setExporting(true);
    try {
      const response = await api.get(`/reports/events/${eventId}/presence-list`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      console.error('Erro ao gerar lista de presença:', err);
      alert('Falha ao gerar lista de presença.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-violet-500" />
        <span className="text-slate-400 text-sm">Carregando painel de indicadores...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="font-bold text-lg text-white">Erro no Carregamento</h3>
        <p className="text-slate-400 text-sm mt-1 mb-6">{error || 'Estatísticas indisponíveis.'}</p>
        <button
          onClick={fetchStats}
          className="bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2 px-5 rounded-lg text-sm flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Tentar Novamente</span>
        </button>
      </div>
    );
  }

  // Calculate totals for quick overview cards
  const totalRegistrations = stats.statusDistribution.reduce((acc, curr) => acc + curr.count, 0);
  const confirmedRegistrations = stats.statusDistribution.find((s) => s.status === 'CONFIRMED')?.count || 0;
  const waitlistRegistrations = stats.statusDistribution.find((s) => s.status === 'WAITLIST')?.count || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Real-time indicator and Action buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">
            {isConnected ? 'Painel Conectado (Tempo Real)' : 'WebSocket Desconectado (Modo Estático)'}
          </span>
        </div>
        
        <button
          onClick={fetchStats}
          className="self-start md:self-auto text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 py-1.5 px-3 rounded-lg flex items-center space-x-1.5 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Indicator Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total registrations */}
        <div className="bg-slate-900/30 border border-slate-900/60 p-5 rounded-2xl flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-2xs text-slate-500 font-bold uppercase tracking-wider">Inscrições Totais</span>
            <h4 className="text-2xl font-black text-white mt-0.5">{totalRegistrations}</h4>
          </div>
        </div>

        {/* Confirmed registrations */}
        <div className="bg-slate-900/30 border border-slate-900/60 p-5 rounded-2xl flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-2xs text-slate-500 font-bold uppercase tracking-wider">Confirmados</span>
            <h4 className="text-2xl font-black text-white mt-0.5">{confirmedRegistrations}</h4>
          </div>
        </div>

        {/* Waitlist registrations */}
        <div className="bg-slate-900/30 border border-slate-900/60 p-5 rounded-2xl flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-2xs text-slate-500 font-bold uppercase tracking-wider">Lista de Espera</span>
            <h4 className="text-2xl font-black text-white mt-0.5">{waitlistRegistrations}</h4>
          </div>
        </div>

        {/* Attendance Rate */}
        <div className="bg-slate-900/30 border border-slate-900/60 p-5 rounded-2xl flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <span className="text-2xs text-slate-500 font-bold uppercase tracking-wider">Taxa de Presença</span>
            <h4 className="text-2xl font-black text-white mt-0.5">{stats.attendanceRate}%</h4>
          </div>
        </div>
      </div>

      {/* Main Charts & Feed Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration Timeline Chart */}
        <div className="lg:col-span-2 bg-slate-900/25 border border-slate-900/80 p-6 rounded-2xl space-y-4">
          <div>
            <h3 className="font-bold text-white text-base">Timeline de Inscrições</h3>
            <p className="text-slate-500 text-xs mt-0.5">Visão do volume de novos participantes cadastrados nos últimos 30 dias.</p>
          </div>
          <div className="h-72 w-full text-slate-300">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.registrationsOverTime} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#475569"
                  fontSize={10}
                  tickFormatter={(val) => {
                    const parts = val.split('-');
                    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : val;
                  }}
                />
                <YAxis stroke="#475569" fontSize={10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '8px' }}
                  labelStyle={{ color: '#94A3B8', fontSize: '11px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#F8FAFC', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="count" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" name="Inscrições" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Pie Chart */}
        <div className="bg-slate-900/25 border border-slate-900/80 p-6 rounded-2xl flex flex-col justify-between">
          <div className="space-y-1">
            <h3 className="font-bold text-white text-base">Distribuição por Status</h3>
            <p className="text-slate-500 text-xs">Divisão das inscrições ativas e inativas do evento.</p>
          </div>

          <div className="h-48 w-full relative flex items-center justify-center my-4">
            {totalRegistrations === 0 ? (
              <span className="text-slate-650 text-xs">Sem inscrições para analisar</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.statusDistribution.filter((s) => s.count > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="status"
                  >
                    {stats.statusDistribution.map((entry) => (
                      <Cell key={`cell-${entry.status}`} fill={COLORS[entry.status as keyof typeof COLORS] || '#475569'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '11px', color: '#FFF' }}
                    formatter={(value: any, name: any) => [value, name ? (STATUS_LABELS[name] || name) : '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-2xs font-semibold text-slate-400">
            {stats.statusDistribution.map((s) => (
              <div key={s.status} className="flex items-center space-x-1.5">
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[s.status as keyof typeof COLORS] }}
                />
                <span className="truncate">{STATUS_LABELS[s.status] || s.status}: <strong>{s.count}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Checkins Bar Chart */}
        <div className="lg:col-span-2 bg-slate-900/25 border border-slate-900/80 p-6 rounded-2xl space-y-4">
          <div>
            <h3 className="font-bold text-white text-base">Check-ins por Horário</h3>
            <p className="text-slate-500 text-xs mt-0.5">Acompanhamento do pico de fluxo de entrada dos participantes.</p>
          </div>
          <div className="h-64 w-full">
            {stats.checkinsByHour.every(h => h.count === 0) ? (
              <div className="h-full flex items-center justify-center border border-slate-950/60 rounded-xl bg-slate-950/20">
                <span className="text-slate-600 text-xs">Nenhum check-in registrado para plotar dados</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.checkinsByHour.filter((h) => h.count > 0)} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis dataKey="hour" stroke="#475569" fontSize={10} />
                  <YAxis stroke="#475569" fontSize={10} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', borderRadius: '8px' }}
                    itemStyle={{ color: '#F8FAFC', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} name="Check-ins" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Live Check-in Feed / Stream */}
        <div className="bg-slate-900/25 border border-slate-900/80 p-6 rounded-2xl flex flex-col h-80">
          <div className="border-b border-slate-900 pb-3 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-white text-base">Feed de Check-in</h3>
              <p className="text-slate-500 text-2xs mt-0.5">Histórico recente de acessos na portaria.</p>
            </div>
            <span className="text-3xs bg-violet-600/10 text-violet-400 font-bold border border-violet-900/35 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Live
            </span>
          </div>

          <div className="flex-1 overflow-y-auto mt-4 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-900 pr-1">
            {liveCheckins.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center">
                <p className="text-slate-600 text-xs">Nenhum check-in em tempo real recebido ainda.</p>
              </div>
            ) : (
              liveCheckins.map((ci, index) => (
                <div key={index} className="flex items-start space-x-3 text-xs bg-slate-900/30 p-2.5 border border-slate-900/50 rounded-xl animate-in slide-in-from-top-3 duration-250">
                  <div className="h-7 w-7 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                    {ci.name.substring(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{ci.name}</p>
                    <p className="text-slate-500 text-3xs mt-0.5">
                      Portaria #{ci.total} • {new Date(ci.checkedInAt).toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Reports and Export Panel */}
      <div className="bg-slate-900/20 border border-slate-900/80 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <h3 className="font-bold text-white text-base">Exportação de Relatórios e Listas</h3>
          <p className="text-slate-400 text-xs leading-relaxed">
            Faça download dos dados cadastrais dos participantes do evento ou emita a lista de presença física (PDF com linhas de assinatura) para credenciamento offline.
          </p>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="sensitiveDataToggle"
              checked={includeSensitive}
              onChange={(e) => setIncludeSensitive(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-violet-600 focus:ring-violet-500 h-4 w-4"
            />
            <label htmlFor="sensitiveDataToggle" className="text-xs text-slate-350 select-none flex items-center cursor-pointer">
              Exportar CPFs em claro (dados sensíveis)
              <span className="ml-1 text-slate-550 group relative cursor-help">
                <HelpCircle className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300 ml-1" />
                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 p-2 bg-slate-950 text-3xs text-slate-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border border-slate-850 shadow-xl z-20">
                  Requer permissão de exportação de dados sensíveis e gera um registro nos logs de auditoria de segurança do Tenant.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0 self-start md:self-auto">
          {/* CSV Export */}
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 font-semibold py-2 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-violet-400" />
            <span>Exportar CSV</span>
          </button>

          {/* Excel Export */}
          <button
            onClick={() => handleExport('xlsx')}
            disabled={exporting}
            className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 font-semibold py-2 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span>Exportar Excel</span>
          </button>

          {/* PDF Presence list */}
          <button
            onClick={handlePresenceList}
            disabled={exporting}
            className="bg-violet-600 hover:bg-violet-750 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-violet-900/10 disabled:opacity-50"
          >
            <FileText className="h-4 w-4 text-white" />
            <span>Lista de Presença (PDF)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
