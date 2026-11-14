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

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth?.token as string) || String(client.handshake.headers.authorization ?? '').replace('Bearer ', '');
      const payload = this.jwt.verify(token, { secret: env().JWT_ACCESS_SECRET });
      const current = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { organization: { select: { status: true } } } });
      const version = payload.sessionVersion ?? 0;
      const session =
        typeof payload.sid === 'string'
          ? await this.prisma.refreshToken.findFirst({
              where: { id: payload.sid, userId: payload.sub, sessionVersion: version, revokedAt: null, expiresAt: { gt: new Date() } },
              select: { id: true },
            })
          : null;
      if (
        !session ||
        !current ||
        !Number.isSafeInteger(version) ||
        current.sessionVersion !== version ||
        current.status !== 'ACTIVE' ||
        current.deletedAt ||
        (current.role !== 'SUPER_ADMIN' && current.organization?.status === 'SUSPENDED') ||
        (env().BROKER_FIRST &&
          (!['SUPER_ADMIN', 'BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT', 'USER'].includes(current.role) ||
            (['BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT'].includes(current.role) && !current.organizationId)))
      ) {
        client.disconnect(true);
        return;
      }
      // Rooms follow current membership, never the possibly stale JWT claims.
      client.data.user = { sub: current.id, role: current.role, orgId: current.organizationId, sessionVersion: current.sessionVersion };
      client.join(`user:${current.id}`);
      client.join(`session:${session.id}`);
      const expiry = setTimeout(() => client.disconnect(true), Math.max(1, payload.exp * 1000 - Date.now()));
      expiry.unref();
      client.on('disconnect', () => clearTimeout(expiry));
      if (current.organizationId && ['SUPER_ADMIN', 'BROKER_ADMIN'].includes(current.role)) client.join(`org:${current.organizationId}`);
      if (current.role === 'SUPER_ADMIN') client.join('admins');
    } catch {
      client.disconnect(true);
    }
  }

  disconnectSession(sessionId: string) {
    this.server?.to(`session:${sessionId}`).emit('session.revoked', { reason: 'DEVICE_REVOKED' });
    this.server?.in(`session:${sessionId}`).disconnectSockets(true);
  }

  disconnectUser(userId: string) {
    this.server?.to(`user:${userId}`).emit('session.revoked', { reason: 'ACCOUNT_ACCESS_CHANGED' });
    this.server?.in(`user:${userId}`).disconnectSockets(true);
  }

  toUser(userId: string, event: string, data: unknown) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }
  toOrg(orgId: string, event: string, data: unknown) {
    this.server?.to(`org:${orgId}`).emit(event, data);
  }
  /** Agents never join an organization room. Deliver message bodies only to the current assignee. */
  async toConversation(orgId: string, conversationId: string, event: string, data: unknown) {
    try {
      const conversation = await this.prisma.conversation.findFirst({
        where: { id: conversationId, organizationId: orgId },
        select: {
          lead: {
            select: {
              organizationId: true,
              deletedAt: true,
              assignedTo: { select: { id: true, organizationId: true, role: true, status: true, deletedAt: true } },
            },
          },
        },
      });
      if (!conversation) return;
      this.toOrg(orgId, event, data);
      const lead = conversation.lead;
      const agent = lead?.assignedTo;
      if (
        lead?.organizationId === orgId &&
        !lead.deletedAt &&
        agent?.organizationId === orgId &&
        agent.role === 'BROKER_AGENT' &&
        agent.status === 'ACTIVE' &&
        !agent.deletedAt
      ) {
        this.toUser(agent.id, event, data);
      }
    } catch {
      this.logger.warn('Conversation realtime delivery failed; clients can recover through authorized polling');
    }
  }
  toAdmins(event: string, data: unknown) {
    this.server?.to('admins').emit(event, data);
  }
}
