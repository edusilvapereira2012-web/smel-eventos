'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useTenant } from '@/components/tenant-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  BookOpen,
  Shield,
  Users,
  Calendar,
  QrCode,
  UserCheck,
  Cpu,
  Lock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Database,
  ArrowRight,
  Sparkles
} from 'lucide-react';

type TabType = 'superadmin' | 'admin' | 'organizer' | 'checker' | 'member';

export default function ManualPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeTenant } = useTenant();
  const { role, loading: permLoading } = usePermissions();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('member');
  const [allowedTabs, setAllowedTabs] = useState<TabType[]>(['member']);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    const tabs: TabType[] = ['member'];

    const isSuperadmin = user.email === 'valterpcjr@gmail.com';

    if (isSuperadmin) {
      tabs.push('checker', 'organizer', 'admin', 'superadmin');
    } else if (role === 'OWNER' || role === 'ADMIN') {
      tabs.push('checker', 'organizer', 'admin');
    } else if (role === 'ORGANIZER') {
      tabs.push('checker', 'organizer');
    } else if (role === 'CHECKER') {
      tabs.push('checker');
    }

    setAllowedTabs(tabs);

    // Set default active tab to the highest permission tab available
    if (isSuperadmin) {
      setActiveTab('superadmin');
    } else if (role === 'OWNER' || role === 'ADMIN') {
      setActiveTab('admin');
    } else if (role === 'ORGANIZER') {
      setActiveTab('organizer');
    } else if (role === 'CHECKER') {
      setActiveTab('checker');
    } else {
      setActiveTab('member');
    }
  }, [user, role]);

  if (authLoading || permLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-slate-200" />
      </div>
    );
  }

  if (!user) return null;

  const tabLabels: Record<TabType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    superadmin: {
      label: 'Superadmin (Global)',
      icon: <Cpu className="h-4 w-4" />,
      color: 'text-violet-400 border-violet-500/30',
      bg: 'bg-violet-950/20'
    },
    admin: {
      label: 'Administrador (Admin/Owner)',
      icon: <Shield className="h-4 w-4" />,
      color: 'text-emerald-400 border-emerald-500/30',
      bg: 'bg-emerald-950/20'
    },
    organizer: {
      label: 'Organizador',
      icon: <Calendar className="h-4 w-4" />,
      color: 'text-blue-400 border-blue-500/30',
      bg: 'bg-blue-950/20'
    },
    checker: {
      label: 'Checker (Validador)',
      icon: <QrCode className="h-4 w-4" />,
      color: 'text-amber-400 border-amber-500/30',
      bg: 'bg-amber-950/20'
    },
    member: {
      label: 'Membro/Participante',
      icon: <UserCheck className="h-4 w-4" />,
      color: 'text-slate-350 border-slate-700/30',
      bg: 'bg-slate-900/30'
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col relative overflow-x-hidden">
      {/* Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[45%] -left-[20%] w-[90%] h-[90%] rounded-full bg-indigo-900/10 blur-[130px]" />
        <div className="absolute -bottom-[45%] -right-[20%] w-[90%] h-[90%] rounded-full bg-violet-900/10 blur-[130px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-slate-900 bg-slate-950/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => router.push('/')}
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-900"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </Button>
          <div className="flex items-center space-x-2.5">
            <BookOpen className="h-5 w-5 text-violet-400" />
            <span className="text-lg font-bold tracking-tight text-slate-100">
              Manual do Sistema
            </span>
          </div>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          SMEL-Plataforma de Eventos
        </div>
      </header>

      {/* Content Container */}
      <section className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-8">
        <div className="space-y-2 text-center md:text-left">
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-350 flex items-center justify-center md:justify-start gap-2">
            <Sparkles className="h-6 w-6 text-violet-400 animate-pulse" />
            Guias e Instruções do Sistema
          </h1>
          <p className="text-slate-450 text-sm max-w-3xl">
            Bem-vindo ao manual integrado. Aqui você pode conferir as regras de negócio, permissões e fluxos operacionais detalhados de acordo com o seu papel de acesso na plataforma.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2.5 pb-2 border-b border-slate-900">
          {allowedTabs
            .slice()
            .reverse() // Highest permissions first
            .map((tab) => {
              const info = tabLabels[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-300 ${
                    isActive
                      ? `${info.color} ${info.bg} bg-opacity-40 border-current shadow-lg shadow-current/5 scale-[1.02]`
                      : 'border-slate-900 bg-slate-900/10 text-slate-450 hover:bg-slate-900/40 hover:text-slate-300'
                  }`}
                >
                  {info.icon}
                  <span>{info.label}</span>
                </button>
              );
            })}
        </div>

        {/* Tab Contents */}
        <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-8">
          
          {/* ================= SUPERADMIN MANUAL ================= */}
          {activeTab === 'superadmin' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center space-x-3 border-b border-slate-850 pb-4">
                <div className="p-3 bg-violet-900/30 text-violet-400 rounded-xl">
                  <Cpu className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-100">Painel e Operações de Superadmin</h2>
                  <p className="text-xs text-violet-400/80 font-medium">Acesso restrito: valterpcjr@gmail.com</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Database className="h-4.5 w-4.5 text-violet-400" />
                    1. Gestão Global de Organizações (Tenants)
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Como Superadmin, você tem visão de todas as organizações da plataforma. No menu do Superadmin, é possível ativar e desativar qualquer inquilino.
                  </p>
                  <div className="p-3 bg-violet-950/20 border border-violet-900/30 rounded-lg text-xs text-violet-300">
                    <strong>Regra de Negócio:</strong> A desativação é <em>segura</em>. Altera o campo <code>isActive</code> no banco para <code>false</code>. Nenhum evento ou dado é deletado fisicamente, permitindo a restauração a qualquer momento. O interceptador <code>TenantInterceptor</code> bloqueará todos os acessos a organizações inativas imediatamente com <code>403 Forbidden</code>.
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Users className="h-4.5 w-4.5 text-violet-400" />
                    2. Bloqueio e Exclusão de Usuários
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você pode desativar o acesso de qualquer usuário à plataforma (Bloquear conta) ou realizar a exclusão física definitiva.
                  </p>
                  <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg text-xs text-red-300 space-y-1.5">
                    <strong>Nova Funcionalidade - Exclusão Física:</strong>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Remove em cascata associações a organizações (<code>TenantMembership</code>) e inscrições (<code>Registration</code>).</li>
                      <li>Preserva o histórico de auditoria (referência do usuário é setada como <code>null</code> / anonimizada).</li>
                      <li>A auto-exclusão e a exclusão do Superadmin principal são permanentemente bloqueadas.</li>
                    </ul>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Lock className="h-4.5 w-4.5 text-violet-400" />
                    3. Criação de Organizações e Convites
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    A criação de novas organizações no sistema e o envio de convites de participação são <strong>exclusivos do Superadmin</strong>. Administradores comuns não possuem acesso ao fluxo de criação e nem ao envio de convites de novos membros para garantir o controle centralizado do ecossistema.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Clock className="h-4.5 w-4.5 text-violet-400" />
                    4. Hospedagem e VPS (Deploy)
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    A aplicação está hospedada na VPS <code>190.2.72.72</code>. O processo de deploy é automatizado:
                  </p>
                  <ol className="list-decimal pl-4 text-xs text-slate-450 space-y-1">
                    <li>Acesse a VPS via terminal.</li>
                    <li>Execute o script Python <code>run_deploy.py</code> (ele lida com credenciais não-interativas e reinicia os serviços via PM2).</li>
                    <li>Sempre limpe a pasta <code>apps/frontend/.next</code> após compilações se houver erros de compilação ou de carregamento de páginas.</li>
                  </ol>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Database className="h-4.5 w-4.5 text-violet-400" />
                    5. Arquitetura em Containers (Docker)
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    O ecossistema inteiro roda isolado sob Docker (<code>docker-compose.prod.yml</code>):
                  </p>
                  <ul className="list-disc pl-4 text-xs text-slate-450 space-y-1">
                    <li><strong>Postgres</strong> (Banco Relacional) e <strong>Valkey/Redis</strong> (Filas e Cache).</li>
                    <li><strong>MinIO</strong> (Armazenamento de Arquivos/Certificados padrão S3).</li>
                    <li><strong>API</strong> (NestJS), <strong>Worker</strong> (Background Jobs) e <strong>Frontend</strong> (Next.js).</li>
                    <li><strong>Nginx</strong> (Proxy Reverso) gerenciando as portas de entrada e rotas.</li>
                  </ul>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Sparkles className="h-4.5 w-4.5 text-violet-400" />
                    6. Resiliência e Alta Concorrência
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Preparado para milhares de acessos simultâneos por meio de:
                  </p>
                  <ul className="list-disc pl-4 text-xs text-slate-450 space-y-1">
                    <li><strong>Processamento Assíncrono (BullMQ)</strong>: Envio de e-mails e geração de PDFs são processados em background, mantendo a API leve.</li>
                    <li><strong>Pessimistic Locking</strong>: Previne overbooking em eventos de alta concorrência por meio de travas no nível do banco.</li>
                    <li><strong>Logger Assíncrono (Pino)</strong>: Escrita rápida de logs sem bloquear o Event Loop do Node.js.</li>
                    <li><strong>PWA + Dexie.js</strong>: Check-in offline que reduz requisições redundantes na API.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ================= ADMIN / OWNER MANUAL ================= */}
          {activeTab === 'admin' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center space-x-3 border-b border-slate-850 pb-4">
                <div className="p-3 bg-emerald-900/30 text-emerald-400 rounded-xl">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-100">Manual do Administrador / Dono</h2>
                  <p className="text-xs text-emerald-400/80 font-medium">Controle e gestão operacional do seu Tenant</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Calendar className="h-4.5 w-4.5 text-emerald-400" />
                    1. Gerenciamento de Eventos e Categorias
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Administradores e Proprietários possuem controle total sobre a criação, edição e exclusão de eventos e de categorias de eventos na organização.
                  </p>
                  <div className="p-3 bg-emerald-950/10 border border-emerald-900/20 rounded-lg text-xs text-emerald-300/90">
                    <strong>Importante:</strong> Esta ação é restrita e não está disponível para o cargo de Organizador ou Checker. Certifique-se de preencher dados essenciais como data, local, vagas e categoria.
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Users className="h-4.5 w-4.5 text-emerald-400" />
                    2. Equipe e Membros da Organização
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você pode listar e gerenciar a equipe do seu inquilino:
                  </p>
                  <ul className="list-disc pl-4 text-xs text-slate-450 space-y-1">
                    <li>Promover membros a <strong>Admin</strong>, <strong>Organizador</strong> ou <strong>Checker</strong>.</li>
                    <li>Remover profissionais da sua organização.</li>
                    <li>Visualizar o status da aceitação de novos membros.</li>
                  </ul>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
                    3. Concorrência de Inscrições e Fila de Espera
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    A plataforma utiliza travas pessimistas no banco de dados (<code>SELECT FOR UPDATE</code>) para garantir que o limite de vagas de um evento seja estritamente respeitado, mesmo em cenários de alta concorrência.
                  </p>
                  <p className="text-xs text-slate-450 leading-relaxed">
                    Quando o número limite de vagas é alcançado, novos inscritos entram automaticamente na <strong>Fila de Espera (Waitlist)</strong>. Se uma vaga confirmada for liberada (cancelamento), o sistema automaticamente promove a inscrição mais antiga da fila para &quot;Confirmada&quot; e dispara um e-mail de aviso.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Lock className="h-4.5 w-4.5 text-emerald-400" />
                    4. LGPD e Logs de Auditoria
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Os dados dos participantes são protegidos de acordo com a LGPD. O CPF é criptografado em banco usando <code>AES-256-GCM</code> e exibido de forma mascarada.
                  </p>
                  <div className="p-3 bg-slate-950/60 border border-slate-900 rounded-lg text-xs space-y-1">
                    <p className="text-slate-350"><strong>Logs de Auditoria:</strong> Registram quem alterou ou executou ações importantes (visualizado no painel de auditoria, restrito a Owners).</p>
                    <p className="text-slate-350"><strong>Monitor de E-mails:</strong> Permite inspecionar logs de e-mails transacionais enviados pelo worker.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= ORGANIZER MANUAL ================= */}
          {activeTab === 'organizer' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center space-x-3 border-b border-slate-850 pb-4">
                <div className="p-3 bg-blue-900/30 text-blue-400 rounded-xl">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-100">Manual do Organizador de Eventos</h2>
                  <p className="text-xs text-blue-400/80 font-medium">Gerenciamento de eventos atribuídos e credenciamento</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <FileText className="h-4.5 w-4.5 text-blue-400" />
                    1. Edição de Eventos com Justificativa
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Como Organizador, você pode alterar detalhes operacionais de um evento existente (quantidade de vagas, local, horários, cronogramas). No entanto, toda alteração <strong>exige obrigatoriamente uma justificativa por escrito</strong> no formulário.
                  </p>
                  <p className="text-xs text-slate-450">
                    Essa justificativa é gravada permanentemente no log de auditoria do inquilino para garantir transparência nas modificações operacionais realizadas pela prefeitura ou organizadores autorizados.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
                    2. Restrições do Cargo
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    De acordo com as novas regras de negócio do sistema, o papel de Organizador possui limites rígidos de permissão:
                  </p>
                  <ul className="list-disc pl-4 text-xs text-slate-450 space-y-1.5">
                    <li className="text-red-400/90 font-medium"><strong>NÃO PODE CRIAR EVENTOS</strong> (função reservada para Admins).</li>
                    <li className="text-red-400/90 font-medium"><strong>NÃO PODE DELETAR EVENTOS</strong> (função reservada para Admins).</li>
                    <li className="text-red-400/90 font-medium"><strong>NÃO PODE CRIAR CATEGORIAS DE EVENTOS</strong>.</li>
                    <li>Não gerencia membros da equipe ou configurações da organização.</li>
                  </ul>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Users className="h-4.5 w-4.5 text-blue-400" />
                    3. Gestão e Monitoramento de Inscritos
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você pode visualizar a listagem de inscritos para os eventos sob sua responsabilidade, monitorando quem já realizou o credenciamento e quem está na fila de espera.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <QrCode className="h-4.5 w-4.5 text-blue-400" />
                    4. Validação de Ingressos (Portaria)
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você possui as permissões necessárias para operar o scanner de ingressos na portaria do evento, realizando check-ins rápidos por câmera ou buscas manuais por CPF/Nome.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= CHECKER MANUAL ================= */}
          {activeTab === 'checker' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center space-x-3 border-b border-slate-850 pb-4">
                <div className="p-3 bg-amber-900/30 text-amber-400 rounded-xl">
                  <QrCode className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-100">Manual do Checker / Validador</h2>
                  <p className="text-xs text-amber-400/80 font-medium">Operação de portaria, credenciamento rápido e validações offline</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <QrCode className="h-4.5 w-4.5 text-amber-400" />
                    1. Leitura de QR Codes (Scanner)
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Na tela de credenciamento do evento, ative a câmera do seu dispositivo móvel ou tablet. Aponte para o QR Code gerado pelo participante no ingresso PDF ou celular.
                  </p>
                  <div className="p-3 bg-slate-950/60 border border-slate-900 rounded-lg text-xs text-slate-350">
                    O sistema validará o token JWT assinado criptograficamente, garantindo que o ingresso é autêntico e pertence a este evento. Se o ingresso já tiver sido validado antes, o sistema impedirá o acesso retornando <strong>Check-in já realizado (409 Conflict)</strong>.
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Users className="h-4.5 w-4.5 text-amber-400" />
                    2. Busca Manual
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Caso a câmera do dispositivo apresente problemas ou o participante não tenha o QR Code em mãos, utilize o campo de busca manual no topo do leitor para localizar a inscrição por:
                  </p>
                  <ul className="list-disc pl-4 text-xs text-slate-450 space-y-1">
                    <li>Nome Completo</li>
                    <li>CPF do Participante</li>
                  </ul>
                  <p className="text-xs text-slate-450">
                    Basta clicar em <strong>&quot;Confirmar Presença&quot;</strong> na linha do participante correspondente após a validação física de sua identidade.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Lock className="h-4.5 w-4.5 text-amber-400" />
                    3. Operação Offline (PWA)
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Se o local do evento estiver sem conexão à internet (ex: quadras de esporte ou locais distantes), instale o aplicativo em seu celular (PWA).
                  </p>
                  <p className="text-xs text-slate-450 leading-relaxed">
                    Ao abrir a página do evento com internet antes de ir para o local, o aplicativo baixa os dados básicos dos participantes e salva localmente no banco do navegador (<strong>Dexie.js</strong>). A validação por câmera continuará funcionando offline!
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="h-4.5 w-4.5 text-amber-400" />
                    4. Sincronização de Dados
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Ao retornar a um local com sinal de internet, acesse a página de sincronização offline e clique no botão <strong>&quot;Sincronizar Check-ins&quot;</strong>. 
                  </p>
                  <p className="text-xs text-slate-450">
                    O aplicativo enviará os check-ins realizados no local em lote para a API, que registrará as presenças de forma atômica no banco de dados central.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= MEMBER MANUAL ================= */}
          {activeTab === 'member' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center space-x-3 border-b border-slate-850 pb-4">
                <div className="p-3 bg-slate-900/40 text-slate-350 rounded-xl border border-slate-800">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-100">Manual do Participante / Membro</h2>
                  <p className="text-xs text-slate-450 font-medium">Como se inscrever, acessar ingressos e emitir certificados</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Calendar className="h-4.5 w-4.5 text-slate-400" />
                    1. Listagem de Eventos e Inscrições
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você pode visualizar todos os eventos abertos ao público promovidos pela organização. Para participar, basta acessar a página do evento, preencher as informações solicitadas (Nome, CPF) e confirmar a inscrição.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Users className="h-4.5 w-4.5 text-slate-400" />
                    2. Fila de Espera
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Se o evento desejado estiver com todas as vagas esgotadas, você pode clicar em &quot;Inscrever-se na Fila de Espera&quot;. Caso algum participante desista, a fila é reprocessada automaticamente e você receberá uma confirmação de participação por e-mail caso sua vaga seja liberada.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <QrCode className="h-4.5 w-4.5 text-slate-400" />
                    3. Ingresso Digital e Acesso ao Evento
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Ao confirmar sua vaga, o sistema gera um ingresso digital criptografado com QR Code. Apresente este ingresso (no celular ou impresso) no portão do evento para que o Checker realize a validação e libere sua entrada.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-900 space-y-3">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <FileText className="h-4.5 w-4.5 text-slate-400" />
                    4. Emissão de Certificados Digitais
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Após a finalização do evento, se o seu check-in tiver sido confirmado pela equipe organizadora, o botão <strong>&quot;Emitir Certificado&quot;</strong> estará liberado na sua página de ingressos. 
                  </p>
                  <p className="text-xs text-slate-450 leading-relaxed">
                    O certificado é gerado em formato PDF de alta definição, assinado digitalmente pela instituição organizadora, e inclui um QR Code público para validação de autenticidade por terceiros.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Back button */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => router.push('/')}
            className="bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white font-bold py-2 px-8 rounded-xl border border-slate-800 transition-all duration-300"
          >
            Voltar para o Início
          </Button>
        </div>
      </section>
    </main>
  );
}
