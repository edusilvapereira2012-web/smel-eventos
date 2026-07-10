import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';
export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
