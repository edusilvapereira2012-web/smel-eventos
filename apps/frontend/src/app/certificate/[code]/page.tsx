'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ShieldCheck, ShieldAlert, Download, Award, Calendar, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ValidationResult {
  valid: boolean;
  participantName: string;
  eventTitle: string;
  eventDate: string;
  issuedAt: string;
}

export default function PublicCertificateValidation() {
  const params = useParams();
  const code = params.code as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ValidationResult | null>(null);

  const fetchValidation = async () => {
    try {
      setLoading(true);
      setError(null);
      // Endpoint público de validação
      const response = await api.get(`/public/certificate/${code}`);
      setData(response.data);
    } catch (err: any) {
      console.error('Erro ao validar certificado:', err);
      setError(err.response?.data?.message || 'Certificado inválido ou não encontrado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (code) {
      fetchValidation();
    }
  }, [code]);

  const handleDownload = () => {
    window.open(`/api/certificates/${code}/download`, '_blank');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[40%] left-[10%] w-[80%] h-[80%] rounded-full bg-violet-900/10 blur-[130px]" />
        <div className="absolute -bottom-[40%] right-[10%] w-[80%] h-[80%] rounded-full bg-indigo-900/10 blur-[130px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl bg-slate-900/50 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-6">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg text-sm">
              SM
            </div>
            <span className="text-lg font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              SMEL-Plataforma de Eventos
            </span>
          </div>
          <div className="flex items-center text-xs text-slate-400 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-full">
            <Award className="h-3.5 w-3.5 mr-1.5 text-violet-500" />
            Validador de Certificados
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-violet-500" />
            <p className="text-sm text-slate-400">Verificando autenticidade no blockchain/banco...</p>
          </div>
        ) : error || !data ? (
          // Invalid Certificate State
          <div className="flex flex-col items-center text-center py-6">
            <div className="h-16 w-16 bg-red-950/40 border border-red-800/50 rounded-full flex items-center justify-center text-red-500 mb-4 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Certificado Não Encontrado</h2>
            <p className="text-sm text-slate-400 max-w-md mb-6">
              O código de autenticação <span className="font-mono text-red-400 bg-red-950/20 px-1.5 py-0.5 rounded border border-red-900/30">{code}</span> não corresponde a nenhum certificado emitido em nossa plataforma.
            </p>
            <div className="w-full max-w-sm p-4 bg-slate-950/50 border border-slate-800 rounded-xl text-left text-xs text-slate-400 space-y-2">
              <p className="font-medium text-slate-300">O que fazer?</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Verifique se digitou o código corretamente (maiúsculas, minúsculas e traços).</li>
                <li>Certifique-se de que o organizador do evento já efetuou a emissão oficial dos certificados.</li>
              </ul>
            </div>
          </div>
        ) : (
          // Valid Certificate State
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 bg-emerald-950/40 border border-emerald-800/50 rounded-full flex items-center justify-center text-emerald-500 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <ShieldCheck className="h-8 w-8 animate-pulse" />
              </div>
              <span className="text-xs font-bold text-emerald-400 tracking-wider bg-emerald-950/30 border border-emerald-900/50 px-3 py-1 rounded-full uppercase mb-2">
                Documento Autêntico & Válido
              </span>
              <h2 className="text-2xl font-extrabold text-white">Verificação de Autenticidade</h2>
              <p className="text-xs text-slate-400 mt-1">Este certificado foi emitido eletronicamente e está devidamente registrado.</p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Participante</span>
                  <span className="text-base font-bold text-white block">{data.participantName}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Evento</span>
                  <span className="text-base font-bold text-violet-400 block">{data.eventTitle}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Data de Realização</span>
                  <span className="text-sm font-medium text-slate-300 flex items-center mt-1">
                    <Calendar className="h-4 w-4 mr-1.5 text-slate-400" />
                    {new Date(data.eventDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Código de Validação</span>
                  <span className="font-mono text-sm text-indigo-300 bg-indigo-950/30 border border-indigo-900/40 px-2 py-0.5 rounded block w-fit mt-1">
                    {code}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 space-y-2 sm:space-y-0">
                <span className="flex items-center">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                  Emitido em {new Date(data.issuedAt).toLocaleString('pt-BR')}
                </span>
                <span className="text-slate-400 flex items-center">
                  Identificador digital verificado
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 pt-2">
              <Button
                onClick={handleDownload}
                className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold py-6 rounded-xl shadow-lg hover:shadow-violet-500/10 transition duration-300"
              >
                <Download className="mr-2 h-5 w-5" />
                Baixar PDF Oficial
              </Button>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="border-t border-slate-800 mt-8 pt-4 text-center text-[10px] text-slate-500">
          Tecnologia SMEL-Plataforma de Eventos Multi-Tenant Security Shield. Todos os direitos reservados.
        </div>
      </div>
    </main>
  );
}
