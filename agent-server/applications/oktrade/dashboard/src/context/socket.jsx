import { io } from "socket.io-client";
import { createContext, useContext, useState } from "react";
import { getHost } from '@/lib/utils';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {

  const [socket, setSocket] = useState(null);
  const [error, setError] = useState(null);
  const [reason, setReason] = useState(null);

  const connectToSocket = () => {
    const socket = io(`${getHost()}/public`);
    socket.secure = false;
    socket.on('connect', () => {
      console.log('public socket connected!');
      setSocket(socket);
      setError(null);
      setReason(null);
    });
    socket.on('connect_error', (error) => {
      console.log('public socket connection error!')
      setSocket(null);
      setError(error);
      setReason(null);
    })
    socket.on('disconnect', (reason) => {
      console.log('public socket disconnected!');
      setSocket(null);
      setError(null);
      setReason(null);
    })
    socket.on('data', data => {
      console.log('public streaming data: ', data);
    })
  }

  return (
    <SocketContext.Provider
      value={{
        socket,
        connectToSocket,
        error,
        reason
      }}
    >
      { children }
    </SocketContext.Provider>
  )
}

export const useSocket = () => {
  return useContext(SocketContext);
}