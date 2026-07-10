import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as express from 'express';
import { RedisService } from '../../../common/redis/redis.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    configService: ConfigService,
    private redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: express.Request) => {
          return req?.cookies?.['refresh_token'] || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET')!,
    });
  }

  async validate(payload: any) {
    const userId = payload.sub;
    const tokenId = payload.tokenId;
    if (!userId || !tokenId) {
      throw new UnauthorizedException('Token de atualização inválido');
    }

    const redisKey = `refresh:${userId}:${tokenId}`;
    const tokenExists = await this.redisService.get(redisKey);
    if (!tokenExists) {
      throw new UnauthorizedException('Token de atualização expirado ou revogado');
    }

    return { id: userId, tokenId };
  }
}
