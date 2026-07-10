'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setSuccess(response.data.message || 'Se o e-mail estiver cadastrado, as instruções foram enviadas.');
      setEmail('');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        'Ocorreu um erro ao processar a solicitação.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      {/* Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-violet-900/10 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-blue-900/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md space-y-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-8 backdrop-blur-xl shadow-2xl">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Recuperar Senha
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Digite seu e-mail cadastrado e enviaremos um link para redefinir sua senha
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
            <div className="mt-4">
              <Link href="/login">
                <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 rounded-lg transition-colors">
                  Voltar para o Login
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
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
              <Button
                id="btn-forgot-submit"
                type="submit"
                disabled={isSubmitting}
                className="w-full justify-center bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                ) : (
                  'Enviar Link de Recuperação'
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
    </div>
  );
}
