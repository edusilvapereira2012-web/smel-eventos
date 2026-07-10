'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useTenant } from '@/components/tenant-provider';
import { api } from '@/lib/api';
import { EventCategory } from '@/lib/events.types';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Loader2, 
  Plus, 
  Edit2, 
  Trash2, 
  Tags, 
  AlertTriangle,
  X,
  Palette
} from 'lucide-react';

const COLOR_PRESETS = [
  { name: 'Roxo', value: '#8B5CF6', bgClass: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  { name: 'Esmeralda', value: '#10B981', bgClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { name: 'Azul', value: '#3B82F6', bgClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { name: 'Âmbar', value: '#F59E0B', bgClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { name: 'Rosa', value: '#F43F5E', bgClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { name: 'Ciano', value: '#06B6D4', bgClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { name: 'Laranja', value: '#F97316', bgClass: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { name: 'Índigo', value: '#6366F1', bgClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' }
];

export default function CategoriesPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeTenant } = useTenant();
  const router = useRouter();

  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EventCategory | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#8B5CF6');
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation States
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState<EventCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const response = await api.get('/events/categories');
      setCategories(response.data);
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
      setError('Não foi possível carregar as categorias.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (activeTenant) {
      fetchCategories();
    }
  }, [activeTenant, authLoading, user]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setColor('#8B5CF6');
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (category: EventCategory) => {
    setEditingCategory(category);
    setName(category.name);
    setColor(category.color || '#8B5CF6');
    setModalError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setModalError('O nome da categoria é obrigatório.');
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      if (editingCategory) {
        // Edit
        await api.patch(`/events/categories/${editingCategory.id}`, { name, color });
        setSuccess(`Categoria "${name}" atualizada com sucesso!`);
      } else {
        // Create
        await api.post('/events/categories', { name, color });
        setSuccess(`Categoria "${name}" criada com sucesso!`);
      }
      setModalOpen(false);
      fetchCategories();
      // Clear success alert after 3s
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar categoria:', err);
      const msg = err.response?.data?.message || 'Falha ao salvar a categoria.';
      setModalError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmCategory) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/events/categories/${deleteConfirmCategory.id}`);
      setSuccess(`Categoria "${deleteConfirmCategory.name}" excluída com sucesso.`);
      setDeleteConfirmCategory(null);
      fetchCategories();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Erro ao excluir categoria:', err);
      const msg = err.response?.data?.message || 'Não foi possível excluir esta categoria.';
      setError(
        msg.includes('foreign key') || msg.includes('utilizada')
          ? 'Esta categoria não pode ser excluída pois está associada a um ou mais eventos.'
          : msg
      );
      setDeleteConfirmCategory(null);
    } finally {
      setDeleting(false);
    }
  };

  const getPresetOrCustomBadgeClass = (catColor: string | null | undefined) => {
    const preset = COLOR_PRESETS.find(p => p.value.toLowerCase() === (catColor || '').toLowerCase());
    if (preset) return preset.bgClass;
    return 'text-slate-200 border-slate-700 bg-slate-800/40';
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
        <div className="absolute top-[10%] left-[10%] w-[60%] h-[50%] rounded-full bg-violet-900/5 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[60%] h-[50%] rounded-full bg-indigo-900/5 blur-[120px]" />
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
          <span className="text-lg font-bold text-slate-200">Gerenciar Categorias</span>
        </div>
      </header>

      {/* Content wrapper */}
      <div className="relative z-10 max-w-4xl w-full mx-auto px-6 mt-8 flex-1 flex flex-col space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Tags className="h-8 w-8 text-violet-500" />
              <span>Categorias de Evento</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">Crie e edite marcadores visuais para organizar e filtrar seus eventos.</p>
          </div>
          <Button
            onClick={openCreateModal}
            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold flex items-center space-x-2 py-2.5 px-5 rounded-lg shadow-lg shadow-violet-900/20 self-start sm:self-auto"
          >
            <Plus className="h-5 w-5" />
            <span>Nova Categoria</span>
          </Button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-xl text-sm text-red-400 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Aviso:</p>
              <p className="mt-1">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-900/50 rounded-xl text-sm text-emerald-400 flex items-start space-x-3">
            <div className="flex-1">
              <p className="font-bold">Sucesso!</p>
              <p className="mt-0.5">{success}</p>
            </div>
            <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Categories List */}
        <div className="bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden backdrop-blur-xl">
          {categories.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Tags className="h-12 w-12 text-slate-700 mx-auto mb-3" />
              <p className="font-bold text-slate-400">Nenhuma categoria cadastrada</p>
              <p className="text-sm mt-1">Crie a sua primeira categoria clicando no botão acima.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-900/80">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between p-4.5 hover:bg-slate-900/10 transition-colors">
                  <div className="flex items-center space-x-4">
                    {/* Color Preview Badge */}
                    <span 
                      className={`text-xs font-bold uppercase px-3 py-1 rounded-full border ${getPresetOrCustomBadgeClass(category.color)}`}
                      style={!COLOR_PRESETS.some(p => p.value.toLowerCase() === (category.color || '').toLowerCase()) ? {
                        backgroundColor: `${category.color}15`,
                        color: category.color || '#fff',
                        borderColor: `${category.color}30`
                      } : undefined}
                    >
                      {category.name}
                    </span>
                    <span className="text-xs text-slate-550 font-mono">
                      {category.color || 'Sem Cor'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => openEditModal(category)}
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-white hover:bg-slate-900"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => setDeleteConfirmCategory(category)}
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-red-400 hover:bg-red-950/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- CREATE / EDIT MODAL --- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-slate-900 border border-slate-850 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <button 
              type="button"
              onClick={() => setModalOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-extrabold text-white text-lg">
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </h3>

            {modalError && (
              <p className="text-xs font-semibold text-red-400 bg-red-950/20 border border-red-900/30 p-2.5 rounded-lg">
                {modalError}
              </p>
            )}

            <div className="space-y-4">
              {/* Category Name */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Nome da Categoria *</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Ex: Workshops, Esportes, Tecnologia..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
                  required
                />
              </div>

              {/* Color Presets */}
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-violet-400" />
                  <span>Escolha uma Cor</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setColor(preset.value)}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                        color.toLowerCase() === preset.value.toLowerCase()
                          ? 'border-violet-500 bg-violet-950/30 ring-1 ring-violet-500'
                          : 'border-slate-850 bg-slate-950 hover:bg-slate-900'
                      }`}
                    >
                      <span 
                        className="w-4 h-4 rounded-full border border-white/10" 
                        style={{ backgroundColor: preset.value }}
                      />
                      <span className="text-3xs text-slate-400 mt-1 font-semibold truncate w-full">
                        {preset.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Color Input */}
              <div className="space-y-1.5 pt-2 border-t border-slate-850">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cor Personalizada (Hex)</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-slate-800 bg-transparent cursor-pointer p-0 overflow-hidden"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#FFFFFF"
                    className="flex-1 bg-slate-950 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors uppercase font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-850">
              <Button
                type="button"
                onClick={() => setModalOpen(false)}
                variant="ghost"
                className="text-slate-400 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar</span>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {deleteConfirmCategory && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl max-w-sm w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-950/30 border border-red-900/30 rounded-lg text-red-500">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-md">Excluir Categoria?</h3>
                <p className="text-slate-400 text-sm mt-1">
                  Tem certeza que deseja excluir a categoria <strong>{deleteConfirmCategory.name}</strong>? Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <Button
                onClick={() => setDeleteConfirmCategory(null)}
                variant="ghost"
                className="text-slate-400 hover:text-white"
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <span>Sim, Excluir</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
