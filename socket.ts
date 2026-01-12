import { io, Socket } from 'socket.io-client';

// Use localhost for development, or window.location for production deployment
const URL = 'http://localhost:3000';

class SocketService {
  public socket: Socket | null = null;

  connect() {
    if (!this.socket) {
      this.socket = io(URL, {
        autoConnect: false,
        transports: ['websocket']
      });
    }
    if (!this.socket.connected) {
        this.socket.connect();
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  getSocket() {
      return this.socket;
  }
}

export const socketService = new SocketService();