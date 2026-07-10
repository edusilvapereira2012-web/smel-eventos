'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WifiOff, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      router.push('/');
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [router]);

  const handleRetry = () => {
    setIsChecking(true);
    setTimeout(() => {
      setIsChecking(false);
      if (typeof window !== 'undefined' && navigator.onLine) {
        router.push('/');
      }
    }, 1000);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center relative p-6">
      {/* Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[45%] -left-[20%] w-[90%] h-[90%] rounded-full bg-violet-900/10 blur-[130px]" />
        <div className="absolute -bottom-[45%] -right-[20%] w-[90%] h-[90%] rounded-full bg-blue-900/10 blur-[130px]" />
      </div>

      <div className="relative z-10 max-w-md w-full text-center space-y-8 bg-slate-900/30 rounded-2xl border border-slate-900 backdrop-blur-xl p-8 shadow-2xl">
        <div className="flex justify-center">
          <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-full text-red-400 animate-pulse">
            <WifiOff className="h-12 w-12" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">Você está offline</h1>
          <p className="text-slate-400 text-sm">
            Parece que você perdeu a conexão com a internet. Algumas funcionalidades, como o check-in offline, continuam funcionando a partir dos dados em cache.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={handleRetry}
            disabled={isChecking}
            className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold transition duration-200 gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Verificando...' : 'Tentar Novamente'}
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push('/')}
            className="border-slate-800 text-slate-300 hover:bg-slate-900/50 hover:text-white transition gap-2"
          >
            <Home className="h-4 w-4" />
            Início
          </Button>
        </div>
      </div>
    </main>
  );
}
