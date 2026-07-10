export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  roleId: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  date: Date;
  location?: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Registration {
  id: string;
  userId: string;
  eventId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
  updatedAt: Date;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

export type Permission =
  | 'event:create'
  | 'event:read'
  | 'event:update'
  | 'event:delete'
  | 'registration:manage'
  | 'tenant:settings';
