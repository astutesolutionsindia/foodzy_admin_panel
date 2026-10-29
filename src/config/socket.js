import { io } from 'socket.io-client';

let socket;

export const initSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('adminToken');
    socket = io('https://foodzy-backend-dmp6.onrender.com', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};