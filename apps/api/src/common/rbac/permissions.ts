import { TenantRole } from '@prisma/client';

export type Permission =
  | 'tenants.update'
  | 'members.create'
  | 'members.update'
  | 'members.delete'
  | 'events.create'
  | 'events.update'
  | 'events.delete'
  | 'events.view'
  | 'checkin.execute'
  | 'checkin.perform'
  | 'registrations.view-cpf'
  | 'reports:export-sensitive'
  | 'dashboard.view'
  | 'audit-logs.view';

export const ROLE_PERMISSIONS: Record<TenantRole, Permission[]> = {
  [TenantRole.OWNER]: [
    'tenants.update',
    'members.create',
    'members.update',
    'members.delete',
    'events.create',
    'events.update',
    'events.delete',
    'events.view',
    'checkin.execute',
    'checkin.perform',
    'registrations.view-cpf',
    'reports:export-sensitive',
    'dashboard.view',
    'audit-logs.view',
  ],
  [TenantRole.ADMIN]: [
    'tenants.update',
    'members.create',
    'members.update',
    'members.delete',
    'events.create',
    'events.update',
    'events.delete',
    'events.view',
    'checkin.execute',
    'checkin.perform',
    'registrations.view-cpf',
    'reports:export-sensitive',
    'dashboard.view',
  ],
  [TenantRole.ORGANIZER]: [
    'events.update',
    'events.view',
    'checkin.execute',
    'checkin.perform',
    'dashboard.view',
  ],
  [TenantRole.CHECKER]: [
    'events.view',
    'checkin.execute',
    'checkin.perform',
  ],
  [TenantRole.MEMBER]: [
    'events.view',
  ],
};

export function hasPermission(role: TenantRole, permission: Permission): boolean {
  if (role === TenantRole.OWNER) return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}
