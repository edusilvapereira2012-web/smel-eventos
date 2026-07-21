'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { useTenant } from '@/components/tenant-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { api } from '@/lib/api';
import { db, PendingCheckIn, ConfirmedRegistration } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  Wifi,
  WifiOff,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  Search,
  RefreshCw,
  Play,
  Square,
  X,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CheckInScannerPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { activeTenant } = useTenant();
  const { hasPermission, loading: permLoading } = usePermissions();
  const eventId = params.eventId as string;

  // Connection & sync state
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ processed: number; duplicates: number; errors: any[] } | null>(null);

  // Cache download state
  const [caching, setCaching] = useState(false);
  const [cacheCount, setCacheCount] = useState(0);

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [scanResult, setScanResult] = useState<{ status: 'success' | 'warning' | 'error'; message: string; details?: string } | null>(null);

  // Manual search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ConfirmedRegistration[]>([]);

  // Local active event name
  const [eventName, setEventName] = useState('Carregando Evento...');

  // Workshops state
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>('');

  useEffect(() => {
    if (eventId) {
      if (isOnline) {
        api.get(`/events/${eventId}/workshops`)
          .then(res => {
            setWorkshops(res.data);
            localStorage.setItem(`eh_workshops_${eventId}`, JSON.stringify(res.data));
          })
          .catch(err => console.error('Erro ao buscar atividades/oficinas:', err));
      } else {
        const cached = localStorage.getItem(`eh_workshops_${eventId}`);
        if (cached) {
          try {
            setWorkshops(JSON.parse(cached));
          } catch (e) {}
        }
      }
    }
  }, [eventId, isOnline]);

  // Live query for pending queue
  const pendingCheckins = useLiveQuery(() =>
    db.pendingCheckins.where('eventId').equals(eventId).toArray()
  ) || [];

  // 1. Connection Status Detection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const goOnline = () => setIsOnline(true);
      const goOffline = () => setIsOnline(false);
      window.addEventListener('online', goOnline);
      window.addEventListener('offline', goOffline);
      return () => {
        window.removeEventListener('online', goOnline);
        window.removeEventListener('offline', goOffline);
      };
    }
  }, []);

  // Get or Generate unique Device ID
  const getDeviceId = () => {
    let id = localStorage.getItem('eh_device_id');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('eh_device_id', id);
    }
    return id;
  };

  // 2. Fetch/Cache confirmed registrations for offline lookup
  const downloadRegistrationsCache = async () => {
    if (!isOnline) return;
    try {
      setCaching(true);
      
      // Get Event Details first
      const evRes = await api.get(`/events/${eventId}`);
      setEventName(evRes.data.title);

      // Load all confirmed registrations recursively due to API pagination limit
      let all: any[] = [];
      let cursor: string | undefined = undefined;
      let hasMore = true;
      let res: any;

      while (hasMore) {
        res = await api.get(`/events/${eventId}/registrations`, {
          params: {
            status: 'CONFIRMED',
            limit: 100,
            cursor,
          },
        });
        all = [...all, ...res.data.data];
        cursor = res.data.nextCursor;
        if (!cursor) {
          hasMore = false;
        }
      }

      // Save to Dexie
      await db.confirmedRegistrations.where('eventId').equals(eventId).delete();
      
      const mapped = all.map(r => ({
        id: r.id,
        name: r.name,
        code: r.code,
        email: r.email,
        eventId: r.eventId,
        checkedInAt: r.checkedInAt,
        workshopEnrollments: r.workshopEnrollments ? r.workshopEnrollments.map((w: any) => w.workshopId) : [],
        workshopCheckins: r.workshopEnrollments ? r.workshopEnrollments.reduce((acc: any, w: any) => {
          if (w.checkedInAt) {
            acc[w.workshopId] = w.checkedInAt;
          }
          return acc;
        }, {}) : {},
      }));

      await db.confirmedRegistrations.bulkAdd(mapped);
      setCacheCount(mapped.length);
    } catch (err) {
      console.error('Falha ao baixar cache de inscritos:', err);
    } finally {
      setCaching(false);
    }
  };

  // Update cached count status
  const updateCachedCount = async () => {
    const count = await db.confirmedRegistrations.where('eventId').equals(eventId).count();
    setCacheCount(count);
  };

  useEffect(() => {
    if (eventId) {
      updateCachedCount();
    }
  }, [eventId]);

  // Sync automatically when coming online
  useEffect(() => {
    if (isOnline && pendingCheckins.length > 0 && !syncing) {
      handleSyncQueue();
    }
  }, [isOnline, pendingCheckins.length]);

  // 3. Batch synchronization function
  const handleSyncQueue = async () => {
    if (!isOnline || pendingCheckins.length === 0 || syncing) return;

    try {
      setSyncing(true);
      setSyncResult(null);

      const payload = pendingCheckins.map(item => ({
        registrationId: item.registrationId,
        eventId: item.eventId,
        checkedInAt: item.checkedInAt,
        deviceId: item.deviceId,
        token: item.token,
        workshopId: item.workshopId,
      }));

      const res = await api.post('/checkin/sync', { checkins: payload });
      
      // Clear processed items from IndexedDB
      const idsToDelete = pendingCheckins
        .map(item => item.id)
        .filter(id => id !== undefined) as number[];
      
      await db.pendingCheckins.bulkDelete(idsToDelete);

      setSyncResult({
        processed: res.data.processed,
        duplicates: res.data.duplicates,
        errors: res.data.errors,
      });

      // Refetch cache to update checked-in timestamps locally
      downloadRegistrationsCache();
    } catch (err) {
      console.error('Erro de sincronização:', err);
    } finally {
      setSyncing(false);
    }
  };

  // Offline decode helper
  const decodeJWTOffline = (token: string) => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      // Decode payload
      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch (err) {
      return null;
    }
  };

  // 4. Handle QR code scans
  const handleQRCodeScanned = async (token: string) => {
    // Prevent double scan processing instantly
    if (scanning) {
      stopScanner();
    }

    if (isOnline) {
      // Direct Online Validation
      try {
        setScanResult(null);
        const res = await api.post('/checkin/validate', {
          token,
          deviceId: getDeviceId(),
          workshopId: selectedWorkshopId || undefined,
        });
        
        setScanResult({
          status: 'success',
          message: res.data.registration.workshopTitle ? 'Check-in Atividade / Oficina Confirmado!' : 'Check-in Confirmado!',
          details: `${res.data.registration.name} (${res.data.registration.code})${res.data.registration.workshopTitle ? ` - ${res.data.registration.workshopTitle}` : ''}`,
        });
      } catch (err: any) {
        const errMsg = err.response?.data?.message || 'Falha ao processar check-in';
        const isDup = err.response?.status === 409;
        
        setScanResult({
          status: isDup ? 'warning' : 'error',
          message: isDup ? 'Check-in Duplicado' : 'Erro no Check-in',
          details: errMsg,
        });
      }
    } else {
      // Offline Local Validation
      const payload = decodeJWTOffline(token);
      if (!payload || payload.eventId !== eventId) {
        setScanResult({
          status: 'error',
          message: 'QR Code Inválido',
          details: 'Este QR Code não pertence a este evento ou assinatura é corrompida.',
        });
        return;
      }

      const registrationId = payload.sub;

      // Check if registration exists locally
      const reg = await db.confirmedRegistrations.get(registrationId);
      if (!reg) {
        setScanResult({
          status: 'error',
          message: 'Participante Não Encontrado',
          details: 'Inscrição não consta no cache de confirmados.',
        });
        return;
      }

      if (selectedWorkshopId) {
        // Validate workshop enrollment offline
        const isEnrolled = reg.workshopEnrollments?.includes(selectedWorkshopId);
        if (!isEnrolled) {
          setScanResult({
            status: 'error',
            message: 'Não Matriculado',
            details: `${reg.name} não está matriculado nesta atividade/oficina.`,
          });
          return;
        }

        const checkedInTime = reg.workshopCheckins?.[selectedWorkshopId];
        const inQueue = await db.pendingCheckins.where('registrationId').equals(registrationId).and(c => c.workshopId === selectedWorkshopId).first();
        if (inQueue || checkedInTime) {
          setScanResult({
            status: 'warning',
            message: 'Check-in Duplicado (Atividade/Oficina)',
            details: `${reg.name} já possui check-in nesta atividade/oficina.`,
          });
          return;
        }

        // Valid check-in offline: Add to Dexie Queue
        await db.pendingCheckins.add({
          registrationId,
          eventId,
          checkedInAt: new Date().toISOString(),
          name: reg.name,
          code: reg.code,
          deviceId: getDeviceId(),
          token,
          workshopId: selectedWorkshopId,
        });

        setScanResult({
          status: 'success',
          message: 'Salvo Offline (Atividade/Oficina)!',
          details: `${reg.name} (${reg.code}) - Atividade/Oficina: ${workshops.find(w => w.id === selectedWorkshopId)?.title || 'Atividade/Oficina'}`,
        });
      } else {
        // Check for local duplications (either in pending queue or already marked checkedInAt)
        const inQueue = await db.pendingCheckins.where('registrationId').equals(registrationId).and(c => !c.workshopId).first();
        if (inQueue || reg.checkedInAt) {
          setScanResult({
            status: 'warning',
            message: 'Check-in Duplicado (Offline)',
            details: `${reg.name} (${reg.code}) já está registrado.`,
          });
          return;
        }

        // Valid check-in offline: Add to Dexie Queue
        await db.pendingCheckins.add({
          registrationId,
          eventId,
          checkedInAt: new Date().toISOString(),
          name: reg.name,
          code: reg.code,
          deviceId: getDeviceId(),
          token,
        });

        setScanResult({
          status: 'success',
          message: 'Salvo Offline com Sucesso!',
          details: `${reg.name} (${reg.code}) - Sincronização pendente.`,
        });
      }
    }
  };

  // Manual Check-in Handler
  const handleManualCheckIn = async (reg: ConfirmedRegistration) => {
    if (selectedWorkshopId) {
      const isEnrolled = reg.workshopEnrollments?.includes(selectedWorkshopId);
      if (!isEnrolled) {
        setScanResult({
          status: 'error',
          message: 'Não Matriculado',
          details: `${reg.name} não está matriculado nesta atividade/oficina.`,
        });
        return;
      }

      const checkedInTime = reg.workshopCheckins?.[selectedWorkshopId];
      const inQueue = await db.pendingCheckins.where('registrationId').equals(reg.id).and(c => c.workshopId === selectedWorkshopId).first();
      if (inQueue || checkedInTime) {
        setScanResult({
          status: 'warning',
          message: 'Check-in Duplicado (Atividade/Oficina)',
          details: `${reg.name} (${reg.code}) já está registrado nesta atividade/oficina.`,
        });
        return;
      }

      await db.pendingCheckins.add({
        registrationId: reg.id,
        eventId,
        checkedInAt: new Date().toISOString(),
        name: reg.name,
        code: reg.code,
        deviceId: getDeviceId(),
        workshopId: selectedWorkshopId,
      });

      setScanResult({
        status: 'success',
        message: isOnline ? 'Check-in Enviado (Atividade/Oficina)!' : 'Salvo Offline (Atividade/Oficina)!',
        details: `${reg.name} (${reg.code}) - ${workshops.find(w => w.id === selectedWorkshopId)?.title || 'Atividade/Oficina'}`,
      });
    } else {
      // Check if duplicate locally
      const inQueue = await db.pendingCheckins.where('registrationId').equals(reg.id).and(c => !c.workshopId).first();
      if (inQueue || reg.checkedInAt) {
        setScanResult({
          status: 'warning',
          message: 'Check-in Duplicado',
          details: `${reg.name} (${reg.code}) já está registrado.`,
        });
        return;
      }

      // Add to queue
      await db.pendingCheckins.add({
        registrationId: reg.id,
        eventId,
        checkedInAt: new Date().toISOString(),
        name: reg.name,
        code: reg.code,
        deviceId: getDeviceId(),
      });

      setScanResult({
        status: 'success',
        message: isOnline ? 'Check-in Enviado!' : 'Salvo Offline com Sucesso!',
        details: `${reg.name} (${reg.code})`,
      });
    }

    // Clear search
    setSearchQuery('');
    setSearchResults([]);

    // If online, immediately trigger sync to process manual check-in
    if (isOnline) {
      handleSyncQueue();
    }
  };

  // Search local offline database
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const results = await db.confirmedRegistrations
      .where('eventId')
      .equals(eventId)
      .filter(r =>
        r.name.toLowerCase().includes(query.toLowerCase()) ||
        r.code.toLowerCase().includes(query.toLowerCase())
      )
      .limit(10)
      .toArray();

    setSearchResults(results);
  };

  // Camera scanner handlers
  const startScanner = async () => {
    try {
      setScanResult(null);
      const { Html5Qrcode } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode('reader');
      setScanner(html5QrCode);
      setScanning(true);

      // Try environment facing mode first
      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (w, h) => {
              const size = Math.min(w, h) * 0.7;
              return { width: size, height: size };
            },
          },
          (decodedText) => {
            handleQRCodeScanned(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.warn('Failed to start camera with environment constraints. Trying fallback...', err);
        // Fallback to getCameras list
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          // Choose back camera if possible
          const backCamera = devices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('traseira') ||
            device.label.toLowerCase().includes('rear') ||
            device.label.toLowerCase().includes('environment')
          );
          const cameraId = backCamera ? backCamera.id : devices[0].id;
          
          await html5QrCode.start(
            cameraId,
            {
              fps: 10,
              qrbox: (w, h) => {
                const size = Math.min(w, h) * 0.7;
                return { width: size, height: size };
              },
            },
            (decodedText) => {
              handleQRCodeScanned(decodedText);
            },
            () => {}
          );
        } else {
          throw new Error('Nenhuma câmera disponível ou sem permissões de acesso.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setScanResult({
        status: 'error',
        message: 'Erro na Câmera',
        details: err?.message || 'Permissão negada ou câmera ocupada por outro aplicativo.',
      });
      setScanning(false);
      setScanner(null);
    }
  };

  const stopScanner = async () => {
    if (scanner && scanner.isScanning) {
      try {
        await scanner.stop();
      } catch (err) {
        console.error(err);
      }
    }
    setScanner(null);
    setScanning(false);
  };

  // Cleanup scanner on leave
  useEffect(() => {
    return () => {
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(console.error);
      }
    };
  }, [scanner]);

  // Initial downloads
  useEffect(() => {
    if (eventId && isOnline) {
      downloadRegistrationsCache();
    }
  }, [eventId, isOnline]);

  // Authorization safeguards
  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (!hasPermission('checkin.perform')) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertTriangle className="h-16 w-16 text-red-500" />
        <h1 className="text-2xl font-black text-white">Acesso Negado</h1>
        <p className="text-sm text-slate-400 max-w-md">
          Você não possui a permissão necessária (`checkin.perform`) para operar o controle de entrada deste evento.
        </p>
        <Button onClick={() => router.push(`/events/${eventId}`)} className="bg-slate-900 border border-slate-800 text-white hover:bg-slate-850">
          Voltar ao Evento
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100 pb-10">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push(`/events/${eventId}`)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-sm font-extrabold text-white truncate max-w-[200px] md:max-w-xs">{eventName}</h1>
            <span className="text-2xs font-bold text-slate-500 uppercase tracking-widest block mt-0.5">Operador: {user.name}</span>
          </div>
        </div>

        {/* Network Status Badge */}
        <div className="flex items-center space-x-2">
          {isOnline ? (
            <div className="flex items-center space-x-1.5 text-2xs font-extrabold text-emerald-400 uppercase tracking-widest bg-emerald-950/20 border border-emerald-900/30 px-3 py-1 rounded-full">
              <Wifi className="h-3.5 w-3.5" />
              <span>Online</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-2xs font-extrabold text-amber-500 uppercase tracking-widest bg-amber-950/20 border border-amber-900/30 px-3 py-1 rounded-full">
              <WifiOff className="h-3.5 w-3.5" />
              <span>Offline</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-xl w-full mx-auto px-6 mt-8 flex-1 flex flex-col space-y-6">
        
        {/* Selection mode (Event wide vs Workshop specific) */}
        <div className="p-5 bg-slate-900/10 border border-slate-900 rounded-2xl space-y-3.5">
          <div className="space-y-1">
            <span className="text-2xs font-extrabold text-violet-400 uppercase tracking-widest block font-sans">Controle de Acesso</span>
            <h3 className="font-extrabold text-sm text-white font-sans">Selecione o Portão / Ponto de Check-in</h3>
          </div>
          <select
            value={selectedWorkshopId}
            onChange={(e) => setSelectedWorkshopId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-900 rounded-xl py-3 px-4 text-xs text-white focus:border-violet-600 focus:outline-none transition-colors appearance-none cursor-pointer font-sans"
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 16px center',
              backgroundSize: '16px'
            }}
          >
            <option value="">Evento Principal (Entrada Geral / Abertura)</option>
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                Atividade / Oficina: {w.title} ({w.location || 'Sem local'})
              </option>
            ))}
          </select>
        </div>

        {/* Offline Queue Sync Card */}
        {pendingCheckins.length > 0 && (
          <div className="p-4 bg-violet-950/20 border border-violet-900/40 rounded-2xl flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-white block">Sincronização Pendente</span>
              <span className="text-2xs text-violet-300 block">{pendingCheckins.length} check-ins coletados offline precisam ser enviados.</span>
            </div>
            <Button
              onClick={handleSyncQueue}
              disabled={syncing || !isOnline}
              className="bg-violet-600 hover:bg-violet-750 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center space-x-2 shadow-lg shadow-violet-950/40"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span>Sincronizar</span>
            </Button>
          </div>
        )}

        {/* Sync Stats results */}
        {syncResult && (
          <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-2xl space-y-2 text-xs text-emerald-400">
            <div className="flex items-center space-x-2 font-bold">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Sincronização Finalizada</span>
            </div>
            <p>
              Processados: <strong>{syncResult.processed}</strong> | Duplicados ignorados: <strong>{syncResult.duplicates}</strong>
            </p>
            {syncResult.errors.length > 0 && (
              <div className="text-red-400 mt-2 space-y-1">
                <span className="font-semibold block">Erros ({syncResult.errors.length}):</span>
                <ul className="list-disc list-inside max-h-20 overflow-y-auto font-mono text-3xs">
                  {syncResult.errors.map((e, idx) => (
                    <li key={idx}>Inscrição {e.registrationId}: {e.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Camera Scanner View */}
        <div className="space-y-4">
          <div className="relative w-full aspect-square overflow-hidden rounded-2xl border border-slate-900 bg-slate-950">
            {/* The actual reader element that html5-qrcode attaches to. MUST remain empty and untouched by React children */}
            <div 
              id="reader" 
              className="w-full h-full text-white"
              style={{ display: scanning ? 'block' : 'none' }}
            />

            {/* Camera Start UI Overlay */}
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="h-16 w-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto border border-slate-800">
                  <QrCode className="h-8 w-8 text-slate-500" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-sm text-white">Scanner de QR Code</h3>
                  <p className="text-2xs text-slate-500 max-w-[240px] mx-auto">
                    Ative a câmera para escanear os QR codes dos ingressos dos participantes.
                  </p>
                </div>
                <Button onClick={startScanner} className="bg-violet-600 hover:bg-violet-750 text-white font-bold text-xs py-2.5 px-6 rounded-xl flex items-center space-x-2 mx-auto">
                  <Camera className="h-4 w-4" />
                  <span>Iniciar Câmera</span>
                </Button>
              </div>
            )}

            {scanning && (
              <Button
                onClick={stopScanner}
                className="absolute bottom-4 right-4 z-10 bg-red-600 hover:bg-red-750 text-white font-bold text-xs p-3 rounded-xl flex items-center space-x-1.5 shadow-lg shadow-red-950/20"
              >
                <Square className="h-4.5 w-4.5" />
                <span>Parar Câmera</span>
              </Button>
            )}
          </div>
        </div>

        {/* Scan Status Feedback */}
        {scanResult && (
          <div
            className={`p-5 border rounded-2xl space-y-2 flex items-start gap-4 transition-all duration-300 ${
              scanResult.status === 'success'
                ? 'bg-emerald-950/25 border-emerald-900/40 text-emerald-400 shadow-md shadow-emerald-950/10'
                : scanResult.status === 'warning'
                ? 'bg-amber-950/25 border-amber-900/40 text-amber-500 shadow-md shadow-amber-950/10'
                : 'bg-red-950/25 border-red-900/40 text-red-400 shadow-md shadow-red-950/10'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {scanResult.status === 'success' ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              ) : (
                <AlertTriangle className={`h-6 w-6 ${scanResult.status === 'warning' ? 'text-amber-500' : 'text-red-400'}`} />
              )}
            </div>
            <div className="flex-1 space-y-1 min-w-0">
              <span className="font-extrabold text-sm block leading-tight">{scanResult.message}</span>
              {scanResult.details && <span className="text-xs text-slate-450 block truncate">{scanResult.details}</span>}
            </div>
            <button onClick={() => setScanResult(null)} className="p-1 hover:bg-slate-900/40 rounded-lg text-slate-500 hover:text-slate-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Manual search panel */}
        <div className="bg-slate-900/10 border border-slate-900 rounded-2xl p-5 space-y-4">
          <div className="space-y-1">
            <h3 className="font-extrabold text-white text-sm">Busca Manual de Inscrição</h3>
            <p className="text-2xs text-slate-500">Procure pelo nome ou código da inscrição se a câmera falhar.</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
            <input
              type="text"
              placeholder="Digite o nome ou código..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full bg-slate-950 border border-slate-900 rounded-xl py-3 pl-11 pr-4 text-xs text-white placeholder-slate-650 focus:border-violet-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Search Results list */}
          {searchResults.length > 0 && (
            <div className="divide-y divide-slate-900 border border-slate-900 rounded-xl overflow-hidden bg-slate-950/40">
              {searchResults.map((reg) => (
                <div key={reg.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-900/20 transition-colors">
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-white block truncate">{reg.name}</span>
                    <span className="font-mono text-3xs text-slate-500 uppercase tracking-wider">{reg.code} • {reg.email}</span>
                  </div>
                  {(() => {
                    const isEnrolled = selectedWorkshopId ? reg.workshopEnrollments?.includes(selectedWorkshopId) : true;
                    const isCheckedIn = selectedWorkshopId
                      ? !!reg.workshopCheckins?.[selectedWorkshopId] || pendingCheckins.some(c => c.registrationId === reg.id && c.workshopId === selectedWorkshopId)
                      : !!reg.checkedInAt || pendingCheckins.some(c => c.registrationId === reg.id && !c.workshopId);

                    if (!isEnrolled) {
                      return (
                        <Button
                          disabled
                          className="font-extrabold text-3xs uppercase tracking-widest px-3 py-1.5 rounded-lg flex-shrink-0 bg-slate-950 border border-slate-900 text-slate-650 cursor-not-allowed font-sans"
                        >
                          Não Matriculado
                        </Button>
                      );
                    }

                    return (
                      <Button
                        onClick={() => handleManualCheckIn(reg)}
                        disabled={isCheckedIn}
                        className={`font-extrabold text-3xs uppercase tracking-widest px-3 py-1.5 rounded-lg flex-shrink-0 font-sans ${
                          isCheckedIn
                            ? 'bg-slate-950 border border-slate-900 text-slate-600 cursor-not-allowed'
                            : 'bg-violet-600 hover:bg-violet-750 text-white'
                        }`}
                      >
                        {isCheckedIn ? 'Presente' : 'Check-in'}
                      </Button>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}

          {searchQuery && searchResults.length === 0 && (
            <div className="text-center py-6 text-slate-500 text-xs border border-dashed border-slate-900 rounded-xl">
              Nenhuma inscrição correspondente encontrada.
            </div>
          )}
        </div>

        {/* Cache status details */}
        <div className="flex justify-between items-center text-3xs font-extrabold text-slate-550 uppercase tracking-widest px-1">
          <span>Cache local: {cacheCount} registros</span>
          {isOnline && (
            <button
              onClick={downloadRegistrationsCache}
              disabled={caching}
              className="flex items-center space-x-1 hover:text-violet-400 transition-colors"
            >
              {caching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span>Atualizar Cache</span>
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
