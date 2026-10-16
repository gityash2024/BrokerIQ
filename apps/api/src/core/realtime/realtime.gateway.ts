import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';

/** Socket.io gateway. Clients connect with { auth: { token } } and are joined to user:<id> and org:<orgId>. */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);
  @WebSocketServer() server: Server;

  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth?.token as string) || String(client.handshake.headers.authorization ?? '').replace('Bearer ', '');
      const payload = this.jwt.verify(token, { secret: env().JWT_ACCESS_SECRET });
      const current = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { organization: { select: { status: true } } } });
      const version = payload.sessionVersion ?? 0;
      if (!current || !Number.isSafeInteger(version) || current.sessionVersion !== version || current.status !== 'ACTIVE' || current.deletedAt ||
        (current.role !== 'SUPER_ADMIN' && current.organization?.status === 'SUSPENDED') ||
        (env().BROKER_FIRST && (!['SUPER_ADMIN', 'BROKER_ADMIN'].includes(current.role) || (current.role === 'BROKER_ADMIN' && !current.organizationId)))) {
        client.disconnect(true);
        return;
      }
      // Rooms follow current membership, never the possibly stale JWT claims.
      client.data.user = { sub: current.id, role: current.role, orgId: current.organizationId, sessionVersion: current.sessionVersion };
      client.join(`user:${current.id}`);
      if (current.organizationId) client.join(`org:${current.organizationId}`);
      if (current.role === 'SUPER_ADMIN') client.join('admins');
    } catch {
      client.disconnect(true);
    }
  }

  disconnectUser(userId: string) {
    this.server?.in(`user:${userId}`).disconnectSockets(true);
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
