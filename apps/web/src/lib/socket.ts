import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    const base = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    socket = io(`${base}/ws`, {
      auth: { token },
      transports: ['polling', 'websocket'], // polling first so it works even if WS upgrade fails
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
