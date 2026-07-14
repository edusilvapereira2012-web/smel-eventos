'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        'Não foi possível realizar o login. Verifique suas credenciais.'
      );
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
            Entre na sua conta para gerenciar seus eventos
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-950/50 border border-red-800/50 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
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
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                  Senha
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Esqueceu sua senha?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:text-sm transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <Button
              id="btn-login-submit"
              type="submit"
              disabled={isSubmitting}
              className="w-full justify-center bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {isSubmitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                'Entrar'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
