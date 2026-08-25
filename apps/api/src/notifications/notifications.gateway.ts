import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/ws' })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private userSockets = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      const payload = this.jwtService.verify(token, { secret: this.configService.get('JWT_SECRET') });
      client.data.userId = payload.sub;
      client.join(`user:${payload.sub}`);
      const wasOffline = !this.userSockets.get(payload.sub)?.size;
      if (!this.userSockets.has(payload.sub)) this.userSockets.set(payload.sub, new Set());
      this.userSockets.get(payload.sub).add(client.id);
      if (wasOffline) this.server.emit('presence:online', { userId: payload.sub });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;
    this.userSockets.get(userId)?.delete(client.id);
    if (!this.userSockets.get(userId)?.size) {
      this.userSockets.delete(userId);
      this.server.emit('presence:offline', { userId });
    }
  }

  getOnlineUserIds(): string[] {
    return [...this.userSockets.keys()].filter((id) => (this.userSockets.get(id)?.size ?? 0) > 0);
  }

  emitToUsers(userIds: string[], event: string, data: any) {
    for (const id of [...new Set(userIds)]) {
      this.server.to(`user:${id}`).emit(event, data);
    }
  }

  async pushToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  async notifyUser(userId: string, payload: { type: string; title: string; body?: string; data?: any }) {
    const notif = await this.notificationsService.create(userId, payload);
    this.pushToUser(userId, 'notification', notif);
    return notif;
  }

  @SubscribeMessage('mark-read')
  async onMarkRead(@ConnectedSocket() client: Socket, @MessageBody() data: { id: string }) {
    await this.notificationsService.markRead(data.id, client.data.userId);
  }

  @SubscribeMessage('join-project')
  onJoinProject(@ConnectedSocket() client: Socket, @MessageBody() data: { projectId: string }) {
    client.join(`project:${data.projectId}`);
  }

  @SubscribeMessage('leave-project')
  onLeaveProject(@ConnectedSocket() client: Socket, @MessageBody() data: { projectId: string }) {
    client.leave(`project:${data.projectId}`);
  }

  @SubscribeMessage('chat:join')
  onChatJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { convId: string }) {
    if (data?.convId) client.join(`chat:${data.convId}`);
  }

  @SubscribeMessage('chat:leave')
  onChatLeave(@ConnectedSocket() client: Socket, @MessageBody() data: { convId: string }) {
    if (data?.convId) client.leave(`chat:${data.convId}`);
  }

  @SubscribeMessage('chat:typing')
  onChatTyping(@ConnectedSocket() client: Socket, @MessageBody() data: { convId: string }) {
    if (!data?.convId || !client.data.userId) return;
    client.to(`chat:${data.convId}`).emit('chat:typing', {
      convId: data.convId,
      userId: client.data.userId,
    });
  }

  broadcastToProject(projectId: string, event: string, data: any) {
    this.server.to(`project:${projectId}`).emit(event, data);
  }
}
