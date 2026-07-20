import Dexie, { type Table } from 'dexie';

export interface PendingCheckIn {
  id?: number;
  registrationId: string;
  eventId: string;
  checkedInAt: string;
  name: string;
  code: string;
  deviceId: string;
  token?: string;
  workshopId?: string;
}

export interface ConfirmedRegistration {
  id: string;
  name: string;
  code: string;
  email: string;
  eventId: string;
  checkedInAt?: string | null;
  workshopEnrollments?: string[];
  workshopCheckins?: Record<string, string>;
}

export class CheckInDatabase extends Dexie {
  pendingCheckins!: Table<PendingCheckIn>;
  confirmedRegistrations!: Table<ConfirmedRegistration>;

  constructor() {
    super('CheckInDatabase');
    this.version(2).stores({
      pendingCheckins: '++id, registrationId, eventId, checkedInAt, workshopId',
      confirmedRegistrations: 'id, name, code, email, eventId',
    });
  }
}

export const db = new CheckInDatabase();
