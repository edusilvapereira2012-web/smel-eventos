export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'FINISHED' | 'CANCELLED';

export const EVENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicado',
  FINISHED: 'Finalizado',
  CANCELLED: 'Cancelado',
};

export const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmado',
  WAITLIST: 'Lista de Espera',
  CANCELLED: 'Cancelado',
  TRANSFERRED: 'Transferido',
};

export interface EventCategory {
  id: string;
  name: string;
  color?: string | null;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventSpeaker {
  id: string;
  name: string;
  bio?: string | null;
  photoUrl?: string | null;
  role?: string | null;
  eventId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventSponsor {
  id: string;
  name: string;
  logoUrl?: string | null;
  tier?: string | null;
  eventId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleItem {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  speakerId?: string | null;
  location?: string | null;
  order: number;
  eventId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description?: string | null;
  bannerUrl?: string | null;
  location?: string | null;
  isOnline: boolean;
  onlineUrl?: string | null;
  startDate: string;
  endDate: string;
  capacity: number;
  status: EventStatus;
  categoryId?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: EventCategory | null;
  speakers?: EventSpeaker[];
  sponsors?: EventSponsor[];
  schedule?: ScheduleItem[];
  certificateTitle?: string | null;
  certificateBody?: string | null;
  certificateHours?: number | null;
  certificateSigner?: string | null;
  certificateSignerUrl?: string | null;
  certificateBackgroundUrl?: string | null;
  certificateLayoutJson?: any | null;
  maxWorkshops: number;
  workshops?: Workshop[];
}

export interface Workshop {
  id: string;
  eventId: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  capacity: number;
  location?: string | null;
  speakerId?: string | null;
  speaker?: EventSpeaker | null;
  _count?: {
    enrollments: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopEnrollment {
  id: string;
  registrationId: string;
  workshopId: string;
  createdAt: string;
}
