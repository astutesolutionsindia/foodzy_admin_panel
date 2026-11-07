import { io } from 'socket.io-client';

let socket;

export const initSocket = () => {
  const token = localStorage.getItem('adminToken');
  if (!socket) {
    socket = io('https://foodzy-backend-dmp6.onrender.com', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
  } else {
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }
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
