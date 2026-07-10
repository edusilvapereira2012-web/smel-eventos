'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useTenant } from '@/components/tenant-provider';
import { api } from '@/lib/api';
import { Event, EventCategory } from '@/lib/events.types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Image as ImageIcon, AlertTriangle, CheckCircle } from 'lucide-react';

export default function EditEventPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeTenant } = useTenant();
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [location, setLocation] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [onlineUrl, setOnlineUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [capacity, setCapacity] = useState<number>(100);
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const [evRes, catRes] = await Promise.all([
          api.get(`/events/${eventId}`),
          api.get('/events/categories'),
        ]);

        const ev = evRes.data as Event;
        setCategories(catRes.data);

        setTitle(ev.title);
        setDescription(ev.description || '');
        setBannerUrl(ev.bannerUrl || '');
        setIsOnline(ev.isOnline);
        setLocation(ev.location || '');
        setOnlineUrl(ev.onlineUrl || '');
        setCategoryId(ev.categoryId || '');
        setCapacity(ev.capacity);

        if (ev.startDate) setStartDate(new Date(ev.startDate).toISOString().slice(0, 16));
        if (ev.endDate) setEndDate(new Date(ev.endDate).toISOString().slice(0, 16));
      } catch (err: any) {
        setError(err.response?.data?.message || 'Erro ao carregar dados do evento.');
      } finally {
        setLoading(false);
      }
    };

    if (activeTenant && eventId) {
      loadData();
    }
  }, [activeTenant, eventId, authLoading, user]);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('O arquivo deve ter menos de 5MB.');
      return;
    }

    setUploadLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBannerUrl(response.data.url);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha no upload da imagem.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        title,
        description: description || undefined,
        bannerUrl: bannerUrl || undefined,
        location: isOnline ? undefined : location || undefined,
        isOnline,
        onlineUrl: isOnline ? onlineUrl || undefined : undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        capacity: Number(capacity),
        categoryId: categoryId || undefined,
      };

      await api.patch(`/events/${eventId}`, payload);
      setSuccess('Evento atualizado com sucesso.');
      setTimeout(() => {
        router.push(`/events/${eventId}`);
      }, 1500);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Ocorreu um erro ao atualizar o evento.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (authLoading || loading) {
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
        <div className="absolute top-[10%] left-[25%] w-[50%] h-[50%] rounded-full bg-violet-900/5 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-slate-900 bg-slate-950/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => router.push(`/events/${eventId}`)}
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white hover:bg-slate-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-6 w-px bg-slate-800" />
          <span className="text-lg font-bold text-slate-200">Editar Evento</span>
        </div>
      </header>

      {/* Form Container */}
      <div className="relative z-10 max-w-4xl w-full mx-auto px-6 mt-8 flex-1 flex flex-col space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Editar Detalhes do Evento</h1>
          <p className="text-slate-400 text-sm mt-1">Ajuste os dados gerais e salve as alterações.</p>
        </div>

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-xl text-sm text-red-400 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Houve um problema:</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-900/50 rounded-xl text-sm text-emerald-400 flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="font-semibold">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 md:p-8 backdrop-blur-xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Título do Evento *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Descrição / Detalhes</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
              />
            </div>

            {/* Banner Image */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Banner do Evento</label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="URL da imagem..."
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </div>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBannerUpload}
                    className="hidden"
                    id="edit-banner-file"
                  />
                  <label
                    htmlFor="edit-banner-file"
                    className="h-full flex items-center justify-center space-x-2 border border-slate-850 bg-slate-900 px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer text-slate-350 hover:text-white"
                  >
                    {uploadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    <span>Upload</span>
                  </label>
                </div>
              </div>
              {bannerUrl && (
                <div className="mt-3 h-36 w-full rounded-xl overflow-hidden border border-slate-850 relative">
                  <img src={bannerUrl} alt="Preview" className="h-full w-full object-cover" />
                </div>
              )}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Categoria</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
              >
                <option value="">Selecione uma Categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Capacity */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Capacidade Máxima *</label>
              <input
                type="number"
                required
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Início do Evento *</label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none"
              />
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Término do Evento *</label>
              <input
                type="datetime-local"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none"
              />
            </div>

            {/* Online checkbox */}
            <div className="space-y-1.5 md:col-span-2 flex items-center space-x-3 py-2 border-y border-slate-900">
              <input
                type="checkbox"
                id="edit-page-isOnline"
                checked={isOnline}
                onChange={(e) => setIsOnline(e.target.checked)}
                className="h-4.5 w-4.5 rounded bg-slate-950 border-slate-850 text-violet-600 focus:ring-0"
              />
              <label htmlFor="edit-page-isOnline" className="text-sm font-bold text-slate-350 select-none cursor-pointer">
                Este evento é realizado Online
              </label>
            </div>

            {/* Conditional Location or Online URL */}
            {isOnline ? (
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Link de Transmissão / Webinar</label>
                <input
                  type="url"
                  value={onlineUrl}
                  onChange={(e) => setOnlineUrl(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none"
                />
              </div>
            ) : (
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Localização Física</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-4 border-t border-slate-900">
            <Button
              type="button"
              onClick={() => router.push(`/events/${eventId}`)}
              variant="ghost"
              className="text-slate-450 hover:text-white"
            >
              Voltar
            </Button>
            <Button
              type="submit"
              disabled={submitLoading}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 px-8 rounded-lg shadow-lg shadow-violet-900/20"
            >
              {submitLoading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin mr-2" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar Detalhes</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
