'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function RegisterPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const response = await api.post('/auth/register', {
        name,
        email,
        password,
      });
      setSuccess(response.data.message || 'Cadastro realizado com sucesso! Verifique seu e-mail.');
      setName('');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        'Ocorreu um erro ao realizar o cadastro. Verifique os dados inseridos.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-slate-200" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      {/* Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-violet-900/10 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-blue-900/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md space-y-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-8 backdrop-blur-xl shadow-2xl">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            SMEL-<span className="text-violet-500">Plataforma de Eventos</span>
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Crie sua conta e comece a gerenciar eventos
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-950/50 border border-red-800/50 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-6 text-center">
            <div className="rounded-lg bg-emerald-950/50 border border-emerald-800/50 p-4 text-sm text-emerald-200">
              {success}
            </div>
            <div className="mt-4">
              <Link href="/login">
                <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 rounded-lg transition-colors">
                  Ir para o Login
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300">
                  Nome completo
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:text-sm transition-colors"
                  placeholder="Seu nome completo"
                />
              </div>

              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-slate-300">
                  Endereço de e-mail
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:text-sm transition-colors"
                  placeholder="exemplo@smel.gov.br"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                  Senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:text-sm transition-colors"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>

            <div>
              <Button
                id="btn-register-submit"
                type="submit"
                disabled={isSubmitting}
                className="w-full justify-center bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                ) : (
                  'Criar Conta'
                )}
              </Button>
            </div>
          </form>
        )}

        <div className="text-center text-sm text-slate-400 mt-6 space-y-2">
          <div>
            Já tem uma conta?{' '}
            <Link
              href="/login"
              className="font-semibold text-violet-400 hover:text-violet-300 transition-colors"
            >
              Faça login aqui
            </Link>
          </div>
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-800/50">
            Ao se cadastrar, você concorda com nossa{' '}
            <Link href="/privacy" className="text-violet-400/80 hover:text-violet-300 transition-colors underline">
              Política de Privacidade
            </Link>
            .
          </div>
        </div>
      </div>
    </div>
  );
}
