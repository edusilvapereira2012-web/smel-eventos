import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const { context, throttler } = requestProps;
    const req = context.switchToHttp().getRequest();
    const isPublic = !req.user;
    const isCheckin = req.url.includes('/api/checkin') || req.url.includes('/api/check-in');

    // Selecionar o limitador apropriado baseado no contexto da requisição
    if (throttler.name === 'checkin') {
      if (!isCheckin) return true; // Ignora o limitador de check-in se não for rota de check-in
    } else if (throttler.name === 'auth') {
      if (isPublic || isCheckin) return true; // Ignora o limitador de auth se for público ou rota de check-in
    } else if (throttler.name === 'public') {
      if (!isPublic || isCheckin) return true; // Ignora o limitador público se for autenticado ou rota de check-in
    }

    return super.handleRequest(requestProps);
  }
}
