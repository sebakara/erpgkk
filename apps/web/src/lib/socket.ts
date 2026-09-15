import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

let socket: Socket | null = null;
let socketToken = '';

function currentToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('access_token') || useAuthStore.getState().token || '';
}

function socketBase() {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
}

export function getSocket(): Socket {
  const token = currentToken();
  if (socket && socketToken !== token) {
    socket.disconnect();
    socket = null;
  }
  if (!socket) {
    socketToken = token;
    socket = io(`${socketBase()}/ws`, {
      path: '/api/socket.io',
      auth: { token },
      transports: ['polling', 'websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 400,
      reconnectionAttempts: Infinity,
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = '';
  }
}
