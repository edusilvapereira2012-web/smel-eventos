'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useTenant } from '@/components/tenant-provider';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewTenant() {
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectTenant } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user && user.email !== 'valterpcjr@gmail.com') {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    const generatedSlug = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    setSlug(generatedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/tenants', { name, slug });
      const newTenant = response.data;
      selectTenant(newTenant.id);
      router.push('/');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        'Não foi possível criar a organização. Tente usar outro slug.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200 px-6 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-violet-900/10 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-blue-900/10 blur-[120px]" />
      </div>

      <div className="relative max-w-md w-full space-y-8 rounded-2xl border border-slate-800/85 bg-slate-900/40 p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center space-x-2">
          <Link href="/" className="inline-flex p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold text-slate-400">Voltar</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-violet-500">
            Nova Organização
          </h1>
          <p className="text-sm text-slate-400">
            Inicie um novo ambiente para organizar e gerenciar seus eventos.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg bg-red-950/50 border border-red-800/60 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-350">Nome da Organização</label>
            <input
              type="text"
              required
              value={name}
              onChange={handleNameChange}
              placeholder="Ex: Minha Empresa Ltda"
              className="w-full rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-350">Slug Identificador</label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="Ex: minha-empresa"
              className="w-full rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <p className="text-xs text-slate-500">
              Usado para links amigáveis e identificação na plataforma.
            </p>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full font-semibold bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Criando...' : 'Criar Organização'}
          </Button>
        </form>
      </div>
    </main>
  );
}
