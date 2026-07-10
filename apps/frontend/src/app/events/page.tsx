'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useTenant } from '@/components/tenant-provider';
import { api } from '@/lib/api';
import { Event, EventCategory } from '@/lib/events.types';
import { Button } from '@/components/ui/button';
import { PwaInstallButton } from '@/components/pwa-install-button';
import {
  Plus,
  Search,
  Calendar,
  MapPin,
  Globe,
  SlidersHorizontal,
  ArrowLeft,
  Loader2,
  Building,
  Tags,
} from 'lucide-react';

export default function EventsListPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeTenant } = useTenant();
  const router = useRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('all');

  const fetchCategories = async () => {
    try {
      const response = await api.get('/events/categories');
      setCategories(response.data);
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
    }
  };

  const fetchEvents = async (cursorToUse?: string | null) => {
    if (!activeTenant) return;
    
    if (cursorToUse) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params: any = {
        limit: 9,
      };
      if (search) params.search = search;
      if (status) params.status = status;
      if (categoryId) params.categoryId = categoryId;
      if (dateRange && dateRange !== 'all') params.dateRange = dateRange;
      if (cursorToUse) params.cursor = cursorToUse;

      const response = await api.get('/events', { params });
      
      if (cursorToUse) {
        setEvents((prev) => [...prev, ...response.data.data]);
      } else {
        setEvents(response.data.data);
      }
      setNextCursor(response.data.nextCursor);
    } catch (err) {
      console.error('Erro ao buscar eventos:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Fetch initial data
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (activeTenant) {
      fetchCategories();
      fetchEvents(null);
    }
  }, [activeTenant, authLoading, user]);

  // Handle filter changes
  const applyFilters = () => {
    fetchEvents(null);
  };

  const resetFilters = () => {
    setSearch('');
    setStatus('');
    setCategoryId('');
    setDateRange('all');
  };

  // Re-run filter when category, status, or dateRange changes directly
  useEffect(() => {
    if (activeTenant) {
      fetchEvents(null);
    }
  }, [categoryId, status, dateRange]);

  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col relative pb-16">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[5%] w-[80%] h-[50%] rounded-full bg-violet-900/5 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[80%] h-[50%] rounded-full bg-indigo-900/5 blur-[120px]" />
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
          <div className="h-6 w-px bg-slate-800" />
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Eventos
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <PwaInstallButton />
          {activeTenant && (
            <div className="flex items-center space-x-2 text-sm text-slate-400 bg-slate-900/40 px-3 py-1.5 rounded-lg border border-slate-850">
              <Building className="h-4 w-4 text-violet-400" />
              <span>{activeTenant.name}</span>
            </div>
          )}
        </div>
      </header>

      {/* Content wrapper */}
      <div className="relative z-10 max-w-7xl w-full mx-auto px-6 mt-8 flex-1 flex flex-col space-y-6">
        {/* Actions bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Eventos Cadastrados</h1>
            <p className="text-slate-400 text-sm mt-1">Gerencie a programação, palestrantes e patrocinadores de seus eventos.</p>
          </div>
          <div className="flex items-center space-x-3 self-start md:self-auto">
            <Button
              onClick={() => router.push('/events/categories')}
              variant="outline"
              className="border-slate-800 bg-slate-900/20 hover:bg-slate-900 text-slate-300 hover:text-white font-semibold flex items-center space-x-2 py-2 px-5 rounded-lg transition-colors border hover:border-slate-700"
            >
              <Tags className="h-4.5 w-4.5 text-violet-400" />
              <span>Categorias</span>
            </Button>
            <Button
              onClick={() => router.push('/events/new')}
              className="bg-violet-600 hover:bg-violet-700 text-white font-semibold flex items-center space-x-2 py-2 px-5 rounded-lg shadow-lg shadow-violet-900/20"
            >
              <Plus className="h-5 w-5" />
              <span>Novo Evento</span>
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-5 backdrop-blur-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-850 pb-3">
            <div className="flex items-center space-x-2 text-slate-350 font-semibold text-sm">
              <SlidersHorizontal className="h-4 w-4 text-violet-400" />
              <span>Painel de Filtros</span>
            </div>
            <button
              onClick={resetFilters}
              className="text-xs text-slate-500 hover:text-violet-400 font-medium transition-colors"
            >
              Limpar Filtros
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 font-semibold uppercase">Buscar por Título</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nome do evento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                  className="w-full bg-slate-950/80 border border-slate-850 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-650 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-650" />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 font-semibold uppercase">Categoria</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
              >
                <option value="">Todas as Categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 font-semibold uppercase">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
              >
                <option value="">Qualquer Status</option>
                <option value="DRAFT">Rascunho (DRAFT)</option>
                <option value="PUBLISHED">Publicado (PUBLISHED)</option>
                <option value="FINISHED">Finalizado (FINISHED)</option>
                <option value="CANCELLED">Cancelado (CANCELLED)</option>
              </select>
            </div>

            {/* Date Range */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 font-semibold uppercase">Período</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
              >
                <option value="all">Todos os Eventos</option>
                <option value="upcoming">Futuros / Em Andamento</option>
                <option value="past">Passados</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={applyFilters}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-1.5 px-4 rounded-lg"
            >
              Aplicar Busca
            </Button>
          </div>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500 mb-3" />
            <span className="text-slate-450 text-sm">Carregando eventos...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="flex-1 border border-dashed border-slate-850 rounded-2xl flex flex-col items-center justify-center py-24 px-6 text-center">
            <Calendar className="h-12 w-12 text-slate-700 mb-4" />
            <h3 className="font-bold text-lg text-slate-350">Nenhum evento encontrado</h3>
            <p className="text-slate-500 text-sm max-w-sm mt-1">Crie um novo evento ou ajuste as opções de busca do seu painel de filtros.</p>
            <Button onClick={() => router.push('/events/new')} className="mt-5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-900/40 text-xs font-bold py-2 px-5 rounded-lg">
              Criar Evento
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => {
                const date = new Date(event.startDate).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });
                
                // Color mapping for status badges
                const statusColors: Record<string, string> = {
                  DRAFT: 'bg-slate-900 border-slate-800 text-slate-400',
                  PUBLISHED: 'bg-emerald-950/40 border-emerald-900/50 text-emerald-400',
                  FINISHED: 'bg-blue-950/40 border-blue-900/50 text-blue-400',
                  CANCELLED: 'bg-red-950/40 border-red-900/50 text-red-400',
                };

                return (
                  <div
                    key={event.id}
                    onClick={() => router.push(`/events/${event.id}`)}
                    className="group cursor-pointer bg-slate-900/30 border border-slate-900 hover:border-slate-800 rounded-2xl p-6 flex flex-col h-full space-y-4 hover:shadow-2xl hover:shadow-violet-950/5 transition-all"
                  >
                    {/* Event Banner Placeholder / Image */}
                    <div className="h-36 w-full rounded-xl bg-slate-950/80 overflow-hidden relative border border-slate-850 flex items-center justify-center">
                      {event.bannerUrl ? (
                        <img
                          src={event.bannerUrl}
                          alt={event.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <Calendar className="h-10 w-10 text-slate-700" />
                      )}
                      
                      {/* Status Badge */}
                      <span className={`absolute top-3 right-3 text-2xs font-extrabold uppercase tracking-wide border px-2 py-0.5 rounded-full ${statusColors[event.status] || 'bg-slate-900'}`}>
                        {event.status}
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        {event.category && (
                          <span
                            className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border"
                            style={{
                              borderColor: `${event.category.color || '#6366f1'}33`,
                              color: event.category.color || '#6366f1',
                              backgroundColor: `${event.category.color || '#6366f1'}11`,
                            }}
                          >
                            {event.category.name}
                          </span>
                        )}
                        <h3 className="font-extrabold text-white text-lg group-hover:text-violet-400 transition-colors line-clamp-1">
                          {event.title}
                        </h3>
                        {event.description && (
                          <p className="text-xs text-slate-500 line-clamp-2">{event.description}</p>
                        )}
                      </div>

                      <div className="space-y-2 pt-2 text-xs text-slate-450 border-t border-slate-900">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-violet-400 flex-shrink-0" />
                          <span>{date}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {event.isOnline ? (
                            <>
                              <Globe className="h-4 w-4 text-violet-400 flex-shrink-0" />
                              <span>Online</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="h-4 w-4 text-violet-400 flex-shrink-0" />
                              <span className="line-clamp-1">{event.location || 'Local não definido'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load More Button */}
            {nextCursor && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => fetchEvents(nextCursor)}
                  disabled={loadingMore}
                  className="bg-slate-900 border border-slate-850 hover:bg-slate-850 text-slate-200 font-semibold py-2 px-8 rounded-lg flex items-center space-x-2 transition-all"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Carregando...</span>
                    </>
                  ) : (
                    <span>Carregar Mais</span>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
