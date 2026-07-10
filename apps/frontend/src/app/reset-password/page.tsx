'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    if (!token) {
      setError('Token de recuperação de senha ausente.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await api.post('/auth/reset-password', {
        token,
        password,
      });
      setSuccess(response.data.message || 'Senha redefinida com sucesso!');
      setPassword('');
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        'Token inválido ou expirado. Solicite uma nova recuperação.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full max-w-md space-y-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-8 backdrop-blur-xl shadow-2xl">
      <div className="text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Redefinir Senha
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Escolha uma nova senha forte para acessar sua conta
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-950/50 border border-red-800/50 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {success ? (
        <div className="space-y-6 text-center">
          <div className="rounded-lg bg-emerald-950/50 border border-emerald-800/50 p-4 text-sm text-emerald-200 font-medium">
            {success}
          </div>
          <p className="text-xs text-slate-400">Redirecionando para o login em instantes...</p>
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
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300">
              Nova Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:text-sm transition-colors"
              placeholder="Mínimo de 6 caracteres"
            />
          </div>

          <div>
            <Button
              id="btn-reset-submit"
              type="submit"
              disabled={isSubmitting || !token}
              className="w-full justify-center bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {isSubmitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                'Atualizar Senha'
              )}
            </Button>
          </div>
        </form>
      )}

      <div className="text-center text-sm text-slate-400 mt-6">
        <Link
          href="/login"
          className="font-semibold text-violet-400 hover:text-violet-300 transition-colors"
        >
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      {/* Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-violet-900/10 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-blue-900/10 blur-[120px]" />
      </div>

      <Suspense fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-slate-200" />
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
