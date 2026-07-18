'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Event } from '@/lib/events.types';
import {
  Calendar,
  MapPin,
  Globe,
  Loader2,
  Sparkles,
  Award,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(digits.charAt(9), 10)) {
    return false;
  }

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(digits.charAt(10), 10)) {
    return false;
  }

  return true;
}

export default function EventPublicLandingPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Registration modal states
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', cpf: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ status: string; code?: string; waitlistPosition?: number } | null>(null);

  // Workshops list
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [maxWorkshops, setMaxWorkshops] = useState<number>(0);
  const [selectedWorkshopIds, setSelectedWorkshopIds] = useState<string[]>([]);

  // Cancellation modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelData, setCancelData] = useState({ code: '', email: '' });
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get(`/events/slug/${slug}`);
        setEvent(response.data);

        // Fetch workshops as well
        try {
          const wsResponse = await api.get(`/public/events/slug/${slug}/workshops`);
          setWorkshops(wsResponse.data.workshops || []);
          setMaxWorkshops(wsResponse.data.maxWorkshops || 0);
        } catch (wsErr) {
          console.error('Erro ao carregar oficinas do evento:', wsErr);
        }
      } catch (err: any) {
        setError(
          err.response?.status === 404
            ? 'Evento não encontrado ou não está publicado.'
            : 'Ocorreu um erro ao carregar o evento.'
        );
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchEvent();
    }
  }, [slug]);

  // Format CPF as the user types: 000.000.000-00
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    // Apply mask
    if (value.length > 9) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
    } else if (value.length > 6) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
    } else if (value.length > 3) {
      value = `${value.slice(0, 3)}.${value.slice(3)}`;
    }
    
    setFormData((prev) => ({ ...prev, cpf: value }));
  };

  // Format Phone as user types: (00) 00000-0000
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    if (value.length > 10) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 6) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }

    setFormData((prev) => ({ ...prev, phone: value }));
  };

  const checkConflict = (workshop: any, selectedIds: string[]) => {
    const wStart = new Date(workshop.startTime).getTime();
    const wEnd = new Date(workshop.endTime).getTime();

    for (const id of selectedIds) {
      const selected = workshops.find((w) => w.id === id);
      if (!selected || selected.id === workshop.id) continue;

      const sStart = new Date(selected.startTime).getTime();
      const sEnd = new Date(selected.endTime).getTime();

      if (sStart < wEnd && wStart < sEnd) {
        return selected.title;
      }
    }
    return null;
  };

  const handleToggleWorkshop = (id: string) => {
    setSelectedWorkshopIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      
      const workshop = workshops.find((w) => w.id === id);
      if (!workshop) return prev;

      if (maxWorkshops > 0 && prev.length >= maxWorkshops) {
        return prev;
      }

      if (checkConflict(workshop, prev)) {
        return prev;
      }

      return [...prev, id];
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCpf(formData.cpf)) {
      setSubmitError('Por favor, informe um CPF válido.');
      return;
    }

    if (!formData.phone || formData.phone.replace(/\D/g, '').length < 10) {
      setSubmitError('Por favor, informe um número de celular válido com DDD.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      const response = await api.post(`/public/events/${slug}/register`, {
        name: formData.name.trim().toUpperCase(),
        email: formData.email,
        cpf: formData.cpf.replace(/\D/g, ''),
        phone: formData.phone.replace(/\D/g, ''),
        workshopIds: selectedWorkshopIds,
      });
      setSuccessData(response.data);
      setFormData({ name: '', email: '', cpf: '', phone: '' });
      setSelectedWorkshopIds([]);
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || 'Ocorreu um erro ao realizar a inscrição.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelData.code || !cancelData.email) {
      setCancelError('Por favor, preencha todos os campos.');
      return;
    }

    try {
      setCancelSubmitting(true);
      setCancelError(null);
      await api.get(`/public/registrations/${cancelData.code.trim()}/cancel`, {
        params: { email: cancelData.email.trim() },
      });
      setCancelSuccess(true);
      setCancelData({ code: '', email: '' });
    } catch (err: any) {
      setCancelError(
        err.response?.data?.message ||
          'Inscrição não encontrada ou dados de cancelamento inválidos.'
      );
    } finally {
      setCancelSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6 text-center">
        <Calendar className="h-16 w-16 text-slate-800 mb-4" />
        <h1 className="text-2xl font-extrabold text-white">Ops! Evento não disponível</h1>
        <p className="text-slate-400 max-w-md mt-2">{error || 'O evento que você está procurando não existe ou não está ativo.'}</p>
        <a
          href="/"
          className="mt-6 bg-violet-650 hover:bg-violet-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-all"
        >
          Voltar ao Início
        </a>
      </div>
    );
  }

  const formatEventDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const sponsorsByTier = event.sponsors?.reduce((acc: Record<string, typeof event.sponsors>, sp) => {
    const tier = sp.tier || 'APOIO';
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(sp);
    return acc;
  }, {}) || {};

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col relative pb-20">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-[20%] w-[60%] h-[30%] rounded-full bg-violet-900/5 blur-[120px]" />
        <div className="absolute bottom-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-900/5 blur-[120px]" />
      </div>

      {/* Navbar */}
      <header className="relative z-10 border-b border-slate-900/60 bg-slate-950/40 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-lg font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-300">
            SMEL-Plataforma de Eventos
          </span>
        </div>
        <button
          onClick={() => {
            setCancelError(null);
            setCancelSuccess(false);
            setShowCancelModal(true);
          }}
          className="text-xs font-bold text-slate-450 hover:text-white transition-colors"
        >
          Cancelar Inscrição
        </button>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-6 mt-8 space-y-12">
        
        {/* Success screen after registration */}
        {successData && (
          <div className="border border-slate-900 rounded-3xl bg-slate-900/20 backdrop-blur-xl p-6 md:p-10 space-y-6 max-w-2xl mx-auto text-center shadow-2xl">
            {successData.status === 'CONFIRMED' ? (
              <>
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
                <div className="space-y-2">
                  <h2 className="text-2xl md:text-3xl font-black text-white">Sua Inscrição está Confirmada!</h2>
                  <p className="text-slate-400 text-sm">
                    Parabéns! Sua vaga para o evento <strong>{event.title}</strong> está garantida. Enviamos um e-mail de confirmação.
                  </p>
                </div>
                <div className="bg-slate-950 border border-slate-900 p-6 rounded-2xl inline-block">
                  <span className="text-2xs font-extrabold text-slate-500 uppercase tracking-widest block">Código da Inscrição</span>
                  <span className="text-3xl font-black text-white tracking-wider block mt-1 font-mono">{successData.code}</span>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-16 w-16 text-amber-500 mx-auto" />
                <div className="space-y-2">
                  <h2 className="text-2xl md:text-3xl font-black text-white">Você está na Lista de Espera</h2>
                  <p className="text-slate-400 text-sm">
                    A capacidade de assentos para o evento <strong>{event.title}</strong> foi atingida. Você foi adicionado à lista de espera e será promovido automaticamente em caso de desistências.
                  </p>
                </div>
                <div className="bg-slate-950 border border-slate-900 px-8 py-5 rounded-2xl inline-block text-amber-500">
                  <span className="text-2xs font-extrabold uppercase tracking-widest block">Sua Posição</span>
                  <span className="text-3xl font-black tracking-wider block mt-1 font-mono">#{successData.waitlistPosition}</span>
                </div>
              </>
            )}
            <div>
              <button
                onClick={() => setSuccessData(null)}
                className="bg-slate-900 hover:bg-slate-850 text-white font-bold py-2.5 px-6 rounded-xl text-xs border border-slate-800 transition-colors"
              >
                Voltar ao Evento
              </button>
            </div>
          </div>
        )}

        {!successData && (
          <div className="border border-slate-900 rounded-3xl bg-slate-900/10 backdrop-blur-xl overflow-hidden shadow-2xl">
            {event.bannerUrl ? (
              <div className="h-64 md:h-80 w-full relative">
                <img src={event.bannerUrl} alt={event.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              </div>
            ) : (
              <div className="h-40 w-full bg-gradient-to-br from-violet-950/40 to-slate-900/80 border-b border-slate-900 flex items-center justify-center">
                <Calendar className="h-16 w-16 text-violet-900/40" />
              </div>
            )}

            <div className="p-6 md:p-10 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                {event.category && (
                  <span
                    className="text-2xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md border"
                    style={{
                      borderColor: `${event.category.color || '#6366f1'}33`,
                      color: event.category.color || '#6366f1',
                      backgroundColor: `${event.category.color || '#6366f1'}11`,
                    }}
                  >
                    {event.category.name}
                  </span>
                )}
                <span className="text-2xs font-bold text-slate-450 uppercase tracking-widest flex items-center space-x-1.5 bg-violet-950/20 px-2.5 py-1 rounded-md border border-violet-900/20">
                  <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  <span>Inscrições Abertas</span>
                </span>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
                  {event.title}
                </h1>
                {event.description && (
                  <p className="text-slate-450 text-sm md:text-base max-w-3xl leading-relaxed">
                    {event.description}
                  </p>
                )}
              </div>

              {/* Event Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-slate-900/60 text-sm">
                <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-slate-900/20 border border-slate-900/60">
                  <Calendar className="h-5 w-5 text-violet-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Data e Horário</h4>
                    <p className="text-slate-400 text-xs mt-1">Início: {formatEventDate(event.startDate)}</p>
                    <p className="text-slate-400 text-xs mt-0.5">Término: {formatEventDate(event.endDate)}</p>
                  </div>
                </div>

                {event.isOnline ? (
                  <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-slate-900/20 border border-slate-900/60">
                    <Globe className="h-5 w-5 text-violet-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Formato</h4>
                      <p className="text-slate-400 text-xs mt-1">100% Online e Interativo</p>
                      {event.onlineUrl && (
                        <a
                          href={event.onlineUrl.startsWith('http') ? event.onlineUrl : `https://${event.onlineUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-400 hover:text-violet-300 hover:underline text-xs font-semibold mt-1 block truncate max-w-xs"
                        >
                          {event.onlineUrl}
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <a
                    href={event.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}` : '#'}
                    target={event.location ? '_blank' : undefined}
                    rel={event.location ? 'noopener noreferrer' : undefined}
                    className={`flex items-start space-x-3.5 p-4 rounded-2xl bg-slate-900/20 border transition-all ${
                      event.location 
                        ? 'border-slate-900/60 hover:border-violet-500/30 hover:bg-slate-900/40 cursor-pointer group' 
                        : 'border-slate-900/60'
                    }`}
                  >
                    <MapPin className="h-5 w-5 text-violet-400 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    <div>
                      <h4 className="font-extrabold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                        Localização
                        {event.location && (
                          <span className="text-[9px] text-violet-400/80 font-normal normal-case group-hover:underline">
                            (Ver no mapa)
                          </span>
                        )}
                      </h4>
                      <p className="text-slate-400 text-xs mt-1 group-hover:text-slate-300 transition-colors">
                        {event.location || 'Local a ser confirmado'}
                      </p>
                    </div>
                  </a>
                )}
              </div>

              {/* Registration CTA */}
              <div className="pt-4 flex justify-center">
                <button
                  onClick={() => {
                    setSubmitError(null);
                    setShowRegisterModal(true);
                  }}
                  className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-extrabold text-sm py-3.5 px-12 rounded-xl shadow-xl shadow-violet-900/25 transition-all"
                >
                  Realizar Inscrição Gratuita
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Schedule timeline */}
        {event.schedule && event.schedule.length > 0 && (
          <div className="space-y-6">
            <div className="border-l-4 border-violet-500 pl-4">
              <h2 className="text-2xl font-black text-white">Cronograma e Atividades</h2>
              <p className="text-slate-500 text-xs mt-0.5">Acompanhe a grade completa programada para o evento.</p>
            </div>

            <div className="relative border-l border-slate-900 ml-4 space-y-6 pt-2">
              {event.schedule.map((item) => {
                const startStr = new Date(item.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const endStr = new Date(item.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const itemSpeaker = event.speakers?.find((sp) => sp.id === item.speakerId);

                return (
                  <div key={item.id} className="relative pl-8 group">
                    <div className="absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full bg-violet-500 ring-4 ring-slate-950 group-hover:scale-125 transition-transform" />
                    
                    <div className="bg-slate-900/10 border border-slate-900 p-5 rounded-2xl space-y-1.5">
                      <div className="flex items-center space-x-2 text-2xs font-extrabold text-violet-400 uppercase tracking-widest">
                        <span>{startStr} - {endStr}</span>
                        {item.location && (
                          <>
                            <span>•</span>
                            <span>{item.location}</span>
                          </>
                        )}
                      </div>
                      <h4 className="font-extrabold text-white text-md">{item.title}</h4>
                      {item.description && <p className="text-xs text-slate-450 leading-relaxed">{item.description}</p>}
                      
                      {itemSpeaker && (
                        <div className="flex items-center space-x-2.5 pt-2 mt-2 border-t border-slate-900/60">
                          {itemSpeaker.photoUrl && (
                            <img src={itemSpeaker.photoUrl} alt={itemSpeaker.name} className="h-6 w-6 rounded-full object-cover" />
                          )}
                          <span className="text-xs text-slate-350 font-semibold">{itemSpeaker.name} {itemSpeaker.role && `(${itemSpeaker.role})`}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Speakers Grid */}
        {event.speakers && event.speakers.length > 0 && (
          <div className="space-y-6">
            <div className="border-l-4 border-violet-500 pl-4">
              <h2 className="text-2xl font-black text-white">Palestrantes Confirmados</h2>
              <p className="text-slate-500 text-xs mt-0.5">Conheça os convidados especiais deste evento.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {event.speakers.map((sp) => (
                <div key={sp.id} className="bg-slate-900/20 border border-slate-900/80 rounded-2xl p-6 flex flex-col items-center text-center space-y-4 hover:shadow-xl hover:shadow-violet-950/5 transition-all">
                  <div className="h-20 w-20 rounded-2xl bg-slate-950 border border-slate-850 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {sp.photoUrl ? (
                      <img src={sp.photoUrl} alt={sp.name} className="h-full w-full object-cover" />
                    ) : (
                      <Calendar className="h-8 w-8 text-slate-850" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-white text-md">{sp.name}</h4>
                    {sp.role && <p className="text-xs text-violet-400 font-semibold">{sp.role}</p>}
                  </div>
                  {sp.bio && <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{sp.bio}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sponsors Section */}
        {event.sponsors && event.sponsors.length > 0 && (
          <div className="space-y-8 pt-4 border-t border-slate-900/60">
            <div className="text-center space-y-1">
              <Award className="h-8 w-8 text-violet-400 mx-auto" />
              <h2 className="text-2xl font-black text-white">Patrocínio e Apoio</h2>
              <p className="text-slate-500 text-xs">Marcas que tornam este evento possível.</p>
            </div>

            <div className="space-y-8">
              {Object.entries(sponsorsByTier).map(([tier, list]) => (
                <div key={tier} className="space-y-3 text-center">
                  <span className="text-2xs font-extrabold uppercase tracking-widest text-slate-400 border border-slate-850 px-3 py-1 rounded-full bg-slate-900/30">
                    {tier}
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
                    {list.map((spon) => (
                      <div key={spon.id} className="h-16 w-32 bg-slate-900/20 border border-slate-900 rounded-xl p-2.5 flex items-center justify-center hover:bg-slate-900/40 transition-colors">
                        {spon.logoUrl ? (
                          <img src={spon.logoUrl} alt={spon.name} className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-xs font-bold text-slate-450 truncate">{spon.name}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Registration Modal Overlay */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="text-lg font-extrabold text-white">Ficha de Inscrição</h3>
                <p className="text-2xs text-slate-500 mt-0.5">Preencha seus dados para obter sua credencial</p>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-450 hover:text-white p-1.5 rounded-lg bg-slate-950 border border-slate-850 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="p-6 space-y-4 overflow-y-auto flex-1">
              {submitError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start space-x-2 text-red-400 text-xs">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider block">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Seu nome completo"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value.toUpperCase() }))}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider block">E-mail</label>
                <input
                  type="email"
                  required
                  placeholder="voce@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider block">CPF</label>
                  <input
                    type="text"
                    required
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={handleCpfChange}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider block">Celular</label>
                  <input
                    type="text"
                    required
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              </div>

              {workshops.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-800/80">
                  <div>
                    <label className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider block">Escolha suas Oficinas</label>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Você pode selecionar até{' '}
                      <span className="font-bold text-violet-400">
                        {maxWorkshops === 0 ? 'quantas oficinas desejar' : `${maxWorkshops} oficina(s)`}
                      </span>
                      .
                    </p>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {workshops.map((w) => {
                      const isSelected = selectedWorkshopIds.includes(w.id);
                      const startTimeStr = new Date(w.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      const endTimeStr = new Date(w.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      const dateStr = new Date(w.startTime).toLocaleDateString('pt-BR');
                      const conflictWith = checkConflict(w, selectedWorkshopIds);
                      const isLimitReached = maxWorkshops > 0 && selectedWorkshopIds.length >= maxWorkshops && !isSelected;
                      const hasVacancies = w.vacancies > 0;
                      
                      const isDisabled = !hasVacancies || isLimitReached || !!conflictWith;

                      return (
                        <div
                          key={w.id}
                          onClick={() => {
                            if (!isDisabled || isSelected) {
                              handleToggleWorkshop(w.id);
                            }
                          }}
                          className={`p-3 border rounded-xl flex items-center justify-between gap-3 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-violet-950/20 border-violet-500/70'
                              : isDisabled
                              ? 'bg-slate-900/10 border-slate-900/40 opacity-50 cursor-not-allowed'
                              : 'bg-slate-950/40 border-slate-850 hover:border-slate-800'
                          }`}
                        >
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-violet-400 font-bold">
                                {dateStr} • {startTimeStr} - {endTimeStr}
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                hasVacancies ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {hasVacancies ? `${w.vacancies} vagas` : 'Esgotado'}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-white truncate">{w.title}</h4>
                            {w.speaker && (
                              <p className="text-[10px] text-slate-500 truncate">Palestrante: {w.speaker.name}</p>
                            )}
                            
                            {/* Warnings/Status */}
                            {conflictWith && (
                              <p className="text-[9px] font-bold text-amber-500 flex items-center gap-1 mt-0.5">
                                Conflita com: {conflictWith}
                              </p>
                            )}
                          </div>

                          <div className="flex-shrink-0">
                            <div className={`h-4.5 w-4.5 rounded border flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-violet-600 border-violet-500' : 'border-slate-700 bg-slate-950'
                            }`}>
                              {isSelected && (
                                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-750 hover:to-indigo-750 text-white font-extrabold text-xs py-3 rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <span>Confirmar Inscrição</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancellation Modal Overlay */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-extrabold text-white">Cancelar Inscrição</h3>
                <p className="text-2xs text-slate-500 mt-0.5">Retire sua credencial e libere sua vaga pública</p>
              </div>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-slate-450 hover:text-white p-1.5 rounded-lg bg-slate-950 border border-slate-850 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {cancelSuccess ? (
              <div className="p-6 text-center space-y-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-md font-bold text-white">Inscrição Cancelada</h4>
                  <p className="text-xs text-slate-400">
                    Sua inscrição foi removida com sucesso. Se sua vaga estava confirmada, o próximo participante da lista de espera foi promovido.
                  </p>
                </div>
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="bg-slate-950 hover:bg-slate-900 text-white font-bold py-2.5 px-6 rounded-xl text-2xs border border-slate-850 transition-colors"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleCancel} className="p-6 space-y-4">
                {cancelError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start space-x-2 text-red-400 text-xs">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{cancelError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider block">Código da Inscrição</label>
                  <input
                    type="text"
                    required
                    placeholder="SLG-2026-00001"
                    value={cancelData.code}
                    onChange={(e) => setCancelData((prev) => ({ ...prev, code: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-2xs font-extrabold text-slate-400 uppercase tracking-wider block">E-mail da Inscrição</label>
                  <input
                    type="email"
                    required
                    placeholder="voce@exemplo.com"
                    value={cancelData.email}
                    onChange={(e) => setCancelData((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={cancelSubmitting}
                    className="w-full bg-red-650 hover:bg-red-700 text-white font-bold text-xs py-3 rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
                  >
                    {cancelSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processando...</span>
                      </>
                    ) : (
                      <span>Confirmar Cancelamento</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
