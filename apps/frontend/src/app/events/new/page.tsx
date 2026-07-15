'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useTenant } from '@/components/tenant-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api';
import { EventCategory } from '@/lib/events.types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Image as ImageIcon, CheckCircle, AlertTriangle } from 'lucide-react';

export default function NewEventPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeTenant } = useTenant();
  const { hasPermission, loading: permLoading } = usePermissions();
  const router = useRouter();

  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch categories on mount and check permissions
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (!authLoading && !permLoading && !hasPermission('events.create')) {
      router.push('/events');
      return;
    }
    
    const fetchCategories = async () => {
      try {
        const response = await api.get('/events/categories');
        setCategories(response.data);
      } catch (err) {
        console.error('Erro ao carregar categorias:', err);
      } finally {
        setCategoriesLoading(false);
      }
    };

    if (activeTenant && !permLoading && hasPermission('events.create')) {
      fetchCategories();
    }
  }, [activeTenant, authLoading, user, permLoading, hasPermission]);

  // Handle banner upload
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 5MB
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
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setBannerUrl(response.data.url);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Falha ao fazer upload da imagem.';
      setError(msg);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;

    setSubmitLoading(true);
    setError(null);

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

      const response = await api.post('/events', payload);
      router.push(`/events/${response.data.id}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Ocorreu um erro ao criar o evento.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (authLoading || permLoading) {
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
            onClick={() => router.push('/events')}
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white hover:bg-slate-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-6 w-px bg-slate-800" />
          <span className="text-lg font-bold text-slate-200">Criar Novo Evento</span>
        </div>
      </header>

      {/* Form Container */}
      <div className="relative z-10 max-w-4xl w-full mx-auto px-6 mt-8 flex-1 flex flex-col space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Configurar Novo Evento</h1>
          <p className="text-slate-400 text-sm mt-1">Preencha os dados do evento. Ele será criado como rascunho para você ajustar a programação.</p>
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
                placeholder="Ex: 1º Congresso de Tecnologia e IA"
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
                placeholder="Descreva os objetivos do evento, público-alvo e informações essenciais..."
                className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
              />
            </div>

            {/* Banner Image Upload */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Banner do Evento</label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="URL da imagem ou faça upload..."
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-650 focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </div>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleBannerUpload}
                    className="hidden"
                    id="banner-file-upload"
                    disabled={uploadLoading}
                  />
                  <label
                    htmlFor="banner-file-upload"
                    className={`h-full flex items-center justify-center space-x-2 border border-slate-850 px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer select-none transition-colors ${
                      uploadLoading ? 'bg-slate-950 text-slate-500' : 'bg-slate-900 hover:bg-slate-850 text-slate-350 hover:text-white'
                    }`}
                  >
                    {uploadLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-4 w-4" />
                        <span>Upload</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
              {bannerUrl && (
                <div className="mt-3 h-36 w-full rounded-xl overflow-hidden border border-slate-850 relative">
                  <img src={bannerUrl} alt="Preview do Banner" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setBannerUrl('')}
                    className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-700 text-white text-2xs font-bold py-1 px-2.5 rounded-md transition-colors"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Categoria</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={categoriesLoading}
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
                className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
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
                className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>

            {/* Online checkbox */}
            <div className="space-y-1.5 md:col-span-2 flex items-center space-x-3 py-2 border-y border-slate-900">
              <input
                type="checkbox"
                id="isOnline-checkbox"
                checked={isOnline}
                onChange={(e) => setIsOnline(e.target.checked)}
                className="h-4.5 w-4.5 rounded bg-slate-950 border-slate-850 text-violet-600 focus:ring-0 focus:ring-offset-0"
              />
              <label htmlFor="isOnline-checkbox" className="text-sm font-bold text-slate-350 select-none cursor-pointer">
                Este evento é realizado Online
              </label>
            </div>

            {/* Conditional Location or Online URL */}
            {isOnline ? (
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Link de Transmissão / Webinar</label>
                <input
                  type="url"
                  placeholder="https://zoom.us/j/... ou link do Youtube"
                  value={onlineUrl}
                  onChange={(e) => setOnlineUrl(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-650 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
            ) : (
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Endereço Físico / Localização</label>
                <input
                  type="text"
                  placeholder="Ex: Av. Paulista, 1000 - São Paulo, SP"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-650 focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-4 border-t border-slate-900">
            <Button
              type="button"
              onClick={() => router.push('/events')}
              variant="ghost"
              className="text-slate-450 hover:text-white hover:bg-slate-900 font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitLoading}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 px-8 rounded-lg shadow-lg shadow-violet-900/20"
            >
              {submitLoading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin mr-2" />
                  <span>Criando...</span>
                </>
              ) : (
                <span>Criar Evento</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
