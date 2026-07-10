import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: /^\/tenant-[a-zA-Z0-9_-]+$/,
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const namespace = client.nsp.name; // e.g. "/tenant-some-uuid"
    const tenantId = namespace.replace('/tenant-', '');
    const token = client.handshake.query.token as string;

    if (!token) {
      this.logger.warn(`Connection rejected: no token in namespace ${namespace}`);
      client.disconnect();
      return;
    }

    try {
      const jwtSecret = this.configService.get<string>('JWT_SECRET') || 'default_secret_key';
      const payload = this.jwtService.verify(token, {
        secret: jwtSecret,
      });
      const userId = payload.sub;

      if (!userId) {
        this.logger.warn(`Connection rejected: Invalid sub in token for namespace ${namespace}`);
        client.disconnect();
        return;
      }

      // Verify tenant membership
      const membership = await this.prisma.tenantMembership.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId,
          },
        },
      });

      if (!membership) {
        this.logger.warn(`Connection rejected: User ${userId} is not a member of tenant ${tenantId}`);
        client.disconnect();
        return;
      }

      this.logger.log(`User ${userId} connected to namespace ${namespace}`);
    } catch (err: any) {
      this.logger.warn(`Connection rejected: Invalid token in namespace ${namespace}. Error: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from namespace ${client.nsp.name}`);
  }

  emitToCheckIn(tenantId: string, eventId: string, data: any) {
    if (this.server) {
      this.server.of(`/tenant-${tenantId}`).emit('checkin:new', data);
    }
  }

  emitToRegistrationNew(tenantId: string, data: any) {
    if (this.server) {
      this.server.of(`/tenant-${tenantId}`).emit('registration:new', data);
    }
  }

  emitToRegistrationCancelled(tenantId: string, data: any) {
    if (this.server) {
      this.server.of(`/tenant-${tenantId}`).emit('registration:cancelled', data);
    }
  }
}
