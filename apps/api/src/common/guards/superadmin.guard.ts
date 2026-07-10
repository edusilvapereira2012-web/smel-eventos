import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class SuperadminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.email !== 'valterpcjr@gmail.com') {
      throw new ForbiddenException('Acesso restrito ao Superadmin.');
    }

    return true;
  }
}
