'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verificando seu e-mail...');

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Token de verificação ausente na URL.');
        return;
      }

      try {
        const response = await api.get(`/auth/verify-email?token=${token}`);
        setStatus('success');
        setMessage(response.data.message || 'E-mail verificado com sucesso!');
      } catch (err: any) {
        setStatus('error');
        setMessage(
          err.response?.data?.message ||
          'Token de verificação inválido ou expirado.'
        );
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="relative w-full max-w-md space-y-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-8 backdrop-blur-xl shadow-2xl">
      <div className="text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Verificação de E-mail
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Aguarde enquanto confirmamos seu endereço de e-mail
        </p>
      </div>

      <div className="flex flex-col items-center justify-center space-y-6 py-6 text-center">
        {status === 'verifying' && (
          <>
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-violet-500" />
            <p className="text-slate-300 font-medium">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-emerald-200 font-semibold text-lg">{message}</p>
            <p className="text-slate-400 text-sm">Sua conta foi ativada e você já pode acessar a plataforma.</p>
            <div className="w-full mt-4">
              <Link href="/login">
                <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 rounded-lg transition-colors">
                  Ir para o Login
                </Button>
              </Link>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="rounded-full bg-red-500/10 p-3 text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-200 font-semibold text-lg">{message}</p>
            <p className="text-slate-400 text-sm">Se o link expirou, você pode solicitar um novo e-mail cadastrando-se novamente ou tentando recuperar a senha.</p>
            <div className="w-full mt-4">
              <Link href="/register">
                <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 rounded-lg transition-colors">
                  Criar Nova Conta
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
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
        <VerifyEmailForm />
      </Suspense>
    </div>
  );
}
