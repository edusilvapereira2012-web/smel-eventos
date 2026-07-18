'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useTenant } from '@/components/tenant-provider';
import { api } from '@/lib/api';
import { Event, EventCategory, EventSpeaker, EventSponsor, ScheduleItem, EVENT_STATUS_LABELS, Workshop } from '@/lib/events.types';
import { Button } from '@/components/ui/button';
import EventDashboard from '@/components/EventDashboard';
import CertificateEditor from '@/components/CertificateEditor';
import {
  ArrowLeft,
  Loader2,
  Calendar,
  MapPin,
  Globe,
  Plus,
  Trash2,
  Edit2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Download,
  Search,
  RefreshCw,
  FileSpreadsheet,
  X,
  AlertCircle,
  QrCode,
  Award,
  Info,
  Upload,
  Users,
} from 'lucide-react';
import { io } from 'socket.io-client';

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

export default function EventDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeTenant, loading: tenantLoading } = useTenant();
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'details' | 'speakers' | 'sponsors' | 'schedule' | 'workshops' | 'registrations' | 'checkin' | 'certificates'>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- CHECK-IN STATE ---
  const [checkinStats, setCheckinStats] = useState<{ totalConfirmed: number; checkedIn: number; recentCheckins: any[] } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // --- SUB-RESOURCE LIST STATES ---
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [sponsors, setSponsors] = useState<EventSponsor[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);

  // --- FORM STATES FOR TAB 1 (DETAILS) ---
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [location, setLocation] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [onlineUrl, setOnlineUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [capacity, setCapacity] = useState<number>(100);
  const [maxWorkshops, setMaxWorkshops] = useState<number>(0);
  const [categoryId, setCategoryId] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [justification, setJustification] = useState('');

  // --- CERTIFICATE STATES ---
  const [certTitle, setCertTitle] = useState('');
  const [certBody, setCertBody] = useState('');
  const [certHours, setCertHours] = useState(8);
  const [certSigner, setCertSigner] = useState('');
  const [certSignerUrl, setCertSignerUrl] = useState('');
  const [certConfigSaving, setCertConfigSaving] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'standard' | 'custom'>('standard');

  // --- INLINE FORM MODAL STATES ---
  const [modalOpen, setModalOpen] = useState<'speaker' | 'sponsor' | 'schedule' | 'workshop' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Speaker Form
  const [spName, setSpName] = useState('');
  const [spBio, setSpBio] = useState('');
  const [spRole, setSpRole] = useState('');
  const [spPhotoUrl, setSpPhotoUrl] = useState('');

  // Sponsor Form
  const [sponName, setSponName] = useState('');
  const [sponTier, setSponTier] = useState('GOLD');
  const [sponLogoUrl, setSponLogoUrl] = useState('');

  // Schedule Item Form
  const [schTitle, setSchTitle] = useState('');
  const [schDesc, setSchDesc] = useState('');
  const [schStart, setSchStart] = useState('');
  const [schEnd, setSchEnd] = useState('');
  const [schLocation, setSchLocation] = useState('');
  const [schSpeakerId, setSchSpeakerId] = useState('');

  // Workshop Form
  const [workTitle, setWorkTitle] = useState('');
  const [workDesc, setWorkDesc] = useState('');
  const [workStart, setWorkStart] = useState('');
  const [workEnd, setWorkEnd] = useState('');
  const [workCapacity, setWorkCapacity] = useState<number>(30);
  const [workLocation, setWorkLocation] = useState('');
  const [workSpeakerId, setWorkSpeakerId] = useState('');

  // --- REGISTRATIONS STATE ---
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [regSearch, setRegSearch] = useState('');
  const [regStatus, setRegStatus] = useState<string>('');
  const [regLoading, setRegLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // --- WORKSHOP ENROLLMENTS MODAL STATE ---
  const [enrollmentsModalOpen, setEnrollmentsModalOpen] = useState(false);
  const [selectedWorkshop, setSelectedWorkshop] = useState<Workshop | null>(null);
  const [workshopEnrollments, setWorkshopEnrollments] = useState<any[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [enrollmentsError, setEnrollmentsError] = useState<string | null>(null);

  // Transfer Registration form states
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  const [transferData, setTransferData] = useState({ name: '', email: '', cpf: '', phone: '' });
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Cancel Registration states
  const [cancelRegModalOpen, setCancelRegModalOpen] = useState(false);
  const [cancelRegTargetId, setCancelRegTargetId] = useState<string | null>(null);
  const [cancelRegReason, setCancelRegReason] = useState('');
  const [cancelRegSubmitting, setCancelRegSubmitting] = useState(false);
  const [cancelRegError, setCancelRegError] = useState<string | null>(null);

  // CPF / Phone masks for transfer form
  const handleTransferCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 9) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
    } else if (value.length > 6) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
    } else if (value.length > 3) {
      value = `${value.slice(0, 3)}.${value.slice(3)}`;
    }
    setTransferData((prev) => ({ ...prev, cpf: value }));
  };

  const handleTransferPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 10) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 6) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    setTransferData((prev) => ({ ...prev, phone: value }));
  };

  const loadRegistrations = async (reset = false, cursorValue?: string) => {
    try {
      setRegLoading(true);
      setError(null);
      const paramsObj: any = { limit: 10 };
      if (regStatus) paramsObj.status = regStatus;
      if (regSearch) paramsObj.search = regSearch;
      if (cursorValue) paramsObj.cursor = cursorValue;

      const res = await api.get(`/events/${eventId}/registrations`, { params: paramsObj });
      if (reset || !cursorValue) {
        setRegistrations(res.data.data);
      } else {
        setRegistrations((prev) => [...prev, ...res.data.data]);
      }
      setNextCursor(res.data.nextCursor);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao carregar inscrições.');
    } finally {
      setRegLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExportLoading(true);
      setError(null);
      const res = await api.get(`/events/${eventId}/registrations/export/cpf`);
      const data = res.data;
      if (!data || data.length === 0) {
        alert('Nenhuma inscrição encontrada para exportar.');
        return;
      }
      const headers = ['ID', 'Codigo', 'Nome', 'Email', 'CPF', 'Telefone', 'Status', 'Posicao Lista Espera', 'Data Inscricao'];
      const rows = data.map((reg: any) => [
        reg.id,
        reg.code,
        reg.name,
        reg.email,
        reg.cpf,
        reg.phone || '',
        reg.status,
        reg.waitlistPosition || '',
        new Date(reg.createdAt).toLocaleString('pt-BR'),
      ]);
      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `inscricoes_evento_${event?.slug || eventId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao exportar inscrições. Verifique suas permissões.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCpf(transferData.cpf)) {
      setTransferError('Por favor, informe um CPF válido.');
      return;
    }
    if (!transferData.phone || transferData.phone.replace(/\D/g, '').length < 10) {
      setTransferError('Por favor, informe um número de telefone/celular válido com DDD.');
      return;
    }
    try {
      setTransferSubmitting(true);
      setTransferError(null);
      await api.post(`/events/${eventId}/registrations/${transferTargetId}/transfer`, {
        name: transferData.name.trim().toUpperCase(),
        email: transferData.email,
        cpf: transferData.cpf.replace(/\D/g, ''),
        phone: transferData.phone.replace(/\D/g, ''),
      });
      setTransferModalOpen(false);
      setTransferData({ name: '', email: '', cpf: '', phone: '' });
      setSuccess('Inscrição transferida com sucesso.');
      loadRegistrations(true);
      loadAll();
    } catch (err: any) {
      setTransferError(err.response?.data?.message || 'Erro ao transferir inscrição.');
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleCancelRegSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCancelRegSubmitting(true);
      setCancelRegError(null);
      await api.delete(`/events/${eventId}/registrations/${cancelRegTargetId}`, {
        data: { cancelReason: cancelRegReason },
      });
      setCancelRegModalOpen(false);
      setCancelRegReason('');
      setSuccess('Inscrição cancelada com sucesso.');
      loadRegistrations(true);
      loadAll();
    } catch (err: any) {
      setCancelRegError(err.response?.data?.message || 'Erro ao cancelar inscrição.');
    } finally {
      setCancelRegSubmitting(false);
    }
  };

  // Fetch all data
  const loadAll = async () => {
    try {
      setLoading(true);
      const [evRes, catRes] = await Promise.all([
        api.get(`/events/${eventId}`),
        api.get('/events/categories'),
      ]);

      const ev = evRes.data as Event;
      setEvent(ev);
      setCategories(catRes.data);

      // Populate details form
      setTitle(ev.title);
      setDescription(ev.description || '');
      setBannerUrl(ev.bannerUrl || '');
      setIsOnline(ev.isOnline);
      setLocation(ev.location || '');
      setOnlineUrl(ev.onlineUrl || '');
      setCategoryId(ev.categoryId || '');
      setCapacity(ev.capacity);
      setMaxWorkshops(ev.maxWorkshops || 0);
      
      // format dates to fit datetime-local input
      if (ev.startDate) setStartDate(new Date(ev.startDate).toISOString().slice(0, 16));
      if (ev.endDate) setEndDate(new Date(ev.endDate).toISOString().slice(0, 16));

      // Fetch subresources
      const [spRes, sponRes, schRes, workRes] = await Promise.all([
        api.get(`/events/${eventId}/speakers`),
        api.get(`/events/${eventId}/sponsors`),
        api.get(`/events/${eventId}/schedule`),
        api.get(`/events/${eventId}/workshops`),
      ]);
      setSpeakers(spRes.data);
      setSponsors(sponRes.data);
      setSchedule(schRes.data);
      setWorkshops(workRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao carregar dados do evento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!tenantLoading && !activeTenant && !authLoading) {
      // Auth done, tenant done, but nothing to load — stop spinner
      setLoading(false);
      return;
    }
    if (activeTenant && eventId) {
      loadAll();
    }
  }, [activeTenant, eventId, authLoading, tenantLoading, user]);

  useEffect(() => {
    if (activeTenant && eventId && activeTab === 'registrations') {
      loadRegistrations(true);
    }
  }, [activeTenant, eventId, activeTab, regStatus]);

  const loadCheckinStats = async () => {
    try {
      setStatsLoading(true);
      const res = await api.get(`/checkin/stats/${eventId}`);
      setCheckinStats(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao carregar estatísticas do check-in.');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTenant && eventId && activeTab === 'checkin') {
      loadCheckinStats();
    }
  }, [activeTenant, eventId, activeTab]);

  useEffect(() => {
    if (activeTab !== 'checkin' || !eventId) return;

    const wsUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
    const socket = io(`${wsUrl}/checkin`);

    socket.on(`events:${eventId}:checkin`, (data: any) => {
      setCheckinStats((prev) => {
        if (!prev) return prev;
        const exists = prev.recentCheckins.some((c) => c.registrationId === data.registrationId);
        const updatedRecent = exists
          ? prev.recentCheckins
          : [data, ...prev.recentCheckins].slice(0, 20);

        return {
          totalConfirmed: prev.totalConfirmed,
          checkedIn: prev.checkedIn + (exists ? 0 : 1),
          recentCheckins: updatedRecent,
        };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [activeTab, eventId]);

  const loadCertificatesConfig = async () => {
    if (!activeTenant || !event) return;
    try {
      const res = await api.get(`/tenants/${activeTenant.id}`);
      const t = res.data;
      setCertTitle(event.certificateTitle !== null && event.certificateTitle !== undefined ? event.certificateTitle : (t.certificateTitle || ''));
      setCertBody(event.certificateBody !== null && event.certificateBody !== undefined ? event.certificateBody : (t.certificateBody || ''));
      setCertHours(event.certificateHours !== null && event.certificateHours !== undefined ? event.certificateHours : (t.certificateHours || 8));
      setCertSigner(event.certificateSigner !== null && event.certificateSigner !== undefined ? event.certificateSigner : (t.certificateSigner || ''));
      setCertSignerUrl(event.certificateSignerUrl !== null && event.certificateSignerUrl !== undefined ? event.certificateSignerUrl : (t.certificateSignerUrl || ''));
      
      if (event.certificateBackgroundUrl) {
        setLayoutMode('custom');
      } else {
        setLayoutMode('standard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao carregar configurações do certificado.');
    }
  };

  useEffect(() => {
    if (activeTenant && activeTab === 'certificates') {
      loadCertificatesConfig();
    }
  }, [activeTenant, activeTab, event]);

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSignature(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCertSignerUrl(response.data.url);
      setSuccess('Assinatura carregada com sucesso! Lembre-se de salvar as alterações.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao subir imagem da assinatura.');
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleSaveCertConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    setCertConfigSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/events/${eventId}`, {
        certificateTitle: certTitle || null,
        certificateBody: certBody || null,
        certificateHours: certHours ? Number(certHours) : null,
        certificateSigner: certSigner || null,
        certificateSignerUrl: certSignerUrl || null,
      });
      setSuccess('Configurações do certificado do evento salvas com sucesso!');
      loadAll();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao salvar configurações do certificado.');
    } finally {
      setCertConfigSaving(false);
    }
  };

  const handleSwitchToStandard = async () => {
    if (!confirm('Deseja alternar para o layout padrão? Isso desativará o plano de fundo customizado.')) return;
    setCertConfigSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`/events/${eventId}`, {
        certificateBackgroundUrl: null,
        certificateLayoutJson: null,
      });
      setSuccess('Layout padrão do certificado reativado com sucesso.');
      setLayoutMode('standard');
      loadAll();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao redefinir layout do certificado.');
    } finally {
      setCertConfigSaving(false);
    }
  };

  const handleGenerateBatch = async () => {
    setBatchGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post(`/events/${eventId}/certificates/generate`);
      setSuccess(`Lote de emissão disparado com sucesso! ${res.data.count} certificados estão sendo gerados em fila.`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao iniciar geração de certificados.');
    } finally {
      setBatchGenerating(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBannerUrl(response.data.url);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao subir imagem.');
    } finally {
      setUploadLoading(false);
    }
  };

  // --- ACTIONS: TRANSITION & UPDATE EVENT ---
  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: any = {
        title,
        description,
        bannerUrl: bannerUrl || null,
        isOnline,
        location: isOnline ? null : location,
        onlineUrl: isOnline ? onlineUrl : null,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        capacity: Number(capacity),
        categoryId: categoryId || null,
        maxWorkshops: Number(maxWorkshops),
      };
      if (user?.email !== 'valterpcjr@gmail.com') {
        if (!justification || justification.trim() === '') {
          setError('A justificativa da alteração é obrigatória.');
          setSaveLoading(false);
          return;
        }
        payload.justification = justification;
      }
      await api.patch(`/events/${eventId}`, payload);
      setSuccess('Detalhes do evento atualizados com sucesso.');
      setJustification('');
      loadAll();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar alterações.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleStatusTransition = async (action: 'publish' | 'cancel' | 'finish') => {
    setError(null);
    setSuccess(null);
    try {
      const response = await api.patch(`/events/${eventId}/${action}`);
      setSuccess(`Evento atualizado para status: ${EVENT_STATUS_LABELS[response.data.status] || response.data.status}`);
      loadAll();
    } catch (err: any) {
      setError(err.response?.data?.message || `Erro ao realizar ação: ${action}`);
    }
  };

  const handleDeleteEvent = async () => {
    if (!confirm('Deseja realmente excluir este evento permanentemente? Esta ação é irreversível.')) return;
    setError(null);
    try {
      await api.delete(`/events/${eventId}`);
      router.push('/events');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Não foi possível excluir o evento.');
    }
  };

  // --- SUB-RESOURCES ACTIONS ---
  
  // Speakers
  const openSpeakerModal = (sp?: EventSpeaker) => {
    if (sp) {
      setEditingId(sp.id);
      setSpName(sp.name);
      setSpBio(sp.bio || '');
      setSpRole(sp.role || '');
      setSpPhotoUrl(sp.photoUrl || '');
    } else {
      setEditingId(null);
      setSpName('');
      setSpBio('');
      setSpRole('');
      setSpPhotoUrl('');
    }
    setModalError(null);
    setModalOpen('speaker');
  };

  const handleSaveSpeaker = async () => {
    setModalError(null);
    if (!spName) {
      setModalError('Nome é obrigatório.');
      return;
    }
    try {
      const payload = { name: spName, bio: spBio, role: spRole, photoUrl: spPhotoUrl };
      if (editingId) {
        await api.patch(`/events/${eventId}/speakers/${editingId}`, payload);
      } else {
        await api.post(`/events/${eventId}/speakers`, payload);
      }
      setModalOpen(null);
      loadAll();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Falha ao salvar palestrante.');
    }
  };

  const handleDeleteSpeaker = async (id: string) => {
    if (!confirm('Excluir este palestrante?')) return;
    try {
      await api.delete(`/events/${eventId}/speakers/${id}`);
      loadAll();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao deletar palestrante.');
    }
  };

  // Sponsors
  const openSponsorModal = (spon?: EventSponsor) => {
    if (spon) {
      setEditingId(spon.id);
      setSponName(spon.name);
      setSponTier(spon.tier || 'GOLD');
      setSponLogoUrl(spon.logoUrl || '');
    } else {
      setEditingId(null);
      setSponName('');
      setSponTier('GOLD');
      setSponLogoUrl('');
    }
    setModalError(null);
    setModalOpen('sponsor');
  };

  const handleSaveSponsor = async () => {
    setModalError(null);
    if (!sponName) {
      setModalError('Nome é obrigatório.');
      return;
    }
    try {
      const payload = { name: sponName, tier: sponTier, logoUrl: sponLogoUrl };
      if (editingId) {
        await api.patch(`/events/${eventId}/sponsors/${editingId}`, payload);
      } else {
        await api.post(`/events/${eventId}/sponsors`, payload);
      }
      setModalOpen(null);
      loadAll();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Falha ao salvar patrocinador.');
    }
  };

  const handleDeleteSponsor = async (id: string) => {
    if (!confirm('Excluir este patrocinador?')) return;
    try {
      await api.delete(`/events/${eventId}/sponsors/${id}`);
      loadAll();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao deletar patrocinador.');
    }
  };

  // Schedule Items
  const openScheduleModal = (item?: ScheduleItem) => {
    if (item) {
      setEditingId(item.id);
      setSchTitle(item.title);
      setSchDesc(item.description || '');
      setSchLocation(item.location || '');
      setSchSpeakerId(item.speakerId || '');
      setSchStart(new Date(item.startTime).toISOString().slice(0, 16));
      setSchEnd(new Date(item.endTime).toISOString().slice(0, 16));
    } else {
      setEditingId(null);
      setSchTitle('');
      setSchDesc('');
      setSchLocation('');
      setSchSpeakerId('');
      setSchStart('');
      setSchEnd('');
    }
    setModalError(null);
    setModalOpen('schedule');
  };

  const handleSaveScheduleItem = async () => {
    setModalError(null);
    if (!schTitle || !schStart || !schEnd) {
      setModalError('Título, horário de início e término são obrigatórios.');
      return;
    }
    try {
      const payload = {
        title: schTitle,
        description: schDesc,
        location: schLocation,
        speakerId: schSpeakerId || null,
        startTime: new Date(schStart).toISOString(),
        endTime: new Date(schEnd).toISOString(),
        order: editingId ? undefined : schedule.length, // last item order if new
      };
      if (editingId) {
        await api.patch(`/events/${eventId}/schedule/${editingId}`, payload);
      } else {
        await api.post(`/events/${eventId}/schedule`, payload);
      }
      setModalOpen(null);
      loadAll();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Falha ao salvar item de programação.');
    }
  };

  const handleDeleteScheduleItem = async (id: string) => {
    if (!confirm('Remover este item da programação?')) return;
    try {
      await api.delete(`/events/${eventId}/schedule/${id}`);
      loadAll();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao deletar item.');
    }
  };

  const openWorkshopModal = (item?: Workshop) => {
    setModalError(null);
    if (item) {
      setEditingId(item.id);
      setWorkTitle(item.title);
      setWorkDesc(item.description || '');
      setWorkStart(item.startTime ? new Date(item.startTime).toISOString().slice(0, 16) : '');
      setWorkEnd(item.endTime ? new Date(item.endTime).toISOString().slice(0, 16) : '');
      setWorkCapacity(item.capacity);
      setWorkLocation(item.location || '');
      setWorkSpeakerId(item.speakerId || '');
    } else {
      setEditingId(null);
      setWorkTitle('');
      setWorkDesc('');
      setWorkStart('');
      setWorkEnd('');
      setWorkCapacity(30);
      setWorkLocation('');
      setWorkSpeakerId('');
    }
    setModalOpen('workshop');
  };

  const handleSaveWorkshop = async () => {
    setModalError(null);
    if (!workTitle || !workStart || !workEnd || !workCapacity) {
      setModalError('Título, horário de início, término e capacidade são obrigatórios.');
      return;
    }
    try {
      const payload = {
        title: workTitle,
        description: workDesc || null,
        startTime: new Date(workStart).toISOString(),
        endTime: new Date(workEnd).toISOString(),
        capacity: Number(workCapacity),
        location: workLocation || null,
        speakerId: workSpeakerId || null,
      };

      if (editingId) {
        await api.patch(`/events/${eventId}/workshops/${editingId}`, payload);
      } else {
        await api.post(`/events/${eventId}/workshops`, payload);
      }

      setModalOpen(null);
      loadAll();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Falha ao salvar oficina.');
    }
  };

  const handleDeleteWorkshop = async (id: string) => {
    if (!confirm('Remover esta oficina?')) return;
    try {
      await api.delete(`/events/${eventId}/workshops/${id}`);
      loadAll();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha ao deletar oficina.');
    }
  };

  const openEnrollmentsModal = async (workshop: Workshop) => {
    setSelectedWorkshop(workshop);
    setWorkshopEnrollments([]);
    setEnrollmentsError(null);
    setLoadingEnrollments(true);
    setEnrollmentsModalOpen(true);
    try {
      const response = await api.get(`/events/${eventId}/workshops/${workshop.id}/enrollments`);
      setWorkshopEnrollments(response.data);
    } catch (err: any) {
      setEnrollmentsError(err.response?.data?.message || 'Falha ao carregar inscritos.');
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const handleCancelEnrollment = async (workshopId: string, registrationId: string) => {
    if (!confirm('Deseja realmente remover este participante da oficina?')) return;
    setEnrollmentsError(null);
    try {
      await api.delete(`/events/${eventId}/workshops/${workshopId}/enrollments/${registrationId}`);
      // Refresh list
      const response = await api.get(`/events/${eventId}/workshops/${workshopId}/enrollments`);
      setWorkshopEnrollments(response.data);
      // Reload workshops list to update remaining spots
      loadAll();
    } catch (err: any) {
      setEnrollmentsError(err.response?.data?.message || 'Falha ao remover participante.');
    }
  };

  // Reordering up/down
  const handleMoveScheduleItem = async (index: number, direction: 'up' | 'down') => {
    const newItems = [...schedule];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    // Swap elements
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    setSchedule(newItems);

    try {
      const ids = newItems.map((item) => item.id);
      await api.patch(`/events/${eventId}/schedule/reorder`, { ids });
    } catch (err) {
      console.error('Erro ao reordenar programação:', err);
      setError('Falha ao sincronizar reordenação da programação no servidor.');
      loadAll();
    }
  };

  // Helper uploads for modals (photos, logos)
  const handleModalPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'speaker' | 'sponsor') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (target === 'speaker') {
        setSpPhotoUrl(response.data.url);
      } else {
        setSponLogoUrl(response.data.url);
      }
    } catch (err: any) {
      setModalError('Falha no upload da imagem.');
    } finally {
      setUploadLoading(false);
    }
  };

  if (authLoading || tenantLoading || loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 text-slate-200 gap-4">
        <p className="text-slate-400 text-sm">{error || 'Evento não encontrado ou você não tem acesso.'}</p>
        <button
          onClick={() => router.push('/events')}
          className="text-xs font-bold text-violet-400 hover:text-violet-300 underline"
        >
          ← Voltar para Eventos
        </button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-900 border-slate-800 text-slate-400',
    PUBLISHED: 'bg-emerald-950/40 border-emerald-900/50 text-emerald-400',
    FINISHED: 'bg-blue-950/40 border-blue-900/50 text-blue-400',
    CANCELLED: 'bg-red-950/40 border-red-900/50 text-red-400',
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col relative pb-16">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[5%] right-[20%] w-[60%] h-[50%] rounded-full bg-violet-900/5 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-slate-900 bg-slate-950/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => router.push('/events')}
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white hover:bg-slate-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-6 w-px bg-slate-800" />
          <span className="text-sm font-semibold text-slate-350 truncate max-w-xs">{event.title}</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`text-2xs font-extrabold uppercase tracking-wide border px-2.5 py-0.5 rounded-full ${statusColors[event.status]}`}>
            {EVENT_STATUS_LABELS[event.status] || event.status}
          </span>
          <a
            href={`/e/${event.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-violet-400 hover:text-violet-300 font-bold bg-violet-950/20 border border-violet-900/40 px-3 py-1.5 rounded-lg transition-colors"
          >
            Ver Landing Page
          </a>
        </div>
      </header>

      {/* Body content */}
      <div className="relative z-10 max-w-6xl w-full mx-auto px-6 mt-8 flex-1 flex flex-col space-y-6">
        {/* Status Messages */}
        {error && (
          <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-xl text-sm text-red-400 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Houve um problema:</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-900/50 rounded-xl text-sm text-emerald-400 flex items-start space-x-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="font-semibold">{success}</p>
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex border-b border-slate-900 space-x-6 overflow-x-auto scrollbar-none whitespace-nowrap">
          {(['dashboard', 'details', 'speakers', 'sponsors', 'schedule', 'workshops', 'registrations', 'checkin', 'certificates'] as const).map((tab) => {
            const labels = {
              dashboard: 'Dashboard & Relatórios',
              details: 'Editar Detalhes',
              speakers: `Palestrantes (${speakers.length})`,
              sponsors: `Patrocinadores (${sponsors.length})`,
              schedule: `Programação (${schedule.length})`,
              workshops: `Oficinas (${workshops.length})`,
              registrations: 'Gerenciar Inscrições',
              checkin: 'Painel Check-in',
              certificates: 'Certificados',
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 font-bold text-sm border-b-2 transition-all relative ${
                  activeTab === tab
                    ? 'border-violet-500 text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-350'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* --- TAB CONTENT --- */}

        {/* TAB 0: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <EventDashboard eventId={eventId} />
        )}

        {/* TAB 1: DETAILS */}
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <form onSubmit={handleUpdateDetails} className="bg-slate-900/20 border border-slate-900 rounded-2xl p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Title */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Título do Evento *</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Descrição</label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
                    />
                  </div>

                  {/* Banner Image */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Banner do Evento</label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={bannerUrl}
                          onChange={(e) => setBannerUrl(e.target.value)}
                          className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
                        />
                      </div>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleBannerUpload}
                          className="hidden"
                          id="edit-banner-upload"
                          disabled={uploadLoading}
                        />
                        <label
                          htmlFor="edit-banner-upload"
                          className="h-full flex items-center justify-center space-x-2 border border-slate-850 bg-slate-900 px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer text-slate-350 hover:text-white transition-colors"
                        >
                          {uploadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                          <span>Upload</span>
                        </label>
                      </div>
                    </div>
                    {bannerUrl && (
                      <div className="mt-3 h-36 w-full rounded-xl overflow-hidden border border-slate-850 relative">
                        <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Categoria</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
                    >
                      <option value="">Selecione uma Categoria</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Capacity */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Capacidade Máxima</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={capacity}
                      onChange={(e) => setCapacity(Number(e.target.value))}
                      className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                  </div>

                  {/* Max Workshops */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Máximo de Oficinas por Participante</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={maxWorkshops}
                      onChange={(e) => setMaxWorkshops(Number(e.target.value))}
                      className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                    <p className="text-[11px] text-slate-500">Defina 0 para ilimitado ou se não houver oficinas.</p>
                  </div>

                  {/* Start Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Início do Evento</label>
                    <input
                      type="datetime-local"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                  </div>

                  {/* End Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Término do Evento</label>
                    <input
                      type="datetime-local"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
                    />
                  </div>

                  {/* Online checkbox */}
                  <div className="space-y-1.5 md:col-span-2 flex items-center space-x-3 py-2 border-y border-slate-900">
                    <input
                      type="checkbox"
                      id="edit-isOnline"
                      checked={isOnline}
                      onChange={(e) => setIsOnline(e.target.checked)}
                      className="h-4.5 w-4.5 rounded bg-slate-950 border-slate-850 text-violet-600 focus:ring-0"
                    />
                    <label htmlFor="edit-isOnline" className="text-sm font-bold text-slate-350 select-none cursor-pointer">
                      Este evento é realizado Online
                    </label>
                  </div>

                  {/* Conditional Location or Online URL */}
                  {isOnline ? (
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Link de Transmissão / Webinar</label>
                      <input
                        type="url"
                        value={onlineUrl}
                        onChange={(e) => setOnlineUrl(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Localização Física</label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
                      />
                    </div>
                  )}

                  {/* Justification (only for non-superadmin) */}
                  {user?.email !== 'valterpcjr@gmail.com' && (
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Justificativa da Alteração *</label>
                      <textarea
                        required
                        rows={3}
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                        placeholder="Por favor, explique brevemente o motivo desta alteração (ex: ajuste de vagas, alteração de data)..."
                        className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-900">
                  <Button
                    type="submit"
                    disabled={saveLoading}
                    className="bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 px-8 rounded-lg shadow-lg shadow-violet-900/20"
                  >
                    {saveLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Salvar Alterações
                  </Button>
                </div>
              </form>
            </div>

            {/* Sidebar Actions & Operations */}
            <div className="space-y-6">
              {/* Operations Box */}
              <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-6 space-y-4">
                <h3 className="font-extrabold text-white text-md border-b border-slate-900 pb-2">Controles do Ciclo de Vida</h3>
                
                {/* Publish */}
                {event.status === 'DRAFT' && (
                  <Button
                    onClick={() => handleStatusTransition('publish')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Publicar Evento</span>
                  </Button>
                )}

                {/* Finish */}
                {event.status === 'PUBLISHED' && (
                  <Button
                    onClick={() => handleStatusTransition('finish')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Finalizar Evento</span>
                  </Button>
                )}

                {/* Cancel */}
                {(event.status === 'PUBLISHED' || event.status === 'DRAFT') && (
                  <Button
                    onClick={() => handleStatusTransition('cancel')}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <span>Cancelar Evento</span>
                  </Button>
                )}

                {/* Delete */}
                {event.status === 'DRAFT' && user?.email === 'valterpcjr@gmail.com' && (
                  <Button
                    onClick={handleDeleteEvent}
                    className="w-full bg-red-950/40 hover:bg-red-900 border border-red-900/50 hover:border-red-900 text-red-400 hover:text-white font-bold py-2 rounded-lg transition-all flex items-center justify-center space-x-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Excluir Evento</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SPEAKERS */}
        {activeTab === 'speakers' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-white">Palestrantes do Evento</h2>
              <Button
                onClick={() => openSpeakerModal()}
                className="bg-violet-600 hover:bg-violet-700 text-white font-semibold flex items-center space-x-2 text-xs py-1.5 px-4 rounded-lg"
              >
                <Plus className="h-4 w-4" />
                <span>Adicionar Palestrante</span>
              </Button>
            </div>

            {speakers.length === 0 ? (
              <div className="border border-dashed border-slate-850 rounded-2xl flex flex-col items-center justify-center py-16 text-center">
                <span className="text-slate-500 text-sm">Nenhum palestrante cadastrado neste evento.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {speakers.map((sp) => (
                  <div key={sp.id} className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5 flex items-start space-x-4">
                    <div className="h-16 w-16 rounded-xl bg-slate-950 border border-slate-850 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {sp.photoUrl ? (
                        <img src={sp.photoUrl} alt={sp.name} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-slate-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-extrabold text-white text-md truncate">{sp.name}</h4>
                      {sp.role && <p className="text-xs text-violet-400 font-semibold truncate mt-0.5">{sp.role}</p>}
                      {sp.bio && <p className="text-xs text-slate-500 line-clamp-2 mt-1.5">{sp.bio}</p>}
                      <div className="flex space-x-3 mt-3 pt-3 border-t border-slate-900 justify-end">
                        <button onClick={() => openSpeakerModal(sp)} className="text-2xs font-bold text-slate-400 hover:text-white flex items-center space-x-1">
                          <Edit2 className="h-3 w-3" />
                          <span>Editar</span>
                        </button>
                        <button onClick={() => handleDeleteSpeaker(sp.id)} className="text-2xs font-bold text-red-400 hover:text-red-300 flex items-center space-x-1">
                          <Trash2 className="h-3 w-3" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SPONSORS */}
        {activeTab === 'sponsors' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-white">Patrocinadores e Apoiadores</h2>
              <Button
                onClick={() => openSponsorModal()}
                className="bg-violet-600 hover:bg-violet-700 text-white font-semibold flex items-center space-x-2 text-xs py-1.5 px-4 rounded-lg"
              >
                <Plus className="h-4 w-4" />
                <span>Adicionar Patrocinador</span>
              </Button>
            </div>

            {sponsors.length === 0 ? (
              <div className="border border-dashed border-slate-850 rounded-2xl flex flex-col items-center justify-center py-16 text-center">
                <span className="text-slate-500 text-sm">Nenhum patrocinador cadastrado.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {sponsors.map((spon) => (
                  <div key={spon.id} className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5 flex flex-col items-center text-center space-y-3">
                    <div className="h-20 w-full rounded-xl bg-slate-950 border border-slate-850 p-2 overflow-hidden flex items-center justify-center">
                      {spon.logoUrl ? (
                        <img src={spon.logoUrl} alt={spon.name} className="h-full max-w-full object-contain" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-slate-700" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm">{spon.name}</h4>
                      <span className="inline-block text-3xs font-extrabold uppercase tracking-widest bg-violet-950/40 border border-violet-900/50 text-violet-400 px-2 py-0.5 rounded-md mt-1">
                        {spon.tier || 'GOLD'}
                      </span>
                    </div>
                    <div className="flex space-x-4 pt-2 w-full justify-center border-t border-slate-900">
                      <button onClick={() => openSponsorModal(spon)} className="text-2xs font-bold text-slate-400 hover:text-white">
                        Editar
                      </button>
                      <button onClick={() => handleDeleteSponsor(spon.id)} className="text-2xs font-bold text-red-400 hover:text-red-300">
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SCHEDULE */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-white">Grade de Programação</h2>
              <Button
                onClick={() => openScheduleModal()}
                className="bg-violet-600 hover:bg-violet-700 text-white font-semibold flex items-center space-x-2 text-xs py-1.5 px-4 rounded-lg"
              >
                <Plus className="h-4 w-4" />
                <span>Adicionar Atividade</span>
              </Button>
            </div>

            {schedule.length === 0 ? (
              <div className="border border-dashed border-slate-850 rounded-2xl flex flex-col items-center justify-center py-16 text-center">
                <span className="text-slate-500 text-sm">Nenhuma atividade agendada na programação.</span>
              </div>
            ) : (
              <div className="space-y-4">
                {schedule.map((item, index) => {
                  const startTimeStr = new Date(item.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const endTimeStr = new Date(item.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const itemSpeaker = speakers.find((sp) => sp.id === item.speakerId);

                  return (
                    <div key={item.id} className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5 flex items-center justify-between gap-4">
                      <div className="flex items-start space-x-5 min-w-0">
                        {/* Up/Down buttons for ordering */}
                        <div className="flex flex-col space-y-1.5">
                          <button
                            onClick={() => handleMoveScheduleItem(index, 'up')}
                            disabled={index === 0}
                            className={`p-1 rounded hover:bg-slate-900 transition-colors ${index === 0 ? 'text-slate-700' : 'text-slate-400 hover:text-white'}`}
                          >
                            <ChevronUp className="h-4.5 w-4.5" />
                          </button>
                          <button
                            onClick={() => handleMoveScheduleItem(index, 'down')}
                            disabled={index === schedule.length - 1}
                            className={`p-1 rounded hover:bg-slate-900 transition-colors ${index === schedule.length - 1 ? 'text-slate-700' : 'text-slate-400 hover:text-white'}`}
                          >
                            <ChevronDown className="h-4.5 w-4.5" />
                          </button>
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center space-x-2 text-2xs font-extrabold text-violet-400 uppercase tracking-widest">
                            <span>{startTimeStr} - {endTimeStr}</span>
                            {item.location && (
                              <>
                                <span>•</span>
                                <span>{item.location}</span>
                              </>
                            )}
                          </div>
                          <h4 className="font-extrabold text-white text-md truncate">{item.title}</h4>
                          {item.description && <p className="text-xs text-slate-500 line-clamp-1">{item.description}</p>}
                          {itemSpeaker && (
                            <p className="text-xs font-semibold text-slate-450 mt-1">Palestrante: {itemSpeaker.name}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <button onClick={() => openScheduleModal(item)} className="p-2 text-slate-450 hover:text-white hover:bg-slate-900 rounded-lg">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteScheduleItem(item.id)} className="p-2 text-red-405 hover:text-red-300 hover:bg-slate-900 rounded-lg">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: WORKSHOPS */}
        {activeTab === 'workshops' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-slate-900/10 border border-slate-900/40 p-5 rounded-2xl">
              <div>
                <h2 className="text-xl font-extrabold text-white">Gestão de Oficinas (CONLUZ)</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Limite por participante:{' '}
                  <span className="font-extrabold text-violet-400">
                    {event?.maxWorkshops === 0 ? 'Sem limite' : `${event?.maxWorkshops} oficina(s)`}
                  </span>
                </p>
              </div>
              <Button
                onClick={() => openWorkshopModal()}
                className="bg-violet-600 hover:bg-violet-700 text-white font-semibold flex items-center space-x-2 text-xs py-1.5 px-4 rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Criar Oficina</span>
              </Button>
            </div>

            {workshops.length === 0 ? (
              <div className="border border-dashed border-slate-850 rounded-2xl flex flex-col items-center justify-center py-16 text-center">
                <span className="text-slate-500 text-sm">Nenhuma oficina cadastrada neste evento.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workshops.map((w) => {
                  const startTimeStr = new Date(w.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const endTimeStr = new Date(w.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const dateStr = new Date(w.startTime).toLocaleDateString('pt-BR');
                  const wSpeaker = speakers.find((sp) => sp.id === w.speakerId);
                  const enrolled = w._count?.enrollments || 0;
                  const pct = Math.min(100, Math.round((enrolled / w.capacity) * 100));

                  return (
                    <div key={w.id} className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-800 transition-colors">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-2xs font-extrabold text-violet-400 uppercase tracking-widest flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{dateStr} • {startTimeStr} - {endTimeStr}</span>
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            enrolled >= w.capacity ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {enrolled >= w.capacity ? 'Esgotado' : `${w.capacity - enrolled} vagas`}
                          </span>
                        </div>

                        <h3 className="font-extrabold text-white text-base leading-tight">{w.title}</h3>
                        {w.description && <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{w.description}</p>}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-900/55 text-xs text-slate-400">
                          {w.location && (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <MapPin className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                              <span className="truncate">{w.location}</span>
                            </div>
                          )}
                          {wSpeaker && (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Globe className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                              <span className="truncate">Palestrante: {wSpeaker.name}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar & Actions */}
                      <div className="space-y-3 pt-2">
                        <div className="space-y-1">
                          <div className="flex justify-between text-2xs font-bold text-slate-450">
                            <span>Ocupação das Vagas</span>
                            <span>{enrolled} / {w.capacity} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-violet-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2 pt-1">
                          <button
                            onClick={() => openEnrollmentsModal(w)}
                            title="Ver Participantes Inscritos"
                            className="p-2 text-slate-455 hover:text-white hover:bg-slate-900 rounded-lg transition-colors"
                          >
                            <Users className="h-4 w-4" />
                          </button>
                          <button onClick={() => openWorkshopModal(w)} className="p-2 text-slate-455 hover:text-white hover:bg-slate-900 rounded-lg transition-colors">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDeleteWorkshop(w.id)} className="p-2 text-red-405 hover:text-red-300 hover:bg-slate-900 rounded-lg transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: REGISTRATIONS */}
        {activeTab === 'registrations' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/10 border border-slate-900 p-6 rounded-2xl">
              <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    loadRegistrations(true);
                  }}
                  className="flex-1 flex gap-2"
                >
                  <input
                    type="text"
                    placeholder="Buscar por nome ou e-mail..."
                    value={regSearch}
                    onChange={(e) => setRegSearch(e.target.value)}
                    className="flex-1 bg-slate-950/80 border border-slate-850 rounded-lg px-4 py-2 text-xs text-slate-205 focus:outline-none focus:border-violet-500/50"
                  />
                  <Button type="submit" className="bg-slate-900 border border-slate-800 hover:bg-slate-850 text-white text-xs px-3">
                    <Search className="h-4 w-4" />
                  </Button>
                </form>

                <select
                  value={regStatus}
                  onChange={(e) => setRegStatus(e.target.value)}
                  className="bg-slate-950/80 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-205 focus:outline-none focus:border-violet-500/50"
                >
                  <option value="">Todos os Status</option>
                  <option value="CONFIRMED">Confirmado</option>
                  <option value="WAITLIST">Lista de Espera</option>
                  <option value="CANCELLED">Cancelado</option>
                  <option value="TRANSFERRED">Transferido</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => loadRegistrations(true)}
                  variant="ghost"
                  className="text-slate-400 hover:text-white p-2 rounded-lg border border-slate-900 hover:bg-slate-900"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleExportCsv}
                  disabled={exportLoading}
                  className="bg-violet-600 hover:bg-violet-750 text-white font-bold text-xs py-2 px-4 rounded-lg flex items-center space-x-2"
                >
                  {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  <span>Exportar CSV</span>
                </Button>
              </div>
            </div>

            {regLoading && registrations.length === 0 ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              </div>
            ) : registrations.length === 0 ? (
              <div className="border border-dashed border-slate-850 rounded-2xl flex flex-col items-center justify-center py-16 text-center">
                <span className="text-slate-500 text-sm">Nenhuma inscrição encontrada para o filtro selecionado.</span>
              </div>
            ) : (
              <div className="bg-slate-900/10 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-900 bg-slate-950/40 text-slate-450 uppercase font-extrabold tracking-wider">
                        <th className="py-3.5 px-4">Código</th>
                        <th className="py-3.5 px-4">Nome</th>
                        <th className="py-3.5 px-4">E-mail</th>
                        <th className="py-3.5 px-4">CPF</th>
                        <th className="py-3.5 px-4">Telefone</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Data Inscrição</th>
                        <th className="py-3.5 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60">
                      {registrations.map((reg) => {
                        const statusBadge: Record<string, string> = {
                          CONFIRMED: 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400',
                          WAITLIST: 'bg-amber-950/30 border-amber-900/50 text-amber-500',
                          CANCELLED: 'bg-red-950/30 border-red-900/50 text-red-400',
                          TRANSFERRED: 'bg-slate-950/30 border-slate-850/50 text-slate-450',
                        };

                        const statusLabel: Record<string, string> = {
                          CONFIRMED: 'Confirmado',
                          WAITLIST: `Fila de Espera #${reg.waitlistPosition || ''}`,
                          CANCELLED: 'Cancelado',
                          TRANSFERRED: 'Transferido',
                        };

                        return (
                          <tr key={reg.id} className="hover:bg-slate-900/20 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-white">{reg.code}</td>
                            <td className="py-3.5 px-4 font-bold text-slate-200">{reg.name}</td>
                            <td className="py-3.5 px-4 text-slate-400">{reg.email}</td>
                            <td className="py-3.5 px-4 text-slate-450 font-mono">{reg.cpf}</td>
                            <td className="py-3.5 px-4 text-slate-450">{reg.phone || '-'}</td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-block text-3xs font-extrabold uppercase tracking-widest border px-2 py-0.5 rounded-md ${statusBadge[reg.status]}`}>
                                {statusLabel[reg.status]}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500">{new Date(reg.createdAt).toLocaleDateString('pt-BR')}</td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end space-x-2.5">
                                {reg.status === 'CONFIRMED' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setTransferTargetId(reg.id);
                                        setTransferError(null);
                                        setTransferData({ name: '', email: '', cpf: '', phone: '' });
                                        setTransferModalOpen(true);
                                      }}
                                      className="text-2xs font-extrabold text-violet-400 hover:text-violet-300 transition-colors"
                                    >
                                      Transferir
                                    </button>
                                    <button
                                      onClick={() => {
                                        setCancelRegTargetId(reg.id);
                                        setCancelRegError(null);
                                        setCancelRegReason('');
                                        setCancelRegModalOpen(true);
                                      }}
                                      className="text-2xs font-extrabold text-red-400 hover:text-red-300 transition-colors"
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                )}
                                {reg.status === 'WAITLIST' && (
                                  <button
                                    onClick={() => {
                                      setCancelRegTargetId(reg.id);
                                      setCancelRegError(null);
                                      setCancelRegReason('');
                                      setCancelRegModalOpen(true);
                                    }}
                                    className="text-2xs font-extrabold text-red-400 hover:text-red-300 transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                )}
                                {reg.status !== 'CONFIRMED' && reg.status !== 'WAITLIST' && <span className="text-slate-700">-</span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {nextCursor && (
                  <div className="p-4 border-t border-slate-900 bg-slate-950/20 text-center">
                    <Button
                      onClick={() => loadRegistrations(false, nextCursor)}
                      disabled={regLoading}
                      className="bg-slate-900 border border-slate-800 hover:bg-slate-850 text-white font-bold text-xs py-2 px-6 rounded-lg"
                    >
                      {regLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Carregar Mais
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: CHECK-IN */}
        {activeTab === 'checkin' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/10 border border-slate-900 p-6 rounded-2xl">
              <div>
                <h2 className="text-xl font-extrabold text-white">Controle de Check-in em Tempo Real</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Monitore a entrada de participantes e acesse a ferramenta de escaneamento de ingressos.
                </p>
              </div>
              <Button
                onClick={() => router.push(`/checkin/${eventId}`)}
                className="bg-violet-600 hover:bg-violet-750 text-white font-bold text-xs py-2.5 px-5 rounded-xl flex items-center space-x-2 shadow-lg shadow-violet-950/20"
              >
                <QrCode className="h-4.5 w-4.5" />
                <span>Abrir Scanner de Check-in</span>
              </Button>
            </div>

            {statsLoading && !checkinStats ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              </div>
            ) : checkinStats ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stats Card */}
                <div className="md:col-span-1 bg-slate-900/20 border border-slate-900 p-6 rounded-2xl flex flex-col justify-between space-y-6">
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Geral de Presença</span>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-4xl font-black text-white">{checkinStats.checkedIn}</span>
                      <span className="text-lg text-slate-550">/ {checkinStats.totalConfirmed}</span>
                    </div>
                    <span className="text-2xs text-slate-450 block font-medium">participantes confirmados fizeram check-in</span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-2xs font-extrabold text-slate-400">
                      <span>Progresso</span>
                      <span>
                        {checkinStats.totalConfirmed > 0
                          ? Math.round((checkinStats.checkedIn / checkinStats.totalConfirmed) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-violet-500 h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${
                            checkinStats.totalConfirmed > 0
                              ? Math.min(100, (checkinStats.checkedIn / checkinStats.totalConfirmed) * 100)
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Activity Feed */}
                <div className="md:col-span-2 bg-slate-900/20 border border-slate-900 p-6 rounded-2xl flex flex-col space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-extrabold text-white text-sm">Registro de Entrada Recente</h3>
                    <div className="flex items-center space-x-1.5 text-3xs font-extrabold text-emerald-400 uppercase tracking-widest bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded-md">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>Ao Vivo</span>
                    </div>
                  </div>

                  {checkinStats.recentCheckins.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 border border-dashed border-slate-850 rounded-xl">
                      <span className="text-slate-500 text-xs">Nenhum check-in registrado até o momento.</span>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                      {checkinStats.recentCheckins.map((item, idx) => {
                        const date = new Date(item.checkedInAt);
                        const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        return (
                          <div
                            key={`${item.registrationId}-${idx}`}
                            className="bg-slate-950/40 border border-slate-900/60 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs hover:border-slate-800 transition-colors"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <span className="font-bold text-white block truncate">{item.name}</span>
                              <span className="font-mono text-slate-500 text-3xs uppercase tracking-wider">{item.code}</span>
                            </div>
                            <span className="font-semibold text-slate-450 font-mono text-2xs flex-shrink-0 bg-slate-900 px-2 py-1 rounded-md border border-slate-850">
                              {timeStr}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-slate-850 rounded-2xl flex flex-col items-center justify-center py-16 text-center">
                <span className="text-slate-500 text-sm">Não foi possível carregar as informações de check-in.</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'certificates' && (
          <div className="space-y-8">
            {/* Top Info Banner / Trigger Box */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-850 p-6 rounded-2xl shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-violet-600/5 blur-3xl pointer-events-none" />
              <div className="space-y-1.5 relative z-10">
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Award className="h-5.5 w-5.5 text-violet-400" />
                  Gerenciamento de Certificados
                </h2>
                <p className="text-xs text-slate-400 max-w-xl">
                  Dispare a emissão de certificados oficiais para os participantes do evento que efetuaram check-in com sucesso. Certificados gerados são enviados por e-mail e ficam disponíveis para validação pública.
                </p>
              </div>
              <Button
                onClick={handleGenerateBatch}
                disabled={batchGenerating}
                className="bg-violet-600 hover:bg-violet-750 disabled:bg-violet-850 text-white font-bold text-xs py-3 px-6 rounded-xl flex items-center space-x-2 shadow-lg shadow-violet-950/35 relative z-10 w-full lg:w-auto justify-center"
              >
                {batchGenerating ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <Award className="h-4.5 w-4.5" />
                )}
                <span>Emitir Certificados em Lote</span>
              </Button>
            </div>

            {/* Seletor de Modo de Layout */}
            <div className="flex border-b border-slate-850">
              <button
                type="button"
                onClick={() => {
                  if (layoutMode === 'custom') {
                    handleSwitchToStandard();
                  } else {
                    setLayoutMode('standard');
                  }
                }}
                className={`flex-1 py-3 text-center text-xs font-bold transition-all border-b-2 ${
                  layoutMode === 'standard'
                    ? 'border-violet-500 text-white bg-slate-900/10'
                    : 'border-transparent text-slate-450 hover:text-slate-250 hover:bg-slate-900/5'
                }`}
              >
                Modelo Padrão da SMEL (Bordas Roxas)
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('custom')}
                className={`flex-1 py-3 text-center text-xs font-bold transition-all border-b-2 ${
                  layoutMode === 'custom'
                    ? 'border-violet-500 text-white bg-slate-900/10'
                    : 'border-transparent text-slate-450 hover:text-slate-250 hover:bg-slate-900/5'
                }`}
              >
                Modelo Customizado (Editor Visual Drag-and-Drop)
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {layoutMode === 'custom' ? (
                <div className="lg:col-span-3">
                  <CertificateEditor
                    api={api}
                    eventId={eventId}
                    eventTitle={certTitle}
                    eventDate={event?.startDate || ''}
                    eventHours={certHours}
                    eventSigner={certSigner}
                    eventSignerUrl={certSignerUrl}
                    initialBackgroundUrl={event?.certificateBackgroundUrl || null}
                    initialLayout={event?.certificateLayoutJson || null}
                    onSaved={() => {
                      loadAll();
                    }}
                  />
                </div>
              ) : (
                <>
                  {/* Form Config */}
                  <div className="lg:col-span-2 bg-slate-900/10 border border-slate-900/80 p-6 rounded-2xl shadow-lg">
                    <h3 className="text-base font-extrabold text-white mb-4 pb-3 border-b border-slate-900">
                      Modelo de Certificado (Configuração do Evento)
                    </h3>
                    <form onSubmit={handleSaveCertConfig} className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-3xs font-extrabold uppercase tracking-widest text-slate-400">Título do Certificado</label>
                          <input
                            type="text"
                            value={certTitle}
                            onChange={(e) => setCertTitle(e.target.value)}
                            placeholder="Ex: CERTIFICADO DE PARTICIPAÇÃO"
                            className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-3xs font-extrabold uppercase tracking-widest text-slate-400">Carga Horária (Horas)</label>
                          <input
                            type="number"
                            value={certHours}
                            onChange={(e) => setCertHours(Number(e.target.value))}
                            placeholder="Ex: 8"
                            className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-3xs font-extrabold uppercase tracking-widest text-slate-400">Corpo do Certificado</label>
                        <textarea
                          rows={5}
                          value={certBody}
                          onChange={(e) => setCertBody(e.target.value)}
                          placeholder="Certificamos que {NOME} participou..."
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50 resize-none font-sans leading-relaxed"
                        />
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-[10px] text-slate-500 mr-2 flex items-center">Variáveis:</span>
                          {(['{NOME}', '{TÍTULO}', '{DATA}', '{X}'] as const).map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setCertBody((prev) => prev + ' ' + tag)}
                              className="text-[10px] font-mono text-indigo-400 bg-indigo-950/30 border border-indigo-900/40 hover:bg-indigo-900/50 px-2 py-0.5 rounded transition"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1.5">
                          <label className="text-3xs font-extrabold uppercase tracking-widest text-slate-400">Nome do Assinante (Organizador)</label>
                          <input
                            type="text"
                            value={certSigner}
                            onChange={(e) => setCertSigner(e.target.value)}
                            placeholder="Ex: Nome do Organizador ou Diretor"
                            className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-3xs font-extrabold uppercase tracking-widest text-slate-400">Assinatura Digital (Upload)</label>
                          <div className="flex items-center space-x-3">
                            <input
                              type="text"
                              value={certSignerUrl}
                              onChange={(e) => setCertSignerUrl(e.target.value)}
                              placeholder="URL da assinatura..."
                              className="flex-1 bg-slate-950 border border-slate-850 rounded-lg px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50"
                            />
                            <div className="relative">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleSignatureUpload}
                                id="sig-upload-input"
                                className="hidden"
                              />
                              <Button
                                type="button"
                                disabled={uploadingSignature}
                                onClick={() => document.getElementById('sig-upload-input')?.click()}
                                className="bg-slate-900 hover:bg-slate-850 text-slate-350 border border-slate-850 text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"
                              >
                                {uploadingSignature ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Upload className="h-3.5 w-3.5" />
                                )}
                                <span>Upload</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-4 border-t border-slate-900">
                        <Button
                          type="submit"
                          disabled={certConfigSaving}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-bold text-xs py-2.5 px-6 rounded-lg flex items-center gap-2"
                        >
                          {certConfigSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                          <span>Salvar Configurações</span>
                        </Button>
                      </div>
                    </form>
                  </div>

                  {/* Guide Card */}
                  <div className="bg-slate-900/10 border border-slate-900 p-6 rounded-2xl flex flex-col justify-between space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <Info className="h-4 w-4 text-violet-400" />
                        Guia do Modelo
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Você pode personalizar o layout do certificado de acordo com a identidade da sua marca/evento. O PDF gerado tem formato A4 Paisagem.
                      </p>
                      <div className="space-y-3 bg-slate-950/60 p-4 border border-slate-850 rounded-xl text-2xs text-slate-450 leading-normal">
                        <p className="font-bold text-slate-350">Tags Dinâmicas Disponíveis:</p>
                        <ul className="list-disc pl-4 space-y-2">
                          <li><strong className="text-indigo-400 font-mono">{`{NOME}`}</strong>: Substituído pelo nome completo do participante registrado no check-in.</li>
                          <li><strong className="text-indigo-400 font-mono">{`{TÍTULO}`}</strong>: Substituído pelo nome do evento corrente.</li>
                          <li><strong className="text-indigo-400 font-mono">{`{DATA}`}</strong>: Substituído pela data de realização formatada (DD/MM/AAAA).</li>
                          <li><strong className="text-indigo-400 font-mono">{`{X}`}</strong>: Substituído pela carga horária definida na configuração.</li>
                        </ul>
                      </div>
                    </div>
                    <div className="text-3xs text-slate-500 border-t border-slate-900 pt-4">
                      Observação: O logotipo da organização (definido nas configurações da conta) é exibido automaticamente no cabeçalho do certificado no modelo padrão.
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- INLINE MODALS FOR SUB-RESOURCES --- */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <h3 className="font-extrabold text-white text-lg">
              {editingId ? 'Editar' : 'Adicionar'}{' '}
              {modalOpen === 'speaker' ? 'Palestrante' : modalOpen === 'sponsor' ? 'Patrocinador' : modalOpen === 'schedule' ? 'Atividade' : 'Oficina'}
            </h3>

            {modalError && <p className="text-xs font-semibold text-red-400 bg-red-950/20 border border-red-900/30 p-2.5 rounded-lg">{modalError}</p>}

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Speaker Modal Content */}
              {modalOpen === 'speaker' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-bold uppercase">Nome *</label>
                    <input type="text" value={spName} onChange={(e) => setSpName(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-bold uppercase">Cargo / Empresa</label>
                    <input type="text" value={spRole} onChange={(e) => setSpRole(e.target.value)} placeholder="Ex: Senior Developer @ Google" className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-bold uppercase">Mini Biografia</label>
                    <textarea rows={3} value={spBio} onChange={(e) => setSpBio(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none resize-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-bold uppercase">Foto de Perfil</label>
                    <div className="flex items-center space-x-3">
                      <input type="text" value={spPhotoUrl} onChange={(e) => setSpPhotoUrl(e.target.value)} placeholder="URL..." className="flex-1 bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none" />
                      <div className="relative">
                        <input type="file" accept="image/*" onChange={(e) => handleModalPhotoUpload(e, 'speaker')} className="hidden" id="sp-photo-file" />
                        <label htmlFor="sp-photo-file" className="px-3 py-2 bg-slate-850 border border-slate-800 rounded-lg text-xs font-semibold cursor-pointer text-slate-350 hover:text-white">Upload</label>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Sponsor Modal Content */}
              {modalOpen === 'sponsor' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-bold uppercase">Nome da Marca *</label>
                    <input type="text" value={sponName} onChange={(e) => setSponName(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-bold uppercase">Tier / Nível</label>
                    <select value={sponTier} onChange={(e) => setSponTier(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none">
                      <option value="DIAMOND">DIAMOND</option>
                      <option value="PLATINUM">PLATINUM</option>
                      <option value="GOLD">GOLD</option>
                      <option value="SILVER">SILVER</option>
                      <option value="BRONZE">BRONZE</option>
                      <option value="SUPPORT">APOIO</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-bold uppercase">Logo Url</label>
                    <div className="flex items-center space-x-3">
                      <input type="text" value={sponLogoUrl} onChange={(e) => setSponLogoUrl(e.target.value)} placeholder="URL..." className="flex-1 bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none" />
                      <div className="relative">
                        <input type="file" accept="image/*" onChange={(e) => handleModalPhotoUpload(e, 'sponsor')} className="hidden" id="spon-logo-file" />
                        <label htmlFor="spon-logo-file" className="px-3 py-2 bg-slate-850 border border-slate-800 rounded-lg text-xs font-semibold cursor-pointer text-slate-350 hover:text-white">Upload</label>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Schedule Item Modal Content */}
              {modalOpen === 'schedule' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-bold uppercase">Título da Atividade *</label>
                    <input type="text" value={schTitle} onChange={(e) => setSchTitle(e.target.value)} placeholder="Ex: Credenciamento e Coffe-break" className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-bold uppercase">Descrição</label>
                    <textarea rows={2} value={schDesc} onChange={(e) => setSchDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-450 font-bold uppercase">Início *</label>
                      <input type="datetime-local" value={schStart} onChange={(e) => setSchStart(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-250 focus:outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-450 font-bold uppercase">Fim *</label>
                      <input type="datetime-local" value={schEnd} onChange={(e) => setSchEnd(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-250 focus:outline-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-bold uppercase">Local (Físico ou Link Online)</label>
                    <input type="text" value={schLocation} onChange={(e) => setSchLocation(e.target.value)} placeholder="Ex: Auditório Principal / Sala Zoom 2" className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-bold uppercase">Palestrante Vinculado</label>
                    <select value={schSpeakerId} onChange={(e) => setSchSpeakerId(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none">
                      <option value="">Nenhum Palestrante</option>
                      {speakers.map((sp) => (
                        <option key={sp.id} value={sp.id}>{sp.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Workshop Modal Content */}
              {modalOpen === 'workshop' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-bold uppercase">Título da Oficina *</label>
                    <input type="text" value={workTitle} onChange={(e) => setWorkTitle(e.target.value)} placeholder="Ex: Oficina de Robótica e IOT" className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-bold uppercase">Descrição</label>
                    <textarea rows={2} value={workDesc} onChange={(e) => setWorkDesc(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-450 font-bold uppercase">Início *</label>
                      <input type="datetime-local" value={workStart} onChange={(e) => setWorkStart(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-250 focus:outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-450 font-bold uppercase">Fim *</label>
                      <input type="datetime-local" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-250 focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-450 font-bold uppercase">Capacidade *</label>
                      <input type="number" min={1} value={workCapacity} onChange={(e) => setWorkCapacity(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-450 font-bold uppercase">Local</label>
                      <input type="text" value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} placeholder="Ex: Sala 103" className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-bold uppercase">Palestrante Responsável</label>
                    <select value={workSpeakerId} onChange={(e) => setWorkSpeakerId(e.target.value)} className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none">
                      <option value="">Nenhum Palestrante</option>
                      {speakers.map((sp) => (
                        <option key={sp.id} value={sp.id}>{sp.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-900">
              <Button type="button" onClick={() => setModalOpen(null)} variant="ghost" className="text-slate-450 hover:text-white">
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={
                  modalOpen === 'speaker'
                    ? handleSaveSpeaker
                    : modalOpen === 'sponsor'
                    ? handleSaveSponsor
                    : modalOpen === 'schedule'
                    ? handleSaveScheduleItem
                    : handleSaveWorkshop
                }
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold py-1.5 px-5 rounded-lg"
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* --- MODAL: WORKSHOP ENROLLMENTS LIST --- */}
      {enrollmentsModalOpen && selectedWorkshop && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative flex flex-col max-h-[85vh]">
            <button
              onClick={() => setEnrollmentsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-455 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="flex-shrink-0 space-y-1">
              <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-violet-500" />
                Participantes da Oficina
              </h3>
              <p className="text-xs text-violet-400 font-extrabold">
                {selectedWorkshop.title}
              </p>
              <p className="text-[10px] text-slate-500">
                {new Date(selectedWorkshop.startTime).toLocaleDateString('pt-BR')} • {new Date(selectedWorkshop.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedWorkshop.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {enrollmentsError && (
              <div className="p-3 bg-red-955/40 border border-red-900/50 rounded-lg text-xs text-red-400 flex items-center gap-2 flex-shrink-0">
                <AlertCircle className="h-4 w-4" />
                <span>{enrollmentsError}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-950/30 border border-slate-850 rounded-xl">
              {loadingEnrollments ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <Loader2 className="h-6 w-6 text-violet-500 animate-spin" />
                  <span className="text-xs text-slate-450 font-semibold">Carregando inscritos...</span>
                </div>
              ) : workshopEnrollments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Users className="h-8 w-8 text-slate-650 mb-2" />
                  <span className="text-slate-500 text-xs font-semibold">Nenhum participante inscrito nesta oficina ainda.</span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-450 uppercase font-bold tracking-widest text-[9px] bg-slate-950/50">
                      <th className="py-3 px-4">Código / Nome</th>
                      <th className="py-3 px-4">E-mail / Telefone</th>
                      <th className="py-3 px-4 text-center">Data Inscrição</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workshopEnrollments.map((item) => {
                      const reg = item.registration;
                      if (!reg) return null;
                      return (
                        <tr key={item.id} className="border-b border-slate-850/50 hover:bg-slate-900/10 text-white">
                          <td className="py-3 px-4">
                            <div className="font-mono text-violet-400 font-extrabold text-[10px]">{reg.code}</div>
                            <div className="font-extrabold mt-0.5">{reg.name}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-350">{reg.email}</div>
                            {reg.phone && <div className="text-slate-500 text-[10px] mt-0.5">{reg.phone}</div>}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-450">
                            {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                            <div className="text-[9px] mt-0.5">{new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleCancelEnrollment(selectedWorkshop.id, reg.id)}
                              className="text-red-405 hover:text-red-300 font-extrabold uppercase text-[9px] tracking-wider px-2.5 py-1 bg-red-955/20 hover:bg-red-900/20 border border-red-900/30 rounded transition-all"
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-900 flex-shrink-0">
              <Button
                type="button"
                onClick={() => setEnrollmentsModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs py-2 px-5 rounded-lg"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: TRANSFER REGISTRATION --- */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setTransferModalOpen(false)}
              className="absolute top-4 right-4 text-slate-450 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            
            <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-violet-500" />
              Transferir Inscrição
            </h3>

            <p className="text-xs text-slate-400">
              Insira os dados do participante destinatário. A inscrição atual será cancelada/transferida e uma nova inscrição será gerada para o novo participante.
            </p>

            {transferError && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{transferError}</span>
              </div>
            )}

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-3xs font-extrabold uppercase tracking-widest text-slate-400">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={transferData.name}
                  onChange={(e) => setTransferData((prev) => ({ ...prev, name: e.target.value.toUpperCase() }))}
                  className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500/50 uppercase"
                  placeholder="Nome do novo participante"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-3xs font-extrabold uppercase tracking-widest text-slate-400">E-mail</label>
                <input
                  type="email"
                  required
                  value={transferData.email}
                  onChange={(e) => setTransferData((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500/50"
                  placeholder="exemplo@email.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-3xs font-extrabold uppercase tracking-widest text-slate-400">CPF</label>
                  <input
                    type="text"
                    required
                    value={transferData.cpf}
                    onChange={handleTransferCpfChange}
                    className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500/50 font-mono"
                    placeholder="000.000.000-00"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-3xs font-extrabold uppercase tracking-widest text-slate-400">Telefone</label>
                  <input
                    type="text"
                    required
                    value={transferData.phone}
                    onChange={handleTransferPhoneChange}
                    className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500/50"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-900">
                <Button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  variant="ghost"
                  className="text-slate-450 hover:text-white text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={transferSubmitting}
                  className="bg-violet-600 hover:bg-violet-750 text-white font-bold text-xs py-2 px-5 rounded-lg flex items-center gap-2"
                >
                  {transferSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Confirmar Transferência</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CANCEL REGISTRATION --- */}
      {cancelRegModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setCancelRegModalOpen(false)}
              className="absolute top-4 right-4 text-slate-450 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Cancelar Inscrição
            </h3>

            <p className="text-xs text-slate-400">
              Tem certeza de que deseja cancelar esta inscrição? Se houver participantes na fila de espera, a vaga poderá ser automaticamente oferecida ao próximo da lista.
            </p>

            {cancelRegError && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{cancelRegError}</span>
              </div>
            )}

            <form onSubmit={handleCancelRegSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-3xs font-extrabold uppercase tracking-widest text-slate-400">Motivo do Cancelamento (Opcional)</label>
                <textarea
                  value={cancelRegReason}
                  onChange={(e) => setCancelRegReason(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500/50 h-20 resize-none"
                  placeholder="Ex: Solicitação do participante..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-900">
                <Button
                  type="button"
                  onClick={() => setCancelRegModalOpen(false)}
                  variant="ghost"
                  className="text-slate-450 hover:text-white text-xs"
                >
                  Manter Ativa
                </Button>
                <Button
                  type="submit"
                  disabled={cancelRegSubmitting}
                  className="bg-red-650 hover:bg-red-750 text-white font-bold text-xs py-2 px-5 rounded-lg flex items-center gap-2"
                >
                  {cancelRegSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Confirmar Cancelamento</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
