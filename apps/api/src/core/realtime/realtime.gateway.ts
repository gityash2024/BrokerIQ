import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { env } from '../../config/env';

/** Socket.io gateway. Clients connect with { auth: { token } } and are joined to user:<id> and org:<orgId>. */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);
  @WebSocketServer() server: Server;

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth?.token as string) || String(client.handshake.headers.authorization ?? '').replace('Bearer ', '');
      const payload = this.jwt.verify(token, { secret: env().JWT_ACCESS_SECRET });
      client.data.user = payload;
      client.join(`user:${payload.sub}`);
      if (payload.orgId) client.join(`org:${payload.orgId}`);
      if (payload.role === 'SUPER_ADMIN') client.join('admins');
    } catch {
      client.disconnect(true);
    }
  }

  toUser(userId: string, event: string, data: unknown) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }
  toOrg(orgId: string, event: string, data: unknown) {
    this.server?.to(`org:${orgId}`).emit(event, data);
  }
  toAdmins(event: string, data: unknown) {
    this.server?.to('admins').emit(event, data);
  }
}
