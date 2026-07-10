import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'checkin',
})
export class CheckInGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(CheckInGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado ao checkin gateway: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado do checkin gateway: ${client.id}`);
  }

  broadcastCheckIn(eventId: string, checkinData: any) {
    if (this.server) {
      this.logger.log(`Broadcasting checkin para evento ${eventId}`);
      this.server.emit(`events:${eventId}:checkin`, checkinData);
    }
  }
}
